-- Checks for supabase/migrations/0088_one_duo_per_queue_up.sql.
--
-- Plain script: plpgsql `assert` in `do` blocks, one transaction, rolled back at the end.
--
-- HOW TO RUN IT
--   After 0088 is committed, alone:
--     powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0088_one_duo_per_queue_up.sql
--   Before: one scratch file holding 0088, then this file's body (everything between its first
--   `begin;` line and its last `rollback;` line), run through apply-migration.ps1 WITHOUT
--   -Commit (it wraps the whole file in begin/rollback). A failure raises and prints
--   "MIGRATION FAILED" with the message; a pass prints "DRY RUN OK". To read the log lines, run
--   the same scratch file wrapped in `begin;` ... `rollback;` through run-sql.ps1 -QueryFile.
--
-- NO PUSH IS SENT. notify_via_edge_function only inserts into net.http_request_queue; the
-- pg_net worker sees committed rows only, and this rolls back. That queue is how the checks
-- read the new_match payloads.
--
-- now() is the transaction's start time and does not move inside this file: every lock "pops
-- in" the 1-second floor, and every row ended here has ended_at = now().
--
-- Sub-tests that must not leave a trace run inside a plpgsql block that ends by raising
-- 'rollback_probe' and catching it: that rolls the block back while keeping the variables the
-- asserts read.
--
-- WHO: the fourteen seeded demo personas (@duoqueue.io, never the review account) made real
-- INSIDE this transaction, as 0085's check does. RPCs run as `authenticated` with
-- request.jwt.claims, the code lookups as `anon`. All rolled back.
--
--   s    the Duo Pop sender            r1   popped by s, queued itself, taps I'm in on s
--   r2   popped by s, too late          o1   popped by r1 (r1's pop must end)
--   ob   an observer reading Online Now
--   s2   the Duo Call sender            r3   popped by s2 (the post locks first)
--   n1   joins with s2's code first     n2   joins after the lock   n3   redeems after the lock
--   s3   a sender who passed on n4      n4   joins, no match, no lock   n5   joins, matches, locks
--   pv   redeems s3's PERMANENT code (1.0.1's path, unchanged)
--
-- Section F reuses r2, n3, o1, ob and r3 inside self-rolling-back probes (an older code in its
-- grace, unmatched and live matches, an answerer who already has a duo, a pre-0088 lock).
--
-- 0085's check, section H, asserts the old "at most 3 auto-matches per call" rule (three other
-- connected redemptions keep a fourth from the standing like). 0088 replaces that rule with
-- "until the first duo", so that one probe in 0085's check no longer holds once 0088 is applied.

begin;

set local lock_timeout = '5s';

create temp table check_log (n serial primary key, line text not null);
create temp table chk_ids (role text primary key, id uuid not null);
create temp table chk_base (queue_id bigint not null);
create temp table chk_q (label text primary key, queue_id uuid, code text, match_id uuid);
grant select on chk_ids, chk_q to authenticated, anon;

insert into chk_base select coalesce(max(id), 0) from net.http_request_queue;

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

create function pg_temp.act_as_anon() returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'anon', true);
end;
$f$;

create function pg_temp.id(p_who text) returns uuid
language sql stable as $f$
  select c.id from chk_ids c where c.role = p_who
$f$;

create function pg_temp.ids(p_who text[]) returns uuid[]
language sql stable as $f$
  select coalesce(array_agg(c.id order by c.id), '{}') from chk_ids c where c.role = any (p_who)
$f$;

create function pg_temp.sorted(p uuid[]) returns uuid[]
language sql immutable as $f$
  select coalesce(array_agg(x order by x), '{}') from unnest(p) x
$f$;

-- An IANA zone whose local hour is exactly p_hour right now.
create function pg_temp.zone_at(p_hour int) returns text
language sql stable as $f$
  select z.name from pg_timezone_names z
  where z.name ~ '^Etc/GMT[+-][0-9]+$'
    and extract(hour from now() at time zone z.name)::int = p_hour
  limit 1
$f$;

-- Push request bodies of one type queued in this transaction, only those about fixtures.
create function pg_temp.requests(p_type text) returns setof jsonb
language sql stable as $f$
  select e.body
  from (
    select q.id, convert_from(q.body, 'UTF8')::jsonb as body
    from net.http_request_queue q
    where q.id > (select b.queue_id from chk_base b)
      and q.method = 'POST'
      and q.body is not null
      and q.url like '%/send-push-notification'
  ) e
  where e.body->>'type' = p_type
    and (e.body->>'recipientId' is null or e.body->>'recipientId' in (select c.id::text from chk_ids c))
  order by e.id
$f$;

-- A live queue-up written directly (no fan-out): p_sender pops exactly p_recipients, with a
-- call code, and is free to duo for the hour, as start_queue_up leaves them.
create function pg_temp.live_pop(p_sender uuid, p_recipients uuid[]) returns uuid
language plpgsql as $f$
declare
  v_id uuid;
begin
  insert into public.queue_ups (sender_id, game_id, ping, created_at, pop_expires_at, looking_until, recipients, call_code)
  values (p_sender, public.lol_game_id(), true, now(), now() + interval '10 minutes', now() + interval '60 minutes',
          p_recipients, public.generate_call_code())
  returning id into v_id;
  update public.profiles
     set is_looking_now = true, looking_now_expires_at = now() + interval '60 minutes'
   where id = p_sender;
  return v_id;
end;
$f$;

-- ===========================================================================
-- A. Shape: the new column, the unchanged signatures and ACLs, and the lock order
-- ===========================================================================
do $$
declare
  v_def text;
  v_lock int;
begin
  assert exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'queue_ups' and column_name = 'locked_via'
      and data_type = 'text' and is_nullable = 'YES' and column_default is null
  ), 'A: queue_ups.locked_via is not a nullable text column with no default';
  assert exists (select 1 from pg_constraint where conrelid = 'public.queue_ups'::regclass and conname = 'queue_ups_locked_via'
                 and pg_get_constraintdef(oid) like '%locked_via IS NULL%pop%call%'),
    'A: queue_ups_locked_via does not allow only null, pop or call';
  assert exists (select 1 from pg_constraint where conrelid = 'public.queue_ups'::regclass and conname = 'queue_ups_locked_via_needs_lock'
                 and pg_get_constraintdef(oid) = 'CHECK (((locked_via IS NULL) OR (locked_at IS NOT NULL)))'),
    'A: queue_ups_locked_via_needs_lock is missing or not "locked_via needs locked_at"';
  -- No backfill, so every row locked before this file has locked_via null, and it must still read
  -- as a Duo Pop: "Popped in" set and no code (queue_up_out), as the push reads it. Every such row
  -- on file is checked here; section F locks a fresh one the pre-0088 way, so this rule is tested
  -- even while the table is empty.
  assert not exists (
    select 1
    from public.queue_ups q
    cross join lateral public.queue_up_out(q.id, false) o
    where q.locked_at is not null and q.locked_via is null
      and (o.popped_in_seconds is null or o.call_code is not null)
  ), 'A: a row locked before 0088 (locked_via null) does not read as a Duo Pop';

  -- Signatures, RETURNS, volatility and ACLs exactly as 0085 left them (read live 15 Oct 2026).
  assert pg_get_function_result('public.answer_duo_pop(uuid,boolean)'::regprocedure)
    = 'TABLE(result text, match_id uuid, popped_in_seconds integer)', 'A: answer_duo_pop RETURNS changed';
  assert (select array_to_string(proacl, ',') from pg_proc where oid = 'public.answer_duo_pop(uuid,boolean)'::regprocedure)
    = 'postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres', 'A: answer_duo_pop ACL changed';
  assert (select provolatile = 'v' and prosecdef from pg_proc where oid = 'public.answer_duo_pop(uuid,boolean)'::regprocedure),
    'A: answer_duo_pop is no longer VOLATILE SECURITY DEFINER';

  assert pg_get_function_result('public.accept_invite()'::regprocedure) = 'TABLE(matched boolean, match_id uuid, inviter_id uuid)',
    'A: accept_invite RETURNS changed';
  assert (select array_to_string(proacl, ',') from pg_proc where oid = 'public.accept_invite()'::regprocedure)
    = 'postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres', 'A: accept_invite ACL changed';
  assert (select provolatile = 'v' and prosecdef from pg_proc where oid = 'public.accept_invite()'::regprocedure),
    'A: accept_invite is no longer VOLATILE SECURITY DEFINER';

  assert pg_get_function_result('public.resolve_invite_code(text)'::regprocedure) = 'TABLE(inviter_id uuid, display_name text)',
    'A: resolve_invite_code RETURNS changed';
  assert (select array_to_string(proacl, ',') from pg_proc where oid = 'public.resolve_invite_code(text)'::regprocedure)
    = 'postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres', 'A: resolve_invite_code ACL changed (anon must keep it)';
  assert (select provolatile = 's' and prosecdef from pg_proc where oid = 'public.resolve_invite_code(text)'::regprocedure),
    'A: resolve_invite_code is no longer STABLE SECURITY DEFINER';

  assert pg_get_function_result('public.call_code_ended(text)'::regprocedure) = 'boolean', 'A: call_code_ended RETURNS changed';
  assert (select array_to_string(proacl, ',') from pg_proc where oid = 'public.call_code_ended(text)'::regprocedure)
    = 'postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres', 'A: call_code_ended ACL changed (anon must keep it)';
  assert (select provolatile = 's' and prosecdef from pg_proc where oid = 'public.call_code_ended(text)'::regprocedure),
    'A: call_code_ended is no longer STABLE SECURITY DEFINER';

  assert pg_get_function_result('public.queue_up_out(uuid,boolean)'::regprocedure)
    = 'TABLE(queue_id uuid, game_id uuid, game_name text, ping boolean, notified integer, pop_note text, created_at timestamp with time zone, pop_expires_at timestamp with time zone, looking_until timestamp with time zone, ended_at timestamp with time zone, call_code text, locked_at timestamp with time zone, match_id uuid, partner_id uuid, partner_name text, popped_in_seconds integer, already_queued boolean)',
    'A: queue_up_out RETURNS is not the 17 columns';
  assert (select array_to_string(proacl, ',') from pg_proc where oid = 'public.queue_up_out(uuid,boolean)'::regprocedure)
    = 'postgres=X/postgres,service_role=X/postgres', 'A: queue_up_out gained a client grant';
  assert pg_get_function_result('public.get_my_queue_up()'::regprocedure)
    = pg_get_function_result('public.queue_up_out(uuid,boolean)'::regprocedure), 'A: get_my_queue_up and queue_up_out differ in shape';

  -- Lock order (the header's LOCK ORDER). One session cannot race itself, so this reads the
  -- bodies: the FIRST row lock each function takes is the ordered pair of profiles, and the
  -- queue_ups row comes after it (in accept_invite, so do the swipes).
  v_def := pg_get_functiondef('public.answer_duo_pop(uuid,boolean)'::regprocedure);
  v_lock := position('perform 1 from public.profiles p' in v_def);
  assert v_lock > 0
     and substr(v_def, v_lock) ~ '^perform 1 from public\.profiles p\s+where p\.id in \(v_me, \(select q\.sender_id from public\.queue_ups q where q\.id = p_pop_id\)\)\s+order by p\.id\s+for no key update;',
    'A: answer_duo_pop does not lock both profiles in one id-ordered FOR NO KEY UPDATE';
  assert position('for no key update' in v_def) > v_lock
     and position('for update' in v_def) > v_lock
     and position('where q.id = p_pop_id for update' in v_def) > v_lock,
    'A: answer_duo_pop takes a row lock before the ordered profile lock';

  v_def := pg_get_functiondef('public.accept_invite()'::regprocedure);
  v_lock := position('perform 1 from public.profiles p' in v_def);
  assert v_lock > 0
     and substr(v_def, v_lock) ~ '^perform 1 from public\.profiles p\s+where p\.id in \(v_me, v_row\.inviter_id\)\s+order by p\.id\s+for no key update;',
    'A: accept_invite does not lock both profiles in one id-ordered FOR NO KEY UPDATE';
  assert position('for no key update' in v_def) > v_lock
     and position('for update' in v_def) > v_lock
     and position('insert into public.swipes' in v_def) > v_lock,
    'A: accept_invite writes a swipe or locks the call before the ordered profile lock';
  assert v_def like '%v_recent_connections < 25 and v_standing_ok%',
    'A: accept_invite lost the 25-a-day cap on the standing like';
  assert v_def not like '%v_call_connected%', 'A: accept_invite still counts connections per call';

  insert into check_log (line) values ('A ok: locked_via (null, pop or call; needs locked_at), and every row locked before it reads as a Duo Pop; answer_duo_pop, accept_invite, resolve_invite_code, call_code_ended (anon keeps both) and queue_up_out (no client grant) keep their signatures, RETURNS, volatility and ACLs; both answer paths lock the two profiles in one id-ordered statement before any other row lock; the 25-a-day cap stays and the 3-per-call count is gone');
end;
$$;

-- ===========================================================================
-- B. Fixtures
-- ===========================================================================
do $$
declare
  v_ids uuid[];
  v_roles text[] := array['s', 'r1', 'r2', 'o1', 'ob', 's2', 'r3', 'n1', 'n2', 'n3', 's3', 'n4', 'n5', 'pv'];
  v_lol uuid := public.lol_game_id();
  i int;
begin
  select array_agg(x.id order by x.id) into v_ids from (
    select p.id
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.is_demo and p.onboarding_completed and p.is_active and not p.is_banned and not p.is_admin_suspended
      and u.email like '%@duoqueue.io' and u.email <> 'review@duoqueue.io'
    order by p.id
    limit 14
  ) x;
  if coalesce(array_length(v_ids, 1), 0) < 14 then
    raise exception 'B: need 14 demo personas, found %', coalesce(array_length(v_ids, 1), 0);
  end if;
  for i in 1..14 loop
    insert into chk_ids values (v_roles[i], v_ids[i]);
  end loop;

  -- A clean slate between every pair of fixtures.
  delete from public.swipes where swiper_id = any (v_ids) and target_id = any (v_ids);
  delete from public.matches where user_a_id = any (v_ids) and user_b_id = any (v_ids);
  delete from public.blocks where blocker_id = any (v_ids) or blocked_id = any (v_ids);
  delete from public.reports where reporter_profile_id = any (v_ids) or reported_profile_id = any (v_ids);
  delete from public.invite_redemptions where invitee_id = any (v_ids) or inviter_id = any (v_ids);
  delete from public.invite_codes where profile_id = any (v_ids);
  delete from public.push_tokens where profile_id = any (v_ids);
  delete from public.like_alerts where recipient_id = any (v_ids) or liker_id = any (v_ids);
  delete from public.rate_limit_hits where profile_id = any (v_ids);
  delete from public.queue_ups where sender_id = any (v_ids) or recipients && v_ids;

  -- Real, NA East, local noon, set up 30 days ago on a 60-day-old account, not looking.
  update public.profiles
     set is_demo = false, region = 'na_east', timezone = pg_temp.zone_at(12),
         is_looking_now = false, looking_now_expires_at = null,
         onboarding_completed_at = now() - interval '30 days', created_at = now() - interval '60 days'
   where id = any (v_ids);
  -- The code redeemers are new accounts (redeem_invite_code's 14-day window).
  update public.profiles set created_at = now() - interval '1 day'
   where id = any (pg_temp.ids(array['n1', 'n2', 'n3', 'n4', 'n5', 'pv']));

  update public.preferences set preferred_regions = null, required_language = null, min_age = 18, max_age = 99
   where profile_id = any (v_ids);

  insert into public.profile_games (profile_id, game_id, skill_level, priority, lol_tier, lol_division)
  select x.id, v_lol, 'competitive'::public.skill_level_enum, 9, 'silver', 1 from unnest(v_ids) x(id)
  on conflict (profile_id, game_id) do update set lol_tier = 'silver', lol_division = 1;

  insert into public.push_tokens (profile_id, expo_push_token)
  select x.id, 'ExponentPushToken[check-0088-' || x.id::text || ']' from unnest(v_ids) x(id);

  insert into public.notification_settings (profile_id) select x.id from unnest(v_ids) x(id)
  on conflict (profile_id) do nothing;
  -- Duo Pops off for EVERYONE (real players included, rolled back), so each fan-out below goes
  -- to exactly the fixtures switched on for it.
  update public.notification_settings set queue_pop = false where queue_pop;

  assert pg_temp.zone_at(12) is not null, 'B: setup: no Etc/GMT zone at noon';

  insert into check_log (line) values ('B setup: fourteen personas made real, NA East, local noon, League, fake tokens, no swipes, matches, blocks, reports, invites or queue-ups between them; Duo Pops off for everyone');
end;
$$;

-- ===========================================================================
-- C. A Duo Pop locks: the sender leaves Online Now, the code dies, and the answerer's own
--    queue-up ends
-- ===========================================================================
do $$
declare
  v_lol uuid := public.lol_game_id();
  r record;
  v_s1 uuid;
  v_s1_code text;
  v_r1q uuid;
  v_r1_code text;
  v_match uuid;
  v_n int;
  v_ended boolean;
  v_online uuid[];
  v_q public.queue_ups%rowtype;
begin
  -- s pops exactly r1 and r2.
  update public.notification_settings set queue_pop = true where profile_id = any (pg_temp.ids(array['r1', 'r2']));
  perform pg_temp.act_as('s');
  select * into r from public.start_queue_up(v_lol, true);
  reset role;
  v_s1 := r.queue_id;
  v_s1_code := r.call_code;
  assert pg_temp.sorted((select recipients from public.queue_ups where id = v_s1)) = pg_temp.ids(array['r1', 'r2']),
    'C: setup: s did not pop exactly r1 and r2';
  insert into chk_q values ('s1', v_s1, v_s1_code, null);

  -- r1 is queued too, and pops o1 (r2 was popped under 3 hours ago; s is not opted in).
  update public.notification_settings set queue_pop = true where profile_id = pg_temp.id('o1');
  perform pg_temp.act_as('r1');
  select * into r from public.start_queue_up(v_lol, true);
  reset role;
  v_r1q := r.queue_id;
  v_r1_code := r.call_code;
  assert (select recipients from public.queue_ups where id = v_r1q) = array[pg_temp.id('o1')],
    'C: setup: r1 did not pop exactly o1';
  insert into chk_q values ('r1q', v_r1q, v_r1_code, null);

  perform pg_temp.act_as('ob');
  select coalesce(array_agg(o.profile_id), '{}') into v_online from public.get_online_now(50) o;
  reset role;
  assert v_online @> pg_temp.ids(array['s', 'r1']), 'C: setup: s and r1 are not in Online Now while queued';

  -- r1 taps I'm in on s's pop.
  perform pg_temp.act_as('r1');
  select * into r from public.answer_duo_pop(v_s1, true);
  reset role;
  assert r.result = 'locked' and r.match_id is not null and r.popped_in_seconds = 1,
    format('C: r1''s I''m in gave %s / %s / %s, expected locked, a match and 1 second', r.result, r.match_id, r.popped_in_seconds);
  v_match := r.match_id;
  update chk_q set match_id = v_match where label = 's1';

  -- The lock: locked_via pop, and NEVER ended_at (build 19's sheet).
  select * into v_q from public.queue_ups where id = v_s1;
  assert v_q.locked_by = pg_temp.id('r1') and v_q.locked_via = 'pop' and v_q.locked_at = now() and v_q.match_id = v_match,
    'C: s''s row does not record r1''s pop lock and the match';
  assert v_q.ended_at is null, 'C: a pop lock set ended_at (build 19 would draw the idle sheet instead of Duo locked)';

  -- The sender has their duo: out of Online Now.
  assert (select not p.is_looking_now and p.looking_now_expires_at is null from public.profiles p where p.id = pg_temp.id('s')),
    'C: s is still free to duo after the lock';
  -- The answerer has theirs too: their own queue-up ended, and they are out of Online Now.
  select * into v_q from public.queue_ups where id = v_r1q;
  assert v_q.ended_at = now() and v_q.locked_at is null and v_q.locked_via is null,
    'C: r1''s own queue-up was not ended (unlocked) when r1 locked s''s pop';
  assert (select not p.is_looking_now and p.looking_now_expires_at is null from public.profiles p where p.id = pg_temp.id('r1')),
    'C: r1 is still free to duo after locking s''s pop';

  perform pg_temp.act_as('ob');
  select coalesce(array_agg(o.profile_id), '{}') into v_online from public.get_online_now(50) o;
  reset role;
  assert not (v_online && pg_temp.ids(array['s', 'r1'])), 'C: s or r1 still shows in Online Now after the duo';

  -- The sender's sheet: Duo locked with r1, popped in 1 second, no code.
  perform pg_temp.act_as('s');
  select * into r from public.get_my_queue_up();
  reset role;
  assert r.queue_id = v_s1 and r.call_code is null and r.popped_in_seconds = 1 and r.partner_id = pg_temp.id('r1')
     and r.ended_at is null and r.locked_at = now(),
    format('C: s''s sheet reads code %s, popped %s, partner %s', r.call_code, r.popped_in_seconds, r.partner_id);
  assert r.partner_name is not distinct from (select display_name from public.profiles where id = pg_temp.id('r1')),
    'C: partner_name is not r1''s display name';

  -- r1's sheet: idle (ended), no code.
  perform pg_temp.act_as('r1');
  select * into r from public.get_my_queue_up();
  reset role;
  assert r.queue_id = v_r1q and r.ended_at = now() and r.call_code is null, 'C: r1''s own sheet does not read ended';

  -- Both codes are dead: neither resolves, both read as ended.
  perform pg_temp.act_as_anon();
  select count(*) into v_n from public.resolve_invite_code(v_s1_code);
  v_ended := public.call_code_ended(v_s1_code);
  reset role;
  assert v_n = 0 and v_ended, 'C: s''s code still resolves after the pop lock, or does not read as ended';
  perform pg_temp.act_as_anon();
  select count(*) into v_n from public.resolve_invite_code(v_r1_code);
  v_ended := public.call_code_ended(v_r1_code);
  reset role;
  assert v_n = 0 and v_ended, 'C: r1''s code still resolves after r1 found a duo, or does not read as ended';

  -- r2 was too late; o1's pop from r1 has ended.
  perform pg_temp.act_as('r2');
  select * into r from public.answer_duo_pop(v_s1, true);
  reset role;
  assert r.result = 'taken', format('C: r2''s late I''m in gave %s, not taken', r.result);
  perform pg_temp.act_as('r2');
  select * into r from public.get_duo_pop(v_s1);
  reset role;
  assert r.status = 'taken', format('C: r2''s Pop card reads %s, not taken', r.status);

  perform pg_temp.act_as('o1');
  select * into r from public.get_duo_pop(v_r1q);
  reset role;
  assert r.status = 'ended', format('C: o1''s Pop card from r1 reads %s, not ended', r.status);
  perform pg_temp.act_as('o1');
  select * into r from public.answer_duo_pop(v_r1q, true);
  reset role;
  assert r.result = 'ended', format('C: o1''s I''m in on r1''s ended pop gave %s, not ended', r.result);

  assert (select count(*) from pg_temp.requests('new_match') b where b->>'matchId' = v_match::text) = 1,
    'C: the pop lock did not queue exactly one new_match request';

  insert into check_log (line) values ('C ok: r1''s I''m in locks s''s pop (locked_via pop, ended_at still null), s and r1 both leave Online Now, r1''s own queue-up ends (its pop answers ended, its sheet is idle), s''s sheet shows r1 with no code and 1 second, both codes stop resolving and read as ended, r2 gets taken, one new_match request');
end;
$$;

-- ===========================================================================
-- D. The post locks: the first redeemer who matches is the duo
-- ===========================================================================
do $$
declare
  v_lol uuid := public.lol_game_id();
  r record;
  v_s2 uuid;
  v_code text;
  v_m1 uuid;
  v_q public.queue_ups%rowtype;
  v_n int;
  v_ended boolean;
  v_after_delete public.queue_ups%rowtype;
begin
  update public.notification_settings set queue_pop = false where queue_pop;
  update public.notification_settings set queue_pop = true where profile_id = pg_temp.id('r3');
  perform pg_temp.act_as('s2');
  select * into r from public.start_queue_up(v_lol, true);
  reset role;
  v_s2 := r.queue_id;
  v_code := r.call_code;
  assert (select recipients from public.queue_ups where id = v_s2) = array[pg_temp.id('r3')], 'D: setup: s2 did not pop exactly r3';
  insert into chk_q values ('s2', v_s2, v_code, null);

  -- Two new players type the posted code at sign-up.
  perform pg_temp.act_as('n1');
  select * into r from public.redeem_invite_code(v_code);
  reset role;
  assert r.inviter_id = pg_temp.id('s2'), 'D: n1 could not redeem s2''s live code';
  perform pg_temp.act_as('n2');
  select * into r from public.redeem_invite_code(v_code);
  reset role;
  assert r.inviter_id = pg_temp.id('s2'), 'D: n2 could not redeem s2''s live code';

  -- n1 joins first and matches: the call locks.
  perform pg_temp.act_as('n1');
  select * into r from public.accept_invite();
  reset role;
  assert r.matched and r.match_id is not null and r.inviter_id = pg_temp.id('s2'), 'D: n1''s accept did not match s2';
  v_m1 := r.match_id;
  update chk_q set match_id = v_m1 where label = 's2';

  select * into v_q from public.queue_ups where id = v_s2;
  assert v_q.locked_by = pg_temp.id('n1') and v_q.locked_via = 'call' and v_q.match_id = v_m1 and v_q.locked_at = now(),
    format('D: the post lock reads locked_by %s, via %s, match %s', v_q.locked_by, v_q.locked_via, v_q.match_id);
  assert v_q.ended_at is null, 'D: a post lock set ended_at (build 19 would draw the idle sheet)';
  assert (select not p.is_looking_now and p.looking_now_expires_at is null from public.profiles p where p.id = pg_temp.id('s2')),
    'D: s2 is still free to duo after the post lock';

  -- The sender's sheet: no "Popped in" (it came from the post), no code, partner n1.
  perform pg_temp.act_as('s2');
  select * into r from public.get_my_queue_up();
  reset role;
  assert r.queue_id = v_s2 and r.popped_in_seconds is null and r.call_code is null and r.partner_id = pg_temp.id('n1')
     and r.locked_at = now() and r.ended_at is null,
    format('D: s2''s sheet reads popped %s, code %s, partner %s', r.popped_in_seconds, r.call_code, r.partner_id);

  -- r3's pop is gone the moment the post filled.
  perform pg_temp.act_as('r3');
  select * into r from public.answer_duo_pop(v_s2, true);
  reset role;
  assert r.result = 'taken', format('D: r3''s I''m in after the post lock gave %s, not taken', r.result);
  perform pg_temp.act_as('r3');
  select * into r from public.get_duo_pop(v_s2);
  reset role;
  assert r.status = 'taken', format('D: r3''s Pop card reads %s, not taken', r.status);

  -- n2 accepts after the lock: only n2's own like; s2 decides in Requests.
  perform pg_temp.act_as('n2');
  select * into r from public.accept_invite();
  reset role;
  assert r.matched = false and r.match_id is null, 'D: n2 matched after the call was locked';
  assert exists (select 1 from public.swipes where swiper_id = pg_temp.id('n2') and target_id = pg_temp.id('s2') and action = 'like'),
    'D: n2''s own like on s2 is missing';
  assert not exists (select 1 from public.swipes where swiper_id = pg_temp.id('s2') and target_id = pg_temp.id('n2')),
    'D: s2 got a standing like for n2 after the lock';
  assert (select locked_by = pg_temp.id('n1') and match_id = v_m1 and locked_via = 'call' from public.queue_ups where id = v_s2),
    'D: n2''s accept changed the lock';

  -- n3 is too late to redeem at all; the posted link reads ended.
  perform pg_temp.act_as('n3');
  select count(*) into v_n from public.redeem_invite_code(v_code);
  reset role;
  assert v_n = 0 and not exists (select 1 from public.invite_redemptions where invitee_id = pg_temp.id('n3')),
    'D: n3 redeemed a locked call code';
  perform pg_temp.act_as_anon();
  select count(*) into v_n from public.resolve_invite_code(v_code);
  v_ended := public.call_code_ended(v_code);
  reset role;
  assert v_n = 0 and v_ended, 'D: the locked call code still resolves for anon, or does not read as ended';

  assert (select count(*) from pg_temp.requests('new_match') b where b->>'matchId' = v_m1::text) = 1,
    'D: the post lock did not queue exactly one new_match request';

  -- Deleting the player who joined keeps the lock (locked_at, locked_via), loses the locker and
  -- the match, and cannot fail on either check.
  begin
    delete from public.profiles where id = pg_temp.id('n1');
    select * into v_after_delete from public.queue_ups where id = v_s2;
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_after_delete.id = v_s2 and v_after_delete.locked_by is null and v_after_delete.locked_at is not null
     and v_after_delete.locked_via = 'call' and v_after_delete.match_id is null,
    'D: deleting the post''s joiner did not leave a lock with no locker, no match and locked_via call';

  insert into check_log (line) values ('D ok: n1 joins s2''s post and matches: the call locks (locked_via call, match, ended_at null), s2 leaves Online Now, s2''s sheet has no Popped in and no code, r3''s pop answers taken; n2 accepting after the lock gets only their own like; n3 cannot redeem and the link reads ended; one new_match request; deleting n1 keeps the lock');
end;
$$;

-- ===========================================================================
-- E. Edge cases: no match no lock; queueing again; answering each other; 1.0.1 unchanged
-- ===========================================================================
do $$
declare
  v_lol uuid := public.lol_game_id();
  r record;
  v_s3 uuid;
  v_code text;
  v_perm text;
  v_who uuid;
  v_n int;
  v_s1 uuid := (select queue_id from chk_q where label = 's1');
  v_new uuid;
  v_new_code text;
  v_x uuid;
  v_y uuid;
  v_first text;
  v_second text;
  v_second_match uuid;
  v_x_row public.queue_ups%rowtype;
  v_y_row public.queue_ups%rowtype;
  v_pair_matches int;
begin
  -- s3 queues with Ping off, and has passed on n4 from the deck.
  perform pg_temp.act_as('s3');
  select * into r from public.start_queue_up(v_lol, false);
  reset role;
  v_s3 := r.queue_id;
  v_code := r.call_code;
  insert into public.swipes (swiper_id, target_id, action) values (pg_temp.id('s3'), pg_temp.id('n4'), 'pass');

  -- n4 joins with the code: the pass stands, no match, and the call stays open.
  perform pg_temp.act_as('n4');
  perform public.redeem_invite_code(v_code);
  select * into r from public.accept_invite();
  reset role;
  assert r.matched = false, 'E: n4 matched although s3 had passed on them';
  assert (select locked_at is null and locked_by is null and locked_via is null and ended_at is null from public.queue_ups where id = v_s3),
    'E: an accept that did not match locked the call';
  perform pg_temp.act_as_anon();
  select count(*) into v_n from public.resolve_invite_code(v_code);
  reset role;
  assert v_n = 1, 'E: the call code stopped resolving after an accept that did not match';

  -- n5 joins next and matches: that is the one duo.
  perform pg_temp.act_as('n5');
  perform public.redeem_invite_code(v_code);
  select * into r from public.accept_invite();
  reset role;
  assert r.matched, 'E: n5 did not match s3';
  assert (select locked_by = pg_temp.id('n5') and locked_via = 'call' and match_id = r.match_id from public.queue_ups where id = v_s3),
    'E: n5''s match did not lock s3''s call';

  -- Queueing again after a lock: Queue up alone still returns the locked row (no double queue);
  -- Stop ends it, and a new queue-up mints a code that resolves.
  perform pg_temp.act_as('s');
  select * into r from public.start_queue_up(v_lol, false);
  reset role;
  assert r.already_queued and r.queue_id = v_s1 and r.call_code is null,
    'E: Queue up on a locked, unended row did not return that row as already queued';
  perform pg_temp.act_as('s');
  perform public.stop_queue_up();
  select * into r from public.start_queue_up(v_lol, false);
  reset role;
  assert (select ended_at = now() and locked_via = 'pop' from public.queue_ups where id = v_s1), 'E: Stop did not end the locked row';
  assert not r.already_queued and r.queue_id <> v_s1 and r.call_code is not null, 'E: queueing again did not mint a new row with a code';
  v_new := r.queue_id;
  v_new_code := r.call_code;
  perform pg_temp.act_as_anon();
  select c.inviter_id into v_who from public.resolve_invite_code(v_new_code) c;
  reset role;
  assert v_who = pg_temp.id('s'), 'E: the new queue-up''s code does not resolve to s';

  -- Two players popping each other: the first I'm in is the duo; the second answer finds the
  -- other's queue-up ended (the answerer's own rows end), so no second lock and one match, and it
  -- answers already_matched with that match (build 19 opens the chat) rather than ended.
  begin
    v_x := pg_temp.live_pop(pg_temp.id('o1'), array[pg_temp.id('ob')]);
    v_y := pg_temp.live_pop(pg_temp.id('ob'), array[pg_temp.id('o1')]);
    perform pg_temp.act_as('ob');
    select a.result into v_first from public.answer_duo_pop(v_x, true) a;
    perform pg_temp.act_as('o1');
    select a.result, a.match_id into v_second, v_second_match from public.answer_duo_pop(v_y, true) a;
    reset role;
    select * into v_x_row from public.queue_ups where id = v_x;
    select * into v_y_row from public.queue_ups where id = v_y;
    select count(*) into v_pair_matches from public.matches
     where user_a_id = least(pg_temp.id('o1'), pg_temp.id('ob')) and user_b_id = greatest(pg_temp.id('o1'), pg_temp.id('ob'));
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_first = 'locked', format('E: the first of two crossed I''m in taps gave %s', v_first);
  assert v_second = 'already_matched' and v_second_match = v_x_row.match_id and v_second_match is not null,
    format('E: the second crossed I''m in gave %s / %s, expected already_matched with the first tap''s match', v_second, v_second_match);
  assert v_x_row.locked_by = pg_temp.id('ob') and v_x_row.ended_at is null, 'E: o1''s pop is not locked by ob';
  assert v_y_row.locked_at is null and v_y_row.ended_at = now(), 'E: ob''s own pop was locked, or not ended';
  assert v_pair_matches = 1, 'E: two crossed I''m in taps made other than one match';

  -- 1.0.1 unchanged: a permanent code still resolves, and its accept still gets the standing like
  -- and matches; it never touches a queue-up.
  perform pg_temp.act_as('s3');
  v_perm := public.get_or_create_invite_code();
  reset role;
  assert v_perm <> v_code, 'E: the permanent code equals the call code';
  perform pg_temp.act_as_anon();
  select c.inviter_id into v_who from public.resolve_invite_code(v_perm) c;
  reset role;
  assert v_who = pg_temp.id('s3') and not public.call_code_ended(v_perm), 'E: s3''s permanent code does not resolve, or reads as an ended call';
  perform pg_temp.act_as('pv');
  perform public.redeem_invite_code(v_perm);
  select * into r from public.accept_invite();
  reset role;
  assert r.matched and r.inviter_id = pg_temp.id('s3'), 'E: a permanent code''s accept no longer matches';
  assert exists (select 1 from public.swipes where swiper_id = pg_temp.id('s3') and target_id = pg_temp.id('pv') and action = 'like'),
    'E: a permanent code''s accept no longer writes the standing like';
  assert (select locked_by = pg_temp.id('n5') and locked_via = 'call' from public.queue_ups where id = v_s3),
    'E: a permanent-code accept touched the inviter''s queue-up';

  insert into check_log (line) values ('E ok: an accept that does not match leaves the call open and a later match locks it; Queue up on a locked row stays idempotent, Stop ends it and a new queue-up''s code resolves; two crossed I''m in taps make one duo (the second answers already_matched with that match); a permanent code resolves, auto-likes and matches as before without touching a queue-up');
end;
$$;

-- ===========================================================================
-- F. One duo per player: an older code in its grace, unmatched and live matches, an answerer
--    who already has their duo, and a lock made before 0088. Every probe rolls itself back.
-- ===========================================================================
do $$
declare
  v_lol uuid := public.lol_game_id();
  v_q1 uuid;
  v_code1 text;
  v_q2 uuid;
  v_q3 uuid;
  v_matched boolean;
  v_q1_row public.queue_ups%rowtype;
  v_q2_row public.queue_ups%rowtype;
  v_q3_row public.queue_ups%rowtype;
  v_looking boolean;
  v_resolves int;
  v_q2_code_ended boolean;
  v_call uuid;
  v_call_code text;
  v_perm text;
  v_m uuid;
  v_res_matched boolean;
  v_res_match uuid;
  v_unmatched timestamptz;
  v_call_row public.queue_ups%rowtype;
  v_perm_matched boolean;
  v_perm_unmatched timestamptz;
  v_live_matched boolean;
  v_live_match uuid;
  v_live_call public.queue_ups%rowtype;
  v_live_looking boolean;
  v_pushes_before int;
  v_pushes_after int;
  v_ob_q uuid;
  v_r2_q uuid;
  v_first text;
  v_has_duo text;
  v_r2_row public.queue_ups%rowtype;
  v_after_stop text;
  v_old uuid;
  v_out record;
begin
  -- F1. r2 queued again inside an older queue-up's 15-minute grace, and n3 joins with the OLDER
  -- code. n3 also has an unlocked queue-up of their own inside its grace.
  begin
    insert into public.queue_ups (sender_id, game_id, ping, created_at, pop_expires_at, looking_until, recipients, call_code)
    values (pg_temp.id('r2'), v_lol, false, now() - interval '65 minutes', now() - interval '55 minutes',
            now() - interval '5 minutes', '{}', public.generate_call_code())
    returning id, call_code into v_q1, v_code1;
    v_q2 := pg_temp.live_pop(pg_temp.id('r2'), '{}');
    insert into public.queue_ups (sender_id, game_id, ping, created_at, pop_expires_at, looking_until, recipients, call_code)
    values (pg_temp.id('n3'), v_lol, false, now() - interval '65 minutes', now() - interval '55 minutes',
            now() - interval '5 minutes', '{}', public.generate_call_code())
    returning id into v_q3;

    perform pg_temp.act_as('n3');
    perform public.redeem_invite_code(v_code1);
    select a.matched into v_matched from public.accept_invite() a;
    reset role;
    select * into v_q1_row from public.queue_ups where id = v_q1;
    select * into v_q2_row from public.queue_ups where id = v_q2;
    select * into v_q3_row from public.queue_ups where id = v_q3;
    select p.is_looking_now into v_looking from public.profiles p where p.id = pg_temp.id('r2');
    perform pg_temp.act_as_anon();
    select count(*) into v_resolves from public.resolve_invite_code(v_q2_row.call_code);
    v_q2_code_ended := public.call_code_ended(v_q2_row.call_code);
    reset role;
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_matched, 'F1: n3 did not match r2 through the older code in its grace';
  assert v_q1_row.locked_by = pg_temp.id('n3') and v_q1_row.locked_via = 'call' and v_q1_row.ended_at is null,
    'F1: the older code''s queue-up is not locked by n3 via the post, or was ended';
  assert v_q2_row.ended_at = now() and v_q2_row.locked_at is null,
    'F1: r2''s newer live queue-up was not ended when the older code found the duo (it could lock a second one)';
  assert v_looking = false, 'F1: r2 is still free to duo after the lock';
  assert v_resolves = 0 and v_q2_code_ended, 'F1: the newer queue-up''s code still resolves, or does not read as ended';
  assert v_q3_row.ended_at = now() and v_q3_row.locked_at is null,
    'F1: n3''s own queue-up inside its grace was not ended (its code would still work)';

  -- F2. o1 posts a Duo Call. n3, whom o1 unmatched a day ago (no block, both likes still on
  -- file), types its code: that no stands, nothing matches and the call stays open.
  begin
    v_call := pg_temp.live_pop(pg_temp.id('o1'), '{}');
    select q.call_code into v_call_code from public.queue_ups q where q.id = v_call;
    insert into public.swipes (swiper_id, target_id, action)
    values (pg_temp.id('o1'), pg_temp.id('n3'), 'like'), (pg_temp.id('n3'), pg_temp.id('o1'), 'like');
    insert into public.matches (user_a_id, user_b_id, unmatched_at, unmatched_by)
    values (least(pg_temp.id('o1'), pg_temp.id('n3')), greatest(pg_temp.id('o1'), pg_temp.id('n3')),
            now() - interval '1 day', pg_temp.id('o1'))
    returning id into v_m;
    perform pg_temp.act_as('n3');
    perform public.redeem_invite_code(v_call_code);
    select a.matched, a.match_id into v_res_matched, v_res_match from public.accept_invite() a;
    reset role;
    select m.unmatched_at into v_unmatched from public.matches m where m.id = v_m;
    select * into v_call_row from public.queue_ups where id = v_call;
    select p.is_looking_now into v_looking from public.profiles p where p.id = pg_temp.id('o1');
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_res_matched = false and v_res_match is null,
    format('F2: a Duo Call code re-matched a pair o1 had unmatched (%s / %s)', v_res_matched, v_res_match);
  assert v_unmatched is not null, 'F2: the unmatched match was brought back to life';
  assert v_call_row.locked_at is null and v_call_row.locked_via is null and v_call_row.ended_at is null,
    'F2: the call spent its one duo on a pair that had already said no';
  assert v_looking, 'F2: o1 left Online Now although no duo formed';

  -- F2b. The permanent code (1.0.1's path) the same way, with the no from the redeemer's side.
  begin
    insert into public.swipes (swiper_id, target_id, action)
    values (pg_temp.id('o1'), pg_temp.id('n3'), 'like'), (pg_temp.id('n3'), pg_temp.id('o1'), 'like');
    insert into public.matches (user_a_id, user_b_id, unmatched_at, unmatched_by)
    values (least(pg_temp.id('o1'), pg_temp.id('n3')), greatest(pg_temp.id('o1'), pg_temp.id('n3')),
            now() - interval '1 day', pg_temp.id('n3'))
    returning id into v_m;
    perform pg_temp.act_as('o1');
    v_perm := public.get_or_create_invite_code();
    perform pg_temp.act_as('n3');
    perform public.redeem_invite_code(v_perm);
    select a.matched into v_perm_matched from public.accept_invite() a;
    reset role;
    select m.unmatched_at into v_perm_unmatched from public.matches m where m.id = v_m;
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_perm_matched = false and v_perm_unmatched is not null,
    'F2b: a permanent code re-matched an unmatched pair';

  -- F3. n3 already has a LIVE match with o1 and types o1's Duo Call code: matched, with that
  -- match, and the call is not locked (they were a duo before the code; no push would say so).
  begin
    v_call := pg_temp.live_pop(pg_temp.id('o1'), '{}');
    select q.call_code into v_call_code from public.queue_ups q where q.id = v_call;
    insert into public.swipes (swiper_id, target_id, action)
    values (pg_temp.id('o1'), pg_temp.id('n3'), 'like'), (pg_temp.id('n3'), pg_temp.id('o1'), 'like');
    insert into public.matches (user_a_id, user_b_id)
    values (least(pg_temp.id('o1'), pg_temp.id('n3')), greatest(pg_temp.id('o1'), pg_temp.id('n3')))
    returning id into v_m;
    v_pushes_before := (select count(*) from pg_temp.requests('new_match') b where b->>'matchId' = v_m::text);
    perform pg_temp.act_as('n3');
    perform public.redeem_invite_code(v_call_code);
    select a.matched, a.match_id into v_live_matched, v_live_match from public.accept_invite() a;
    reset role;
    v_pushes_after := (select count(*) from pg_temp.requests('new_match') b where b->>'matchId' = v_m::text);
    select * into v_live_call from public.queue_ups where id = v_call;
    select p.is_looking_now into v_live_looking from public.profiles p where p.id = pg_temp.id('o1');
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_live_matched and v_live_match = v_m, 'F3: an existing live match was not returned as matched with its id';
  assert v_live_call.locked_at is null and v_live_call.locked_via is null and v_live_call.match_id is null,
    'F3: a code redeemed by an existing match locked the call';
  assert v_live_looking, 'F3: o1 left Online Now although no new duo formed';
  assert v_pushes_after = v_pushes_before, 'F3: redeeming over an existing match queued a new_match push';

  -- F4. ob's own queue-up is locked (r3 took it), so ob already has their duo: ob's I'm in on
  -- r2's pop answers unavailable and takes nothing. After Stop, the same tap locks.
  begin
    v_ob_q := pg_temp.live_pop(pg_temp.id('ob'), array[pg_temp.id('r3')]);
    perform pg_temp.act_as('r3');
    select a.result into v_first from public.answer_duo_pop(v_ob_q, true) a;
    reset role;
    v_r2_q := pg_temp.live_pop(pg_temp.id('r2'), array[pg_temp.id('ob')]);
    perform pg_temp.act_as('ob');
    select a.result into v_has_duo from public.answer_duo_pop(v_r2_q, true) a;
    reset role;
    select * into v_r2_row from public.queue_ups where id = v_r2_q;
    perform pg_temp.act_as('ob');
    perform public.stop_queue_up();
    select a.result into v_after_stop from public.answer_duo_pop(v_r2_q, true) a;
    reset role;
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_first = 'locked', format('F4: setup: r3''s I''m in on ob''s pop gave %s', v_first);
  assert v_has_duo = 'unavailable', format('F4: ob, whose own queue-up is locked, got %s on r2''s pop (expected unavailable)', v_has_duo);
  assert v_r2_row.locked_at is null and v_r2_row.locked_by is null, 'F4: ob took r2''s one duo while already having one';
  assert v_after_stop = 'locked', format('F4: after Stop, ob''s I''m in on r2''s pop gave %s', v_after_stop);

  -- F5. A lock made the pre-0088 way (locked_via null) reads as a Duo Pop: "Popped in", no code.
  begin
    v_old := pg_temp.live_pop(pg_temp.id('o1'), '{}');
    update public.queue_ups set locked_by = pg_temp.id('ob'), locked_at = now() where id = v_old;
    select * into v_out from public.queue_up_out(v_old, false);
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_out.popped_in_seconds = 1 and v_out.call_code is null and v_out.partner_id = pg_temp.id('ob'),
    format('F5: a pre-0088 lock reads popped %s, code %s', v_out.popped_in_seconds, v_out.call_code);

  insert into check_log (line) values ('F ok: a duo through an older code in its grace ends the sender''s newer queue-up (code dead) and the redeemer''s own in-grace one, and takes the sender out of Online Now; a Duo Call or permanent code never re-matches an unmatched pair, and leaves the call open; a code redeemed by an existing live match returns that match, locks nothing and pushes nothing; an answerer whose own queue-up is locked gets unavailable until they Stop; a pre-0088 lock reads as a Duo Pop');
end;
$$;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
