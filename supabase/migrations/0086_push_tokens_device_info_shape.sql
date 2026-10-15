-- 0086: push_tokens.device_info has a shape: null, or a JSON object of at most 2 KB.
--
-- WHY. From 1.0.2 the app stamps its push-token row with what it is running (Group P, task P7:
-- app version, build, update id, channel, whether the bundle is embedded, the OS and its
-- version, which kind of Supabase key it holds, when it stamped). It writes that object itself,
-- through push_tokens_update_own, so until now the column took any JSON of any size from any
-- signed-in client: an array, a string, or a few megabytes on its own row. Nothing reads it in
-- the app; it exists so Cameron can see which builds and OTAs are in use and whether the
-- publishable key reached each phone. The real stamp is ten short fields, well under 1 KB
-- (each string is cut to 64 characters on the phone), so 2 KB is room to grow, not a squeeze.
--
-- SAFE FOR THE 1.0.1 APP IN THE STORE: 1.0.1 never writes device_info (read on 15 Oct 2026:
-- all 21 live rows are null, and apps/mobile at 0ee8ef2 has no device_info write).
-- push_tokens_update_own and push_tokens_delete_own are untouched (the 1.0.2 sign-out deletes its
-- own row through the second).
--
-- THE LOCK, honestly. ADD CONSTRAINT takes an ACCESS EXCLUSIVE lock on push_tokens, and
-- apply-migration.ps1 runs this whole file as ONE transaction, so that lock is held through the
-- VALIDATE and until commit: NOT VALID followed by VALIDATE in the same transaction does not
-- shorten it. Here that is harmless, because the scan is 21 rows (15 Oct 2026) and
-- lock_timeout is 5 s. Do not copy this pattern onto a large table expecting the usual benefit:
-- there, the VALIDATE has to run in its own transaction (a separate migration or call), which
-- takes only SHARE UPDATE EXCLUSIVE and lets reads and writes go on during the scan.
--
-- pg_column_size is the stored size of the value as written (a CHECK runs before TOAST
-- compresses anything), so the bound is on what the client sent.
--
-- TO UNDO: alter table public.push_tokens drop constraint device_info_shape;
--
-- Checks: supabase/checks/0086_push_tokens_device_info_shape.sql.

set local lock_timeout = '5s';

alter table public.push_tokens drop constraint if exists device_info_shape;
alter table public.push_tokens
  add constraint device_info_shape
  check (
    device_info is null
    or (jsonb_typeof(device_info) = 'object' and pg_column_size(device_info) <= 2048)
  ) not valid;
alter table public.push_tokens validate constraint device_info_shape;
