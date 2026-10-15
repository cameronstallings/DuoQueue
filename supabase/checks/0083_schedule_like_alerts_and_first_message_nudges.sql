-- Checks for supabase/migrations/0083_schedule_like_alerts_and_first_message_nudges.sql.
--
-- Plain script: plpgsql `assert` in `do` blocks, one transaction, rolled back at the end.
--
-- HOW TO RUN IT
--   After 0083 is committed, alone:
--     powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db/run-sql.ps1 -QueryFile supabase/checks/0083_schedule_like_alerts_and_first_message_nudges.sql
--   Before: chain it after 0071-0083 in one rolled-back transaction (see 0071's check).
--
-- NO PUSH IS SENT: notify_via_edge_function only enqueues into net.http_request_queue, which a
-- rollback discards (asserted in 0072's check). WHO: seeded demo personas made non-demo inside
-- the transaction; every like goes through the app's own RPCs (perform_swipe, accept_invite,
-- send_super_ping) as `authenticated`, exactly as the app calls them. All rolled back.
--
-- THE LIKE TRIGGER FIRES AT COMMIT, and this transaction never commits. pg_temp.fire_like_alerts()
-- stands in for the commit: SET CONSTRAINTS ... IMMEDIATE runs every pending deferred event of
-- on_swipe_like_alert right then, and setting it back to DEFERRED keeps the next RPC's likes
-- waiting for "their" commit, the way production sees them.

begin;

set local lock_timeout = '5s';

create temp table check_log (n serial primary key, line text not null);
create temp table chk_ids (role text primary key, id uuid not null);
create temp table chk_base (queue_id bigint not null);
grant select on chk_ids to authenticated;

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

create function pg_temp.id(p_who text) returns uuid
language sql stable as $f$
  select c.id from chk_ids c where c.role = p_who
$f$;

-- The commit, as far as the like trigger can tell.
create function pg_temp.fire_like_alerts() returns void
language plpgsql as $f$
begin
  set constraints public.on_swipe_like_alert immediate;
  set constraints public.on_swipe_like_alert deferred;
end;
$f$;

-- Push requests of one type queued in this transaction, to one person (any of the id fields).
create function pg_temp.requests(p_type text, p_person uuid) returns integer
language sql stable as $f$
  select count(*)::int
  from net.http_request_queue q
  where q.id > (select b.queue_id from chk_base b)
    and q.url like '%/send-push-notification'
    and q.body is not null
    and convert_from(q.body, 'UTF8')::jsonb->>'type' = p_type
    and p_person::text in (
      convert_from(q.body, 'UTF8')::jsonb->>'recipientId',
      convert_from(q.body, 'UTF8')::jsonb->>'receiverId',
      convert_from(q.body, 'UTF8')::jsonb->>'userAId',
      convert_from(q.body, 'UTF8')::jsonb->>'userBId'
    )
$f$;

-- A persona made real for this transaction: local noon, a fake token, every switch on, no deck
-- filters, sharing p_game, and a clean slate of alerts, swipe counters and rate limits.
create function pg_temp.make_real(p_id uuid, p_region public.region_enum, p_game uuid, p_skill text) returns void
language plpgsql as $f$
begin
  update public.profiles set is_demo = false, region = p_region, timezone = pg_temp.zone_at(12) where id = p_id;
  insert into public.push_tokens (profile_id, expo_push_token) values (p_id, 'ExponentPushToken[check-0083-' || p_id::text || ']')
  on conflict do nothing;
  insert into public.notification_settings (profile_id) values (p_id) on conflict (profile_id) do nothing;
  update public.notification_settings set new_like = true, new_player = true, new_match = true, super_ping = true where profile_id = p_id;
  update public.preferences set preferred_regions = null, required_language = null, min_age = 18, max_age = 99 where profile_id = p_id;
  insert into public.profile_games (profile_id, game_id, skill_level, priority)
  select p_id, p_game, p_skill::public.skill_level_enum, 9
  where not exists (select 1 from public.profile_games pg where pg.profile_id = p_id and pg.game_id = p_game);
  delete from public.like_alerts where recipient_id = p_id or liker_id = p_id;
  delete from public.new_player_alerts where recipient_id = p_id;
  delete from public.daily_swipe_counters where profile_id = p_id;
  delete from public.rate_limit_hits where profile_id = p_id;
end;
$f$;

create function pg_temp.zone_at(p_hour int) returns text
language sql stable as $f$
  select z.name from pg_timezone_names z
  where z.name ~ '^Etc/GMT[+-][0-9]+$'
    and extract(hour from now() at time zone z.name)::int = p_hour
  limit 1
$f$;

-- ===========================================================================
-- A. What 0083 switches on
-- ===========================================================================
do $$
begin
  assert exists (
    select 1 from pg_trigger t
    where t.tgname = 'on_swipe_like_alert' and t.tgrelid = 'public.swipes'::regclass and not t.tgisinternal
      and t.tgenabled = 'O'
      and pg_get_triggerdef(t.oid) like '%AFTER INSERT ON public.swipes%'
      and pg_get_triggerdef(t.oid) like '%''like''%'
      and pg_get_triggerdef(t.oid) like '%enqueue_like_alert()%'
  ), 'A: on_swipe_like_alert is missing, disabled, or not AFTER INSERT for likes only';
  assert exists (
    select 1 from pg_trigger t
    where t.tgname = 'on_swipe_like_alert' and t.tgrelid = 'public.swipes'::regclass
      and t.tgconstraint <> 0 and t.tgdeferrable and t.tginitdeferred
  ), 'A: on_swipe_like_alert is not a DEFERRABLE INITIALLY DEFERRED constraint trigger, so it decides before accept_invite and send_super_ping finish';
  assert position('exception' in lower(pg_get_functiondef('public.enqueue_like_alert()'::regprocedure))) > 0,
    'A: enqueue_like_alert has no exception block, so a bug could fail a swipe';
  assert exists (select 1 from cron.job where jobname = 'like-alerts-hourly' and schedule = '10 * * * *'
                 and command like '%public.send_pending_like_alerts()%'), 'A: like-alerts-hourly is not scheduled';
  assert exists (select 1 from cron.job where jobname = 'first-message-nudges-hourly' and schedule = '50 * * * *'
                 and command like '%public.send_first_message_nudges()%'), 'A: first-message-nudges-hourly is not scheduled';
  assert (select count(*) from cron.job where jobname in ('like-alerts-hourly', 'first-message-nudges-hourly')) = 2,
    'A: a job is scheduled twice';
  insert into check_log (line) values ('A ok: like trigger (AFTER INSERT, likes only, deferred to commit, error-proof) and both hourly sweeps (:10, :50) are in place, once each');
end;
$$;

-- ===========================================================================
-- B. End to end: a like through perform_swipe queues one alert; a pass queues nothing
-- ===========================================================================
do $$
declare
  v_ids uuid[];
  v_game uuid;
  v_skill text;
  v_res record;
  v_alerts int;
begin
  select array_agg(x.id order by x.id) into v_ids from (
    select p.id from public.profiles p join auth.users u on u.id = p.id
    where p.is_demo and p.onboarding_completed and p.is_active and not p.is_banned and not p.is_admin_suspended
      and u.email like '%@duoqueue.io' and u.email <> 'review@duoqueue.io'
      and not public.is_premium(p.id)
    order by p.id desc limit 3
  ) x;
  insert into chk_ids values ('r', v_ids[1]), ('l', v_ids[2]), ('p', v_ids[3]);
  insert into chk_base select coalesce(max(q.id), 0) from net.http_request_queue q;

  update public.profiles set is_demo = false, region = 'na_east', timezone = pg_temp.zone_at(12) where id = v_ids[1];
  update public.profiles set is_demo = false, region = 'na_west' where id in (v_ids[2], v_ids[3]);
  insert into public.push_tokens (profile_id, expo_push_token) values (v_ids[1], 'ExponentPushToken[check-0083-r]');
  insert into public.notification_settings (profile_id) values (v_ids[1]) on conflict (profile_id) do nothing;
  update public.notification_settings set new_like = true where profile_id = v_ids[1];
  update public.preferences set preferred_regions = null, required_language = null, min_age = 18, max_age = 99 where profile_id = v_ids[1];
  delete from public.like_alerts where recipient_id = v_ids[1];
  delete from public.new_player_alerts where recipient_id = v_ids[1];
  delete from public.swipes where (swiper_id = any (v_ids) and target_id = any (v_ids));
  delete from public.daily_swipe_counters where profile_id in (v_ids[2], v_ids[3]);
  delete from public.rate_limit_hits where profile_id in (v_ids[2], v_ids[3]);

  select pg.game_id, pg.skill_level::text into v_game, v_skill
    from public.profile_games pg where pg.profile_id = v_ids[1] order by pg.priority limit 1;
  insert into public.profile_games (profile_id, game_id, skill_level, priority)
  select x, v_game, v_skill::public.skill_level_enum, 9
    from unnest(array[v_ids[2], v_ids[3]]) x
   where not exists (select 1 from public.profile_games pg where pg.profile_id = x and pg.game_id = v_game);

  -- A pass first: nothing.
  perform pg_temp.act_as('p');
  select * into v_res from public.perform_swipe(pg_temp.id('r'), 'pass');
  reset role;
  perform pg_temp.fire_like_alerts();
  assert not exists (select 1 from public.like_alerts where liker_id = pg_temp.id('p')), 'B: a pass queued a like alert';

  -- A like: one alert, sent at once (local noon, budget unspent).
  perform pg_temp.act_as('l');
  select * into v_res from public.perform_swipe(pg_temp.id('r'), 'like');
  reset role;
  assert not v_res.matched, 'B: the like unexpectedly matched';
  assert not exists (select 1 from public.like_alerts where recipient_id = pg_temp.id('r') and liker_id = pg_temp.id('l')),
    'B: the like was decided before commit (the trigger is not deferred)';
  perform pg_temp.fire_like_alerts();
  assert (select sent_at from public.like_alerts where recipient_id = pg_temp.id('r') and liker_id = pg_temp.id('l')) is not null,
    'B: the like through perform_swipe was not alerted';
  select count(*) into v_alerts
    from net.http_request_queue q
   where q.id > (select b.queue_id from chk_base b) and q.url like '%/send-push-notification'
     and convert_from(q.body, 'UTF8')::jsonb->>'type' = 'new_like'
     and convert_from(q.body, 'UTF8')::jsonb->>'recipientId' = pg_temp.id('r')::text;
  assert v_alerts = 1, format('B: expected 1 new_like request, got %s', v_alerts);

  -- The like-back makes a match and no second like alert.
  update public.profiles set timezone = pg_temp.zone_at(12) where id = pg_temp.id('l');
  insert into public.push_tokens (profile_id, expo_push_token) values (pg_temp.id('l'), 'ExponentPushToken[check-0083-l]');
  perform pg_temp.act_as('r');
  select * into v_res from public.perform_swipe(pg_temp.id('l'), 'like');
  reset role;
  perform pg_temp.fire_like_alerts();
  assert v_res.matched, 'B: the like-back did not match';
  assert not exists (select 1 from public.like_alerts where recipient_id = pg_temp.id('l') and liker_id = pg_temp.id('r')),
    'B: a like-back that made a match was queued as a like alert';

  insert into check_log (line) values ('B ok: perform_swipe like -> one new_like request; a pass -> nothing; a like-back -> a match and no like alert');
end;
$$;

-- ===========================================================================
-- C. The sweeps run
-- ===========================================================================
do $$
begin
  assert public.send_pending_like_alerts() >= 0, 'C: the like sweep failed';
  assert public.send_first_message_nudges() >= 0, 'C: the first-message sweep failed';
  insert into check_log (line) values ('C ok: both sweeps run cleanly');
end;
$$;

-- ===========================================================================
-- D. Accepting an invite: "New match!" to both, and NO like alert to the inviter
-- ===========================================================================
--
-- The case a plain AFTER INSERT trigger got wrong: accept_invite writes the invitee's like
-- first, and at that moment the inviter has not swiped, so every gate passed and the inviter got
-- "Someone wants to duo with you" next to "New match!". The pair is set up so that every gate
-- WOULD pass (same group, a shared game, inside each other's decks, the inviter at local noon
-- with a token and an unspent budget): only the deferral stands between it and the false push.
do $$
declare
  v_inviter uuid;
  v_invitee uuid;
  v_game uuid;
  v_skill text;
  v_res record;
begin
  select x.ids[1], x.ids[2] into v_inviter, v_invitee from (
    select array_agg(y.id order by y.id) as ids from (
      select p.id from public.profiles p join auth.users u on u.id = p.id
      where p.is_demo and p.onboarding_completed and p.is_active and not p.is_banned and not p.is_admin_suspended
        and u.email like '%@duoqueue.io' and u.email <> 'review@duoqueue.io'
        and p.id not in (select c.id from chk_ids c)
        and not exists (select 1 from public.invite_redemptions ir where ir.invitee_id = p.id)
      order by p.id
      limit 2
    ) y
  ) x;
  if v_invitee is null then
    raise exception 'D: need 2 more demo personas';
  end if;
  assert public.same_age_band(v_inviter, v_invitee), 'D: the two personas are in different age groups';
  insert into chk_ids values ('inviter', v_inviter), ('invitee', v_invitee);

  select pg.game_id, pg.skill_level::text into v_game, v_skill
    from public.profile_games pg where pg.profile_id = v_inviter order by pg.priority limit 1;
  perform pg_temp.make_real(v_inviter, 'na_east', v_game, v_skill);
  perform pg_temp.make_real(v_invitee, 'na_west', v_game, v_skill);
  delete from public.swipes where (swiper_id = v_inviter and target_id = v_invitee) or (swiper_id = v_invitee and target_id = v_inviter);
  delete from public.matches where user_a_id = least(v_inviter, v_invitee) and user_b_id = greatest(v_inviter, v_invitee);

  assert public.like_alert_recipient_ok(v_inviter), 'D: setup: the inviter is not an eligible like-alert recipient';
  assert public.deck_gate_hard(v_inviter, v_invitee) and public.deck_gate_preferences(v_inviter, v_invitee),
    'D: setup: the invitee is not in the inviter''s deck, so this case would pass for the wrong reason';
  assert not public.person_push_sent_recently(v_inviter), 'D: setup: the inviter''s budget is already spent';

  insert into public.invite_redemptions (invitee_id, inviter_id, code) values (v_invitee, v_inviter, 'CHECK0083D');

  perform pg_temp.act_as('invitee');
  select * into v_res from public.accept_invite();
  reset role;
  perform pg_temp.fire_like_alerts();

  assert v_res.matched, 'D: accept_invite did not match the pair';
  assert pg_temp.requests('new_match', v_inviter) >= 1, 'D: no "New match!" request for the pair';
  assert pg_temp.requests('new_like', v_inviter) = 0, 'D: the inviter was sent a like alert for an invite they made';
  assert pg_temp.requests('new_like', v_invitee) = 0, 'D: the invitee was sent a like alert for the inviter''s automatic like';
  assert not exists (
    select 1 from public.like_alerts la
    where (la.recipient_id, la.liker_id) in ((v_inviter, v_invitee), (v_invitee, v_inviter))
  ), 'D: an invite left a like_alerts row (it would spend or wait on a budget for nothing)';
  assert not public.person_push_sent_recently(v_inviter), 'D: the invite spent the inviter''s one person-push of the day';

  insert into check_log (line) values ('D ok: accept_invite -> a match and "New match!", no like alert to either side, no ledger row, the inviter''s daily budget untouched');
end;
$$;

-- ===========================================================================
-- E. A Super Ping: the named Super Ping push, and NO anonymous like alert as well
-- ===========================================================================
do $$
declare
  v_sender uuid;
  v_target uuid;
  v_game uuid;
  v_skill text;
  v_store text;
  v_res record;
begin
  select x.ids[1], x.ids[2] into v_sender, v_target from (
    select array_agg(y.id order by y.id) as ids from (
      select p.id from public.profiles p join auth.users u on u.id = p.id
      where p.is_demo and p.onboarding_completed and p.is_active and not p.is_banned and not p.is_admin_suspended
        and u.email like '%@duoqueue.io' and u.email <> 'review@duoqueue.io'
        and p.id not in (select c.id from chk_ids c)
      order by p.id
      limit 2
    ) y
  ) x;
  if v_target is null then
    raise exception 'E: need 2 more demo personas';
  end if;
  assert public.same_age_band(v_sender, v_target), 'E: the two personas are in different age groups';
  insert into chk_ids values ('pinger', v_sender), ('pinged', v_target);

  select pg.game_id, pg.skill_level::text into v_game, v_skill
    from public.profile_games pg where pg.profile_id = v_target order by pg.priority limit 1;
  perform pg_temp.make_real(v_target, 'na_east', v_game, v_skill);
  perform pg_temp.make_real(v_sender, 'na_west', v_game, v_skill);
  delete from public.swipes where (swiper_id = v_sender and target_id = v_target) or (swiper_id = v_target and target_id = v_sender);
  delete from public.super_pings where sender_id = v_sender;

  -- Premium for the sender, the way the RevenueCat webhook records it.
  select e.enumlabel into v_store from pg_enum e
   where e.enumtypid = (select a.atttypid from pg_attribute a where a.attrelid = 'public.subscriptions'::regclass and a.attname = 'store')
   order by e.enumsortorder limit 1;
  delete from public.subscriptions where profile_id = v_sender;
  execute format('insert into public.subscriptions (profile_id, revenuecat_app_user_id, product_id, status, store) values (%L, %L, %L, %L, %L)',
                 v_sender, 'check-0083', 'check-0083', 'active', v_store);
  assert public.is_premium(v_sender), 'E: setup: the sender is not premium';

  assert public.like_alert_recipient_ok(v_target), 'E: setup: the target is not an eligible like-alert recipient';
  assert public.deck_gate_hard(v_target, v_sender) and public.deck_gate_preferences(v_target, v_sender),
    'E: setup: the sender is not in the target''s deck, so this case would pass for the wrong reason';
  assert not public.person_push_sent_recently(v_target), 'E: setup: the target''s budget is already spent';

  perform pg_temp.act_as('pinger');
  select * into v_res from public.send_super_ping(v_target);
  reset role;
  perform pg_temp.fire_like_alerts();

  assert v_res.ping_sent, 'E: the Super Ping was not sent';
  assert pg_temp.requests('super_ping', v_target) = 1, 'E: expected exactly one super_ping request';
  assert pg_temp.requests('new_like', v_target) = 0, 'E: a Super Ping also sent the anonymous like alert';
  assert not exists (select 1 from public.like_alerts la where la.recipient_id = v_target and la.liker_id = v_sender),
    'E: a Super Ping left a like_alerts row';
  assert not public.person_push_sent_recently(v_target), 'E: the Super Ping spent the target''s one person-push of the day';

  insert into check_log (line) values ('E ok: send_super_ping -> one named super_ping request, no like alert, no ledger row, the daily budget untouched');
end;
$$;

insert into check_log (line) values ('ALL CHECKS PASSED. Rolling back.');

select line from check_log order by n;

rollback;
