-- Checks for supabase/migrations/0072_like_alerts.sql.
--
-- Plain script: plpgsql `assert` in `do` blocks, one transaction, rolled back at the end.
--
-- HOW TO RUN IT
--   After 0072 is committed, alone:
--     powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0072_like_alerts.sql
--   Before: chain it after the migration(s) in one rolled-back transaction (see 0071's check).
--   It passes with or without 0083's swipes trigger in place: that trigger is deferred to COMMIT,
--   and this transaction rolls back, so it never fires here; the explicit queue_like_alert call
--   is what queues. (Were it ever made immediate again, the trigger would queue first and the
--   explicit call would report 'skip-already-queued'; the asserts accept both.) Either way
--   exactly one push request must exist.
--
-- NO PUSH IS SENT. notify_via_edge_function only inserts into net.http_request_queue (asserted
-- below from the live source); the pg_net worker sees committed rows only, and this rolls back.
-- That queue is also how the checks read the exact payload.
--
-- WHO: five seeded demo personas (@duoqueue.io demo accounts, never the review account), made
-- non-demo INSIDE this transaction so the real-account gates apply to them, with timezones,
-- regions, a shared game and a fake push token set as each step needs. All rolled back.

begin;

set local lock_timeout = '5s';

create temp table check_log (n serial primary key, line text not null);
create temp table chk_ids (role text primary key, id uuid not null);
create temp table chk_base (queue_id bigint not null);

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

create function pg_temp.id(p_who text) returns uuid
language sql stable as $f$
  select c.id from chk_ids c where c.role = p_who
$f$;

-- Push payloads of one type queued in this transaction for one recipient.
create function pg_temp.events(p_type text, p_recipient uuid) returns setof jsonb
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
  where e.body->>'type' = p_type and e.body->>'recipientId' = p_recipient::text
$f$;

-- An IANA zone whose local hour is exactly p_hour right now.
create function pg_temp.zone_at(p_hour int) returns text
language sql stable as $f$
  select z.name from pg_timezone_names z
  where z.name ~ '^Etc/GMT[+-][0-9]+$'
    and extract(hour from now() at time zone z.name)::int = p_hour
  limit 1
$f$;

-- A like from p_liker to p_recipient, then the queue call, returning the queue's answer.
create function pg_temp.like_and_queue(p_liker uuid, p_recipient uuid) returns text
language plpgsql as $f$
begin
  insert into public.swipes (swiper_id, target_id, action) values (p_liker, p_recipient, 'like')
  on conflict (swiper_id, target_id) do nothing;
  return public.queue_like_alert(p_liker, p_recipient);
end;
$f$;

-- ===========================================================================
-- 0. Why nothing here can send a push
-- ===========================================================================
do $$
declare
  v_post text;
begin
  assert position('net.http_post' in pg_get_functiondef('public.notify_via_edge_function(jsonb)'::regprocedure)) > 0,
    '0: notify_via_edge_function no longer goes through net.http_post';
  select p.prosrc into v_post from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'net' and p.proname = 'http_post' limit 1;
  assert position('insert into net.http_request_queue' in v_post) > 0, '0: net.http_post no longer just enqueues';
  insert into chk_base select coalesce(max(q.id), 0) from net.http_request_queue q;
  insert into check_log (line) values ('0 ok: pushes only enqueue into net.http_request_queue, and this transaction rolls back');
end;
$$;

-- ===========================================================================
-- A. Schema, grants, contract
-- ===========================================================================
do $$
begin
  assert exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notification_settings' and column_name = 'new_like'
      and data_type = 'boolean' and is_nullable = 'NO' and column_default = 'true'
  ), 'A: notification_settings.new_like is not boolean NOT NULL DEFAULT true';
  assert not exists (select 1 from public.notification_settings where new_player = false and new_like = true),
    'A: a player who switched off new_player has new_like on';

  assert (select relrowsecurity from pg_class where oid = 'public.like_alerts'::regclass), 'A: like_alerts has no RLS';
  assert not has_table_privilege('anon', 'public.like_alerts', 'select'), 'A: anon can read like_alerts';
  assert not has_table_privilege('authenticated', 'public.like_alerts', 'select'), 'A: authenticated can read like_alerts';
  assert has_table_privilege('service_role', 'public.like_alerts', 'select, insert, update, delete'), 'A: service_role lacks like_alerts grants';
  assert (select count(*) from pg_constraint
           where conrelid = 'public.like_alerts'::regclass and contype = 'f' and confdeltype = 'c') = 2,
    'A: like_alerts ids do not both cascade from profiles';

  assert not has_function_privilege('authenticated', 'public.queue_like_alert(uuid,uuid)', 'execute'), 'A: queue_like_alert callable by authenticated';
  assert not has_function_privilege('authenticated', 'public.dispatch_like_alert(uuid,boolean)', 'execute'), 'A: dispatch_like_alert callable by authenticated';
  assert not has_function_privilege('anon', 'public.send_pending_like_alerts(integer)', 'execute'), 'A: send_pending_like_alerts callable by anon';
  assert not has_function_privilege('authenticated', 'public.send_pending_like_alerts(integer)', 'execute'), 'A: send_pending_like_alerts callable by authenticated';
  assert has_function_privilege('service_role', 'public.send_pending_like_alerts(integer)', 'execute'), 'A: service_role cannot run the sweep';
  assert not has_function_privilege('authenticated', 'public.local_hour_within(text,integer,integer)', 'execute'), 'A: local_hour_within callable by authenticated';
  assert not has_function_privilege('authenticated', 'public.person_push_sent_recently(uuid)', 'execute'), 'A: person_push_sent_recently callable by authenticated';
  assert not has_function_privilege('authenticated', 'public.claim_new_player_alert(uuid,uuid[])', 'execute'), 'A: claim_new_player_alert callable by authenticated';
  assert not has_function_privilege('anon', 'public.claim_new_player_alert(uuid,uuid[])', 'execute'), 'A: claim_new_player_alert callable by anon';
  assert has_function_privilege('service_role', 'public.claim_new_player_alert(uuid,uuid[])', 'execute'), 'A: service_role cannot claim new-player alerts';
  assert position('like_alert_recipient_ok' in pg_get_functiondef('public.send_pending_like_alerts(integer)'::regprocedure)) > 0
     and position('like_alert_pair_ok' in pg_get_functiondef('public.send_pending_like_alerts(integer)'::regprocedure)) > 0,
    'A: the like sweep picks recipients without checking they can still be sent to (starves the rest under the cap)';
  assert exists (
    select 1 from pg_trigger t
    where t.tgname = 'notification_settings_new_like_follows_new_player'
      and t.tgrelid = 'public.notification_settings'::regclass and t.tgenabled = 'O'
  ), 'A: new_like does not follow new_player (1.0.1 players could not turn like alerts off)';

  assert pg_get_function_result('public.get_new_player_alert_batch(integer)'::regprocedure)
    = 'TABLE(recipient_id uuid, new_profile_ids uuid[], new_player_count integer, headline_game text)',
    'A: get_new_player_alert_batch RETURNS changed';
  assert not has_function_privilege('authenticated', 'public.get_new_player_alert_batch(integer)', 'execute'), 'A: new-player batch callable by authenticated';
  assert has_function_privilege('service_role', 'public.get_new_player_alert_batch(integer)', 'execute'), 'A: service_role lost the new-player batch';

  insert into check_log (line) values ('A ok: new_like boolean default true (carried over from new_player opt-outs, and kept following it); like_alerts RLS on, server-only, both ids cascade; every like-alert function server-only; the sweep only picks sendable recipients; new-player batch shape and grants unchanged');
end;
$$;

-- ===========================================================================
-- B. local_hour_within
-- ===========================================================================
do $$
declare
  h int := extract(hour from now() at time zone 'UTC')::int;
begin
  assert public.local_hour_within('UTC', h, h), 'B: the current hour is not inside [h, h]';
  assert not public.local_hour_within('UTC', (h + 1) % 24, (h + 1) % 24), 'B: the current hour is inside [h+1, h+1]';
  assert not public.local_hour_within('UTC', (h + 1) % 24, (h + 23) % 24), 'B: a window that wraps around h still contains h';
  assert public.local_hour_within('UTC', 0, 23), 'B: [0, 23] does not contain every hour';
  assert public.local_hour_within(pg_temp.zone_at(23), 10, 0), 'B: 23:00 is not inside the event window 10..0';
  assert public.local_hour_within(pg_temp.zone_at(0), 10, 0), 'B: 00:00 is not inside the event window 10..0';
  assert not public.local_hour_within(pg_temp.zone_at(4), 10, 0), 'B: 04:00 is inside the event window';
  assert not public.local_hour_within(pg_temp.zone_at(9), 10, 0), 'B: 09:00 is inside the event window';
  assert not public.local_hour_within(pg_temp.zone_at(21), 10, 20), 'B: 21:00 is inside the batch window';
  assert public.local_hour_within(null, 10, 20)
       = (public.local_hour_within('America/New_York', 10, 20) and public.local_hour_within('America/Los_Angeles', 10, 20)),
    'B: a NULL zone is not judged in both New York and Los Angeles';
  insert into check_log (line) values ('B ok: local_hour_within: inclusive hours, wraps midnight (10..0 allows 23:00 and 00:00, not 04:00 or 09:00), NULL zone must pass in New York AND Los Angeles');
end;
$$;

-- ===========================================================================
-- C. Setup: five personas, made real for this transaction
-- ===========================================================================
do $$
declare
  v_ids uuid[];
  v_r uuid;
  v_game uuid;
  v_skill text;
  v_x uuid;
begin
  select array_agg(p.id order by p.id) into v_ids
    from (
      select p.id
      from public.profiles p
      join auth.users u on u.id = p.id
      where p.is_demo and p.onboarding_completed and p.is_active and not p.is_banned and not p.is_admin_suspended
        and u.email like '%@duoqueue.io' and u.email <> 'review@duoqueue.io'
      order by p.id
      limit 6
    ) p;
  if coalesce(array_length(v_ids, 1), 0) < 6 then
    raise exception 'C: need 6 demo personas, found %', coalesce(array_length(v_ids, 1), 0);
  end if;
  insert into chk_ids values
    ('r', v_ids[1]), ('l1', v_ids[2]), ('l2', v_ids[3]), ('lx', v_ids[4]), ('lb', v_ids[5]), ('ld', v_ids[6]);
  v_r := v_ids[1];

  foreach v_x in array v_ids loop
    assert public.same_age_band(v_r, v_x), 'C: personas are in different age groups';
  end loop;

  -- R: real, NA East, local noon, a token, settings on, no filters, a clean slate.
  update public.profiles set is_demo = false, region = 'na_east', timezone = pg_temp.zone_at(12) where id = v_r;
  insert into public.push_tokens (profile_id, expo_push_token) values (v_r, 'ExponentPushToken[check-0072-r]');
  insert into public.notification_settings (profile_id) values (v_r) on conflict (profile_id) do nothing;
  update public.notification_settings set new_like = true where profile_id = v_r;
  update public.preferences set preferred_regions = null, required_language = null, min_age = 18, max_age = 99 where profile_id = v_r;
  delete from public.like_alerts where recipient_id = v_r;
  delete from public.new_player_alerts where recipient_id = v_r;
  delete from public.swipes where (swiper_id = v_r and target_id = any (v_ids)) or (target_id = v_r and swiper_id = any (v_ids));

  -- The likers: real, NA West (same group as NA East), sharing a game with R. lx is EU. ld
  -- stays DEMO.
  select pg.game_id, pg.skill_level::text into v_game, v_skill
    from public.profile_games pg where pg.profile_id = v_r order by pg.priority limit 1;
  if v_game is null then
    raise exception 'C: persona R has no games';
  end if;
  foreach v_x in array v_ids[2:6] loop
    update public.profiles set is_demo = (v_x = v_ids[6]), region = case when v_x = v_ids[4] then 'eu'::public.region_enum else 'na_west'::public.region_enum end
     where id = v_x;
    insert into public.profile_games (profile_id, game_id, skill_level, priority)
    select v_x, v_game, v_skill::public.skill_level_enum, 9
    where not exists (select 1 from public.profile_games pg where pg.profile_id = v_x and pg.game_id = v_game);
  end loop;

  assert public.like_alert_recipient_ok(v_r), 'C: R is not an eligible recipient after setup';
  insert into check_log (line) values ('C ok: six personas set up (R real at local noon with a token; l1, l2, lb real NA West; lx real EU; ld demo), all sharing a game with R');
end;
$$;

-- ===========================================================================
-- D. The first like sends at once; the second waits for tomorrow's budget
-- ===========================================================================
do $$
declare
  v_r uuid := pg_temp.id('r');
  v_out text;
  v_ev jsonb;
begin
  v_out := pg_temp.like_and_queue(pg_temp.id('l1'), v_r);
  assert v_out in ('sent', 'skip-already-queued'), format('D: first like answered %s', v_out);
  assert (select sent_at from public.like_alerts where recipient_id = v_r and liker_id = pg_temp.id('l1')) is not null,
    'D: the first like was not marked sent';
  assert (select count(*) from pg_temp.events('new_like', v_r)) = 1, 'D: expected exactly one new_like request';
  select e into v_ev from pg_temp.events('new_like', v_r) e;
  assert v_ev ?& array['type', 'recipientId', 'likeCount'] and (select count(*) from jsonb_object_keys(v_ev)) = 3,
    format('D: new_like keys are %s', (select array_agg(k) from jsonb_object_keys(v_ev) k));
  assert (v_ev->>'likeCount')::int = 1, 'D: likeCount is not 1';
  assert position(pg_temp.id('l1')::text in v_ev::text) = 0, 'D: the payload names the liker';

  v_out := pg_temp.like_and_queue(pg_temp.id('l2'), v_r);
  assert v_out in ('pending', 'skip-already-queued'), format('D: second like answered %s', v_out);
  assert (select sent_at from public.like_alerts where recipient_id = v_r and liker_id = pg_temp.id('l2')) is null,
    'D: the second like was sent inside the day''s budget';
  assert (select count(*) from pg_temp.events('new_like', v_r)) = 1, 'D: a second new_like request went out the same day';

  insert into check_log (line) values ('D ok: first like -> one new_like {type, recipientId, likeCount:1}, no liker id in it; second like the same day waits pending (one person-push a day)');
end;
$$;

-- ===========================================================================
-- E. Who never gets an alert
-- ===========================================================================
do $$
declare
  v_r uuid := pg_temp.id('r');
begin
  assert pg_temp.like_and_queue(pg_temp.id('lx'), v_r) = 'skip-pair', 'E: a liker in another server group was queued';
  assert pg_temp.like_and_queue(pg_temp.id('ld'), v_r) = 'skip-pair', 'E: a demo liker was queued';
  assert not exists (select 1 from public.like_alerts where recipient_id = v_r and liker_id in (pg_temp.id('lx'), pg_temp.id('ld'))),
    'E: a ledger row exists for a refused liker';

  insert into public.swipes (swiper_id, target_id, action) values (v_r, pg_temp.id('lb'), 'pass');
  assert pg_temp.like_and_queue(pg_temp.id('lb'), v_r) = 'skip-swiped-back', 'E: a like from someone R already passed was queued';

  update public.notification_settings set new_like = false where profile_id = v_r;
  assert not public.like_alert_recipient_ok(v_r), 'E: new_like = false did not stop the alert';
  update public.notification_settings set new_like = true where profile_id = v_r;

  -- 1.0.1 has only "New players in your games": switching it off now (after the one-time
  -- carry-over) must stop like alerts too, and switching it on again must bring them back.
  update public.notification_settings set new_player = false where profile_id = v_r;
  assert (select new_like from public.notification_settings where profile_id = v_r) = false,
    'E: switching new_player off after 0072 left like alerts on (1.0.1 has no other switch)';
  assert not public.like_alert_recipient_ok(v_r), 'E: new_player off did not stop the like alert';
  update public.notification_settings set new_player = true where profile_id = v_r;
  assert (select new_like from public.notification_settings where profile_id = v_r) = true,
    'E: switching new_player back on left like alerts off with no switch to restore them';
  -- A build with its own toggle keeps its choice: new_like can be turned back on with
  -- new_player off (an update of new_like alone is never touched), and an update that changes
  -- new_like in the same statement as new_player keeps the new_like it asked for.
  update public.notification_settings set new_player = false where profile_id = v_r;
  update public.notification_settings set new_like = true where profile_id = v_r;
  assert (select new_like from public.notification_settings where profile_id = v_r) = true,
    'E: new_like could not be turned back on while new_player is off';
  update public.notification_settings set new_player = true, new_like = false where profile_id = v_r;
  assert (select new_like from public.notification_settings where profile_id = v_r) = false,
    'E: an update that changed new_like itself was overridden';
  update public.notification_settings set new_player = true, new_like = true where profile_id = v_r;

  -- The pending pair (l2) stops passing the pair gate the moment a match or a Super Ping exists
  -- between them: both already told R about l2 by name.
  assert public.like_alert_pair_ok(v_r, pg_temp.id('l2')), 'E: setup: the pending l2 pair does not pass';
  insert into public.super_pings (sender_id, receiver_id) values (pg_temp.id('l2'), v_r);
  assert not public.like_alert_pair_ok(v_r, pg_temp.id('l2')), 'E: a liker who Super Pinged R would also get the anonymous like alert';
  delete from public.super_pings where sender_id = pg_temp.id('l2') and receiver_id = v_r;
  insert into public.matches (user_a_id, user_b_id) values (least(v_r, pg_temp.id('l2')), greatest(v_r, pg_temp.id('l2')));
  assert not public.like_alert_pair_ok(v_r, pg_temp.id('l2')), 'E: a matched pair would still get a like alert';
  delete from public.matches where user_a_id = least(v_r, pg_temp.id('l2')) and user_b_id = greatest(v_r, pg_temp.id('l2'));
  assert public.like_alert_pair_ok(v_r, pg_temp.id('l2')), 'E: cleanup: the l2 pair no longer passes';

  insert into check_log (line) values ('E ok: no alert for a liker in another server group, a demo liker, someone R already swiped, a matched pair or a Super Ping sender, or when R switched new_like off; new_like follows new_player both ways unless the same update changes it');
end;
$$;

-- ===========================================================================
-- F. Quiet hours, the batch window, and the deferred send
-- ===========================================================================
do $$
declare
  v_r uuid := pg_temp.id('r');
  v_ev jsonb;
begin
  -- Free the budget: pretend the first alert went out 25 hours ago.
  update public.like_alerts set sent_at = now() - interval '25 hours' where recipient_id = v_r and liker_id = pg_temp.id('l1');

  update public.profiles set timezone = pg_temp.zone_at(4) where id = v_r;
  assert public.dispatch_like_alert(v_r, true) = 0, 'F: an event-driven like alert went out at 04:00 local';
  assert public.dispatch_like_alert(v_r, false) = 0, 'F: the sweep sent at 04:00 local';

  update public.profiles set timezone = pg_temp.zone_at(23) where id = v_r;
  assert public.dispatch_like_alert(v_r, false) = 0, 'F: the sweep sent at 23:00 local (batch window ends 21:00)';
  assert public.dispatch_like_alert(v_r, true) = 1, 'F: the pending like did not go out event-driven at 23:00 local';
  assert (select count(*) from pg_temp.events('new_like', v_r)) = 2, 'F: expected the deferred alert as a second request';
  select e into v_ev from pg_temp.events('new_like', v_r) e order by (e->>'likeCount') limit 1;
  assert public.dispatch_like_alert(v_r, true) = 0, 'F: a third alert went out inside the budget';

  assert public.send_pending_like_alerts() >= 0, 'F: the sweep did not run';

  insert into check_log (line) values ('F ok: nothing at 04:00 local in either mode; the sweep keeps 10:00-21:00; the waiting like went out event-driven at 23:00 once the budget freed; no third alert');
end;
$$;

-- ===========================================================================
-- G. The new-player batch: same server group only, shared budget
-- ===========================================================================
do $$
declare
  v_rows int;
  v_cross int;
begin
  select count(*) into v_rows from public.get_new_player_alert_batch(200);
  select count(*) into v_cross
    from public.get_new_player_alert_batch(200) b
    cross join lateral unnest(b.new_profile_ids) np(id)
    join public.profiles r on r.id = b.recipient_id
    join public.profiles n on n.id = np.id
   where public.server_group(r.region) is distinct from public.server_group(n.region);
  assert v_cross = 0, format('G: %s new-player pairs cross server groups', v_cross);
  assert not exists (select 1 from public.get_new_player_alert_batch(200) b where b.recipient_id = pg_temp.id('r')),
    'G: R got a new-player alert row inside the budget its like alert spent';

  -- The claim re-checks the budget under the lock: R's like alert went out in F, so a claim for R
  -- (as if the batch had been read before that alert) claims nothing and writes no ledger row.
  assert (select count(*) from public.claim_new_player_alert(pg_temp.id('r'), array[pg_temp.id('l1')])) = 0,
    'G: a new-player alert was claimed for R inside the budget its like alert spent';
  assert not exists (select 1 from public.new_player_alerts where recipient_id = pg_temp.id('r') and new_profile_id = pg_temp.id('l1')),
    'G: the refused claim still wrote a ledger row';
  -- With the budget free it claims each new id once, and a second claim gets nothing.
  update public.like_alerts set sent_at = now() - interval '25 hours' where recipient_id = pg_temp.id('r') and sent_at is not null;
  assert (select count(*) from public.claim_new_player_alert(pg_temp.id('r'), array[pg_temp.id('l1'), pg_temp.id('l1'), pg_temp.id('r'), null])) = 1,
    'G: a claim with the budget free did not claim exactly the one real new id';
  assert (select count(*) from public.claim_new_player_alert(pg_temp.id('r'), array[pg_temp.id('l2')])) = 0,
    'G: a second claim the same day went through (the first claim spent the budget)';

  insert into check_log (line) values (format('G ok: new-player batch has %s rows right now, none across server groups; a recipient with a like alert in 24h is held back, at batch time and again at claim time', v_rows));
end;
$$;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
