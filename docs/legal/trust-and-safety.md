# DuoQueue Trust & Safety Operating Procedure

Status: **DRAFT — operational as of publication, but section 4 (minor/CSAM escalation) has a
launch-blocking dependency that is not yet closed.** See the `TODO(lawyer)` and `GAP:` markers
throughout. This document describes the process as it must be run today, given what is actually
built, not an aspirational future state.

---

## 1. Scope and responsibility

This procedure covers every path through which DuoQueue content or user conduct gets reviewed,
actioned, or escalated: automated photo moderation, the admin review queue, the in-app report
flow, and admin access to private messages for investigating a report.

**DuoQueue is operated by a single person today.** There is no separate trust & safety team, no
on-call rotation, and no 24/7 coverage. This document defines a role — **Trust & Safety Duty
Officer** — rather than naming an individual, so the procedure survives the operator changing or
a second person being added. Today, the operator (Cameron Stallings) holds this role personally,
alongside every other `is_admin = true` account (see section 6).

Whoever holds `is_admin = true` on `profiles` is, by construction, someone with the technical
ability to review flagged content and read reported conversations (`admin/index.html`). Anyone
granted that flag inherits the duties in this document, not just the technical access.

**GAP:** there is no written policy for *who* is allowed to hold `is_admin`, and no background-check
or NDA process for granting it. — *Proposed fix: before granting `is_admin` to a second person,
require a signed confidentiality agreement covering exposure to private messages and reported
media, and record the grant (who, when, why) in the record-keeping log described in section 9.*

---

## 2. The moderation pipeline as built

### 2.1 Automated photo screening

Every profile photo goes through `supabase/functions/moderate-photo/index.ts` immediately after
upload, before it can ever become visible to another user:

1. The uploaded file is re-encoded and stripped of EXIF/GPS data (`sanitize.ts`), and the
   sanitized bytes overwrite the original in storage.
2. The **same sanitized bytes** are sent to Sightengine (`provider.ts`) for three checks in one
   request: `nudity-2.1`, `gore-2.0`, and `face-attributes` (which returns a per-face `minor`
   score — the likelihood a detected face belongs to a minor).
3. Sightengine was chosen specifically because it returns a minor-likelihood score per face;
   AWS Rekognition's moderation labels do not answer "is this a minor," and that question is the
   single most important one this pipeline has to answer correctly.

### 2.2 Thresholds and outcomes

There are three possible outcomes per photo, not two — `approved`, `rejected`, or `undetermined`
(left `pending`). A boolean would force every "I don't know" (provider outage, timeout,
unparseable response) into a false approve or a false reject; both are wrong, so `undetermined`
exists as a real third state.

| Check | Auto-reject at | Route to human review (band) |
|---|---|---|
| **Minor** (per-face) | `>= 0.70` | `0.35 – 0.69` |
| **Explicit sexual content** (`sexual_activity`, `sexual_display`, `erotica` — max of the three) | `>= 0.50` | `0.30 – 0.49` |
| **Gore / graphic violence** | `>= 0.50` | `0.30 – 0.49` |

The minor check is evaluated **first** and outranks every other signal: if `minor >= 0.70` the
photo is auto-rejected regardless of what else the image shows, with the reason surfaced to the
uploader as *"This photo appears to show a minor."*

The minor thresholds are deliberately asymmetric with a wide review band (`0.35–0.69`, more than
twice the width of the explicit/gore review bands). The reasoning, stated directly in
`provider.ts`: wrongly rejecting a young-looking adult is an annoyance the user can appeal;
wrongly approving a photo of a child is unacceptable and potentially criminal. So anything past
mild suspicion goes to a human, and only a confident detection auto-rejects without one.

Ordinary swimsuit/gym/shirtless photos are not penalized — only the three genuinely explicit
nudity classes are scored; `mildly_suggestive` / `suggestive` / `very_suggestive` are ignored
entirely, because this is a friend-finder app, not a nudity-free zone.

Any of the following degrade to `undetermined` (never to a silent approve): the moderation
provider is unset or misconfigured, the HTTP call fails or times out, Sightengine reports a
non-success status, or a successful response is missing every section the code expects. An unset
provider intentionally routes **every** photo to manual review rather than defaulting to
auto-approve — a silent auto-approve is the one failure mode that looks like nothing is wrong
while quietly publishing unreviewed content.

### 2.3 Where pending items surface, and the human review step

Photos and voice intros left `pending` (either genuinely undetermined, or landed in a review
band) appear in the admin console (`admin/index.html`), under "Pending photos" and "Pending voice
intros." Nothing else can move a photo out of `pending` except an admin action there
(`review_photo` RPC) or the automated check itself — clients have no write path to
`moderation_status` (enforced at the RLS/grant level, `0006` and `0031`).

**Today, the admin queue treats every pending item identically.** A photo held for a suspected
minor and a photo held for a borderline swimsuit shot land in the same list, shown as a raw image
an admin has to judge cold, with no visible signal for *why* it was flagged or which threshold it
tripped.

**GAP:** no distinct minor-flag signal in the admin queue. — *Proposed fix: have
`moderate-photo` write the triggering scores (`minor`, `explicit`, `gore`) and verdict onto the
`profile_media` row (or a linked table) so the admin queue can visually separate and prioritize
"possible minor" items ahead of ordinary content review, per the SLA in section 3.*

**GAP:** no server-side log of who reviewed what, when, and what they decided, beyond the current
`moderation_status` value itself (which just gets overwritten). — *Proposed fix: add an
`admin_audit_log` table and write a row on every `review_photo` / `review_voice_intro` call and
every report status change, capturing admin id, target, action, and timestamp. See section 6.*

---

## 3. Response-time commitments

Apple App Store Review Guideline 1.2 requires a stated commitment for UGC apps, not just a
mechanism. The commitments below are deliberately sized for a **solo operator** — achievable
without weekend/holiday exceptions — but they are commitments to be met, not aspirations to miss
gracefully.

| Trigger | Commitment |
|---|---|
| Any report reason **other than** `underage` (harassment, spam, inappropriate content, impersonation, other) | Triaged (status moved from `open`) within **24 hours** |
| Report reason **is** `underage`, OR a photo lands in the minor-review band (`minor` score `0.35`+) | Triaged **immediately on discovery, ahead of every other queue item** — treated as the Duty Officer's highest priority, checked at minimum every few waking hours, not batched with routine review |
| Account action decided (warn / remove content / suspend / ban) after triage | Taken **same day** the triage decision is made |
| User support/contact inquiries (see section 6/gap below re: published contact) | Acknowledged within **48 hours** |
| Appeal of an account action (section 8) | Reviewed within **72 hours** |

These are the operator's own commitment, sized to what one person can realistically sustain, and
they are the number that should be quoted in App Store Connect's review notes and any published
Safety Center / support text.

**GAP:** no published support/contact email exists anywhere in the app or repo today (confirmed by
repo-wide search — the Safety Center's crisis page links 988/IASP for user emergencies but names
no DuoQueue contact). Apple 1.2 expects reachable contact info alongside the SLA. — *Proposed fix:
publish a support address (e.g. `support@duoqueue.io`, since the domain is already owned) in
Settings and the Safety Center, and register the same address in App Store Connect before
submission.*

---

## 4. Escalation path: suspected minors / CSAM

**This is the critical section.** DuoQueue's own pipeline manufactures actual knowledge in two
ways: the automated minor-score on every photo (section 2), and the `underage` report reason
available to any user (`report_reason_enum`, `ReportModal.tsx`). Once a human — an admin, or the
Duty Officer — looks at a flagged item and forms the belief that it depicts a minor, US law (18
U.S.C. § 2258A) imposes a reporting duty on DuoQueue as the provider. This is a **reporting** duty
that attaches once knowledge exists — it does not require DuoQueue to have gone looking, but
DuoQueue already scans every photo, so knowledge will arise.

When a photo trips `minor >= 0.35` (review band or auto-reject) or a report with reason
`underage` is filed, the Duty Officer follows this sequence:

**(a) Immediate account suspension and removal from public surfaces.**
Set the account `is_active = false` (removing it from `public_profiles` and all `public_profile_*`
views immediately) and confirm the flagged media's `moderation_status` is `rejected` (never
`approved`) so it cannot appear anywhere. Do this before anything else in this list.

**GAP:** there is no single "suspend account" admin action today — `is_active` has to be updated
directly, and there is no admin UI button for it. — *Proposed fix: add a suspend/reinstate control
to `admin/index.html`, gated the same way `review_photo` is, that flips `is_active` and logs the
action.*

**(b) PRESERVE — do not delete.**
Do **not** delete the account, the flagged media, the storage object, or the associated report,
match, or message rows. Destroying this material can itself be an offence, and 18 U.S.C. § 2258A
requires preservation of the reported content and associated records (for a defined retention
window) after a CyberTipline report is made. Preservation, not deletion, is the default the
instant suspicion exists.

**This is a real, live conflict with the current system, flagged by the audit:**
`reports.reporter_id` and `reports.reported_id` both reference `profiles(id) on delete cascade`,
and `delete-account` (`supabase/functions/delete-account/index.ts`) permanently deletes the
`auth.users` row — which cascades through `profiles` and destroys every report filed against that
user, along with their storage objects, the moment they hit "Delete account" themselves. Today, a
user under suspicion (or under an open report) can self-delete and erase the evidence before any
admin acts on it. This is a dependency that must be fixed, and it is being tracked as one — self-
service deletion cannot be allowed to complete normally for an account with an open `underage`
report or a `minor`-band-flagged photo pending review.

**GAP:** `delete-account` has no exception for flagged/reported accounts and no quarantine
mechanism. — *Proposed fix (engineering, no legal sign-off needed): before running the deletion
path, check for (i) any `reports` row against this user with `reason = 'underage'` and
`status != 'dismissed'`, or (ii) any `profile_media` row for this user with a `rejected` status
whose rejection reason indicates the minor threshold. If either exists, refuse the self-service
deletion (or route it to a hold state) rather than executing it, and surface a message directing
the user to contact support. Until this ships, the Duty Officer's fallback is to suspend the
account (4a) the moment a minor-flag or `underage` report appears, specifically so the user
cannot out-run review by self-deleting first.*

**(c) Do not view, download, forward, or re-share beyond what is strictly necessary.**
Do not download the flagged image to a local device, do not forward it by email/Slack/message to
anyone (including a co-founder, a contractor, or any AI assistant/chat tool), and do not view it
more times than necessary to make the suspension/report decision. Viewing and handling CSAM-
adjacent material carries its own legal exposure; the rule is minimum necessary handling, full
stop. The admin console's signed-URL preview (already time-limited, already access-controlled
behind `is_admin`) is the review surface — nothing gets copied out of it.

**(d) Report to NCMEC's CyberTipline as a provider.**
`TODO(lawyer)`: **the mechanics of CyberTipline registration and submission must be set up with
counsel before launch.** This is not an engineering task — the submission format, retention
mechanics, and the "who is DuoQueue's designated point of contact with NCMEC" question all carry
criminal exposure if handled incorrectly, and no NCMEC integration exists in this codebase today.
Until that is in place, the Duty Officer's obligation is to complete (a), (b), and (c) above and
hold the account/content in a preserved, suspended state — not to attempt a CyberTipline
submission without counsel-reviewed process.

**(e) Named record of what was done and when.**
Every step above gets logged: who (Duty Officer name/role), what account/media, what action, what
timestamp, in the record described in section 9. This record is itself something a future
CyberTipline submission and/or law-enforcement request will need.

---

## 5. Other report categories: harassment, spam, inappropriate content, impersonation

For everything that is not a minor/CSAM signal, triage against the 24-hour SLA (section 3) using
these criteria, then apply the lowest rung of the action ladder that is proportionate:

| Category | Triage criteria | Action ladder |
|---|---|---|
| **Harassment** | Is it targeted, repeated, or threatening? Check `messages` for the reported match via "View chat" in the admin console. | Warn → remove offending message content is not currently deletable (messages have no admin-delete path — see gap below) → suspend → ban, escalating with severity/repetition |
| **Spam** | Commercial/promotional content, scripted mass-liking pattern, off-platform redirect attempts | Remove reported content where possible → suspend → ban |
| **Inappropriate content** | Bio/prompt text, or a photo that a user flagged but the automated pipeline missed/approved | Re-run judgment against the same thresholds a human would apply in the photo queue (section 2.2) → reject/remove photo via `review_photo`, or note bio/prompt for the operator to edit/warn on (no content-editing admin path exists yet — see gap below) → suspend → ban on repeat |
| **Impersonation** | Reported user claims to be someone else, or profile photos appear lifted from elsewhere | Suspend pending the reported user's response → ban if confirmed |
| **Other** | Read `details` field, use judgment; if it resembles any category above, apply that row's ladder | As appropriate |

Every action taken against a report should move its `status` (`reviewed` → `actioned` /
`dismissed`) via the admin console, which is the only record of triage outcome today.

**GAP:** there is no admin action to delete/hide a single offending message or bio/prompt text —
today the only levers are per-photo approve/reject and whole-account suspension (via direct DB
edit) or account deletion. — *Proposed fix: add a narrowly-scoped admin RPC to redact a specific
message or clear a bio/prompt field, logged the same way `review_photo` is.*

---

## 6. Admin access to private messages

**Admins can read reported conversations.** This is by design: `admin/index.html`'s report queue
lets an admin click "View chat" on any report that has a `match_id`, which loads up to the most
recent 100 messages of that conversation (`loadConversation`, gated only by `is_admin_user()` at
the RLS layer, `0006`/`0031`). The code's own comment acknowledges this plainly: *"this page is
the one surface where an `is_admin` account can read reports and private messages."*

**This access is limited to investigating a specific report.** Reading a conversation that has
not been reported is not an intended use of this access, even though the RLS policy
(`messages_select_admin`) does not technically restrict reads to reported matches — the policy
grants broader access than the stated purpose. Until the audit log below exists, this is a
**policy commitment**, not a technical one: an admin only opens "View chat" in direct response to
an open report.

Access-control facts as they exist today:
- Gated by `profiles.is_admin`, which is not client-settable (closed as a critical hole in
  `0031_security_hardening.sql`, after a prior bug let any user self-grant it).
- The admin console itself authenticates with plain Supabase email/password sign-in — no MFA
  requirement exists.

**GAP:** no audit log of message access exists — `updateReportStatus` timestamps the *report*
status change, but nothing records that an admin opened a specific conversation, or when.
— *Proposed fix: add an `admin_audit_log` table (admin id, action type, target id, timestamp) and
write a row from `loadConversation` (message view), `review_photo`, `review_voice_intro`, and
`updateReportStatus`. This is the same table needed for section 2.3 and section 4(e).*

**GAP:** no MFA is enforced on `is_admin` accounts, which is the single account type with access to
every private message and every unapproved photo in the system. — *Proposed fix: require MFA
(Supabase Auth supports TOTP) on any account before granting `is_admin = true`.*

---

## 7. Lawful requests (subpoenas, law enforcement)

`TODO(lawyer)`: the formal policy for responding to subpoenas, warrants, and law-enforcement
requests must be drafted with counsel before launch — which jurisdictions' process DuoQueue will
honor, whether a subpoena is sufficient for message content or a warrant is required, response
timelines, and a designated point of contact.

Until that formal policy exists, the operating rule is:

- **Intake route:** any legal request must arrive in writing (email is acceptable at current
  scale) to the Duty Officer. No request is acted on if received informally (a phone call, a
  social-media DM, an in-app message).
- **Every request is reviewed before any data is disclosed.** No data — account records, photos,
  messages, or metadata — is produced in response to a request until the Duty Officer (and, once
  engaged, counsel) has confirmed the request is facially valid for the jurisdiction and scope
  claimed. Nothing is disclosed same-day by default; "reviewed before disclosure" is the rule even
  under perceived urgency.
- Every request received, and every response given, is recorded per section 9.

---

## 8. Appeals

A user who has had content removed or their account actioned (warned, suspended, or banned) may
contest it by contacting the published support address (section 3 gap notwithstanding — until
that ships, the App Store/Play Store listing's support contact is the fallback channel).

- Appeals are reviewed within **72 hours** (section 3).
- The Duty Officer reviewing an appeal should not be the same review that made the original
  action where practicable; at solo-operator scale this is not always possible, and that
  limitation is disclosed here rather than pretended away.
- Appeal outcome (upheld / reversed / modified) is recorded per section 9.
- **Exception:** actions taken under section 4 (suspected minor/CSAM) are not reversed by an
  appeal alone — any reinstatement in that category requires the same preservation obligations to
  stay satisfied and, once section 4(d) is operational, coordination with counsel.

---

## 9. Record-keeping and periodic review

Until the `admin_audit_log` table (sections 2.3, 6) ships, the Duty Officer keeps a manual record
(a private, access-controlled log — not a public document) of:

- Every section 4 escalation: account/media id, each step (a)–(e) and when it was completed, and
  by whom.
- Every lawful request received and the response given (section 7).
- Every appeal and its outcome (section 8).
- Every `is_admin` grant: who, when, why, and confirmation the confidentiality agreement (section
  1 gap) was signed.

**This document is reviewed at minimum every 6 months, and immediately after:**
- Any change to the moderation thresholds in `provider.ts`.
- Any change to the admin console's report/queue/message-access surfaces.
- The NCMEC CyberTipline integration (section 4d) becoming operational — this document must be
  updated to remove its `TODO(lawyer)` marker and describe the real, counsel-approved process
  before that happens, not after.
- Any actual section 4 escalation, as a post-incident review.

## Open items tracker (all GAP/TODO markers in this document)

1. **GAP** (§1): no written policy or background-check/NDA process for granting `is_admin`.
2. **GAP** (§2.3): admin queue doesn't distinguish minor-flagged items from ordinary pending
   review — no visible score/reason on the queue row.
3. **GAP** (§2.3, §6): no `admin_audit_log` table — no record of who reviewed/viewed what, when.
4. **GAP** (§3): no published support/contact email in-app or in store metadata.
5. **GAP** (§4a): no admin "suspend account" UI action — requires a direct DB edit today.
6. **GAP / dependency** (§4b): self-service account deletion cascades and destroys `reports` rows
   (and storage) with no exception for flagged/reported accounts — must be fixed before this
   procedure's preservation step can be technically guaranteed rather than merely a race against
   the user.
7. **TODO(lawyer)** (§4d): NCMEC CyberTipline registration and submission process — not built,
   must not be built without counsel.
8. **GAP** (§5): no admin action to redact a single message or bio/prompt field short of full
   photo reject or whole-account suspension/deletion.
9. **GAP** (§6): no MFA requirement on `is_admin` accounts.
10. **TODO(lawyer)** (§7): formal lawful-request response policy.
