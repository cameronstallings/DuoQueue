-- Closes the two remaining halves of the account-deletion evidence-preservation gap
-- documented in docs/legal/trust-and-safety.md section 4(b) (open items tracker #6,
-- "GAP / dependency"), now that 0042/0043 are live.
--
-- (a) GAP 1 — delete-account's storage-removal loop deletes every object under the
--     departing user's folder in profile-photos/voice-intros unconditionally, with no
--     exception for media that was rejected or is still sitting in manual review. Per
--     the moderation pipeline (moderate-photo/provider.ts), 'pending' is not just "not
--     yet checked" — it is also where the minor-review band (score 0.35-0.69) and any
--     provider-outage "undetermined" result land, and 'rejected' is where a confident
--     auto-reject (score >= 0.70, or explicit/gore) lands. There is no finer-grained
--     signal than moderation_status yet (T&S doc section 2.3, open item #2 — the
--     per-photo score/reason is not persisted), so "flagged" here means the only thing
--     that is actually knowable today: any profile_media / profile_voice_intro row
--     whose moderation_status is not 'approved'. Under-preserving is the dangerous
--     failure mode — destroying possible CSAM evidence can itself be an offense under
--     18 U.S.C. Sec 2258A; a handful of ordinary photos still sitting in 'pending'
--     surviving longer than strictly necessary is not.
--
--     profile_media and profile_voice_intro both cascade away with the profile
--     (`on delete cascade`, 0001_init.sql / 0024_voice_intros.sql) regardless of
--     moderation_status, so a storage object left un-deleted would become an orphan
--     nobody can find the instant the account is gone, unless something durable still
--     points at it. preserved_moderation_evidence below is that pointer: a standalone
--     table with NO foreign key to profiles (the profile is, by definition, about to
--     stop existing) that delete-account writes to *before* it deletes anything.
--     Chosen over re-parenting the original rows onto some other profile because (i)
--     profile_id is the primary key of profile_voice_intro, not just a column, so there
--     is nothing to re-parent it onto without inventing a fake "tombstone" profile, and
--     (ii) re-parenting profile_media rows would pull them into every other policy/view
--     that already queries profile_media by profile_id (the admin review queue,
--     public_profile_media, etc.), widening the blast radius for no benefit. A copy
--     table stays entirely out of the way of the live schema. delete-account still
--     needs redeploying after this migration for the fix to take effect.
--
-- (b) GAP 2 — reports.reporter_id was still `on delete cascade`, asymmetric with
--     reported_id (changed to `on delete set null` in 0042): a report survives its
--     *subject* deleting their account, but not its *filer* — so a user who files an
--     `underage` report and then deletes their own account for any reason destroys the
--     very report that would have triggered the T&S escalation path (section 4). Mirrors
--     0042's reported_id treatment exactly: `on delete set null` plus a non-FK
--     reporter_profile_id copy taken at insert time, so reports keep correlating by the
--     same (possibly long-gone) reporter, and the report row — what was reported, when,
--     against whom — stays actionable either way.

-- ---------------------------------------------------------------------------
-- (a) Preservation table for flagged/rejected media pointers.
-- ---------------------------------------------------------------------------

create table public.preserved_moderation_evidence (
  id uuid primary key default gen_random_uuid(),
  original_profile_id uuid not null,
  original_media_id uuid,
  media_kind text not null check (media_kind in ('profile_photo', 'voice_intro')),
  storage_bucket text not null,
  storage_path text not null,
  moderation_status moderation_status_enum not null,
  media_created_at timestamptz,
  preserved_at timestamptz not null default now(),
  constraint preserved_moderation_evidence_unique_object unique (storage_bucket, storage_path)
);

create index preserved_moderation_evidence_profile_id_idx
  on public.preserved_moderation_evidence (original_profile_id);

alter table public.preserved_moderation_evidence enable row level security;

-- Admin-only read, same shape as every other admin-review surface
-- (profile_media_select_admin, 0033_photo_review_queue.sql). No insert/update/delete
-- grant to authenticated/anon anywhere — the only writer is delete-account, which runs
-- as the service role and bypasses RLS/grants entirely, the same way it already does
-- for the storage.remove() calls in that same function.
create policy "preserved_moderation_evidence_select_admin"
  on public.preserved_moderation_evidence
  for select to authenticated using (public.is_admin_user());

grant select on public.preserved_moderation_evidence to authenticated;
revoke select on public.preserved_moderation_evidence from anon;

-- ---------------------------------------------------------------------------
-- (b) reports.reporter_id: on delete cascade -> on delete set null, mirroring 0042's
-- treatment of reported_id line for line. Needs the column nullable, so the plain NOT
-- NULL constraint is dropped and replaced by the same before-insert trigger that
-- already enforces reported_id is required on new rows — extended here to also require
-- reporter_id and stamp reporter_profile_id. The function name is legacy (0042 named it
-- for reported_id only) but CREATE OR REPLACE FUNCTION updates the body the existing
-- trigger already fires, so no trigger drop/recreate is needed.
-- ---------------------------------------------------------------------------

alter table public.reports drop constraint reports_reporter_id_fkey;
alter table public.reports alter column reporter_id drop not null;
alter table public.reports add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references public.profiles (id) on delete set null;

alter table public.reports add column reporter_profile_id uuid;
update public.reports set reporter_profile_id = reporter_id where reporter_profile_id is null;
alter table public.reports alter column reporter_profile_id set not null;

create index reports_reporter_profile_id_idx on public.reports (reporter_profile_id);

create or replace function public.reports_require_reported_id_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reported_id is null then
    raise exception 'reported_id is required';
  end if;
  if new.reporter_id is null then
    raise exception 'reporter_id is required';
  end if;
  new.reported_profile_id := new.reported_id;
  new.reporter_profile_id := new.reporter_id;
  return new;
end;
$$;

revoke execute on function public.reports_require_reported_id_on_insert() from public, anon, authenticated;
