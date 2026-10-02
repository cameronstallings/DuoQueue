-- Checks for supabase/migrations/0070_party_invites_cap_and_pushes.sql.
--
-- Plain script, not pgTAP (see supabase/checks/0069_league_rank_duo.sql for why it lives in
-- supabase/checks/): plpgsql `assert` inside `do` blocks, one transaction, rolled back at the
-- end, nothing left behind.
--
-- HOW TO RUN IT
--
--   After 0070 is committed, run this file alone:
--     powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0070_party_invites_cap_and_pushes.sql
--
--   Before 0070 is committed, run it TOGETHER with the migration in one rolled-back
--   transaction: a scratch file holding `begin;`, the migration, this file's body (everything
--   between its first `begin;` line and its last `rollback;` line), then `rollback;`.
--
--   A failing check raises (assert_failure, or the named exception) and the run prints
--   "QUERY FAILED" with the message; nothing is committed either way. A passing run prints
--   the log the last statement selects, one line per section. The Management API returns
--   only the last result set, which is why the log is a table.
--
-- WHO IT ACTS AS. Real accounts read from the database, never hard-coded and never printed:
-- the App Review account (review@duoqueue.io), the demo persona it has an active match with
-- (Priya today), and six other demo personas taken from that party's own deck. Each RPC is
-- called the way the app calls it: `set local role authenticated` plus request.jwt.claims
-- carrying that account's id, so auth.uid(), the grants and RLS are all the real ones.
--
-- NO PUSH IS SENT. The triggers call notify_via_edge_function, whose only side effect is
-- net.http_post, which inserts a row into net.http_request_queue (section 0 asserts both
-- from the live source). The pg_net worker only sees committed rows, and this transaction
-- rolls back, so every request it queues is discarded unsent. That same queue is how the
-- checks below read the exact payload each trigger would have sent.
--
-- WHAT IT TOUCHES (all rolled back): every party whose members are exactly the review
-- account and its matched persona (deleted and rebuilt), the new party's swipes, invites,
-- members and one party message, invites for the six personas, a second scratch party for
-- the sweep, and rate_limit_hits rows for the accounts it acts as. Run it at a quiet hour
-- when chained with the migration, since the migration's trigger DDL locks party_invites
-- and party_messages until the rollback.

begin;

set local lock_timeout = '5s';

create temp table check_log (n serial primary key, line text not null);
create temp table chk_ids (role text primary key, id uuid not null);
create temp table chk_base (queue_id bigint not null);
create temp table deck_rows (run text not null, profile_id uuid not null);
grant select on chk_ids to authenticated;
grant insert, select on deck_rows to authenticated;

-- A plpgsql assert is a no-op when plpgsql.check_asserts is off, and then every check below
-- would pass without checking anything. Refuse to run in that state.
do $$
begin
  begin
    assert false, 'probe';
    raise exception 'plpgsql.check_asserts is off: every assert in this file would pass silently';
  exception when assert_failure then
    null;
  end;
end;
$$;

-- Act as one of the accounts in chk_ids, exactly as PostgREST would for that user's JWT.
create function pg_temp.act_as(p_who text) returns void
language plpgsql as $f$
declare
  v_id uuid;
begin
  select c.id into strict v_id from chk_ids c where c.role = p_who;
  perform set_config('request.jwt.claims', json_build_object('sub', v_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$f$;

create function pg_temp.id(p_who text) returns uuid
language sql stable as $f$
  select c.id from chk_ids c where c.role = p_who
$f$;

-- Push payloads this transaction queued for one party (read as postgres).
create function pg_temp.events(p_type text, p_party uuid) returns setof jsonb
language sql stable as $f$
  select e.body
  from (
    select convert_from(q.body, 'UTF8')::jsonb as body
    from net.http_request_queue q
    where q.id > (select b.queue_id from chk_base b)
      and q.method = 'POST'
      and q.body is not null
      and q.url like '%/send-push-notification'
  ) e
  where e.body->>'type' = p_type and e.body->>'partyId' = p_party::text
$f$;

-- Parties whose current membership is exactly {rev, priya}.
create function pg_temp.pair_parties() returns setof uuid
language sql stable as $f$
  select pa.id
  from public.parties pa
  where exists (select 1 from public.party_members pm where pm.party_id = pa.id and pm.profile_id = pg_temp.id('rev'))
    and exists (select 1 from public.party_members pm where pm.party_id = pa.id and pm.profile_id = pg_temp.id('priya'))
    and (select count(*) from public.party_members pm where pm.party_id = pa.id) = 2
$f$;

-- ===========================================================================
-- 0. Setup, and why nothing here can send a push
-- ===========================================================================

do $$
declare
  v_rev uuid;
  v_partner uuid;
  v_match uuid;
  v_notify text;
  v_post text;
begin
  select pg_get_functiondef('public.notify_via_edge_function(jsonb)'::regprocedure) into v_notify;
  assert position('net.http_post' in v_notify) > 0,
    '0: notify_via_edge_function no longer goes through net.http_post; re-check that a rollback discards its requests';
  select p.prosrc into v_post
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'net' and p.proname = 'http_post'
   limit 1;
  assert position('insert into net.http_request_queue' in v_post) > 0,
    '0: net.http_post no longer just enqueues; re-check that a rollback discards its requests';

  select u.id into v_rev from auth.users u where u.email = 'review@duoqueue.io';
  if v_rev is null then
    raise exception '0: review@duoqueue.io not found';
  end if;

  select m.id, p.id into v_match, v_partner
    from public.matches m
    join public.profiles p on p.id = case when m.user_a_id = v_rev then m.user_b_id else m.user_a_id end
   where v_rev in (m.user_a_id, m.user_b_id)
     and m.unmatched_at is null
     and p.is_demo and not p.is_banned
   order by (p.display_name = 'Priya') desc, m.matched_at
   limit 1;
  if v_match is null then
    raise exception '0: the review account has no active match with a demo persona';
  end if;
  assert public.same_age_band(v_rev, v_partner), '0: the review account and its partner are in different age groups';

  insert into chk_ids values ('rev', v_rev), ('priya', v_partner), ('match', v_match);
  insert into chk_base select coalesce(max(q.id), 0) from net.http_request_queue q;

  insert into check_log (line)
    values ('0 ok: notify_via_edge_function -> net.http_post -> insert into net.http_request_queue; this transaction rolls back, so nothing queued here is ever sent');
end;
$$;

-- Census on the live data: no pending invite sits in a full party (0070's one-off and the
-- accept path keep it that way).
do $$
declare
  v_full_pending int;
  v_expired_pending int;
begin
  select count(*) into v_full_pending
    from public.party_invites pi
   where pi.status = 'pending'
     and (select count(*) from public.party_members pm where pm.party_id = pi.party_id) >= 3;
  assert v_full_pending = 0, format('census: %s pending invites sit in full parties', v_full_pending);

  select count(*) into v_expired_pending
    from public.party_invites pi
   where pi.status = 'pending' and pi.created_at <= now() - interval '7 days';

  insert into check_log (line)
    values (format('census ok: 0 pending invites in full parties; %s pending past 7 days awaiting the daily sweep', v_expired_pending));
end;
$$;

-- ===========================================================================
-- B. create_party: one party per duo, whoever taps
-- ===========================================================================

-- B1. A party the review account created is reused when PARTNER taps (0044 made a second one).
do $$
declare
  v_rev uuid := pg_temp.id('rev');
  v_priya uuid := pg_temp.id('priya');
  v_match uuid := pg_temp.id('match');
  v_x uuid;
  v_got uuid;
  v_got2 uuid;
begin
  delete from public.parties where id in (select pg_temp.pair_parties());
  insert into public.parties (created_by) values (v_rev) returning id into v_x;
  insert into public.party_members (party_id, profile_id) values (v_x, v_rev), (v_x, v_priya);

  perform pg_temp.act_as('priya');
  v_got := public.create_party(v_match);
  perform pg_temp.act_as('rev');
  v_got2 := public.create_party(v_match);
  reset role;

  assert v_got = v_x, 'B1: the partner tapping got a new party instead of the one the review account created';
  assert v_got2 = v_x, 'B1: the creator tapping again got a different party';
  assert (select count(*) from pg_temp.pair_parties()) = 1, 'B1: more than one party holds exactly this duo';
  assert (select count(*) from pg_temp.events('party_started', v_x)) = 0, 'B1: a reused party sent party_started';

  insert into check_log (line) values ('B1 ok: party made by the review account is reused when the partner taps and when the creator taps again; no party_started for a reuse');
end;
$$;

-- B2. No party yet: the first tap creates one and pushes party_started to the partner; every
-- later tap, from either side, gets the same party and no second push.
do $$
declare
  v_rev uuid := pg_temp.id('rev');
  v_priya uuid := pg_temp.id('priya');
  v_match uuid := pg_temp.id('match');
  v_n uuid;
  v_n2 uuid;
  v_n3 uuid;
  v_ev jsonb;
  v_src text;
begin
  delete from public.parties where id in (select pg_temp.pair_parties());

  perform pg_temp.act_as('priya');
  v_n := public.create_party(v_match);
  perform pg_temp.act_as('rev');
  v_n2 := public.create_party(v_match);
  perform pg_temp.act_as('priya');
  v_n3 := public.create_party(v_match);
  reset role;

  assert v_n is not null and v_n = v_n2 and v_n = v_n3, 'B2: the two members ended up in different parties';
  assert (select pa.created_by from public.parties pa where pa.id = v_n) = v_priya, 'B2: created_by is not the first tapper';
  assert (select count(*) from public.party_members pm where pm.party_id = v_n) = 2, 'B2: the new party does not have 2 members';
  assert (select count(*) from pg_temp.pair_parties()) = 1, 'B2: more than one party holds exactly this duo';

  assert (select count(*) from pg_temp.events('party_started', v_n)) = 1, 'B2: expected exactly one party_started';
  select e into v_ev from pg_temp.events('party_started', v_n) e;
  assert v_ev ?& array['type', 'partyId', 'creatorId', 'partnerId'] and (select count(*) from jsonb_object_keys(v_ev)) = 4,
    format('B2: party_started keys are %s', (select array_agg(k) from jsonb_object_keys(v_ev) k));
  assert v_ev->>'creatorId' = v_priya::text and v_ev->>'partnerId' = v_rev::text, 'B2: party_started has the wrong creator or partner';

  select pg_get_functiondef('public.create_party(uuid)'::regprocedure) into v_src;
  assert position('pg_advisory_xact_lock' in v_src) > 0, 'B2: create_party takes no advisory lock on the pair';

  insert into chk_ids values ('party', v_n);
  insert into check_log (line) values ('B2 ok: first tap creates the party (one party_started, to the partner, keys type/partyId/creatorId/partnerId); 2 more taps from both sides reuse it; pair lock present');
end;
$$;

-- ===========================================================================
-- C. perform_party_swipe: invited only on a real insert
-- ===========================================================================

-- The party's own deck, as the review account. Six demo personas from it are the targets.
do $$
begin
  perform pg_temp.act_as('rev');
  insert into deck_rows (run, profile_id) select 'a', g.profile_id from public.get_party_deck(pg_temp.id('party'), 50) g;
  reset role;
end;
$$;

do $$
declare
  v_count int;
  v_blocks int;
begin
  select count(*) into v_count from deck_rows where run = 'a';
  if v_count >= 50 then
    raise exception 'pool larger than the limit: the deck comparisons in section D are not valid';
  end if;

  insert into chk_ids (role, id)
  select 'c' || x.rn, x.id
    from (
      select p.id, row_number() over (order by p.display_name, p.id) as rn
        from (select distinct d.profile_id from deck_rows d where d.run = 'a') d
        join public.profiles p on p.id = d.profile_id
       where p.is_demo
    ) x
   where x.rn <= 6;
  select count(*) into v_count from chk_ids where role like 'c_';
  assert v_count = 6, format('C: only %s demo personas in the party deck, need 6', v_count);

  select count(*) into v_blocks
    from public.blocks b
   where b.blocker_id in (select id from chk_ids where role in ('rev', 'priya', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6'))
     and b.blocked_id in (select id from chk_ids where role in ('rev', 'priya', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6'));
  assert v_blocks = 0, format('C: %s blocks among the accounts this check uses', v_blocks);

  insert into check_log (line)
    values (format('C setup ok: party deck has %s cards; targets are 6 demo personas from it', (select count(*) from deck_rows where run = 'a')));
end;
$$;

-- C1. One like of two: no invite. Second like: invited = true and exactly one invite row and
-- one party_invite push. C2. Liking again from either side: invited = false, nothing new.
do $$
declare
  v_party uuid := pg_temp.id('party');
  v_c1 uuid := pg_temp.id('c1');
  v_r boolean;
  v_inv uuid;
  v_ev jsonb;
begin
  perform pg_temp.act_as('rev');
  select s.invited into v_r from public.perform_party_swipe(v_party, v_c1, 'like') s;
  reset role;
  assert v_r is false, 'C1: invited after one of two members liked';
  assert not exists (select 1 from public.party_invites pi where pi.party_id = v_party and pi.target_id = v_c1),
    'C1: an invite row exists after one of two likes';

  perform pg_temp.act_as('priya');
  select s.invited into v_r from public.perform_party_swipe(v_party, v_c1, 'like') s;
  reset role;
  assert v_r is true, 'C1: both members liked and invited is not true';

  select pi.id into v_inv from public.party_invites pi
   where pi.party_id = v_party and pi.target_id = v_c1 and pi.status = 'pending';
  assert v_inv is not null, 'C1: no pending invite row after both likes';

  assert (select count(*) from pg_temp.events('party_invite', v_party) e where e->>'targetId' = v_c1::text) = 1,
    'C1: expected exactly one party_invite push';
  select e into v_ev from pg_temp.events('party_invite', v_party) e where e->>'targetId' = v_c1::text;
  assert v_ev ?& array['type', 'partyId', 'inviteId', 'targetId'] and (select count(*) from jsonb_object_keys(v_ev)) = 4,
    format('C1: party_invite keys are %s', (select array_agg(k) from jsonb_object_keys(v_ev) k));
  assert v_ev->>'inviteId' = v_inv::text, 'C1: party_invite carries the wrong inviteId';

  perform pg_temp.act_as('priya');
  select s.invited into v_r from public.perform_party_swipe(v_party, v_c1, 'like') s;
  assert v_r is false, 'C2: a repeat like by the second member returned invited = true';
  perform pg_temp.act_as('rev');
  select s.invited into v_r from public.perform_party_swipe(v_party, v_c1, 'like') s;
  reset role;
  assert v_r is false, 'C2: a repeat like by the first member returned invited = true';

  assert (select count(*) from public.party_invites pi where pi.party_id = v_party and pi.target_id = v_c1) = 1,
    'C2: repeat likes created a second invite row';
  assert (select count(*) from pg_temp.events('party_invite', v_party) e where e->>'targetId' = v_c1::text) = 1,
    'C2: repeat likes queued a second party_invite push';

  insert into chk_ids values ('inv_c1', v_inv);
  insert into check_log (line) values ('C1 ok: 1 of 2 likes -> false; 2 of 2 -> true, 1 pending row, 1 party_invite push (type/partyId/inviteId/targetId). C2 ok: repeat likes from both -> false, still 1 row, 1 push');
end;
$$;

-- C3. Someone who already has an invite row in ANY status is never re-invited: c2 holds an
-- expired pending invite, c5 a declined one. Both members like both: invited = false, no
-- new row, no status change.
do $$
declare
  v_party uuid := pg_temp.id('party');
  v_c2 uuid := pg_temp.id('c2');
  v_c5 uuid := pg_temp.id('c5');
  v_inv2 uuid;
  v_inv5 uuid;
  v_r boolean;
  v_any_true boolean := false;
begin
  insert into public.party_invites (party_id, target_id, status, created_at)
  values (v_party, v_c2, 'pending', now() - interval '8 days') returning id into v_inv2;
  insert into public.party_invites (party_id, target_id, status)
  values (v_party, v_c5, 'declined') returning id into v_inv5;

  perform pg_temp.act_as('rev');
  select s.invited into v_r from public.perform_party_swipe(v_party, v_c2, 'like') s; v_any_true := v_any_true or v_r;
  select s.invited into v_r from public.perform_party_swipe(v_party, v_c5, 'like') s; v_any_true := v_any_true or v_r;
  perform pg_temp.act_as('priya');
  select s.invited into v_r from public.perform_party_swipe(v_party, v_c2, 'like') s; v_any_true := v_any_true or v_r;
  select s.invited into v_r from public.perform_party_swipe(v_party, v_c5, 'like') s; v_any_true := v_any_true or v_r;
  reset role;

  assert not v_any_true, 'C3: a like on someone already invited returned invited = true';
  assert (select count(*) from public.party_invites pi where pi.party_id = v_party and pi.target_id in (v_c2, v_c5)) = 2,
    'C3: a second invite row appeared for an already-invited person';
  assert (select pi.status from public.party_invites pi where pi.id = v_inv2) = 'pending'
     and (select pi.status from public.party_invites pi where pi.id = v_inv5) = 'declined',
    'C3: re-liking changed an existing invite''s status';

  insert into chk_ids values ('inv_c2', v_inv2), ('inv_c5', v_inv5);
  insert into check_log (line) values ('C3 ok: both members liking someone with an expired-pending or declined invite -> false x4, no new row, statuses unchanged');
end;
$$;

-- ===========================================================================
-- D. get_party_deck excludes everyone with an invite row
-- ===========================================================================
--
-- The review account's own swipes on c1, c2 and c5 are removed first, so the only thing
-- keeping them out of the deck is their invite (pending, expired-pending, declined).

do $$
begin
  delete from public.party_swipes ps
   where ps.party_id = pg_temp.id('party')
     and ps.member_id = pg_temp.id('rev')
     and ps.target_id in (pg_temp.id('c1'), pg_temp.id('c2'), pg_temp.id('c5'));
end;
$$;

do $$
begin
  perform pg_temp.act_as('rev');
  insert into deck_rows (run, profile_id) select 'b', g.profile_id from public.get_party_deck(pg_temp.id('party'), 50) g;
  reset role;
end;
$$;

do $$
begin
  assert not exists (
    select 1 from deck_rows d
     where d.run = 'b' and d.profile_id in (pg_temp.id('c1'), pg_temp.id('c2'), pg_temp.id('c5'))
  ), 'D: an invited person (pending, expired or declined) is still in the party deck';
  assert (select count(*) from deck_rows d
           where d.run = 'b' and d.profile_id in (pg_temp.id('c3'), pg_temp.id('c4'), pg_temp.id('c6'))) = 3,
    'D: an uninvited, unswiped persona dropped out of the deck';
  insert into check_log (line)
    values (format('D ok: deck went from %s to %s cards; the 3 invited personas are out (no swipe of theirs left), the 3 uninvited are in',
                   (select count(*) from deck_rows where run = 'a'), (select count(*) from deck_rows where run = 'b')));
end;
$$;

-- ===========================================================================
-- E/F/G/H. Invites list, accept refusals, accept declines the rest
-- ===========================================================================

-- E. get_my_party_invites hides the expired invite and shows the live one.
do $$
declare
  v_party uuid := pg_temp.id('party');
  v_c2_rows int;
  v_c1_rows int;
  v_c1_inv uuid;
begin
  perform pg_temp.act_as('c2');
  select count(*) into v_c2_rows from public.get_my_party_invites() i where i.party_id = v_party;
  perform pg_temp.act_as('c1');
  select count(*), max(i.invite_id::text)::uuid into v_c1_rows, v_c1_inv from public.get_my_party_invites() i where i.party_id = v_party;
  reset role;

  assert v_c2_rows = 0, 'E: an invite older than 7 days is still listed';
  assert v_c1_rows = 1 and v_c1_inv = pg_temp.id('inv_c1'), 'E: the live invite is not listed for its target';
  insert into check_log (line) values ('E ok: get_my_party_invites lists the live invite and hides the 8-day-old one');
end;
$$;

-- F. Accepting the expired invite is refused with the readable sentence; nobody joins.
do $$
declare
  v_party uuid := pg_temp.id('party');
  v_msg text;
  v_detail text;
begin
  perform pg_temp.act_as('c2');
  begin
    perform public.respond_party_invite(pg_temp.id('inv_c2'), true);
    v_msg := 'accepted';
  exception when raise_exception then
    get stacked diagnostics v_msg = message_text, v_detail = pg_exception_detail;
  end;
  reset role;

  assert v_msg = 'This party invite expired. Invites last 7 days.',
    format('F: accepting an expired invite gave %L', v_msg);
  assert v_detail = 'party_invite_expired', format('F: detail %L', v_detail);
  assert not public.is_party_member(v_party, pg_temp.id('c2')), 'F: the expired invitee joined anyway';
  assert (select count(*) from public.party_members pm where pm.party_id = v_party) = 2, 'F: member count changed';
  insert into check_log (line) values (format('F ok: expired accept refused: %L (detail party_invite_expired); party still 2', v_msg));
end;
$$;

-- G. A second live invite (c3), then c1 accepts: c1 joins, c1's invite is accepted, every
-- other pending invite of the party is declined, and party_joined is pushed once.
do $$
declare
  v_inv3 uuid;
begin
  insert into public.party_invites (party_id, target_id) values (pg_temp.id('party'), pg_temp.id('c3'))
  returning id into v_inv3;
  insert into chk_ids values ('inv_c3', v_inv3);
end;
$$;

do $$
declare
  v_party uuid := pg_temp.id('party');
  v_ev jsonb;
begin
  perform pg_temp.act_as('c1');
  perform public.respond_party_invite(pg_temp.id('inv_c1'), true);
  reset role;

  assert public.is_party_member(v_party, pg_temp.id('c1')), 'G: c1 is not a member after accepting';
  assert (select count(*) from public.party_members pm where pm.party_id = v_party) = 3, 'G: the party does not have 3 members';
  assert (select pi.status from public.party_invites pi where pi.id = pg_temp.id('inv_c1')) = 'accepted', 'G: c1''s invite is not accepted';
  assert (select pi.status from public.party_invites pi where pi.id = pg_temp.id('inv_c3')) = 'declined', 'G: c3''s pending invite was not declined';
  assert (select pi.status from public.party_invites pi where pi.id = pg_temp.id('inv_c2')) = 'declined', 'G: c2''s pending invite was not declined';
  assert not exists (select 1 from public.party_invites pi where pi.party_id = v_party and pi.status = 'pending'),
    'G: a pending invite survived the party filling';

  assert (select count(*) from pg_temp.events('party_joined', v_party)) = 1, 'G: expected exactly one party_joined';
  select e into v_ev from pg_temp.events('party_joined', v_party) e;
  assert v_ev ?& array['type', 'partyId', 'joinerId'] and (select count(*) from jsonb_object_keys(v_ev)) = 3,
    format('G: party_joined keys are %s', (select array_agg(k) from jsonb_object_keys(v_ev) k));
  assert v_ev->>'joinerId' = pg_temp.id('c1')::text, 'G: party_joined names the wrong joiner';

  insert into check_log (line) values ('G ok: accept -> 3 members, invite accepted, the 2 other pending invites declined, 1 party_joined push (type/partyId/joinerId) and none for the declines');
end;
$$;

-- H. Full party: c3's stale card (declined when the party filled) and c4's pending invite
-- (planted the way legacy data looked) are both refused as full; nobody joins.
do $$
declare
  v_inv4 uuid;
begin
  insert into public.party_invites (party_id, target_id) values (pg_temp.id('party'), pg_temp.id('c4'))
  returning id into v_inv4;
  insert into chk_ids values ('inv_c4', v_inv4);
end;
$$;

do $$
declare
  v_party uuid := pg_temp.id('party');
  v_msg3 text;
  v_msg4 text;
  v_detail4 text;
  v_rows4 int;
begin
  perform pg_temp.act_as('c3');
  begin
    perform public.respond_party_invite(pg_temp.id('inv_c3'), true);
    v_msg3 := 'accepted';
  exception when raise_exception then
    get stacked diagnostics v_msg3 = message_text;
  end;

  perform pg_temp.act_as('c4');
  select count(*) into v_rows4 from public.get_my_party_invites() i where i.party_id = v_party;
  begin
    perform public.respond_party_invite(pg_temp.id('inv_c4'), true);
    v_msg4 := 'accepted';
  exception when raise_exception then
    get stacked diagnostics v_msg4 = message_text, v_detail4 = pg_exception_detail;
  end;
  reset role;

  assert v_msg3 = 'This party is already full. Parties hold 3 players.', format('H: stale card accept gave %L', v_msg3);
  assert v_msg4 = 'This party is already full. Parties hold 3 players.', format('H: full-party accept gave %L', v_msg4);
  assert v_detail4 = 'party_full', format('H: detail %L', v_detail4);
  assert v_rows4 = 0, 'H: get_my_party_invites lists an invite into a full party';
  assert (select count(*) from public.party_members pm where pm.party_id = v_party) = 3, 'H: a fourth member got in';
  insert into check_log (line) values (format('H ok: full accept refused for a pending and a stale invite: %L (detail party_full); invite hidden from the list; still 3', v_msg4));
end;
$$;

-- ===========================================================================
-- I/J. A full party makes no invites and deals no cards
-- ===========================================================================

do $$
declare
  v_party uuid := pg_temp.id('party');
  v_c6 uuid := pg_temp.id('c6');
  v_r boolean;
  v_any_true boolean := false;
  v_rev_cards int;
  v_c1_cards int;
begin
  perform pg_temp.act_as('rev');
  select s.invited into v_r from public.perform_party_swipe(v_party, v_c6, 'like') s; v_any_true := v_any_true or v_r;
  perform pg_temp.act_as('priya');
  select s.invited into v_r from public.perform_party_swipe(v_party, v_c6, 'like') s; v_any_true := v_any_true or v_r;
  perform pg_temp.act_as('c1');
  select s.invited into v_r from public.perform_party_swipe(v_party, v_c6, 'like') s; v_any_true := v_any_true or v_r;

  perform pg_temp.act_as('rev');
  select count(*) into v_rev_cards from public.get_party_deck(v_party, 50);
  perform pg_temp.act_as('c1');
  select count(*) into v_c1_cards from public.get_party_deck(v_party, 50);
  reset role;

  assert not v_any_true, 'I: all 3 members liked someone and invited came back true';
  assert not exists (select 1 from public.party_invites pi where pi.party_id = v_party and pi.target_id = v_c6),
    'I: an invite row was created in a full party';
  assert (select count(*) from public.party_swipes ps where ps.party_id = v_party and ps.target_id = v_c6 and ps.action = 'like') = 3,
    'I: the likes themselves were not recorded';
  assert v_rev_cards = 0 and v_c1_cards = 0, format('J: a full party''s deck has %s / %s cards', v_rev_cards, v_c1_cards);
  insert into check_log (line) values ('I ok: 3 of 3 likes in a full party -> false, swipes recorded, no invite row. J ok: full party deck is empty for an original member and the joiner');
end;
$$;

-- ===========================================================================
-- K. party_message push
-- ===========================================================================

do $$
declare
  v_party uuid := pg_temp.id('party');
  v_row public.party_messages;
  v_ev jsonb;
begin
  perform pg_temp.act_as('rev');
  v_row := public.send_party_message(v_party, '0070 check');
  reset role;

  assert (select count(*) from pg_temp.events('party_message', v_party)) = 1, 'K: expected exactly one party_message push';
  select e into v_ev from pg_temp.events('party_message', v_party) e;
  assert v_ev ?& array['type', 'partyId', 'messageId', 'senderId'] and (select count(*) from jsonb_object_keys(v_ev)) = 4,
    format('K: party_message keys are %s', (select array_agg(k) from jsonb_object_keys(v_ev) k));
  assert v_ev->>'messageId' = v_row.id::text and v_ev->>'senderId' = pg_temp.id('rev')::text,
    'K: party_message carries the wrong message or sender';
  insert into check_log (line) values ('K ok: a party message queues 1 party_message push (type/partyId/messageId/senderId)');
end;
$$;

-- ===========================================================================
-- L. The sweep, and its schedule
-- ===========================================================================

do $$
declare
  v_m uuid;
  v_m_old uuid;
  v_m_new uuid;
  v_declined int;
begin
  -- A second, 2-member party holding one 8-day-old and one fresh pending invite.
  insert into public.parties (created_by) values (pg_temp.id('rev')) returning id into v_m;
  insert into public.party_members (party_id, profile_id) values (v_m, pg_temp.id('rev')), (v_m, pg_temp.id('priya'));
  insert into public.party_invites (party_id, target_id, created_at)
  values (v_m, pg_temp.id('c3'), now() - interval '8 days') returning id into v_m_old;
  insert into public.party_invites (party_id, target_id)
  values (v_m, pg_temp.id('c4')) returning id into v_m_new;

  v_declined := public.decline_stale_party_invites();

  assert (select pi.status from public.party_invites pi where pi.id = pg_temp.id('inv_c4')) = 'declined',
    'L: the sweep left a pending invite in a full party';
  assert (select pi.status from public.party_invites pi where pi.id = v_m_old) = 'declined',
    'L: the sweep left an 8-day-old pending invite';
  assert (select pi.status from public.party_invites pi where pi.id = v_m_new) = 'pending',
    'L: the sweep declined a fresh invite in a party with room';
  assert v_declined >= 2, format('L: the sweep reported %s declines', v_declined);

  assert (select count(*) from cron.job j
           where j.jobname = 'party-invites-expire-daily' and j.schedule = '25 9 * * *' and j.active
             and position('decline_stale_party_invites' in j.command) > 0) = 1,
    'L: party-invites-expire-daily is missing, duplicated or not daily';

  insert into check_log (line) values (format('L ok: sweep declined %s (full-party pending + 8-day-old pending), kept the fresh one; cron party-invites-expire-daily at 25 9 * * *', v_declined));
end;
$$;

-- ===========================================================================
-- M. Grants and triggers
-- ===========================================================================

do $$
declare
  v_fn text;
  v_acl text[];
  v_role text;
begin
  -- The app's RPCs: exactly the pre-0070 ACL, i.e. authenticated may call, anon may not.
  foreach v_fn in array array[
    'public.create_party(uuid)',
    'public.perform_party_swipe(uuid,uuid,swipe_action_enum)',
    'public.respond_party_invite(uuid,boolean)',
    'public.get_party_deck(uuid,integer)',
    'public.get_my_party_invites()'
  ] loop
    select array_agg(a::text order by a::text) into v_acl
      from pg_proc p cross join lateral unnest(p.proacl) a
     where p.oid = v_fn::regprocedure;
    assert v_acl = array['authenticated=X/postgres', 'postgres=X/postgres', 'service_role=X/postgres'],
      format('M: %s ACL is %s', v_fn, v_acl);
    assert not has_function_privilege('anon', v_fn, 'execute'), format('M: anon can execute %s', v_fn);
    assert has_function_privilege('authenticated', v_fn, 'execute'), format('M: authenticated cannot execute %s', v_fn);
  end loop;

  -- Server-only: the sweep and the three trigger functions.
  foreach v_fn in array array[
    'public.decline_stale_party_invites()',
    'public.notify_party_invite()',
    'public.notify_party_joined()',
    'public.notify_party_message()'
  ] loop
    foreach v_role in array array['anon', 'authenticated'] loop
      assert not has_function_privilege(v_role, v_fn, 'execute'), format('M: %s can execute %s', v_role, v_fn);
    end loop;
  end loop;

  assert (select count(*) from pg_trigger t
           where not t.tgisinternal
             and t.tgname in ('on_party_invite_created', 'on_party_invite_accepted', 'on_party_message_created')) = 3,
    'M: a party push trigger is missing';
  assert position('pending' in (select pg_get_triggerdef(t.oid) from pg_trigger t where t.tgname = 'on_party_invite_accepted')) > 0
     and position('accepted' in (select pg_get_triggerdef(t.oid) from pg_trigger t where t.tgname = 'on_party_invite_accepted')) > 0,
    'M: on_party_invite_accepted is not limited to pending -> accepted';
end;
$$;

-- ...and by use: anon is refused (42501) by every party RPC.
do $$
declare
  v_refused int := 0;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
  begin perform public.get_my_party_invites(); exception when insufficient_privilege then v_refused := v_refused + 1; end;
  begin perform public.get_party_deck(gen_random_uuid(), 5); exception when insufficient_privilege then v_refused := v_refused + 1; end;
  begin perform public.create_party(gen_random_uuid()); exception when insufficient_privilege then v_refused := v_refused + 1; end;
  begin perform public.perform_party_swipe(gen_random_uuid(), gen_random_uuid(), 'like'); exception when insufficient_privilege then v_refused := v_refused + 1; end;
  begin perform public.respond_party_invite(gen_random_uuid(), true); exception when insufficient_privilege then v_refused := v_refused + 1; end;
  begin perform public.decline_stale_party_invites(); exception when insufficient_privilege then v_refused := v_refused + 1; end;
  reset role;
  assert v_refused = 6, format('M: anon was refused by only %s of 6 party functions', v_refused);
  insert into check_log (line) values ('M ok: 5 party RPCs ACL = authenticated + postgres + service_role; sweep and 3 trigger fns not callable by anon/authenticated; anon refused 6/6 by use; 3 push triggers present');
end;
$$;

-- What this run queued, all of it discarded by the rollback below. No payload carries a matchId.
do $$
declare
  v_total int;
begin
  select count(*) into v_total
    from net.http_request_queue q
   where q.id > (select b.queue_id from chk_base b)
     and q.method = 'POST' and q.body is not null
     and q.url like '%/send-push-notification'
     and convert_from(q.body, 'UTF8')::jsonb->>'type' like 'party\_%';
  assert not exists (
    select 1 from net.http_request_queue q
     where q.id > (select b.queue_id from chk_base b)
       and q.method = 'POST' and q.body is not null
       and q.url like '%/send-push-notification'
       and convert_from(q.body, 'UTF8')::jsonb->>'type' like 'party\_%'
       and convert_from(q.body, 'UTF8')::jsonb ? 'matchId'
  ), 'push: a party payload carries a matchId';
  insert into check_log (line) values (format('push ok: %s party push requests queued in this transaction, none with a matchId, all discarded unsent by the rollback', v_total));
end;
$$;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
