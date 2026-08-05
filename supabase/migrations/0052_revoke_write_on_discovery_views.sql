-- 0052: the discovery views were writable by any logged-in user. Close it.
--
-- Every `public_profile*` view exists to READ other people's profiles safely — they
-- encode the approved/active/onboarded/not-blocked filters that the base tables cannot
-- express to a stranger. They were created with only SELECT in mind, but nothing ever
-- revoked the write privileges Postgres/Supabase hand out by default, so
-- `information_schema.role_table_grants` showed INSERT, UPDATE, DELETE, TRUNCATE,
-- REFERENCES and TRIGGER granted to `authenticated` on all twelve.
--
-- That is not merely untidy. These views are simple enough for Postgres to treat as
-- auto-updatable, and none of them sets `security_invoker` (verified live: reloptions is
-- null on every one), so a view executes against its base tables with the VIEW OWNER's
-- rights — deliberately, because that is how 0035 reads `blocks` without granting users
-- access to it. The combination means a write routed through the view would land on the
-- base table with owner privileges, side-stepping the base table's RLS entirely:
--
--   PATCH /rest/v1/public_profiles?id=eq.<someone-else>   { "display_name": "..." }
--   DELETE /rest/v1/public_profile_media?profile_id=eq.<someone-else>
--
-- i.e. edit or delete another user's profile and photos with nothing but a normal
-- account. Read access is unaffected — the SELECT grants stay exactly as they were.
--
-- Applies to anon too, which holds no SELECT here but should hold nothing at all.

do $$
declare
  v_view text;
begin
  for v_view in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and c.relname like 'public_profile%'
  loop
    execute format(
      'revoke insert, update, delete, truncate, references, trigger on public.%I from public, anon, authenticated',
      v_view
    );
  end loop;
end;
$$;

-- Belt and braces for anything added later: stop handing out write privileges on new
-- views in this schema by default. (Existing objects are unaffected by this; the loop
-- above is what fixes them.)
alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
