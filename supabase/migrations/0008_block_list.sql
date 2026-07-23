-- Blocks were insert/select-only (0001_init.sql) — there was no way to unblock, and no
-- way to show a blocked user's display_name (profiles RLS only allows selecting your own
-- row). This adds an unblock policy and a SECURITY DEFINER RPC scoped to the caller's own
-- blocks so the client can render a "Block List" management screen.

create policy "blocks_delete_own" on public.blocks
  for delete using (blocker_id = auth.uid());

grant delete on public.blocks to authenticated;

create or replace function public.get_blocked_users()
returns table (blocked_id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select b.blocked_id, p.display_name
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

grant execute on function public.get_blocked_users() to authenticated;
