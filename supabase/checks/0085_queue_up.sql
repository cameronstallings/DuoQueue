-- Checks for supabase/migrations/0085_queue_up.sql.
--
-- Plain script: plpgsql `assert` in `do` blocks, one transaction, rolled back at the end.
--
-- HOW TO RUN IT
--   After 0085 is committed, alone:
--     powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0085_queue_up.sql
--   Before: one scratch file holding `begin;`, 0084, 0085, this file's body (everything between
--   its first `begin;` line and its last `rollback;` line), then `rollback;` (see 0071's check).
--   A failure raises and the run prints "QUERY FAILED" with the message. A pass prints the log.
--
-- RE-RUNNABLE AFTER 1.0.2 SHIPS. Real players with Duo Pops on do not change any result:
--   * Section A's "nobody is opted in" (the no-backfill check) is asserted only while 0085 is NOT
--     yet recorded in supabase_migrations.schema_migrations, i.e. in the dry run and the apply
--     run, where the column was created in this same transaction. Once 0085 is recorded, people
--     opting in is the feature working, so the count is logged instead.
--   * Section B switches Duo Pops off for everyone but the fourteen fixtures (rolled back), so
--     the exact recipient sets in C, E and F see only fixtures.
--   * pg_temp.requests() reads only push requests addressed to a fixture (or with no recipient),
--     so a real Duo Pop committed while this runs cannot change a count.
--
-- NO PUSH IS SENT. notify_via_edge_function only inserts into net.http_request_queue; the
-- pg_net worker sees committed rows only, and this rolls back. That queue is also how the
-- checks read the exact duo_pop and new_match payloads.
--
-- now() is the transaction's start time and does not move inside this file, so every row a
-- check writes "now" has created_at = now(), every pop has exactly 600 seconds left, and every
-- lock pops in the 1-second floor. Times in the past are written explicitly.
--
-- Sub-tests that must not leave a trace for the next one run inside a plpgsql block that ends
-- by raising 'rollback_probe' and catching it: that rolls the block back (rows, rate-limit hits,
-- the role) while keeping the plpgsql variables the asserts read.
--
-- WHO: fourteen seeded demo personas (@duoqueue.io demo accounts, never the review account),
-- made real INSIDE this transaction (is_demo false, except dm), with regions, clocks, League
-- ranks, fake push tokens and Duo Pops switched on as each role needs. RPCs are called as
-- `authenticated` with request.jwt.claims, and the Duo Call lookups as `anon` with no JWT,
-- exactly as PostgREST would. All rolled back.
--
--   s     the sender (NA West, Gold II, set up 30 days ago)
--   a     eligible, Gold I: can duo with s by rank
--   b     eligible, Diamond I: cannot duo with s by rank
--   p1    s passed p1             p2    p2 passed s            bl    s blocked bl
--   eu    Europe                  dm    still a demo account   nt    03:00 on their clock
--   z     eligible in every way except it has no notification_settings row
--   x     a second sender         k     the Duo Call sender
--   inv   a new account that answers k's call code; inv2 one that answers k's permanent code

begin;

set local lock_timeout = '5s';

create temp table check_log (n serial primary key, line text not null);
create temp table chk_ids (role text primary key, id uuid not null);
create temp table chk_base (queue_id bigint not null);
create temp table chk_q (label text primary key, queue_id uuid, code text, match_id uuid);
grant select on chk_ids to authenticated, anon;

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

-- The commit, as far as the deferred like-alert trigger can tell (0083's check).
create function pg_temp.fire_like_alerts() returns void
language plpgsql as $f$
begin
  set constraints public.on_swipe_like_alert immediate;
  set constraints public.on_swipe_like_alert deferred;
end;
$f$;

-- Push request bodies of one type queued in this transaction. Only those addressed to a fixture
-- (or naming no recipient, as new_match does): the queue is a shared table, and another
-- transaction's committed request (a real player's Duo Pop, after 1.0.2 ships) is visible here
-- until the pg_net worker takes it.
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

-- An old, finished queue-up row from p_sender with these recipients, p_hours ago.
create function pg_temp.old_pop(p_sender uuid, p_recipients uuid[], p_hours int) returns void
language sql as $f$
  insert into public.queue_ups (sender_id, game_id, ping, created_at, pop_expires_at, looking_until, ended_at, recipients)
  values (
    p_sender, public.lol_game_id(), true,
    now() - make_interval(hours => p_hours),
    now() - make_interval(hours => p_hours) + interval '10 minutes',
    now() - make_interval(hours => p_hours) + interval '60 minutes',
    now() - make_interval(hours => p_hours) + interval '60 minutes',
    p_recipients
  )
$f$;

-- ===========================================================================
-- A. Schema, grants, RLS and the two rebuilt invite functions
-- ===========================================================================
do $$
declare
  f text;
  v_def text;
  v_at int;
begin
  assert exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notification_settings' and column_name = 'queue_pop'
      and data_type = 'boolean' and is_nullable = 'NO' and column_default = 'false'
  ), 'A: notification_settings.queue_pop is not boolean NOT NULL DEFAULT false';
  -- No backfill. Asserted while 0085 is not yet recorded (the dry run and the apply run, where the
  -- column was added in this transaction); once it is, opting in is the feature working, so the
  -- count is only logged (see the header).
  if exists (select 1 from supabase_migrations.schema_migrations where version = '0085') then
    insert into check_log (line)
    select format('A note: 0085 is applied; %s players have Duo Pops on (logged, not asserted)', count(*))
    from public.notification_settings where queue_pop;
  else
    assert (select count(*) from public.notification_settings where queue_pop) = 0,
      'A: somebody is opted in to Duo Pops at apply time (no backfill allowed, App Store 4.5.4)';
  end if;
  assert has_column_privilege('authenticated', 'public.notification_settings', 'queue_pop', 'update'),
    'A: the app cannot switch Duo Pops on (no UPDATE on queue_pop)';
  assert has_column_privilege('authenticated', 'public.notification_settings', 'queue_pop', 'select'),
    'A: the app cannot read queue_pop';

  assert (select relrowsecurity from pg_class where oid = 'public.queue_ups'::regclass), 'A: queue_ups has no RLS';
  assert not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'queue_ups'),
    'A: queue_ups has a policy';
  assert not has_table_privilege('anon', 'public.queue_ups', 'select, insert, update, delete'), 'A: anon can touch queue_ups';
  assert not has_table_privilege('authenticated', 'public.queue_ups', 'select, insert, update, delete'), 'A: authenticated can touch queue_ups';
  assert has_table_privilege('service_role', 'public.queue_ups', 'select'), 'A: service_role cannot select queue_ups';
  assert has_table_privilege('service_role', 'public.queue_ups', 'insert'), 'A: service_role cannot insert queue_ups';
  assert has_table_privilege('service_role', 'public.queue_ups', 'update'), 'A: service_role cannot update queue_ups';
  assert has_table_privilege('service_role', 'public.queue_ups', 'delete'), 'A: service_role cannot delete queue_ups';

  -- The six from the plan's S6 device-QA query.
  assert (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname in ('start_queue_up', 'stop_queue_up', 'get_my_queue_up', 'get_duo_pop', 'answer_duo_pop', 'call_code_ended')) = 6,
    'A: the six Queue Up functions are not all there (exactly once each)';

  foreach f in array array[
    'public.start_queue_up(uuid,boolean)', 'public.get_my_queue_up()', 'public.stop_queue_up()',
    'public.get_duo_pop(uuid)', 'public.answer_duo_pop(uuid,boolean)'
  ] loop
    assert has_function_privilege('authenticated', f, 'execute'), format('A: authenticated cannot call %s', f);
    assert has_function_privilege('service_role', f, 'execute'), format('A: service_role cannot call %s', f);
    assert not has_function_privilege('anon', f, 'execute'), format('A: anon can call %s', f);
    assert not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = f::regprocedure and a.grantee = 0),
      format('A: PUBLIC can call %s', f);
    assert (select prosecdef from pg_proc where oid = f::regprocedure), format('A: %s is not SECURITY DEFINER', f);
  end loop;

  foreach f in array array[
    'public.generate_call_code()', 'public.duo_pop_pair_ok(uuid,uuid)', 'public.duo_pop_clock_ok(text)',
    'public.duo_pop_recipients(uuid,uuid)',
    'public.queue_up_out(uuid,boolean)', 'public.prune_queue_ups()', 'public.queue_ups_forget_profile()'
  ] loop
    assert not has_function_privilege('authenticated', f, 'execute'), format('A: authenticated can call the helper %s', f);
    assert not has_function_privilege('anon', f, 'execute'), format('A: anon can call the helper %s', f);
    assert not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = f::regprocedure and a.grantee = 0),
      format('A: PUBLIC can call the helper %s', f);
  end loop;

  assert has_function_privilege('anon', 'public.call_code_ended(text)', 'execute'), 'A: anon cannot call call_code_ended';
  assert has_function_privilege('authenticated', 'public.call_code_ended(text)', 'execute'), 'A: authenticated cannot call call_code_ended';
  assert pg_get_function_result('public.call_code_ended(text)'::regprocedure) = 'boolean', 'A: call_code_ended does not return boolean';
  assert (select provolatile = 's' and prosecdef from pg_proc where oid = 'public.call_code_ended(text)'::regprocedure),
    'A: call_code_ended is not STABLE SECURITY DEFINER';

  -- The two rebuilt invite functions: signatures, RETURNS, volatility and ACLs exactly as read
  -- live on 15 Oct 2026.
  assert pg_get_function_result('public.resolve_invite_code(text)'::regprocedure) = 'TABLE(inviter_id uuid, display_name text)',
    'A: resolve_invite_code RETURNS changed';
  assert pg_get_function_arguments('public.resolve_invite_code(text)'::regprocedure) = 'p_code text', 'A: resolve_invite_code arguments changed';
  assert (select array_to_string(proacl, ',') from pg_proc where oid = 'public.resolve_invite_code(text)'::regprocedure)
    = 'postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres', 'A: resolve_invite_code ACL changed';
  assert (select provolatile = 's' and prosecdef from pg_proc where oid = 'public.resolve_invite_code(text)'::regprocedure),
    'A: resolve_invite_code is no longer STABLE SECURITY DEFINER';
  assert pg_get_function_result('public.accept_invite()'::regprocedure) = 'TABLE(matched boolean, match_id uuid, inviter_id uuid)',
    'A: accept_invite RETURNS changed';
  assert (select array_to_string(proacl, ',') from pg_proc where oid = 'public.accept_invite()'::regprocedure)
    = 'postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres', 'A: accept_invite ACL changed';
  assert (select provolatile = 'v' and prosecdef from pg_proc where oid = 'public.accept_invite()'::regprocedure),
    'A: accept_invite is no longer VOLATILE SECURITY DEFINER';

  assert pg_get_function_result('public.start_queue_up(uuid,boolean)'::regprocedure)
    = 'TABLE(queue_id uuid, game_id uuid, game_name text, ping boolean, notified integer, pop_note text, created_at timestamp with time zone, pop_expires_at timestamp with time zone, looking_until timestamp with time zone, ended_at timestamp with time zone, call_code text, locked_at timestamp with time zone, match_id uuid, partner_id uuid, partner_name text, popped_in_seconds integer, already_queued boolean)',
    'A: start_queue_up RETURNS is not the plan''s 17 columns';
  assert pg_get_function_result('public.get_my_queue_up()'::regprocedure)
    = pg_get_function_result('public.start_queue_up(uuid,boolean)'::regprocedure), 'A: get_my_queue_up and start_queue_up differ in shape';
  assert pg_get_function_result('public.get_duo_pop(uuid)'::regprocedure)
    = 'TABLE(pop_id uuid, sender_id uuid, display_name text, age integer, game_name text, rank_text text, can_duo boolean, seconds_left integer, status text, match_id uuid)',
    'A: get_duo_pop RETURNS is not the plan''s 10 columns';
  assert pg_get_function_result('public.answer_duo_pop(uuid,boolean)'::regprocedure)
    = 'TABLE(result text, match_id uuid, popped_in_seconds integer)', 'A: answer_duo_pop RETURNS changed';

  -- One call per sender at a time (a double tap, or N parallel RPCs). One session cannot race
  -- itself, so this reads the bodies: start_queue_up locks the caller's profiles row before the
  -- rate limit, the live-row lookup and the 3-a-day count, and stop_queue_up before it ends
  -- anything. A position of 0 (the text moved) fails too, on purpose.
  v_def := pg_get_functiondef('public.start_queue_up(uuid,boolean)'::regprocedure);
  v_at := position('where p.id = v_me for no key update' in v_def);
  assert v_at > 0
     and v_at < position('check_rate_limit(' in v_def)
     and v_at < position('q.ended_at is null and q.looking_until > now()' in v_def)
     and v_at < position('cardinality(q.recipients) > 0' in v_def),
    'A: start_queue_up does not lock the sender''s profile before its rate limit, live-row and 3-a-day checks';
  v_def := pg_get_functiondef('public.stop_queue_up()'::regprocedure);
  v_at := position('where p.id = v_me for no key update' in v_def);
  assert v_at > 0 and v_at < position('update public.queue_ups' in v_def),
    'A: stop_queue_up does not lock the sender''s profile before ending the row';

  -- Decision 6 on the recipient's clock: the whole 10-minute pop inside 10:00-00:59. Etc/GMT
  -- zones are whole hours, so their local minute is UTC's minute.
  assert pg_temp.zone_at(0) is not null and pg_temp.zone_at(1) is not null and pg_temp.zone_at(9) is not null
     and pg_temp.zone_at(10) is not null and pg_temp.zone_at(23) is not null,
    'A: setup: no Etc/GMT zone at 00, 01, 09, 10 or 23 local';
  assert public.duo_pop_clock_ok(pg_temp.zone_at(10)) and public.duo_pop_clock_ok(pg_temp.zone_at(23)),
    'A: duo_pop_clock_ok refuses a pop at 10:xx or 23:xx local';
  assert not public.duo_pop_clock_ok(pg_temp.zone_at(1)) and not public.duo_pop_clock_ok(pg_temp.zone_at(3))
     and not public.duo_pop_clock_ok(pg_temp.zone_at(9)),
    'A: duo_pop_clock_ok allows a pop at 01:xx, 03:xx or 09:xx local';
  assert public.duo_pop_clock_ok(pg_temp.zone_at(0)) = (extract(minute from now() at time zone 'UTC') < 50),
    format('A: at 00:%s local duo_pop_clock_ok says %s; a pop is allowed from 00:00 to 00:49 only (it must close before 01:00)',
           to_char(now() at time zone 'UTC', 'MI'), public.duo_pop_clock_ok(pg_temp.zone_at(0)));
  assert public.duo_pop_clock_ok(null) = (public.duo_pop_clock_ok('America/New_York') and public.duo_pop_clock_ok('America/Los_Angeles'))
     and public.duo_pop_clock_ok('  ') = public.duo_pop_clock_ok(null),
    'A: duo_pop_clock_ok with no timezone does not need both NA coasts to agree';

  assert exists (select 1 from cron.job where jobname = 'queue-ups-prune-daily' and schedule = '57 9 * * *'
                 and command = 'select public.prune_queue_ups()'), 'A: queue-ups-prune-daily is not scheduled at 57 9 * * *';
  assert (select count(*) from cron.job where jobname = 'queue-ups-prune-daily') = 1, 'A: the prune job is scheduled twice';
  assert exists (select 1 from pg_trigger t where t.tgname = 'queue_ups_forget_profile' and t.tgrelid = 'public.profiles'::regclass
                 and pg_get_triggerdef(t.oid) like '%BEFORE DELETE ON public.profiles FOR EACH ROW%'), 'A: the profile delete trigger is missing';
  -- answer_duo_pop's "zero like alerts" depends on this being deferred (0083).
  assert exists (select 1 from pg_trigger t where t.tgname = 'on_swipe_like_alert' and t.tgrelid = 'public.swipes'::regclass
                 and t.tgdeferrable and t.tginitdeferred), 'A: on_swipe_like_alert is not DEFERRABLE INITIALLY DEFERRED';

  insert into check_log (line) values ('A ok: queue_pop defaults false (nobody opted in at apply time) and is app-writable; queue_ups is RLS-on, policy-less, service-role only; the five RPCs are authenticated-only SECURITY DEFINER with the plan''s shapes; start and stop lock the sender''s profile before any check; a pop goes out only when all 10 minutes sit inside 10:00-00:59 local; helpers have no client grant; call_code_ended is anon-callable; resolve_invite_code and accept_invite keep their shapes and ACLs; the prune job and the delete trigger exist');
end;
$$;

-- ===========================================================================
-- B. Fixtures
-- ===========================================================================
do $$
declare
  v_ids uuid[];
  v_roles text[] := array['s', 'a', 'b', 'p1', 'p2', 'bl', 'eu', 'dm', 'nt', 'z', 'x', 'k', 'inv', 'inv2'];
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

  -- Real, NA East, local noon, set up 30 days ago on a 60-day-old account, not looking.
  update public.profiles
     set is_demo = false, region = 'na_east', timezone = pg_temp.zone_at(12),
         is_looking_now = false, looking_now_expires_at = null,
         onboarding_completed_at = now() - interval '30 days', created_at = now() - interval '60 days'
   where id = any (v_ids);
  update public.profiles set region = 'na_west' where id = pg_temp.id('s');
  update public.profiles set region = 'eu' where id = pg_temp.id('eu');
  update public.profiles set is_demo = true where id = pg_temp.id('dm');
  update public.profiles set timezone = pg_temp.zone_at(3) where id = pg_temp.id('nt');
  -- The two Duo Call answerers are new accounts (redeem_invite_code's 14-day window).
  update public.profiles set created_at = now() - interval '1 day' where id in (pg_temp.id('inv'), pg_temp.id('inv2'));

  update public.preferences set preferred_regions = null, required_language = null, min_age = 18, max_age = 99
   where profile_id = any (v_ids);

  -- League on every card. s Gold II; a Gold I (can duo with s); b Diamond I (cannot); the rest
  -- Silver I.
  insert into public.profile_games (profile_id, game_id, skill_level, priority, lol_tier, lol_division)
  select x.id, v_lol, 'competitive'::public.skill_level_enum, 9, 'silver', 1 from unnest(v_ids) x(id)
  on conflict (profile_id, game_id) do update set lol_tier = 'silver', lol_division = 1;
  update public.profile_games set lol_tier = 'gold', lol_division = 2 where profile_id = pg_temp.id('s') and game_id = v_lol;
  update public.profile_games set lol_tier = 'gold', lol_division = 1 where profile_id = pg_temp.id('a') and game_id = v_lol;
  update public.profile_games set lol_tier = 'diamond', lol_division = 1 where profile_id = pg_temp.id('b') and game_id = v_lol;

  insert into public.push_tokens (profile_id, expo_push_token)
  select x.id, 'ExponentPushToken[check-0085-' || x.id::text || ']' from unnest(v_ids) x(id);

  insert into public.notification_settings (profile_id) select x.id from unnest(v_ids) x(id)
  on conflict (profile_id) do nothing;
  -- Duo Pops off for EVERYONE first, real players included (rolled back with the rest): once
  -- 1.0.2 ships, any real opted-in NA League player would qualify for s's or x's pops and change
  -- the exact recipient sets C, E and F assert. Holds those settings rows for the length of this
  -- run, a few seconds.
  update public.notification_settings set queue_pop = false where queue_pop;
  update public.notification_settings set queue_pop = true
   where profile_id = any (pg_temp.ids(array['a', 'b', 'p1', 'p2', 'bl', 'eu', 'dm', 'nt']));
  delete from public.notification_settings where profile_id = pg_temp.id('z');
  -- z is opted in in every other way: the only thing missing is the settings row.

  -- The pair-level exclusions, all against s.
  insert into public.swipes (swiper_id, target_id, action) values
    (pg_temp.id('s'), pg_temp.id('p1'), 'pass'),
    (pg_temp.id('p2'), pg_temp.id('s'), 'pass');
  insert into public.blocks (blocker_id, blocked_id) values (pg_temp.id('s'), pg_temp.id('bl'));

  assert (select rank_text from public.profile_games where profile_id = pg_temp.id('s') and game_id = v_lol) = 'Gold II',
    'B: setup: s''s League rank_text is not Gold II';
  assert public.lol_solo_duo_eligible('gold', 2, 'gold', 1) is true, 'B: setup: Gold II and Gold I cannot duo';
  assert public.lol_solo_duo_eligible('gold', 2, 'diamond', 1) is false, 'B: setup: Gold II and Diamond I can duo';
  assert pg_temp.zone_at(12) is not null and pg_temp.zone_at(3) is not null, 'B: setup: no Etc/GMT zone at noon or 03:00';

  insert into check_log (line) values ('B setup: fourteen personas made real (dm stays demo), NA (eu in Europe), local noon (nt at 03:00), League ranks, fake tokens; Duo Pops off for everyone else, on for a, b, p1, p2, bl, eu, dm, nt; z has no settings row; s passed p1, p2 passed s, s blocked bl');
end;
$$;

-- ===========================================================================
-- C. Queue up: the right two players are popped, once, and the sender is free to duo
-- ===========================================================================
do $$
declare
  v_lol uuid := public.lol_game_id();
  r record;
  r2 record;
  v_q public.queue_ups%rowtype;
  v_bodies jsonb[];
  v_body jsonb;
  v_set uuid[];
  v_late boolean;
  v_early boolean;
begin
  perform pg_temp.act_as('s');
  select * into r from public.start_queue_up(v_lol, true);
  reset role;

  assert r.already_queued = false, 'C: a first queue-up says already_queued';
  assert r.pop_note is null, format('C: pop_note is %s, expected none (somebody was popped)', r.pop_note);
  assert r.notified = 2, format('C: %s players were popped, expected exactly a and b', r.notified);
  assert r.game_id = v_lol and r.game_name = 'League of Legends', 'C: the wrong game came back';
  assert r.ping, 'C: ping was not recorded';
  assert r.call_code ~ '^[0-9A-HJKMNP-TV-Z]{10}$', 'C: no call code, or a malformed one';
  assert r.created_at = now() and r.pop_expires_at = now() + interval '10 minutes' and r.looking_until = now() + interval '60 minutes',
    'C: the pop and looking windows are not 10 and 60 minutes';
  assert r.ended_at is null and r.locked_at is null and r.match_id is null and r.partner_id is null and r.popped_in_seconds is null,
    'C: a fresh queue-up already has an end or a lock';

  select * into v_q from public.queue_ups where id = r.queue_id;
  assert v_q.recipients = array[pg_temp.id('a'), pg_temp.id('b')],
    'C: recipients are not exactly [a, b] in that order (can duo by rank first)';
  assert v_q.can_duo = array[pg_temp.id('a')], 'C: can_duo is not exactly [a]';
  assert not (v_q.recipients && pg_temp.ids(array['p1', 'p2', 'bl', 'eu', 'dm', 'nt', 'z', 'x', 'k', 'inv', 'inv2', 's'])),
    'C: an excluded player was popped (pass either way, block, non-NA, demo mismatch, 03:00, no settings row, or not opted in)';

  assert (select p.is_looking_now and p.looking_now_expires_at = v_q.looking_until from public.profiles p where p.id = pg_temp.id('s')),
    'C: the sender is not free to duo until looking_until';

  select array_agg(b) into v_bodies from pg_temp.requests('duo_pop') b;
  assert coalesce(array_length(v_bodies, 1), 0) = 2, format('C: %s duo_pop push requests, expected 2', coalesce(array_length(v_bodies, 1), 0));
  foreach v_body in array v_bodies loop
    assert (select array_agg(k order by k) from jsonb_object_keys(v_body) k) = array['popId', 'recipientId', 'type'],
      format('C: a duo_pop payload has other keys: %s', v_body);
    assert v_body->>'popId' = r.queue_id::text, 'C: a duo_pop payload has the wrong popId';
  end loop;
  assert pg_temp.sorted(array[(v_bodies[1]->>'recipientId')::uuid, (v_bodies[2]->>'recipientId')::uuid])
    = pg_temp.sorted(array[pg_temp.id('a'), pg_temp.id('b')]), 'C: the duo_pop requests are not to a and b';

  insert into chk_q values ('s1', r.queue_id, r.call_code, null);

  -- Each of nt, eu, dm and z was left out for its one difference only: fix those and all four
  -- are eligible (a and b are now inside their 3-hour gap).
  begin
    update public.profiles set timezone = pg_temp.zone_at(12) where id = pg_temp.id('nt');
    update public.profiles set region = 'na_east' where id = pg_temp.id('eu');
    update public.profiles set is_demo = false where id = pg_temp.id('dm');
    insert into public.notification_settings (profile_id, queue_pop) values (pg_temp.id('z'), true);
    select pg_temp.sorted(array_agg(d.profile_id)) into v_set from public.duo_pop_recipients(pg_temp.id('s'), v_lol) d;
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_set = pg_temp.ids(array['nt', 'eu', 'dm', 'z']),
    'C: 03:00 local, Europe, demo or a missing settings row was not the only reason a player was left out';

  -- The edge of the night through the real fan-out: nt at 00:xx local is popped only while the
  -- whole 10 minutes closes before 01:00 (00:00 to 00:49), and at 09:xx never.
  begin
    update public.profiles set timezone = pg_temp.zone_at(0) where id = pg_temp.id('nt');
    select pg_temp.id('nt') = any (array_agg(d.profile_id)) is true into v_late
      from public.duo_pop_recipients(pg_temp.id('s'), v_lol) d;
    update public.profiles set timezone = pg_temp.zone_at(9) where id = pg_temp.id('nt');
    select pg_temp.id('nt') = any (array_agg(d.profile_id)) is true into v_early
      from public.duo_pop_recipients(pg_temp.id('s'), v_lol) d;
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_late = (extract(minute from now() at time zone 'UTC') < 50),
    format('C: at 00:%s local nt popped = %s; only 00:00 to 00:49 may (the pop must close before 01:00)',
           to_char(now() at time zone 'UTC', 'MI'), v_late);
  assert not v_early, 'C: nt was popped at 09:xx local';

  -- A second tap while queued: the same row, unchanged, nobody popped again.
  perform pg_temp.act_as('s');
  select * into r2 from public.start_queue_up(v_lol, false);
  reset role;
  assert r2.already_queued and r2.queue_id = r.queue_id and r2.ping and r2.notified = 2 and r2.call_code = r.call_code,
    'C: a second tap did not return the live row unchanged';
  assert (select count(*) from pg_temp.requests('duo_pop')) = 2, 'C: a second tap popped players again';
  assert (select count(*) from public.queue_ups where sender_id = pg_temp.id('s')) = 1, 'C: a second tap wrote a second row';

  perform pg_temp.act_as('s');
  select * into r2 from public.get_my_queue_up();
  reset role;
  assert r2.queue_id = r.queue_id and not r2.already_queued and r2.call_code = r.call_code and r2.notified = 2,
    'C: get_my_queue_up does not return the live row';

  insert into check_log (line) values ('C ok: s''s queue-up pops exactly a then b (can duo first), skipping a pass either way, a block, Europe, a demo account, 03:00 local and a missing settings row; 00:xx local pops only up to 00:49 and 09:xx never; two duo_pop requests naming nobody; s is free to duo for the hour; a second tap returns the same row and pops nobody');
end;
$$;

-- ===========================================================================
-- D. The Pop card
-- ===========================================================================
do $$
declare
  r record;
  v_n int;
  v_pop uuid := (select queue_id from chk_q where label = 's1');
  v_age int := (select extract(year from age(current_date, p.dob))::int from public.profiles p where p.id = pg_temp.id('s'));
  v_name text := (select display_name from public.profiles where id = pg_temp.id('s'));
begin
  perform pg_temp.act_as('p1');
  select count(*) into v_n from public.get_duo_pop(v_pop);
  reset role;
  assert v_n = 0, 'D: a player who was not popped can read the pop';

  perform pg_temp.act_as('a');
  select * into r from public.get_duo_pop(v_pop);
  reset role;
  assert r.pop_id = v_pop and r.sender_id = pg_temp.id('s'), 'D: a cannot read the pop';
  assert r.status = 'open' and r.seconds_left = 600, format('D: status %s with %s seconds left, expected open with 600', r.status, r.seconds_left);
  assert r.age = v_age and r.display_name is not distinct from v_name, 'D: the sender''s name or age is wrong (ages stay)';
  assert r.game_name = 'League of Legends' and r.rank_text = 'Gold II', 'D: the game or rank text is wrong';
  assert r.can_duo is true and r.match_id is null, 'D: a should see can duo and no match';
  assert (select opened = array[pg_temp.id('a')] from public.queue_ups where id = v_pop), 'D: opening the pop was not recorded';

  perform pg_temp.act_as('b');
  select * into r from public.get_duo_pop(v_pop);
  reset role;
  assert r.status = 'open' and r.can_duo is false, 'D: b should see an open pop without can duo';

  -- A block between them inside the 10 minutes hides it, and answering it is unavailable.
  begin
    insert into public.blocks (blocker_id, blocked_id) values (pg_temp.id('b'), pg_temp.id('s'));
    perform pg_temp.act_as('b');
    select count(*) into v_n from public.get_duo_pop(v_pop);
    select a.result into r from public.answer_duo_pop(v_pop, true) a;
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_n = 0, 'D: a pop is still readable after the recipient blocked the sender';
  assert r.result = 'unavailable', format('D: answering after a block gave %s, not unavailable', r.result);

  insert into check_log (line) values ('D ok: only the popped can read the pop; it shows the sender''s name, AGE, game, Gold II and can duo for a only, 600 server seconds, records the open; a block inside the window hides it and answers unavailable');
end;
$$;

-- ===========================================================================
-- E. I'm in: the first wins, the second is taken, no like alert, one new_match push
-- ===========================================================================
do $$
declare
  r record;
  v_pop uuid := (select queue_id from chk_q where label = 's1');
  v_match uuid;
  v_swipes_before bigint := (select coalesce(sum(swipe_count), 0) from public.daily_swipe_counters
                             where profile_id in (pg_temp.id('s'), pg_temp.id('a')));
begin
  perform pg_temp.act_as('a');
  select * into r from public.answer_duo_pop(v_pop, true);
  reset role;
  assert r.result = 'locked' and r.match_id is not null and r.popped_in_seconds = 1,
    format('E: a''s I''m in gave %s / %s / %s, expected locked, a match and 1 second', r.result, r.match_id, r.popped_in_seconds);
  v_match := r.match_id;
  update chk_q set match_id = v_match where label = 's1';

  perform pg_temp.act_as('b');
  select * into r from public.answer_duo_pop(v_pop, true);
  reset role;
  assert r.result = 'taken' and r.match_id is null, format('E: the second I''m in gave %s, not taken', r.result);

  perform pg_temp.act_as('a');
  select * into r from public.answer_duo_pop(v_pop, true);
  reset role;
  assert r.result = 'locked' and r.match_id = v_match, 'E: a''s second I''m in is not the same lock';

  assert exists (select 1 from public.matches m where m.id = v_match and m.unmatched_at is null
                 and m.user_a_id = least(pg_temp.id('s'), pg_temp.id('a')) and m.user_b_id = greatest(pg_temp.id('s'), pg_temp.id('a'))),
    'E: no live match between s and a';
  assert exists (select 1 from public.swipes where swiper_id = pg_temp.id('s') and target_id = pg_temp.id('a') and action = 'like')
     and exists (select 1 from public.swipes where swiper_id = pg_temp.id('a') and target_id = pg_temp.id('s') and action = 'like'),
    'E: the two likes are not both there';
  assert (select coalesce(sum(swipe_count), 0) from public.daily_swipe_counters where profile_id in (pg_temp.id('s'), pg_temp.id('a')))
    = v_swipes_before, 'E: the lock charged a swipe';
  assert (select locked_by = pg_temp.id('a') and locked_at = now() and match_id = v_match from public.queue_ups where id = v_pop),
    'E: the row does not record a''s lock and the match';

  -- The commit, as far as the like trigger can tell: both likes and the match exist, so 0072's
  -- swiped-back check skips both.
  perform pg_temp.fire_like_alerts();
  assert not exists (select 1 from public.like_alerts
                     where (recipient_id = pg_temp.id('s') and liker_id = pg_temp.id('a'))
                        or (recipient_id = pg_temp.id('a') and liker_id = pg_temp.id('s'))), 'E: the lock wrote a like alert';
  assert not exists (select 1 from pg_temp.requests('new_like') b
                     where b->>'recipientId' in (pg_temp.id('s')::text, pg_temp.id('a')::text)), 'E: the lock queued a like push';
  assert (select count(*) from pg_temp.requests('new_match') b where b->>'matchId' = v_match::text) = 1,
    'E: the lock did not queue exactly one new_match request';

  perform pg_temp.act_as('s');
  select * into r from public.get_my_queue_up();
  reset role;
  assert r.partner_id = pg_temp.id('a') and r.match_id = v_match and r.popped_in_seconds = 1 and r.locked_at = now(),
    'E: the sender''s status does not show the lock';
  assert r.partner_name is not distinct from (select display_name from public.profiles where id = pg_temp.id('a')),
    'E: partner_name is not a''s display name';

  perform pg_temp.act_as('a');
  select * into r from public.get_duo_pop(v_pop);
  reset role;
  assert r.status = 'locked_by_you' and r.match_id = v_match and r.seconds_left = 0, 'E: a''s re-open is not locked_by_you with the match';

  perform pg_temp.act_as('b');
  select * into r from public.get_duo_pop(v_pop);
  reset role;
  assert r.status = 'taken' and r.match_id is null, 'E: b does not see taken, or sees the match id';

  perform pg_temp.act_as('b');
  select * into r from public.answer_duo_pop(v_pop, false);
  reset role;
  assert r.result = 'declined', 'E: Not now did not answer declined';
  assert (select declined = array[pg_temp.id('b')] from public.queue_ups where id = v_pop), 'E: Not now was not remembered';

  perform pg_temp.act_as('p1');
  select * into r from public.answer_duo_pop(v_pop, true);
  reset role;
  assert r.result = 'unavailable', 'E: a player who was not popped could answer';

  insert into check_log (line) values ('E ok: a''s I''m in locks (popped in 1 s, no swipe charged, two likes and a live match), b gets taken, a again gets the same lock; zero like alerts at commit and exactly one new_match request; the sender sees partner, match and seconds; Not now is remembered; a stranger''s answer is unavailable');
end;
$$;

-- ===========================================================================
-- F. The recipient caps (1 in 3 hours, 3 in 24 hours) and the 7-day Not now memory
-- ===========================================================================
do $$
declare
  v_lol uuid := public.lol_game_id();
  r record;
  v_q public.queue_ups%rowtype;
  v_s1 uuid := (select queue_id from chk_q where label = 's1');
  v_set uuid[];
begin
  -- p1 had 3 pops in the last 24 hours (none in the last 3); p2 had 2.
  perform pg_temp.old_pop(pg_temp.id('eu'), array[pg_temp.id('p1')], 5);
  perform pg_temp.old_pop(pg_temp.id('eu'), array[pg_temp.id('p1')], 10);
  perform pg_temp.old_pop(pg_temp.id('eu'), array[pg_temp.id('p1')], 20);
  perform pg_temp.old_pop(pg_temp.id('eu'), array[pg_temp.id('p2')], 4);
  perform pg_temp.old_pop(pg_temp.id('eu'), array[pg_temp.id('p2')], 6);

  perform pg_temp.act_as('x');
  select * into r from public.start_queue_up(v_lol, true);
  reset role;
  select * into v_q from public.queue_ups where id = r.queue_id;
  insert into chk_q values ('x1', r.queue_id, r.call_code, null);
  assert pg_temp.sorted(v_q.recipients) = pg_temp.ids(array['p2', 'bl']),
    'F: x''s pop did not go to exactly p2 and bl (a and b were popped under 3 hours ago, p1 three times today)';

  -- The 3-hour cap was the only thing keeping a and b out: move s's pop 4 hours back.
  update public.queue_ups
     set created_at = created_at - interval '4 hours', pop_expires_at = pop_expires_at - interval '4 hours',
         looking_until = looking_until - interval '4 hours', locked_at = locked_at - interval '4 hours'
   where id = v_s1;
  select pg_temp.sorted(array_agg(d.profile_id)) into v_set from public.duo_pop_recipients(pg_temp.id('x'), v_lol) d;
  assert v_set = pg_temp.ids(array['a', 'b']), 'F: with s''s pop 4 hours old, a and b are still not eligible for x';

  -- And the third pop of the day was the only thing keeping p1 out of the 3-hour-free set.
  delete from public.queue_ups where sender_id = pg_temp.id('eu') and recipients = array[pg_temp.id('p1')]
    and created_at = now() - interval '20 hours';
  select pg_temp.sorted(array_agg(d.profile_id)) into v_set from public.duo_pop_recipients(pg_temp.id('x'), v_lol) d;
  assert v_set = pg_temp.ids(array['a', 'b', 'p1']), 'F: with two pops today, p1 is still not eligible';

  -- s queues again (the old row is past its window): a is matched, b said Not now to s, and
  -- every other popped-in player is excluded from s by a pass, a block or a recent pop.
  perform pg_temp.act_as('s');
  select * into r from public.start_queue_up(v_lol, true);
  reset role;
  assert r.already_queued = false and r.queue_id <> v_s1, 'F: s''s second queue-up reused the old row';
  assert r.pop_note = 'no_players' and r.notified = 0 and r.call_code is not null,
    format('F: s''s second queue-up gave %s / %s, expected no_players with a call code', r.pop_note, r.notified);
  insert into chk_q values ('s2', r.queue_id, r.call_code, null);

  -- Not now was the only thing keeping b out.
  update public.queue_ups set declined = '{}' where id = v_s1;
  select pg_temp.sorted(array_agg(d.profile_id)) into v_set from public.duo_pop_recipients(pg_temp.id('s'), v_lol) d;
  assert v_set = pg_temp.ids(array['b']), 'F: without the Not now, b is still not eligible for s';
  update public.queue_ups set declined = array[pg_temp.id('b')] where id = v_s1;

  -- And it lasts 7 days, not forever.
  update public.queue_ups
     set created_at = created_at - interval '7 days', pop_expires_at = pop_expires_at - interval '7 days',
         looking_until = looking_until - interval '7 days', locked_at = locked_at - interval '7 days'
   where id = v_s1;
  select pg_temp.sorted(array_agg(d.profile_id)) into v_set from public.duo_pop_recipients(pg_temp.id('s'), v_lol) d;
  assert v_set = pg_temp.ids(array['b']), 'F: a Not now older than 7 days still keeps b out';
  update public.queue_ups
     set created_at = created_at + interval '7 days', pop_expires_at = pop_expires_at + interval '7 days',
         looking_until = looking_until + interval '7 days', locked_at = locked_at + interval '7 days'
   where id = v_s1;

  -- The sender's own cap: 3 queue-ups with pops in 24 hours. s has 1; two more make 3.
  perform pg_temp.old_pop(pg_temp.id('s'), array[pg_temp.id('dm')], 2);
  perform pg_temp.old_pop(pg_temp.id('s'), array[pg_temp.id('nt')], 3);
  perform pg_temp.act_as('s');
  perform public.stop_queue_up();
  select * into r from public.start_queue_up(v_lol, true);
  reset role;
  assert r.pop_note = 'daily_limit' and r.notified = 0, format('F: the fourth queue-up of the day gave %s, not daily_limit', r.pop_note);
  assert (select p.is_looking_now from public.profiles p where p.id = pg_temp.id('s')), 'F: a daily_limit queue-up did not leave s free to duo';

  insert into check_log (line) values ('F ok: a and b (popped under 3 hours ago) and p1 (3 pops today) are skipped for x, who pops p2 and bl; each cap alone was the reason; Not now keeps b out of s''s pops for 7 days and no longer; the sender''s fourth queue-up with pops in a day is daily_limit and still queued');
end;
$$;

-- ===========================================================================
-- G. The sender's rules and the other notes; stop; ended and expired pops
-- ===========================================================================
do $$
declare
  v_lol uuid := public.lol_game_id();
  v_other_game uuid;
  r record;
  v_x1 uuid := (select queue_id from chk_q where label = 'x1');
  v_err text;
  v_hint text;
begin
  perform pg_temp.act_as('x');
  perform public.stop_queue_up();
  reset role;
  assert (select ended_at = now() from public.queue_ups where id = v_x1), 'G: stop did not end x''s row';
  assert (select not p.is_looking_now and p.looking_now_expires_at is null from public.profiles p where p.id = pg_temp.id('x')),
    'G: stop did not clear free to duo';
  perform pg_temp.act_as('x');
  perform public.stop_queue_up();
  reset role;

  -- An ended pop reads ended and answers ended.
  perform pg_temp.act_as('bl');
  select * into r from public.get_duo_pop(v_x1);
  assert r.status = 'ended' and r.seconds_left = 0, format('G: a stopped pop reads %s', r.status);
  select * into r from public.answer_duo_pop(v_x1, true);
  reset role;
  assert r.result = 'ended', format('G: answering a stopped pop gave %s', r.result);

  -- An open pop past its 10 minutes reads expired and answers expired.
  begin
    update public.queue_ups
       set ended_at = null, created_at = now() - interval '11 minutes',
           pop_expires_at = now() - interval '1 minute', looking_until = now() + interval '49 minutes'
     where id = v_x1;
    perform pg_temp.act_as('bl');
    select g.status into v_err from public.get_duo_pop(v_x1) g;
    select a.result into v_hint from public.answer_duo_pop(v_x1, true) a;
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_err = 'expired' and v_hint = 'expired', format('G: a pop past 10 minutes reads %s and answers %s', v_err, v_hint);

  -- A day past setup: 23 hours is too new.
  update public.profiles set onboarding_completed_at = now() - interval '23 hours' where id = pg_temp.id('x');
  perform pg_temp.act_as('x');
  select * into r from public.start_queue_up(v_lol, true);
  perform public.stop_queue_up();
  reset role;
  assert r.pop_note = 'too_new' and r.notified = 0 and r.call_code is not null, format('G: a 23-hour-old sender got %s, not too_new', r.pop_note);
  update public.profiles set onboarding_completed_at = now() - interval '30 days' where id = pg_temp.id('x');

  -- A report against the sender in the last 30 days.
  insert into public.reports (reporter_id, reported_id, reason) values (pg_temp.id('eu'), pg_temp.id('x'), 'spam');
  perform pg_temp.act_as('x');
  select * into r from public.start_queue_up(v_lol, true);
  perform public.stop_queue_up();
  reset role;
  assert r.pop_note = 'unavailable' and r.notified = 0, format('G: a reported sender got %s, not unavailable', r.pop_note);
  delete from public.reports where reported_profile_id = pg_temp.id('x');

  perform pg_temp.act_as('x');
  select * into r from public.start_queue_up(v_lol, false);
  perform public.stop_queue_up();
  reset role;
  assert r.pop_note = 'ping_off' and r.notified = 0 and not r.ping, format('G: Ping players off gave %s, not ping_off', r.pop_note);

  update public.profiles set region = 'eu' where id = pg_temp.id('x');
  perform pg_temp.act_as('x');
  select * into r from public.start_queue_up(v_lol, true);
  perform public.stop_queue_up();
  reset role;
  assert r.pop_note = 'outside_na' and r.notified = 0, format('G: a sender in Europe got %s, not outside_na', r.pop_note);
  update public.profiles set region = 'na_east' where id = pg_temp.id('x');

  assert (select count(*) from pg_temp.requests('duo_pop') b where b->>'popId' <> v_x1::text
            and b->>'popId' <> (select queue_id::text from chk_q where label = 's1')) = 0,
    'G: a queue-up with a pop_note still queued a duo_pop request';

  -- A game that is not on the profile.
  select g.id into v_other_game from public.games g
   where not exists (select 1 from public.profile_games pg where pg.profile_id = pg_temp.id('x') and pg.game_id = g.id)
   limit 1;
  begin
    perform pg_temp.act_as('x');
    perform public.start_queue_up(v_other_game, true);
    v_err := 'no error';
  exception when others then
    get stacked diagnostics v_err = message_text, v_hint = pg_exception_hint;
  end;
  reset role;
  assert v_err = 'not_your_game' and v_hint = 'Pick one of the games on your profile.',
    format('G: queueing a game not on the profile gave %s / %s', v_err, v_hint);

  insert into check_log (line) values ('G ok: stop ends the row and clears free to duo (twice is fine); a stopped pop reads and answers ended, a pop past 10 minutes expired; a 23-hour-old sender is too_new, a reported one unavailable, Ping off is ping_off, Europe is outside_na, none of them pops anyone and each still gets a call code; a game not on the profile raises not_your_game with its hint');
end;
$$;

-- ===========================================================================
-- H. Duo Call: a call code through the invite plumbing; permanent codes unchanged
-- ===========================================================================
do $$
declare
  v_lol uuid := public.lol_game_id();
  r record;
  v_code text;
  v_perm text;
  v_who uuid;
  v_n int;
  v_ended boolean;
  v_live_ended boolean;
  v_capped boolean;
  v_capped_like boolean;
  v_stopped boolean;
  v_stopped_resolves int;
  v_stopped_ended boolean;
  v_lapsed_resolves int;
  v_lapsed_ended boolean;
  v_grace_resolves int;
begin
  perform pg_temp.act_as('k');
  select * into r from public.start_queue_up(v_lol, false);
  reset role;
  v_code := r.call_code;
  insert into chk_q values ('k1', r.queue_id, v_code, null);

  -- Signed out, as the front door does it: any case, any punctuation.
  perform pg_temp.act_as_anon();
  select c.inviter_id into v_who from public.resolve_invite_code(lower(substr(v_code, 1, 5)) || '-' || substr(v_code, 6)) c;
  select count(*) into v_n from public.resolve_invite_code(v_code);
  v_live_ended := public.call_code_ended(v_code);
  reset role;
  assert v_who = pg_temp.id('k') and v_n = 1, 'H: a live call code does not resolve to its sender for anon';
  assert v_live_ended = false, 'H: a live call code reads as ended';

  -- The 15-minute grace after the window: at 14 minutes past it still resolves.
  begin
    update public.queue_ups
       set created_at = now() - interval '74 minutes', pop_expires_at = now() - interval '64 minutes',
           looking_until = now() - interval '14 minutes'
     where id = r.queue_id;
    perform pg_temp.act_as_anon();
    select count(*) into v_grace_resolves from public.resolve_invite_code(v_code);
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_grace_resolves = 1, 'H: a call code 14 minutes past its window no longer resolves';

  -- inv, a new account, redeems it at Save.
  perform pg_temp.act_as('inv');
  select * into r from public.redeem_invite_code(v_code);
  reset role;
  assert r.inviter_id = pg_temp.id('k') and r.connected = false, 'H: redeeming the call code did not name k';
  assert exists (select 1 from public.invite_redemptions where invitee_id = pg_temp.id('inv')
                 and inviter_id = pg_temp.id('k') and code = v_code), 'H: the redemption row is missing';

  -- Three other answers to this call already connected: the fourth gets no standing like.
  begin
    insert into public.invite_redemptions (invitee_id, inviter_id, code, connected_at) values
      (pg_temp.id('p1'), pg_temp.id('k'), v_code, now()),
      (pg_temp.id('p2'), pg_temp.id('k'), v_code, now()),
      (pg_temp.id('bl'), pg_temp.id('k'), v_code, now());
    perform pg_temp.act_as('inv');
    select a.matched into v_capped from public.accept_invite() a;
    reset role;
    v_capped_like := exists (select 1 from public.swipes where swiper_id = pg_temp.id('k') and target_id = pg_temp.id('inv'));
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_capped = false and not v_capped_like, 'H: a fourth answer to one call still got the standing like';

  -- After Stop the code stops resolving at once, reads as ended, and gives no standing like.
  begin
    perform pg_temp.act_as('k');
    perform public.stop_queue_up();
    perform pg_temp.act_as_anon();
    select count(*) into v_stopped_resolves from public.resolve_invite_code(v_code);
    v_stopped_ended := public.call_code_ended(v_code);
    perform pg_temp.act_as('inv');
    select a.matched into v_stopped from public.accept_invite() a;
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_stopped_resolves = 0 and v_stopped_ended, 'H: a stopped call''s code still resolves, or does not read as ended';
  assert v_stopped = false, 'H: answering a stopped call still matched';

  -- 15 minutes past the window, the same.
  begin
    update public.queue_ups
       set created_at = now() - interval '76 minutes', pop_expires_at = now() - interval '66 minutes',
           looking_until = now() - interval '16 minutes'
     where call_code = v_code;
    perform pg_temp.act_as_anon();
    select count(*) into v_lapsed_resolves from public.resolve_invite_code(v_code);
    v_lapsed_ended := public.call_code_ended(v_code);
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_lapsed_resolves = 0 and v_lapsed_ended, 'H: a call code 16 minutes past its window still resolves';

  -- The real answer, inside the window and under every cap: a match with k.
  perform pg_temp.act_as('inv');
  select * into r from public.accept_invite();
  reset role;
  assert r.matched and r.inviter_id = pg_temp.id('k') and r.match_id is not null, 'H: answering a live call did not match with k';

  -- Permanent codes are unchanged: k's own code resolves and its answer still gets the standing like.
  perform pg_temp.act_as('k');
  v_perm := public.get_or_create_invite_code();
  reset role;
  assert v_perm <> v_code, 'H: the permanent code equals the call code';
  perform pg_temp.act_as_anon();
  select c.inviter_id into v_who from public.resolve_invite_code(v_perm) c;
  v_ended := public.call_code_ended(v_perm);
  reset role;
  assert v_who = pg_temp.id('k'), 'H: k''s permanent code no longer resolves';
  assert v_ended = false, 'H: a permanent code reads as an ended call';
  perform pg_temp.act_as('inv2');
  perform public.redeem_invite_code(v_perm);
  select * into r from public.accept_invite();
  reset role;
  assert r.matched and r.inviter_id = pg_temp.id('k'), 'H: a permanent code''s answer no longer matches';

  perform pg_temp.act_as_anon();
  select count(*) into v_n from public.resolve_invite_code('ZZZZZZZZZZ');
  v_ended := public.call_code_ended('ZZZZZZZZZZ') or public.call_code_ended('not a code') or public.call_code_ended(null);
  reset role;
  assert v_n = 0 and not v_ended, 'H: an unknown code resolves or reads as an ended call';

  insert into check_log (line) values ('H ok: a live call code resolves for anon in any case and punctuation (and 14 minutes past its window), a new account redeems it and matches; a fourth connected answer, a stopped call and a lapsed window each give no standing like, and the code then reads as ended; permanent codes resolve and auto-like as before; unknown codes neither resolve nor read as ended');
end;
$$;

-- ===========================================================================
-- I. Account deletion leaves no trace in anyone else's row; the locker's lock stays a lock
-- ===========================================================================
do $$
declare
  v_s1 uuid := (select queue_id from chk_q where label = 's1');
  v_left_b int;
  v_q public.queue_ups%rowtype;
  v_x1_before uuid[];
  v_x1_after uuid[];
begin
  select recipients into v_x1_before from public.queue_ups where id = (select queue_id from chk_q where label = 'x1');
  begin
    delete from public.profiles where id = pg_temp.id('b');
    select count(*) into v_left_b from public.queue_ups
     where recipients @> array[pg_temp.id('b')] or can_duo @> array[pg_temp.id('b')]
        or opened @> array[pg_temp.id('b')] or declined @> array[pg_temp.id('b')];
    delete from public.profiles where id = pg_temp.id('a');
    select * into v_q from public.queue_ups where id = v_s1;
    delete from public.profiles where id = pg_temp.id('bl');
    select recipients into v_x1_after from public.queue_ups where id = (select queue_id from chk_q where label = 'x1');
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_left_b = 0, 'I: a deleted recipient is still in a queue_ups array';
  assert v_q.id = v_s1, 'I: deleting the locker deleted the sender''s row';
  assert v_q.locked_by is null and v_q.locked_at is not null and v_q.match_id is null,
    'I: deleting the locker did not leave a lock with no locker and no match';
  assert v_q.recipients = '{}' and v_q.can_duo = '{}' and v_q.opened = '{}' and v_q.declined = '{}',
    'I: the deleted players are still in s''s row';
  assert v_x1_after = array_remove(v_x1_before, pg_temp.id('bl')) and cardinality(v_x1_after) = cardinality(v_x1_before) - 1,
    'I: deleting bl did not take exactly bl out of x''s row';

  -- The sender's own rows go with them.
  begin
    delete from public.profiles where id = pg_temp.id('s');
    select count(*) into v_left_b from public.queue_ups where sender_id = pg_temp.id('s');
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_left_b = 0, 'I: a deleted sender''s rows are still there';

  -- Retention: the prune deletes exactly the rows older than 30 days.
  begin
    perform pg_temp.old_pop(pg_temp.id('eu'), array[]::uuid[], 24 * 31);
    perform pg_temp.old_pop(pg_temp.id('eu'), array[]::uuid[], 24 * 29);
    v_left_b := public.prune_queue_ups();
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_left_b = (select count(*) from public.queue_ups where created_at < now() - interval '30 days') + 1,
    'I: prune_queue_ups did not delete exactly the rows older than 30 days';

  insert into check_log (line) values ('I ok: deleting an account takes it out of every other queue_ups array; deleting the locker keeps the lock (locked_at, no locker, no match) and cannot fail; a deleted sender''s rows go with them; the prune deletes only rows older than 30 days');
end;
$$;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
