-- Replace the up-to-6-photo grid with exactly two named photo slots per profile: a
-- profile picture (used as the small avatar everywhere — matches list, admirers,
-- Standouts thumbnail) and a header picture (the big image behind prompts on the swipe
-- card). "position" ordering no longer means anything once there are only two distinct,
-- named roles, so it's replaced outright rather than layered on top of.

create type photo_role_enum as enum ('profile', 'header');

alter table public.profile_media add column photo_role photo_role_enum;

-- Backfill: for each profile, the lowest-position photo becomes the profile picture,
-- the next becomes the header picture. Anything beyond that (profiles that had more
-- than 2 photos under the old model) has no role assigned and gets dropped below.
with ranked as (
  select id, row_number() over (partition by profile_id order by "position") as rn
  from public.profile_media
)
update public.profile_media pm
set photo_role = case ranked.rn when 1 then 'profile' when 2 then 'header' end::photo_role_enum
from ranked
where ranked.id = pm.id and ranked.rn <= 2;

delete from public.profile_media where photo_role is null;

alter table public.profile_media alter column photo_role set not null;
alter table public.profile_media drop constraint position_range;
alter table public.profile_media drop constraint unique_profile_position;

-- public_profile_media still references "position" at this point — drop it now and
-- recreate (with photo_role instead) further down, after the column is gone.
drop view public.public_profile_media;

alter table public.profile_media drop column "position";
alter table public.profile_media add constraint unique_profile_role unique (profile_id, photo_role);

-- public_profile_media: same shape, photo_role instead of position.
create or replace view public.public_profile_media as
select pm.id, pm.profile_id, pm.storage_path, pm.photo_role
from public.profile_media pm
join public.profiles p on p.id = pm.profile_id
where pm.moderation_status = 'approved' and p.is_active = true;

-- get_matches_summary: same body as 0004_chat.sql, but the avatar subquery now picks
-- the profile-role photo directly instead of "first by position".
create or replace function public.get_matches_summary()
returns table (
  match_id uuid,
  other_profile_id uuid,
  other_display_name text,
  other_photo_path text,
  last_message text,
  last_message_at timestamptz,
  last_message_sender_id uuid,
  unread_count int,
  is_locked boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_is_premium boolean;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  v_is_premium := public.is_premium(v_me);

  return query
  with my_matches as (
    select
      m.id,
      case when m.user_a_id = v_me then m.user_b_id else m.user_a_id end as other_id,
      m.matched_at
    from public.matches m
    where (m.user_a_id = v_me or m.user_b_id = v_me) and m.unmatched_at is null
  ),
  last_msgs as (
    select distinct on (msg.match_id) msg.match_id, msg.content, msg.created_at, msg.sender_id
    from public.messages msg
    where msg.match_id in (select id from my_matches)
    order by msg.match_id, msg.created_at desc
  ),
  unread as (
    select msg.match_id, count(*) as cnt
    from public.messages msg
    where msg.match_id in (select id from my_matches)
      and msg.sender_id <> v_me
      and msg.read_at is null
    group by msg.match_id
  ),
  ranked as (
    select
      mm.id,
      greatest(mm.matched_at, coalesce(lm.created_at, mm.matched_at)) as activity
    from my_matches mm
    left join last_msgs lm on lm.match_id = mm.id
  ),
  unlocked_ids as (
    select id from ranked order by activity desc limit 5
  )
  select
    mm.id,
    mm.other_id,
    p.display_name,
    (
      select pmedia.storage_path from public.profile_media pmedia
      where pmedia.profile_id = mm.other_id
        and pmedia.moderation_status = 'approved'
        and pmedia.photo_role = 'profile'
    ),
    lm.content,
    lm.created_at,
    lm.sender_id,
    coalesce(u.cnt, 0)::int,
    not (v_is_premium or mm.id in (select id from unlocked_ids))
  from my_matches mm
  join public.profiles p on p.id = mm.other_id
  left join last_msgs lm on lm.match_id = mm.id
  left join unread u on u.match_id = mm.id
  order by greatest(mm.matched_at, coalesce(lm.created_at, mm.matched_at)) desc;
end;
$$;

grant execute on function public.get_matches_summary() to authenticated;
