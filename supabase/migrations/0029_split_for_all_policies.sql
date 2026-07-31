-- Replace the twelve `for all` ownership policies with explicit per-operation ones.
--
-- The existing policies were behaviorally correct (all were plain
-- `profile_id = auth.uid()` ownership checks with a matching WITH CHECK), so this is a
-- defensive refactor rather than a fix: `for all` collapses SELECT/INSERT/UPDATE/DELETE
-- into one rule, so a future edit that's right for reads but wrong for writes has
-- nowhere to show up as a separate, reviewable policy. Splitting them means each
-- operation's intent is stated — and auditable — on its own.
--
-- Semantics are deliberately unchanged: USING for read/update/delete visibility,
-- WITH CHECK for the rows a write is allowed to produce.

do $$
declare
  t text;
  -- Every table whose ownership column is `profile_id`.
  tables text[] := array[
    'profile_media',
    'profile_platforms',
    'profile_languages',
    'profile_playstyles',
    'profile_games',
    'profile_shows',
    'preferences',
    'push_tokens',
    'notification_settings',
    'hidden_words',
    'profile_prompts',
    'profile_vibe'
  ];
  old_policy_names text[] := array[
    'profile_media_all_own',
    'profile_platforms_all_own',
    'profile_languages_all_own',
    'profile_playstyles_all_own',
    'profile_games_all_own',
    'profile_shows_all_own',
    'preferences_all_own',
    'push_tokens_all_own',
    'notification_settings_all_own',
    'hidden_words_all_own',
    'profile_prompts_all_own',
    'profile_vibe_all_own'
  ];
  i int;
begin
  for i in 1 .. array_length(tables, 1) loop
    t := tables[i];

    execute format('drop policy if exists %I on public.%I', old_policy_names[i], t);

    execute format(
      'create policy %I on public.%I for select using (profile_id = auth.uid())',
      t || '_select_own', t
    );
    execute format(
      'create policy %I on public.%I for insert with check (profile_id = auth.uid())',
      t || '_insert_own', t
    );
    execute format(
      'create policy %I on public.%I for delete using (profile_id = auth.uid())',
      t || '_delete_own', t
    );

    -- Only create an UPDATE policy where UPDATE is actually granted. hidden_words is
    -- add/remove-only (no UPDATE grant in 0009), and profile_media's UPDATE is
    -- column-restricted in 0006 so moderation_status stays server-only — writing a
    -- policy for a privilege the role doesn't hold would just be decoration that
    -- reads like a real control.
    if exists (
      select 1 from information_schema.role_table_grants
      where grantee = 'authenticated'
        and table_schema = 'public'
        and table_name = t
        and privilege_type = 'UPDATE'
    ) then
      execute format(
        'create policy %I on public.%I for update using (profile_id = auth.uid()) with check (profile_id = auth.uid())',
        t || '_update_own', t
      );
    end if;
  end loop;
end
$$;
