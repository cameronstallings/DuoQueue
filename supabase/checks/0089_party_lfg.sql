-- Checks for supabase/migrations/0089_party_lfg.sql.
--
-- Plain script: plpgsql `assert` in `do` blocks, one transaction, rolled back at the end.
--
-- HOW TO RUN IT
--   After 0089 is committed, alone:
--     powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0089_party_lfg.sql
--   Before: one scratch file holding 0089, then this file's body (everything between its first
--   `begin;` line and its last `rollback;` line), run through apply-migration.ps1 WITHOUT
--   -Commit. A failure prints "MIGRATION FAILED" with the message; a pass prints "DRY RUN OK".
--   To read the log lines, wrap the same scratch file in `begin;` ... `rollback;` and run it
--   through run-sql.ps1 -QueryFile.
--
-- NO PUSH IS SENT. notify_via_edge_function only inserts into net.http_request_queue, which the
-- pg_net worker reads after COMMIT; this rolls back. That queue is how the checks read the
-- party_message and party_joined payloads.
--
-- Sub-tests that must not leave a trace run inside a plpgsql block that ends by raising
-- 'rollback_probe' and catching it (rows, rate-limit hits and the role all roll back).
--
-- WHO: eight of the seeded demo personas (@duoqueue.io, never the review account) made real
-- INSIDE this transaction. RPCs run as `authenticated` with request.jwt.claims, the code lookup
-- as `anon`. All rolled back.
--
--   a, b   party P, matched; a shares the post (a is 27, b is 25)
--   c      not in P; the third member when a probe needs P full
--   n      a new player who joins P with the code      m   a second joiner, too late
--   j      the joiner each safety rule is tried on
--   d      holds a pending DECK invite into P (declined when the seat goes)
--   e      with c, party Q: the 1.0.1 deck flow, unchanged

begin;

set local lock_timeout = '5s';

create temp table check_log (n serial primary key, line text not null);
create temp table chk_ids (role text primary key, id uuid not null);
create temp table chk_vals (k text primary key, v text);
create temp table chk_base (queue_id bigint not null);
grant select on chk_ids, chk_vals to authenticated, anon;

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

create function pg_temp.val(p_k text) returns text
language sql stable as $f$
  select c.v from chk_vals c where c.k = p_k
$f$;

-- Runs p_sql as p_who and returns 'ok', or 'message | detail | hint' of the error it raised.
-- The error's subtransaction rolls back whatever p_sql did; a success keeps it.
create function pg_temp.try_as(p_who text, p_sql text) returns text
language plpgsql as $f$
declare
  v_msg text;
  v_detail text;
  v_hint text;
begin
  begin
    perform pg_temp.act_as(p_who);
    execute p_sql;
    reset role;
    return 'ok';
  exception when others then
    get stacked diagnostics v_msg = message_text, v_detail = pg_exception_detail, v_hint = pg_exception_hint;
    return v_msg || ' | ' || coalesce(v_detail, '') || ' | ' || coalesce(v_hint, '');
  end;
end;
$f$;

-- Push request bodies of one type for party p queued in this transaction.
create function pg_temp.requests(p_type text, p_party uuid) returns setof jsonb
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
  where e.body->>'type' = p_type and e.body->>'partyId' = p_party::text
  order by e.id
$f$;

-- The joiner rules as the app meets them: preview's first status and join's result, as p_who.
create function pg_temp.preview_status(p_who text, p_code text) returns text
language plpgsql as $f$
declare
  v text;
begin
  perform pg_temp.act_as(p_who);
  select x.status into v from public.preview_party_code(p_code) x limit 1;
  reset role;
  return v;
end;
$f$;

create function pg_temp.join_result(p_who text, p_code text) returns text
language plpgsql as $f$
declare
  v text;
begin
  perform pg_temp.act_as(p_who);
  select x.result into v from public.join_party_by_code(p_code) x;
  reset role;
  return v;
end;
$f$;

create function pg_temp.resolve_status(p_code text) returns text
language plpgsql as $f$
declare
  v text;
begin
  perform pg_temp.act_as_anon();
  select x.status into v from public.resolve_party_code(p_code) x;
  reset role;
  return v;
end;
$f$;

-- ===========================================================================
-- A. Shape: the table, the ACLs, the untouched 0070 functions, the cron job
-- ===========================================================================
do $$
declare
  f text;
begin
  assert (select relrowsecurity from pg_class where oid = 'public.party_calls'::regclass), 'A: party_calls has no RLS';
  assert not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_calls'), 'A: party_calls has a policy';
  assert not has_table_privilege('anon', 'public.party_calls', 'select, insert, update, delete'), 'A: anon can touch party_calls';
  assert not has_table_privilege('authenticated', 'public.party_calls', 'select, insert, update, delete'), 'A: authenticated can touch party_calls';
  assert has_table_privilege('service_role', 'public.party_calls', 'select') and has_table_privilege('service_role', 'public.party_calls', 'insert')
     and has_table_privilege('service_role', 'public.party_calls', 'update') and has_table_privilege('service_role', 'public.party_calls', 'delete'),
    'A: service_role does not have full privileges on party_calls';
  assert (select array_agg(column_name::text order by ordinal_position) from information_schema.columns
          where table_schema = 'public' and table_name = 'party_calls')
       = array['id', 'party_id', 'sharer_id', 'game_id', 'code', 'created_at', 'expires_at', 'ended_at', 'filled_at', 'filled_by'],
    'A: party_calls columns are not the ten in the design';
  assert exists (select 1 from pg_constraint where conrelid = 'public.party_calls'::regclass and contype = 'f'
                 and pg_get_constraintdef(oid) = 'FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE'), 'A: party_id does not cascade';
  assert exists (select 1 from pg_constraint where conrelid = 'public.party_calls'::regclass and contype = 'f'
                 and pg_get_constraintdef(oid) = 'FOREIGN KEY (sharer_id) REFERENCES profiles(id) ON DELETE CASCADE'), 'A: sharer_id does not cascade';
  assert exists (select 1 from pg_constraint where conrelid = 'public.party_calls'::regclass and contype = 'f'
                 and pg_get_constraintdef(oid) = 'FOREIGN KEY (filled_by) REFERENCES profiles(id) ON DELETE SET NULL'), 'A: filled_by is not SET NULL';
  assert exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'party_calls' and indexdef like 'CREATE UNIQUE INDEX%(code)%'),
    'A: party_calls.code is not unique';
  -- party_invites is exactly as 0026/0070 left it: no code invites, no new column.
  assert (select array_agg(column_name::text order by ordinal_position) from information_schema.columns
          where table_schema = 'public' and table_name = 'party_invites')
       = array['id', 'party_id', 'target_id', 'status', 'created_at'], 'A: party_invites gained or lost a column';

  foreach f in array array[
    'public.start_party_call(uuid)', 'public.get_party_call(uuid)', 'public.end_party_call(uuid)',
    'public.preview_party_code(text)', 'public.join_party_by_code(text)'
  ] loop
    assert has_function_privilege('authenticated', f, 'execute'), format('A: authenticated cannot call %s', f);
    assert has_function_privilege('service_role', f, 'execute'), format('A: service_role cannot call %s', f);
    assert not has_function_privilege('anon', f, 'execute'), format('A: anon can call %s', f);
    assert not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = f::regprocedure and a.grantee = 0),
      format('A: PUBLIC can call %s', f);
    assert (select prosecdef from pg_proc where oid = f::regprocedure), format('A: %s is not SECURITY DEFINER', f);
  end loop;

  assert (select array_to_string(proacl, ',') from pg_proc where oid = 'public.resolve_party_code(text)'::regprocedure)
    = 'postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres', 'A: resolve_party_code is not anon + authenticated + service_role';
  assert (select provolatile = 's' and prosecdef from pg_proc where oid = 'public.resolve_party_code(text)'::regprocedure),
    'A: resolve_party_code is not STABLE SECURITY DEFINER';

  foreach f in array array[
    'public.party_call_status(uuid)', 'public.party_call_for_code(text)', 'public.party_code_joiner_ok(uuid,uuid)',
    'public.prune_party_calls()', 'public.generate_call_code()', 'public.handle_new_block()'
  ] loop
    assert not has_function_privilege('authenticated', f, 'execute'), format('A: authenticated can call the helper %s', f);
    assert not has_function_privilege('anon', f, 'execute'), format('A: anon can call the helper %s', f);
    assert not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = f::regprocedure and a.grantee = 0),
      format('A: PUBLIC can call the helper %s', f);
  end loop;

  -- The 0070 functions 1.0.1 calls are untouched.
  assert pg_get_function_result('public.respond_party_invite(uuid,boolean)'::regprocedure) = 'void', 'A: respond_party_invite RETURNS changed';
  assert (select array_to_string(proacl, ',') from pg_proc where oid = 'public.respond_party_invite(uuid,boolean)'::regprocedure)
    = 'postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres', 'A: respond_party_invite ACL changed';
  assert pg_get_functiondef('public.respond_party_invite(uuid,boolean)'::regprocedure) not like '%profile_not_ready%',
    'A: respond_party_invite was rebuilt (the corrected design leaves it alone)';
  assert exists (select 1 from pg_trigger t where t.tgname = 'on_block_created' and t.tgrelid = 'public.blocks'::regclass
                 and pg_get_triggerdef(t.oid) like '%AFTER INSERT ON public.blocks FOR EACH ROW EXECUTE FUNCTION handle_new_block()%'),
    'A: handle_new_block is no longer the blocks trigger';

  -- On the membership: how they joined, and whether their app can show a post. Clients cannot
  -- write either (party_members still has no INSERT or UPDATE policy).
  assert exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'party_members' and column_name = 'joined_by_code'
                   and data_type = 'boolean' and is_nullable = 'NO' and column_default = 'false'),
    'A: party_members.joined_by_code is not a boolean, not null, default false';
  assert exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'party_members' and column_name = 'lfg_seen_at'
                   and data_type = 'timestamp with time zone' and is_nullable = 'YES' and column_default is null),
    'A: party_members.lfg_seen_at is not a nullable timestamptz with no default';
  assert not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_members'
                     and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')),
    'A: party_members has a write policy (a client could mark itself, or anyone, as a code joiner)';
  -- At apply time (0089 not yet recorded), no existing membership may read as a code join or a
  -- seen post. Once it is applied, both are the feature working.
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '0089') then
    assert not exists (select 1 from public.party_members where joined_by_code or lfg_seen_at is not null),
      'A: an existing membership reads as a code join or a seen post at apply time';
  end if;

  -- The chat: one select policy, for authenticated, through party_message_visible.
  assert (select count(*) from pg_policies where schemaname = 'public' and tablename = 'party_messages' and cmd = 'SELECT') = 1,
    'A: party_messages has other than one select policy';
  assert exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_messages'
                 and policyname = 'party_messages_select_member' and cmd = 'SELECT' and roles::text = '{authenticated}'
                 and qual = 'party_message_visible(party_id, created_at)'),
    'A: party_messages_select_member is not "authenticated, party_message_visible(party_id, created_at)"';
  assert (select array_to_string(proacl, ',') from pg_proc where oid = 'public.party_message_visible(uuid,timestamptz)'::regprocedure)
    = 'postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres', 'A: party_message_visible is not authenticated + service_role only';
  assert (select provolatile = 's' and prosecdef from pg_proc where oid = 'public.party_message_visible(uuid,timestamptz)'::regprocedure),
    'A: party_message_visible is not STABLE SECURITY DEFINER';

  -- handle_new_block takes the party locks before anything else (the block/join race).
  assert position('for no key update' in pg_get_functiondef('public.handle_new_block()'::regprocedure))
       between 1 and position('update public.matches' in pg_get_functiondef('public.handle_new_block()'::regprocedure)),
    'A: handle_new_block does not lock the parties before its first write';
  assert pg_get_functiondef('public.handle_new_block()'::regprocedure) not like '%party_calls%',
    'A: handle_new_block still reads party_calls (pruned at 30 days) to protect founders';

  -- Under 18 cannot be tested as a joiner: profiles.profile_must_be_18 refuses the row itself, so
  -- party_code_joiner_ok's own 18+ test is defence in depth. Pin the constraint it leans on.
  assert exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profile_must_be_18'),
    'A: profiles.profile_must_be_18 is gone (party_code_joiner_ok''s 18+ test would be the only floor)';

  assert exists (select 1 from cron.job where jobname = 'party-calls-prune-daily' and schedule = '58 9 * * *'
                 and command = 'select public.prune_party_calls()'), 'A: party-calls-prune-daily is not scheduled at 58 9 * * *';
  assert (select count(*) from cron.job where jobname = 'party-calls-prune-daily') = 1, 'A: the prune job is scheduled twice';

  insert into check_log (line) values ('A ok: party_calls is RLS-on, policy-less, service-role only, ten columns (party and sharer cascade, filled_by SET NULL, unique code); party_invites unchanged; party_members gains joined_by_code and lfg_seen_at (unset on every existing row, no write policy); party_messages has one select policy, for authenticated, through party_message_visible; start/get/end/preview/join are authenticated-only SECURITY DEFINER; resolve_party_code is anon-callable STABLE; the helpers, generate_call_code and handle_new_block have no client grant; handle_new_block locks parties first and no longer reads party_calls; respond_party_invite untouched; the prune job is scheduled once at 09:58');
end;
$$;

-- ===========================================================================
-- B. Fixtures
-- ===========================================================================
do $$
declare
  v_ids uuid[];
  v_roles text[] := array['a', 'b', 'c', 'n', 'm', 'j', 'd', 'e'];
  v_lol uuid := public.lol_game_id();
  v_other uuid;
  v_p uuid;
  v_q uuid;
  i int;
begin
  select array_agg(x.id order by x.id) into v_ids from (
    select p.id
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.is_demo and p.onboarding_completed and p.is_active and not p.is_banned and not p.is_admin_suspended
      and u.email like '%@duoqueue.io' and u.email <> 'review@duoqueue.io'
    order by p.id
    limit 8
  ) x;
  if coalesce(array_length(v_ids, 1), 0) < 8 then
    raise exception 'B: need 8 demo personas, found %', coalesce(array_length(v_ids, 1), 0);
  end if;
  for i in 1..8 loop
    insert into chk_ids values (v_roles[i], v_ids[i]);
  end loop;

  -- A clean slate between every pair of fixtures, and no parties of theirs.
  delete from public.swipes where swiper_id = any (v_ids) and target_id = any (v_ids);
  delete from public.matches where user_a_id = any (v_ids) and user_b_id = any (v_ids);
  delete from public.blocks where blocker_id = any (v_ids) or blocked_id = any (v_ids);
  delete from public.reports where reporter_profile_id = any (v_ids) or reported_profile_id = any (v_ids);
  delete from public.rate_limit_hits where profile_id = any (v_ids);
  delete from public.parties pa where exists (select 1 from public.party_members pm where pm.party_id = pa.id and pm.profile_id = any (v_ids));
  delete from public.party_invites where target_id = any (v_ids);
  delete from public.party_calls where sharer_id = any (v_ids) or filled_by = any (v_ids);
  delete from public.push_tokens where profile_id = any (v_ids);

  update public.profiles
     set is_demo = false, region = 'na_east', is_looking_now = false, looking_now_expires_at = null,
         dob = (current_date - interval '25 years')::date,
         onboarding_completed_at = now() - interval '30 days', created_at = now() - interval '60 days'
   where id = any (v_ids);
  update public.profiles set dob = (current_date - interval '27 years')::date where id = pg_temp.id('a');
  -- Age ranges open (18 to 99), so only section E's probes narrow them.
  update public.preferences set min_age = 18, max_age = 99 where profile_id = any (v_ids);
  insert into public.push_tokens (profile_id, expo_push_token)
  select x.id, 'ExponentPushToken[check-0089-' || x.id::text || ']' from unnest(v_ids) x(id);

  -- Games: League on every card; a ALSO has another game ahead of League, which b does not have,
  -- so the post names League (the first of a's games b also has).
  select g.id into v_other from public.games g where g.id <> v_lol order by g.name limit 1;
  delete from public.profile_games where profile_id = any (v_ids);
  insert into public.profile_games (profile_id, game_id, skill_level, priority)
  select x.id, v_lol, 'competitive'::public.skill_level_enum, 2 from unnest(v_ids) x(id);
  insert into public.profile_games (profile_id, game_id, skill_level, priority)
  values (pg_temp.id('a'), v_other, 'competitive'::public.skill_level_enum, 1);

  -- Party P: a and b, matched. Party Q: c and e, matched.
  insert into public.matches (user_a_id, user_b_id)
  values (least(pg_temp.id('a'), pg_temp.id('b')), greatest(pg_temp.id('a'), pg_temp.id('b'))),
         (least(pg_temp.id('c'), pg_temp.id('e')), greatest(pg_temp.id('c'), pg_temp.id('e')));
  insert into public.parties (created_by) values (pg_temp.id('a')) returning id into v_p;
  insert into public.party_members (party_id, profile_id) values (v_p, pg_temp.id('a')), (v_p, pg_temp.id('b'));
  insert into public.parties (created_by) values (pg_temp.id('c')) returning id into v_q;
  insert into public.party_members (party_id, profile_id) values (v_q, pg_temp.id('c')), (v_q, pg_temp.id('e'));

  insert into chk_vals values ('P', v_p::text), ('Q', v_q::text), ('lol', v_lol::text), ('other_game', v_other::text);

  insert into check_log (line) values ('B setup: eight personas made real (ages 25, a 27), League on every card plus another game ahead of it on a''s; party P = a + b and party Q = c + e, each a live match');
end;
$$;

-- ===========================================================================
-- C. Share: one post per party, a note in the chat, both members see it
-- ===========================================================================
do $$
declare
  r record;
  v_p uuid := pg_temp.val('P')::uuid;
  v_code text;
  v_err text;
  v_notes int;
  v_i int;
  v_b_name text := (select coalesce(nullif(btrim(display_name), ''), 'Your partner') from public.profiles where id = pg_temp.id('b'));
  v_rows int;
  v_demo_err text;
begin
  -- b has never opened this party on a build that shows posts (1.0.1 and build 19 never call
  -- get_party_call, and have no Stop): a's Share is refused, naming b, and nothing is written.
  v_err := pg_temp.try_as('a', format('select * from public.start_party_call(%L)', v_p));
  assert v_err = format('party_not_ready | partner_not_ready | Ask %s to open this party on the latest DuoQueue first. Then they can see your post and stop it.', v_b_name),
    format('C: a''s Share before b could see posts gave %s', v_err);
  assert not exists (select 1 from public.party_calls where party_id = v_p)
     and not exists (select 1 from public.party_messages where party_id = v_p),
    'C: a refused Share wrote a post or a note';

  -- A demo persona never opens the app and counts as seen, so App Review's demo party can post.
  begin
    update public.profiles set is_demo = true where id = pg_temp.id('b');
    v_demo_err := pg_temp.try_as('a', format('select * from public.start_party_call(%L)', v_p));
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_demo_err = 'ok', format('C: a Share beside a demo partner who never opened the app gave %s', v_demo_err);

  -- b opens the party on build 20 (its party screen polls get_party_call): no post yet, and b's
  -- membership is stamped. a's is not (a's refused call rolled back).
  perform pg_temp.act_as('b');
  select count(*) into v_rows from public.get_party_call(v_p);
  reset role;
  assert v_rows = 0, 'C: get_party_call shows a post that does not exist';
  assert (select lfg_seen_at = now() from public.party_members where party_id = v_p and profile_id = pg_temp.id('b')),
    'C: get_party_call did not stamp b''s lfg_seen_at';
  assert (select lfg_seen_at is null from public.party_members where party_id = v_p and profile_id = pg_temp.id('a')),
    'C: a refused Share stamped a anyway';

  perform pg_temp.act_as('a');
  select * into r from public.start_party_call(v_p);
  reset role;
  assert r.already_live = false, 'C: a first post says already_live';
  assert (select lfg_seen_at = now() from public.party_members where party_id = v_p and profile_id = pg_temp.id('a')),
    'C: a''s own Share did not stamp a''s lfg_seen_at';
  assert r.code ~ '^[0-9A-HJKMNP-TV-Z]{10}$', 'C: no code, or a malformed one';
  assert r.expires_at = now() + interval '2 hours', 'C: the post does not work for exactly 2 hours';
  assert r.game_id = pg_temp.val('lol')::uuid and r.game_name = 'League of Legends',
    format('C: the post names %s, not the first game both members have (League)', r.game_name);
  v_code := r.code;
  insert into chk_vals values ('code', v_code);
  insert into chk_vals select 'call', id::text from public.party_calls where code = v_code;

  select count(*) into v_notes from public.party_messages where party_id = v_p and sender_id = pg_temp.id('a')
    and content = 'I made an LFG post to find our third. The first player who joins with its code in the next 2 hours gets the spot. They''ll see our names and ages, and our chat from when they join. You can stop the post on our party screen.';
  assert v_notes = 1, 'C: the new post did not write its note in the party chat';
  assert (select count(*) from pg_temp.requests('party_message', v_p)) = 1, 'C: the note did not queue a party_message push';

  -- b taps Share too: the same post, no second note.
  perform pg_temp.act_as('b');
  select * into r from public.start_party_call(v_p);
  reset role;
  assert r.already_live and r.code = v_code, 'C: b''s Share did not return a''s live post';
  assert (select count(*) from public.party_messages where party_id = v_p) = 1, 'C: an already_live Share wrote another note';
  assert (select count(*) from public.party_calls where party_id = v_p) = 1, 'C: two Shares made two posts';

  -- Both members read it; it is a's.
  perform pg_temp.act_as('b');
  select * into r from public.get_party_call(v_p);
  reset role;
  assert r.code = v_code and r.sharer_id = pg_temp.id('a') and r.mine = false and r.game_name = 'League of Legends'
     and r.expires_at = now() + interval '2 hours',
    'C: b does not see a''s live post';
  assert r.sharer_name is not distinct from (select display_name from public.profiles where id = pg_temp.id('a')), 'C: sharer_name is not a''s';
  perform pg_temp.act_as('a');
  select * into r from public.get_party_call(v_p);
  reset role;
  assert r.mine, 'C: a''s own post does not read mine';

  -- Not a member.
  v_err := pg_temp.try_as('c', format('select * from public.start_party_call(%L)', v_p));
  assert v_err like 'Not a party member%', format('C: a non-member''s Share gave %s', v_err);
  v_err := pg_temp.try_as('c', format('select * from public.get_party_call(%L)', v_p));
  assert v_err like 'Not a party member%', format('C: a non-member''s read gave %s', v_err);

  -- A party of three is full.
  begin
    insert into public.party_members (party_id, profile_id) values (v_p, pg_temp.id('c'));
    v_err := pg_temp.try_as('a', format('select * from public.start_party_call(%L)', v_p));
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_err = 'This party is already full. Parties hold 3 players. | party_full | ',
    format('C: a full party''s Share gave %s', v_err);

  -- A party of one (b blocked a founder out of it) is not ready.
  begin
    insert into public.blocks (blocker_id, blocked_id) values (pg_temp.id('a'), pg_temp.id('b'));
    v_err := pg_temp.try_as('a', format('select * from public.start_party_call(%L)', v_p));
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_err = 'party_not_ready | party_not_ready | A party needs two players before it can look for a third.',
    format('C: a party of one''s Share gave %s', v_err);

  -- Two members with no live match (they unmatched) cannot post.
  begin
    update public.matches set unmatched_at = now(), unmatched_by = pg_temp.id('a')
     where user_a_id = least(pg_temp.id('a'), pg_temp.id('b')) and user_b_id = greatest(pg_temp.id('a'), pg_temp.id('b'));
    v_err := pg_temp.try_as('b', format('select * from public.start_party_call(%L)', v_p));
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_err like 'party_not_ready | party_not_ready |%', format('C: two unmatched members'' Share gave %s', v_err);

  -- The 11th Share in an hour hits the rate limit.
  begin
    delete from public.rate_limit_hits where profile_id = pg_temp.id('a');
    for v_i in 1..10 loop
      v_err := pg_temp.try_as('a', format('select * from public.start_party_call(%L)', v_p));
      if v_err <> 'ok' then
        raise exception 'rollback_probe';
      end if;
    end loop;
    v_err := pg_temp.try_as('a', format('select * from public.start_party_call(%L)', v_p));
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_err like 'rate_limit_exceeded:party_call%', format('C: the 11th Share in an hour gave %s', v_err);

  insert into check_log (line) values ('C ok: a''s Share is refused, naming b, until b''s app has read the party''s post state (get_party_call stamps lfg_seen_at), and a demo partner counts as seen; then a''s Share mints a 2-hour post naming League (the first game both have) and writes one note in the party chat (one party_message push); b''s Share returns the same post with no second note; both read it (mine only for a); a non-member is refused; a full party raises party_full, a party of one and an unmatched pair raise party_not_ready with its hint; the 11th Share in an hour is rate limited');
end;
$$;

-- ===========================================================================
-- D. Resolve: what the front door sees
-- ===========================================================================
do $$
declare
  r record;
  v_code text := pg_temp.val('code');
  v_call uuid := pg_temp.val('call')::uuid;
  v_n int;
  v_status text;
  v_typo text;
  v_demo int;
  v_ended boolean;
begin
  perform pg_temp.act_as_anon();
  select * into r from public.resolve_party_code(v_code);
  reset role;
  assert r.status = 'live' and r.game_name = 'League of Legends'
     and r.sharer_name is not distinct from (select display_name from public.profiles where id = pg_temp.id('a')),
    format('D: anon resolve gave %s / %s / %s', r.status, r.sharer_name, r.game_name);

  assert pg_temp.resolve_status(lower(substr(v_code, 1, 5)) || '-' || substr(v_code, 6)) = 'live',
    'D: a lowercase code with a dash does not resolve';

  -- I, L and O read as 1, 1 and 0 (normalize_invite_code), on a code that has a 1 and a 0.
  begin
    update public.party_calls set code = 'K7Q2M0XA41' where id = v_call;
    v_typo := pg_temp.resolve_status('k7q2mOxa4I');
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_typo = 'live', format('D: the I/L/O typo of a party code resolves to %s', v_typo);

  -- Old builds: the code is not an invite or Duo Call code, so 1.0.1 and build 19 say "did not work".
  perform pg_temp.act_as_anon();
  select count(*) into v_n from public.resolve_invite_code(v_code);
  v_ended := public.call_code_ended(v_code);
  reset role;
  assert v_n = 0 and v_ended = false, 'D: a party code resolves as an invite code, or reads as an ended Duo Call';

  -- A demo party's code never works.
  begin
    update public.profiles set is_demo = true where id = pg_temp.id('a');
    perform pg_temp.act_as_anon();
    select count(*) into v_demo from public.resolve_party_code(v_code);
    reset role;
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_demo = 0, 'D: a demo party''s code resolves';

  perform pg_temp.act_as_anon();
  select count(*) into v_n from public.resolve_party_code('not a code');
  assert v_n = 0, 'D: garbage resolves';
  select count(*) into v_n from public.resolve_party_code(null);
  assert v_n = 0, 'D: null resolves';
  select count(*) into v_n from public.resolve_party_code('ZZZZZZZZZZ');
  assert v_n = 0, 'D: an unknown code resolves';
  reset role;

  insert into check_log (line) values ('D ok: anon resolves the live code to (live, a''s name, League) in any case, punctuation and I/L/O typos; it is not an invite or Duo Call code to old builds; a demo party''s code and garbage resolve to nothing');
end;
$$;

-- ===========================================================================
-- E. Who may join: every refusal is "unavailable", and refusals change nothing
-- ===========================================================================
do $$
declare
  v_code text := pg_temp.val('code');
  v_p uuid := pg_temp.val('P')::uuid;
  v_ok_preview text;
  v_ok_rows int;
  v_ok_join text;
  v_pre text;
  v_join text;
  v_err text;
  v_case text;
  v_other1 uuid;
  v_other2 uuid;
  v_other3 uuid;
begin
  -- j may join: preview lists both members, and a join would succeed (rolled back).
  begin
    v_ok_preview := pg_temp.preview_status('j', v_code);
    perform pg_temp.act_as('j');
    select count(*) into v_ok_rows from public.preview_party_code(v_code);
    reset role;
    v_ok_join := pg_temp.join_result('j', v_code);
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_ok_preview = 'live' and v_ok_rows = 2 and v_ok_join = 'joined',
    format('E: setup: j could not join a live post (%s, %s rows, %s)', v_ok_preview, v_ok_rows, v_ok_join);

  foreach v_case in array array[
    'j blocked b', 'b blocked j', 'j reported a', 'a reported j', 'j passed a', 'b passed j',
    'j unmatched with b', 'a passed j in the party deck', 'inactive joiner', 'demo joiner', 'suspended joiner',
    'three posts filled today', 'a''s age range leaves out j', 'j''s age range leaves out b'
  ] loop
    begin
      if v_case = 'j blocked b' then
        insert into public.blocks (blocker_id, blocked_id) values (pg_temp.id('j'), pg_temp.id('b'));
      elsif v_case = 'b blocked j' then
        insert into public.blocks (blocker_id, blocked_id) values (pg_temp.id('b'), pg_temp.id('j'));
      elsif v_case = 'j reported a' then
        insert into public.reports (reporter_id, reported_id, reason) values (pg_temp.id('j'), pg_temp.id('a'), 'spam');
      elsif v_case = 'a reported j' then
        insert into public.reports (reporter_id, reported_id, reason) values (pg_temp.id('a'), pg_temp.id('j'), 'spam');
      elsif v_case = 'j passed a' then
        insert into public.swipes (swiper_id, target_id, action) values (pg_temp.id('j'), pg_temp.id('a'), 'pass');
      elsif v_case = 'b passed j' then
        insert into public.swipes (swiper_id, target_id, action) values (pg_temp.id('b'), pg_temp.id('j'), 'pass');
      elsif v_case = 'j unmatched with b' then
        insert into public.matches (user_a_id, user_b_id, unmatched_at, unmatched_by)
        values (least(pg_temp.id('j'), pg_temp.id('b')), greatest(pg_temp.id('j'), pg_temp.id('b')), now(), pg_temp.id('b'));
      elsif v_case = 'a passed j in the party deck' then
        insert into public.party_swipes (party_id, member_id, target_id, action) values (v_p, pg_temp.id('a'), pg_temp.id('j'), 'pass');
      elsif v_case = 'inactive joiner' then
        update public.profiles set is_active = false where id = pg_temp.id('j');
      elsif v_case = 'demo joiner' then
        update public.profiles set is_demo = true where id = pg_temp.id('j');
      elsif v_case = 'suspended joiner' then
        update public.profiles set is_admin_suspended = true where id = pg_temp.id('j');
      elsif v_case = 'three posts filled today' then
        insert into public.parties (created_by) values (pg_temp.id('c')) returning id into v_other1;
        insert into public.parties (created_by) values (pg_temp.id('c')) returning id into v_other2;
        insert into public.parties (created_by) values (pg_temp.id('c')) returning id into v_other3;
        insert into public.party_calls (party_id, sharer_id, code, created_at, expires_at, filled_at, filled_by)
        values (v_other1, pg_temp.id('c'), public.generate_call_code(), now() - interval '3 hours', now() - interval '1 hour', now() - interval '150 minutes', pg_temp.id('j')),
               (v_other2, pg_temp.id('c'), public.generate_call_code(), now() - interval '3 hours', now() - interval '1 hour', now() - interval '140 minutes', pg_temp.id('j')),
               (v_other3, pg_temp.id('c'), public.generate_call_code(), now() - interval '3 hours', now() - interval '1 hour', now() - interval '130 minutes', pg_temp.id('j'));
      elsif v_case = 'a''s age range leaves out j' then
        -- a (27) looks for 18 to 24; j is 25.
        update public.preferences set min_age = 18, max_age = 24 where profile_id = pg_temp.id('a');
      elsif v_case = 'j''s age range leaves out b' then
        -- j looks for 26 to 99; b is 25 (a, 27, would be fine).
        update public.preferences set min_age = 26, max_age = 99 where profile_id = pg_temp.id('j');
      end if;
      v_pre := pg_temp.preview_status('j', v_code);
      v_join := pg_temp.join_result('j', v_code);
      raise exception 'rollback_probe';
    exception when raise_exception then
      if sqlerrm <> 'rollback_probe' then raise; end if;
    end;
    assert v_pre = 'unavailable' and v_join = 'unavailable',
      format('E: %s: preview %s, join %s (both must be unavailable)', v_case, v_pre, v_join);
  end loop;

  -- Two posts filled today is still fine (HOP_CAP is 3).
  begin
    insert into public.parties (created_by) values (pg_temp.id('c')) returning id into v_other1;
    insert into public.parties (created_by) values (pg_temp.id('c')) returning id into v_other2;
    insert into public.party_calls (party_id, sharer_id, code, created_at, expires_at, filled_at, filled_by)
    values (v_other1, pg_temp.id('c'), public.generate_call_code(), now() - interval '3 hours', now() - interval '1 hour', now() - interval '150 minutes', pg_temp.id('j')),
           (v_other2, pg_temp.id('c'), public.generate_call_code(), now() - interval '3 hours', now() - interval '1 hour', now() - interval '140 minutes', pg_temp.id('j'));
    v_pre := pg_temp.preview_status('j', v_code);
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_pre = 'live', format('E: two posts filled today already refuse j (%s)', v_pre);

  -- A banned joiner is refused outright; a joiner still on the card is told to finish it.
  begin
    update public.profiles set is_banned = true where id = pg_temp.id('j');
    v_err := pg_temp.try_as('j', format('select * from public.join_party_by_code(%L)', v_code));
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_err like 'account_banned%', format('E: a banned joiner got %s', v_err);
  begin
    update public.profiles set onboarding_completed = false where id = pg_temp.id('j');
    v_pre := pg_temp.try_as('j', format('select * from public.preview_party_code(%L)', v_code));
    v_err := pg_temp.try_as('j', format('select * from public.join_party_by_code(%L)', v_code));
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_pre = 'profile_not_ready |  | Finish setting up your profile first.' and v_err = v_pre,
    format('E: a joiner who has not saved their card got %s / %s', v_pre, v_err);

  -- None of it touched the post.
  assert pg_temp.resolve_status(v_code) = 'live', 'E: a refusal changed the post';
  assert (select count(*) from public.party_members where party_id = v_p) = 2, 'E: a refusal changed the party';

  insert into check_log (line) values ('E ok: j may join a live post; a block or report either way, a 1:1 pass either way, an unmatched match, a party-deck pass, an inactive, demo or suspended joiner, a third filled post in 24 hours, and either side''s age range leaving the other out each answer unavailable to both preview and join (two filled posts do not); a banned joiner raises account_banned; a joiner without a saved card raises profile_not_ready; the post stays live');
end;
$$;

-- ===========================================================================
-- F. Lifecycle: Stop, the 2 hours and the grace, a sharer blocked out, an unmatch
-- ===========================================================================
do $$
declare
  r record;
  v_code text := pg_temp.val('code');
  v_call uuid := pg_temp.val('call')::uuid;
  v_p uuid := pg_temp.val('P')::uuid;
  v_resolve text;
  v_preview text;
  v_join text;
  v_rows int;
  v_err text;
  v_lapsed text;
  v_grace text;
  v_grace_rows int;
  v_blocked text;
  v_unmatched text;
begin
  -- b stops a's post: nothing resolves to live, nobody can join, neither member sees it.
  begin
    perform pg_temp.act_as('b');
    perform public.end_party_call(v_p);
    perform public.end_party_call(v_p);
    reset role;
    v_resolve := pg_temp.resolve_status(v_code);
    v_preview := pg_temp.preview_status('n', v_code);
    v_join := pg_temp.join_result('n', v_code);
    perform pg_temp.act_as('a');
    select count(*) into v_rows from public.get_party_call(v_p);
    reset role;
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_resolve = 'ended' and v_preview = 'ended' and v_join = 'ended' and v_rows = 0,
    format('F: after Stop: resolve %s, preview %s, join %s, %s live rows', v_resolve, v_preview, v_join, v_rows);

  v_err := pg_temp.try_as('c', format('select public.end_party_call(%L)', v_p));
  assert v_err like 'Not a party member%', format('F: a non-member''s Stop gave %s', v_err);

  -- 2 hours 16 minutes after sharing: ended. 2 hours 10 minutes: still joinable (the grace), but
  -- no longer shown to the members as live.
  begin
    update public.party_calls set created_at = now() - interval '136 minutes', expires_at = now() - interval '16 minutes' where id = v_call;
    v_lapsed := pg_temp.resolve_status(v_code);
    update public.party_calls set created_at = now() - interval '130 minutes', expires_at = now() - interval '10 minutes' where id = v_call;
    v_grace := pg_temp.resolve_status(v_code);
    perform pg_temp.act_as('a');
    select count(*) into v_grace_rows from public.get_party_call(v_p);
    reset role;
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_lapsed = 'ended', format('F: a post 16 minutes past its 2 hours reads %s', v_lapsed);
  assert v_grace = 'live' and v_grace_rows = 0, format('F: inside the 15-minute grace the post reads %s (%s live rows to members)', v_grace, v_grace_rows);

  -- The sharer blocked out of the party by the other founder: ended.
  begin
    insert into public.blocks (blocker_id, blocked_id) values (pg_temp.id('b'), pg_temp.id('a'));
    v_blocked := pg_temp.resolve_status(v_code);
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_blocked = 'ended', format('F: a post whose sharer was blocked out reads %s', v_blocked);

  -- The founders unmatched (no block): ended, so no stranger lands between them.
  begin
    update public.matches set unmatched_at = now(), unmatched_by = pg_temp.id('b')
     where user_a_id = least(pg_temp.id('a'), pg_temp.id('b')) and user_b_id = greatest(pg_temp.id('a'), pg_temp.id('b'));
    v_unmatched := pg_temp.resolve_status(v_code);
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_unmatched = 'ended', format('F: a post whose founders unmatched reads %s', v_unmatched);

  assert pg_temp.resolve_status(v_code) = 'live', 'F: a probe leaked into the live post';

  insert into check_log (line) values ('F ok: Stop by either member ends the post at once for resolve, preview and join (and twice is fine); a non-member cannot Stop; 2h16m after sharing it is ended, at 2h10m still joinable but no longer shown to the members; a sharer blocked out or founders who unmatched end it');
end;
$$;

-- ===========================================================================
-- G. The join: n takes the seat; everyone after reads full
-- ===========================================================================
do $$
declare
  r record;
  v_code text := pg_temp.val('code');
  v_call uuid := pg_temp.val('call')::uuid;
  v_p uuid := pg_temp.val('P')::uuid;
  v_n int;
  v_i int;
  v_err text;
  v_rows record;
  -- Read as the check's own role: as n, RLS decides what profiles shows.
  v_a_name text := (select display_name from public.profiles where id = pg_temp.id('a'));
  v_second uuid;
  v_total int;
  v_expected int;
  v_seen int;
  v_seen_before int;
  v_seen_welcome int;
begin
  -- n is a new player still on the card: refused until it is saved.
  update public.profiles set onboarding_completed = false, created_at = now() - interval '1 hour' where id = pg_temp.id('n');
  v_err := pg_temp.try_as('n', format('select * from public.join_party_by_code(%L)', v_code));
  assert v_err = 'profile_not_ready |  | Finish setting up your profile first.', format('G: n joined before saving the card: %s', v_err);
  update public.profiles set onboarding_completed = true where id = pg_temp.id('n');

  -- Five previews hold nothing.
  for v_i in 1..5 loop
    perform pg_temp.act_as('n');
    select count(*) into v_n from public.preview_party_code(v_code);
    reset role;
    assert v_n = 2, format('G: preview %s returned %s rows, not one per member', v_i, v_n);
  end loop;
  assert pg_temp.resolve_status(v_code) = 'live', 'G: previews changed the post';
  assert (select filled_at is null and filled_by is null from public.party_calls where id = v_call), 'G: a preview filled the post';
  assert (select count(*) from public.party_members where party_id = v_p) = 2, 'G: a preview added a member';

  -- What the preview shows: both members, oldest first, with their AGES.
  perform pg_temp.act_as('n');
  select array_agg(x.member_age order by x.member_age desc) as ages,
         bool_and(x.status = 'live') as live,
         bool_and(x.game_name = 'League of Legends') as game,
         bool_and(x.sharer_name is not distinct from v_a_name) as sharer
    into v_rows
  from public.preview_party_code(v_code) x;
  reset role;
  assert v_rows.ages = array[27, 25] and v_rows.live and v_rows.game and v_rows.sharer,
    format('G: the preview shows ages %s (expected 27 and 25), live %s, game %s, sharer %s', v_rows.ages, v_rows.live, v_rows.game, v_rows.sharer);

  -- The founders' chat from before any post: b's line to a, a day ago.
  insert into public.party_messages (party_id, sender_id, content, created_at)
  values (v_p, pg_temp.id('b'), 'Founders only, from before the post.', now() - interval '1 day');

  -- d holds a pending deck invite into P. And b shared a second post while a's sat in its grace
  -- (written directly; start_party_call returns a's while it is before expires_at).
  insert into public.party_invites (party_id, target_id, status) values (v_p, pg_temp.id('d'), 'pending');
  insert into public.party_calls (party_id, sharer_id, game_id, code, created_at, expires_at)
  values (v_p, pg_temp.id('b'), pg_temp.val('lol')::uuid, public.generate_call_code(), now(), now() + interval '2 hours')
  returning id into v_second;

  perform pg_temp.act_as('n');
  select * into r from public.join_party_by_code(v_code);
  reset role;
  assert r.result = 'joined' and r.party_id = v_p, format('G: n''s join gave %s / %s', r.result, r.party_id);
  assert (select count(*) from public.party_members where party_id = v_p) = 3
     and exists (select 1 from public.party_members where party_id = v_p and profile_id = pg_temp.id('n')), 'G: n is not the third member';
  assert (select filled_by = pg_temp.id('n') and filled_at = now() and ended_at is null from public.party_calls where id = v_call),
    'G: the post does not record n as its joiner';
  assert (select status = 'declined' from public.party_invites where party_id = v_p and target_id = pg_temp.id('d')),
    'G: d''s pending deck invite was not declined when the seat went';
  assert not exists (select 1 from public.party_invites where party_id = v_p and target_id = pg_temp.id('n')),
    'G: a code join wrote a party invite';
  assert (select ended_at = now() and filled_at is null from public.party_calls where id = v_second),
    'G: the party''s other open post did not end when the seat was taken';
  assert (select count(*) from pg_temp.requests('party_joined', v_p) b where b->>'joinerId' = pg_temp.id('n')::text) = 1,
    'G: the join did not queue exactly one party_joined push for n';
  assert (select joined_by_code and joined_at = now() from public.party_members where party_id = v_p and profile_id = pg_temp.id('n')),
    'G: n''s membership does not say they joined by code, at now()';

  -- What n reads of the chat: only from their join on. a's welcome (after) shows; b's line from
  -- the day before does not. The founders still read everything; anon reads nothing.
  insert into public.party_messages (party_id, sender_id, content) values (v_p, pg_temp.id('a'), 'Welcome in.');
  v_total := (select count(*) from public.party_messages where party_id = v_p);
  v_expected := (select count(*) from public.party_messages where party_id = v_p and created_at >= now());
  perform pg_temp.act_as('n');
  select count(*), count(*) filter (where created_at < now()), count(*) filter (where content = 'Welcome in.')
    into v_seen, v_seen_before, v_seen_welcome
  from public.party_messages where party_id = v_p;
  reset role;
  assert v_seen_before = 0 and v_seen = v_expected and v_seen_welcome = 1 and v_total > v_expected,
    format('G: n reads %s of %s party messages (%s from before joining, welcome %s); expected only the %s from the join on',
           v_seen, v_total, v_seen_before, v_seen_welcome, v_expected);
  perform pg_temp.act_as('b');
  select count(*) into v_seen from public.party_messages where party_id = v_p;
  reset role;
  assert v_seen = v_total, format('G: founder b reads %s of %s party messages', v_seen, v_total);
  perform pg_temp.act_as_anon();
  select count(*) into v_seen from public.party_messages where party_id = v_p;
  reset role;
  assert v_seen = 0, 'G: anon reads party messages';

  -- Again: member, with the party, so the app opens the chat.
  perform pg_temp.act_as('n');
  select * into r from public.join_party_by_code(v_code);
  reset role;
  assert r.result = 'member' and r.party_id = v_p, format('G: n''s second join gave %s', r.result);
  assert pg_temp.preview_status('n', v_code) = 'member', 'G: n''s preview after joining is not member';

  -- Everyone after: full.
  assert pg_temp.resolve_status(v_code) = 'full', 'G: the filled post does not resolve as full';
  assert pg_temp.preview_status('m', v_code) = 'full', 'G: m''s preview of a filled post is not full';
  perform pg_temp.act_as('m');
  select * into r from public.join_party_by_code(v_code);
  reset role;
  assert r.result = 'full' and r.party_id is null, format('G: m''s join of a filled post gave %s', r.result);
  perform pg_temp.act_as('a');
  select count(*) into v_n from public.get_party_call(v_p);
  reset role;
  assert v_n = 0, 'G: a full party still shows a live post';
  v_err := pg_temp.try_as('b', format('select * from public.start_party_call(%L)', v_p));
  assert v_err like 'This party is already full.%party_full%', format('G: a full party could post again: %s', v_err);

  insert into check_log (line) values ('G ok: n cannot join before saving the card; five previews hold nothing and show both members with ages 27 and 25; n''s join makes n the third member (joined_by_code), fills the post, ends the party''s other open post, declines d''s pending deck invite, writes no invite and queues one party_joined push; n reads the party chat only from their join on (not b''s line from the day before), b reads all of it, anon none; n again gets member; resolve, preview and join for anyone else read full; the full party shows no post and cannot post');
end;
$$;

-- ===========================================================================
-- H. After the join: blocks, deletion and retention
-- ===========================================================================
do $$
declare
  r record;
  v_code text := pg_temp.val('code');
  v_call uuid := pg_temp.val('call')::uuid;
  v_p uuid := pg_temp.val('P')::uuid;
  v_status text;
  v_m_join text;
  v_members uuid[];
  v_new record;
  v_after public.party_calls%rowtype;
  v_left int;
  v_pruned int;
begin
  -- A founder blocks the joiner: the joiner goes (as before), and the post stays spoken for.
  begin
    insert into public.blocks (blocker_id, blocked_id) values (pg_temp.id('a'), pg_temp.id('n'));
    select array_agg(profile_id order by profile_id) into v_members from public.party_members where party_id = v_p;
    v_status := pg_temp.resolve_status(v_code);
    v_m_join := pg_temp.join_result('m', v_code);
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_members = (select array_agg(x order by x) from unnest(array[pg_temp.id('a'), pg_temp.id('b')]) x),
    'H: a founder''s block did not remove the joiner';
  assert v_status = 'full' and v_m_join = 'full', format('H: after the joiner was blocked out the post reads %s and m''s join %s (must stay full)', v_status, v_m_join);

  -- The joiner blocks a founder: the JOINER leaves; both founders stay; they can post again.
  begin
    insert into public.blocks (blocker_id, blocked_id) values (pg_temp.id('n'), pg_temp.id('a'));
    select array_agg(profile_id order by profile_id) into v_members from public.party_members where party_id = v_p;
    perform pg_temp.act_as('b');
    select * into v_new from public.start_party_call(v_p);
    reset role;
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_members = (select array_agg(x order by x) from unnest(array[pg_temp.id('a'), pg_temp.id('b')]) x),
    'H: a code joiner''s block evicted a founder (the joiner must leave instead)';
  assert v_new.already_live = false and v_new.code <> v_code, 'H: the founders could not post again after the joiner left';

  -- The same block 31 days on, after the prune deleted the post: still the joiner who leaves (the
  -- flag is on the membership, not on the pruned post).
  begin
    update public.party_calls
       set created_at = now() - interval '31 days', expires_at = now() - interval '31 days' + interval '2 hours',
           filled_at = now() - interval '31 days'
     where party_id = v_p;
    perform public.prune_party_calls();
    assert not exists (select 1 from public.party_calls where party_id = v_p), 'H: setup: the prune left the party''s post';
    insert into public.blocks (blocker_id, blocked_id) values (pg_temp.id('n'), pg_temp.id('a'));
    select array_agg(profile_id order by profile_id) into v_members from public.party_members where party_id = v_p;
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_members = (select array_agg(x order by x) from unnest(array[pg_temp.id('a'), pg_temp.id('b')]) x),
    'H: after the 30-day prune, the code joiner''s block evicted a founder';

  -- And after the sharer's account is deleted (their posts cascade away): the joiner blocking the
  -- remaining founder leaves; b stays.
  begin
    delete from public.profiles where id = pg_temp.id('a');
    insert into public.blocks (blocker_id, blocked_id) values (pg_temp.id('n'), pg_temp.id('b'));
    select array_agg(profile_id order by profile_id) into v_members from public.party_members where party_id = v_p;
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_members = array[pg_temp.id('b')], 'H: after the sharer''s deletion, the code joiner''s block evicted the other founder';

  -- Deleting the joiner: filled_by goes, the post stays full.
  begin
    delete from public.profiles where id = pg_temp.id('n');
    select * into v_after from public.party_calls where id = v_call;
    v_status := pg_temp.resolve_status(v_code);
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_after.id = v_call and v_after.filled_by is null and v_after.filled_at is not null and v_status = 'full',
    format('H: deleting the joiner left filled_by %s, filled_at %s, status %s', v_after.filled_by, v_after.filled_at, v_status);

  -- Deleting the sharer: their posts go with them.
  begin
    delete from public.profiles where id = pg_temp.id('a');
    select count(*) into v_left from public.party_calls where sharer_id = pg_temp.id('a') or id = v_call;
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_left = 0, 'H: a deleted sharer''s posts are still there';

  -- Retention: the prune deletes exactly the posts older than 30 days.
  begin
    insert into public.party_calls (party_id, sharer_id, code, created_at, expires_at)
    values (v_p, pg_temp.id('b'), public.generate_call_code(), now() - interval '31 days', now() - interval '31 days' + interval '2 hours'),
           (v_p, pg_temp.id('b'), public.generate_call_code(), now() - interval '29 days', now() - interval '29 days' + interval '2 hours');
    v_left := (select count(*) from public.party_calls where created_at < now() - interval '30 days');
    v_pruned := public.prune_party_calls();
    v_left := v_left - v_pruned + (select count(*) from public.party_calls where created_at < now() - interval '30 days');
    assert exists (select 1 from public.party_calls where party_id = v_p and created_at = now() - interval '29 days'),
      'H: the prune deleted a 29-day-old post';
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_left = 0 and v_pruned >= 1, format('H: prune_party_calls deleted %s and left %s posts older than 30 days', v_pruned, v_left);

  insert into check_log (line) values ('H ok: a founder blocking the joiner removes the joiner and the post stays full; the joiner blocking a founder removes the joiner (both founders stay) and the founders can post again, and so it stays after the 30-day prune and after the sharer''s account deletion; deleting the joiner nulls filled_by and the post stays full; deleting the sharer deletes their posts; the prune deletes only posts older than 30 days');
end;
$$;

-- ===========================================================================
-- I. The 1.0.1 deck flow, unchanged
-- ===========================================================================
do $$
declare
  r record;
  v_q uuid := pg_temp.val('Q')::uuid;
  v_deck uuid[];
  v_invite uuid;
  v_mine int;
  v_members int;
  v_after_block uuid[];
  v_history int;
begin
  perform pg_temp.act_as('c');
  select coalesce(array_agg(x.profile_id), '{}') into v_deck from public.get_party_deck(v_q, 50) x;
  reset role;
  assert v_deck @> array[pg_temp.id('d')], 'I: d is not in party Q''s deck';

  perform pg_temp.act_as('c');
  perform public.perform_party_swipe(v_q, pg_temp.id('d'), 'like');
  reset role;
  assert not exists (select 1 from public.party_invites where party_id = v_q and target_id = pg_temp.id('d')),
    'I: one like invited d (every member has to like)';
  perform pg_temp.act_as('e');
  perform public.perform_party_swipe(v_q, pg_temp.id('d'), 'like');
  reset role;
  select id into v_invite from public.party_invites where party_id = v_q and target_id = pg_temp.id('d') and status = 'pending';
  assert v_invite is not null, 'I: both likes did not invite d';

  -- Q's chat from before d: a deck joiner (every member liked them) reads all of it, as before.
  insert into public.party_messages (party_id, sender_id, content, created_at)
  values (v_q, pg_temp.id('c'), 'Before d, deck party.', now() - interval '1 day');

  perform pg_temp.act_as('d');
  select count(*) into v_mine from public.get_my_party_invites() x where x.invite_id = v_invite;
  perform public.respond_party_invite(v_invite, true);
  select count(*) into v_history from public.party_messages where party_id = v_q and content = 'Before d, deck party.';
  reset role;
  assert v_mine = 1, 'I: d does not see the deck invite';
  select count(*) into v_members from public.party_members where party_id = v_q;
  assert v_members = 3 and (select status = 'accepted' from public.party_invites where id = v_invite), 'I: d''s accept did not join Q';
  assert (select not joined_by_code from public.party_members where party_id = v_q and profile_id = pg_temp.id('d')),
    'I: a deck join reads as a code join';
  assert v_history = 1, 'I: a deck joiner no longer reads the party chat from before they joined';

  -- A deck party's block: the blocked member goes, exactly as before (no party_calls row).
  begin
    insert into public.blocks (blocker_id, blocked_id) values (pg_temp.id('d'), pg_temp.id('c'));
    select array_agg(profile_id order by profile_id) into v_after_block from public.party_members where party_id = v_q;
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
  assert v_after_block = (select array_agg(x order by x) from unnest(array[pg_temp.id('d'), pg_temp.id('e')]) x),
    'I: a block in a deck party no longer removes the blocked member';

  insert into check_log (line) values ('I ok: the 1.0.1 deck flow is unchanged: d is dealt to Q, two likes invite d, d sees and accepts the invite and joins (not a code join) and reads Q''s chat from before; in a deck party the blocked member is removed as before');
end;
$$;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
