-- Six-photo gallery, part 2 of 2: schema + reorder RPC + public view. Requires 0036
-- (the 'gallery' enum value) to be committed first — see 0036 for why they are split.

-- 2. photo_role's uniqueness used to be table-wide (0015: unique_profile_role ==
--    unique (profile_id, photo_role)), which is exactly wrong for a role that must
--    repeat per profile. Narrow it to just the two singleton roles; gallery photos are
--    kept unique by position instead (below).
alter table public.profile_media drop constraint unique_profile_role;

create unique index profile_media_named_role_unique on public.profile_media (profile_id, photo_role)
  where photo_role in ('profile', 'header');

-- 3. Bring back "position" — dropped outright in 0015 when there were only two named
--    roles and ordering stopped meaning anything. It's meaningful again for gallery
--    photos only: profile/header rows must leave it null, gallery rows must set it to
--    a slot in 0..5.
alter table public.profile_media add column "position" smallint;

alter table public.profile_media add constraint profile_media_position_shape check (
  (photo_role = 'gallery' and "position" between 0 and 5)
  or (photo_role <> 'gallery' and "position" is null)
);

-- Deferrable, and deliberately NOT a partial index: NULLs are never equal to each
-- other under a plain UNIQUE constraint, so profile/header rows (position always null,
-- per the check above) never collide with one another and this can cover the whole
-- table instead of needing a `where photo_role = 'gallery'` clause — which matters
-- because partial indexes can't be converted into deferrable constraints.
--
-- The cap of 6 gallery photos falls out of this for free, the same way 0001's original
-- position_range + unique_profile_position capped the old up-to-6 model: only 6
-- distinct integers exist in 0..5, so a 7th gallery row for the same profile has
-- nowhere to go without colliding. No separate counting trigger needed.
--
-- Deferrable because make_gallery_photo_first (below) reorders by shifting every row
-- ahead of the target back one position, then moving the target to 0 — two UPDATEs
-- whose net effect is a legal permutation, but whose *intermediate* per-row writes can
-- collide with another row's not-yet-updated value (Postgres checks immediate unique
-- constraints as each row is written, not once at end of statement). Deferring the
-- check to end-of-transaction is the standard fix for exactly this "swap under a
-- unique constraint" case.
alter table public.profile_media
  add constraint profile_media_gallery_position_unique unique (profile_id, "position") deferrable initially immediate;

-- 4. Clients pick the position themselves on insert (first free slot in 0..5 among
--    their own gallery rows) but must never move a row afterward by writing to
--    "position" directly — reordering only ever happens through
--    make_gallery_photo_first below, the same "only a specific function can change
--    this" shape moderation_status already has (0006/0031).
revoke insert on public.profile_media from authenticated;
grant insert (profile_id, storage_path, photo_role, "position") on public.profile_media to authenticated;

-- 5. "Make first": move the target gallery photo to position 0, shifting whatever was
-- ahead of it back by one so the rest of the order is preserved (not a bare two-row
-- swap — that would silently reorder whatever used to sit between position 0 and the
-- target). profile_id = auth.uid() is enforced directly rather than left to RLS
-- because the SELECT ... FOR UPDATE needs to resolve the caller's own row (and lock
-- it against a concurrent reorder) before either UPDATE runs.
create or replace function public.make_gallery_photo_first(p_media_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_old_position smallint;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select "position" into v_old_position
  from public.profile_media
  where id = p_media_id and profile_id = v_me and photo_role = 'gallery'
  for update;

  if not found then
    raise exception 'Gallery photo not found';
  end if;

  if v_old_position = 0 then
    return;
  end if;

  set constraints public.profile_media_gallery_position_unique deferred;

  update public.profile_media
  set "position" = "position" + 1
  where profile_id = v_me and photo_role = 'gallery' and "position" < v_old_position;

  update public.profile_media
  set "position" = 0
  where id = p_media_id;
end;
$$;

revoke execute on function public.make_gallery_photo_first(uuid) from public, anon;
grant execute on function public.make_gallery_photo_first(uuid) to authenticated;

-- 6. public_profile_media: expose position so strangers' clients can order approved
--    gallery photos. Appended at the end of the SELECT list rather than reordered —
--    CREATE OR REPLACE VIEW cannot rename, reorder, or drop existing output columns,
--    only add new ones after the existing set. photo_role already passes through
--    unfiltered, so 'gallery' needs no separate exposure here; the block-aware WHERE
--    clause is unchanged from 0035.
create or replace view public.public_profile_media as
select pm.id, pm.profile_id, pm.storage_path, pm.photo_role, pm."position"
from public.profile_media pm
join public.profiles p on p.id = pm.profile_id
where pm.moderation_status = 'approved'
  and p.is_active = true
  and p.onboarding_completed = true
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );
