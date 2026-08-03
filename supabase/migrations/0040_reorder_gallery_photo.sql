-- Full drag-to-reorder for the gallery grid. make_gallery_photo_first (0037) only ever
-- moves a photo to the front; this adds the general case — move a gallery photo to any
-- rank among the caller's own gallery photos, shifting the rows in between by one.
--
-- Ranks, not raw "position" values: useRemoveGalleryPhoto (client) deletes a row without
-- compacting the rest, so stored positions can already have gaps (e.g. [0, 2, 4] after
-- removing the row that used to sit at 1), and make_gallery_photo_first doesn't close
-- those gaps either — it only shifts rows literally < the old position. p_new_position
-- is therefore taken as a RANK (0..count-1, matching what the client's sorted array
-- indices already mean), not a literal position value: every gallery row for the caller
-- gets its position recomputed from row_number() over ("position") and reassigned
-- densely, which also self-heals any pre-existing gaps as a side effect rather than
-- trying to preserve them.
create or replace function public.reorder_gallery_photo(p_media_id uuid, p_new_position smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_old_position smallint;
  v_old_rank int;
  v_count int;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  -- Lock the target row first (as make_gallery_photo_first does) so a concurrent
  -- reorder on the same profile can't interleave with this one.
  select "position" into v_old_position
  from public.profile_media
  where id = p_media_id and profile_id = v_me and photo_role = 'gallery'
  for update;

  if not found then
    raise exception 'Gallery photo not found';
  end if;

  select count(*), count(*) filter (where "position" < v_old_position)
  into v_count, v_old_rank
  from public.profile_media
  where profile_id = v_me and photo_role = 'gallery';

  if p_new_position is null or p_new_position < 0 or p_new_position > v_count - 1 then
    raise exception 'Target position out of range';
  end if;

  if p_new_position = v_old_rank then
    return;
  end if;

  -- Same "swap under a unique constraint" situation 0037 explains at length: the
  -- intermediate per-row writes below are a legal permutation only once every row in
  -- the batch has been written, so the uniqueness check has to wait for end of
  -- transaction rather than firing per-row.
  set constraints public.profile_media_gallery_position_unique deferred;

  with ranked as (
    select id, (row_number() over (order by "position") - 1)::smallint as old_rank
    from public.profile_media
    where profile_id = v_me and photo_role = 'gallery'
  ),
  shifted as (
    select
      id,
      (case
        when id = p_media_id then p_new_position
        -- Moving earlier: everything from the target slot up to (not including) the
        -- photo's old rank slides back one rank to make room at the front.
        when p_new_position < v_old_rank and old_rank >= p_new_position and old_rank < v_old_rank
          then old_rank + 1
        -- Moving later: everything after the old rank up to the target slides forward
        -- one rank to close the gap the photo left behind.
        when p_new_position > v_old_rank and old_rank > v_old_rank and old_rank <= p_new_position
          then old_rank - 1
        else old_rank
      end)::smallint as new_position
    from ranked
  )
  update public.profile_media pm
  set "position" = shifted.new_position
  from shifted
  where pm.id = shifted.id;
end;
$$;

revoke execute on function public.reorder_gallery_photo(uuid, smallint) from public, anon;
grant execute on function public.reorder_gallery_photo(uuid, smallint) to authenticated;
