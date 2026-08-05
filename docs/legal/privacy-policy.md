# DuoQueue Privacy Policy

**Effective date:** TODO(Cameron): set the effective date when this is published at a public URL.
**Version:** 1.0 (draft)

This policy explains what DuoQueue collects, why, who we share it with, and what control you have over it. It's written in plain language on purpose — if anything here is unclear, contact us using the details below.

---

## 1. Who we are

DuoQueue is a swipe-based app for finding gaming duos, built for players 18 and older.

- **Legal entity:** TODO(Cameron): insert the registered business name (or your own legal name if operating as an individual) and business address.
- **Contact email for privacy questions and rights requests:** TODO(Cameron): insert a monitored email address (e.g. `privacy@duoqueue.io`).
- **Data Protection Officer / EU representative (if applicable):** TODO(Cameron): fill in if required for your user base, or state "not applicable" once confirmed with counsel.

Wherever this policy says "contact us," use the email above.

---

## 2. What we collect, and why

We only collect what the app actually uses. Here's every category, itemized.

### Account information
- **Email address and password.** Your password is never stored or seen by us in plain text — authentication is handled by our infrastructure provider, Supabase Auth, which stores a salted hash. We use your email to let you sign in, confirm your address (a one-time 6-digit code), and send account-related messages.

### Profile information
- **Display name** — shown on your profile and in chat.
- **Date of birth** — collected once at signup. We use it for two things: confirming you're 18 or older (DuoQueue is not available to anyone younger — see [Section 9](#9-age-restriction)) and calculating the age shown on your profile. Your exact birth date is never shown to other users, only your calculated age.
- **Gender** — collected at onboarding and shown on your profile to other users; also used to filter candidates when someone sets a gender preference.
- **Region** — collected at onboarding and shown on your profile to other users; also used to filter candidates when someone sets a region preference, and to slightly favor same-region matches in ranking.
- **Spoken language(s)** — collected at onboarding; used as a premium filter so users can require a shared language, and to favor candidates who share a language with you in ranking.
- **Photos** — a profile photo, an optional header photo, and up to six gallery photos. Every uploaded photo is automatically re-processed to strip embedded location and camera metadata (EXIF/GPS data) before it's stored. Every photo also goes through our moderation pipeline before it becomes visible to anyone else — when our automated moderation provider (Sightengine) is configured, most photos are screened automatically and only borderline or undetermined cases go to a human moderator; if the automated provider isn't configured, every photo instead goes straight to human review. See [Section 3](#3-who-we-share-data-with).
- **Bio and prompt answers** — free-text fields you write about yourself.
- **Games, shows/movies/anime, and platforms** — what you play or watch, your self-reported skill level and rank per game, and which platforms (PC, PlayStation, Xbox, Switch, mobile) you play on.
- **Playstyle tags and "vibe" answers** — self-reported traits (e.g. chill vs. competitive, mic preference) and three sliders (session intensity, communication style, coaching preference) plus a tilt-handling answer, used to help match you with compatible players.
- **Schedule/timezone** — your device timezone (detected automatically at signup) and an optional "usual play window" (hours of day you typically play), used to rank candidates who are actually awake and playing when you are.
- **Discord username (optional)** — never shown automatically. It's only revealed to a specific match if and when you tap "Share my Discord" in that conversation.
- **Voice intro (if recorded)** — a short (up to 10 seconds) audio clip some accounts may have recorded. This feature is not currently exposed in the app's interface, but existing recordings are still reviewed by a human moderator before becoming visible — the same pending-until-approved pattern as photos, but without automated screening, since there is no automated audio moderation available today (see [Section 3](#3-who-we-share-data-with)) — and are deleted the same way on account deletion.

### Content
- **Messages.** Chat messages you send to a match (or a party) are stored so the conversation is available across your devices. Messages are automatically screened by an on-device-adjacent profanity filter before being delivered. Messages are intended to be private between the participants of that conversation, with one exception: if a message is reported, a human moderator on our team reviews the reported conversation to investigate. This is a **policy commitment about how we access messages, not an absolute technical restriction** — our moderation tooling is built so an admin account is able to open any conversation to investigate a report, and admins are instructed to only do so in direct response to an open report. See our [Trust & Safety procedure](./trust-and-safety.md) §6 for the full access-control picture, including the admin-access gap noted in [Section 7](#7-security).

### Usage information
- **Presence / "Online Now" status** — an explicit toggle you turn on to signal you're free to duo right now (it expires automatically after 60 minutes). We also track a general "last active" timestamp used to rank the deck and to show partners when you're around.
- **Swipes and matches** — who you liked, passed on, or matched with, needed to run the core matching feature and prevent the same profile from being shown to you twice.
- **Reports and blocks** — who you've reported or blocked, and why, so we can act on it and keep that person from reappearing in your deck.
- **Match feedback tags** — optional, non-public tags ("good comms," "showed up on time," "flaked," etc.) you can leave about a match after the fact, used to build a lightweight reputation signal.

### Device information
- **Push notification token.** If you grant notification permission, we store a device-specific push token (via Expo's push service) so we can deliver notifications like new matches and messages. No other device identifiers are collected. TODO(Cameron): confirm this stays true before every release — our schema has an unused column reserved for additional device info that isn't written by any code path today, but could be populated later without a doc update if this isn't rechecked.

### Purchases
- **Subscription and purchase status** (DuoQueue+, Boosts, Roses). Purchases are handled entirely by Apple's App Store or Google Play, and processed for us by RevenueCat. **We never see or store your card number, billing address, or any other payment credential** — we only receive purchase/subscription status (active, expired, product purchased, renewal date) from RevenueCat.

### Optional linked gaming accounts
- **Steam** — if you choose to link your Steam account, we verify it's really yours via Steam's own sign-in (OpenID), then store your Steam ID, persona name, and avatar. We separately pull your owned-games playtime for titles in our catalog (e.g. "42.3h on Counter-Strike 2") so your stats are verified rather than self-reported. TODO(Cameron): re-verify at publication that we only persist the Steam ID, persona name, and avatar from Steam's profile response, and not the full response Steam returns (which can include other public-profile fields depending on the linked account's own Steam privacy settings) — confirm against `link-steam-callback` before this ships.
- **Riot Games (League of Legends)** — same idea, currently limited to reading your ranked solo/duo queue rank. This integration is not yet available to users (it requires a production API key from Riot that we have not yet obtained).
- **Xbox** — planned, same idea as Riot. This integration is not yet available to users, and we collect nothing from Xbox today.
- We only ever read the specific fields disclosed above for each provider — we do not read your friends list, purchase history, private messages, or anything else on these platforms.

### Bot-protection signals
- At signup, we may run Cloudflare Turnstile, an anti-bot challenge, to block automated account creation. Cloudflare processes device/browser signals for this purpose; we don't receive or store the details itself, only a pass/fail token.

### What we do NOT collect
We do not collect precise GPS location, contacts-list access, or browsing history outside the app. We do not run any advertising or analytics SDK (no Meta/Google ad pixels, no Mixpanel/Amplitude/Segment-style tracker) — TODO(Cameron): confirm this stays true before every release, since adding one later would require updating this policy first.

---

## 3. Who we share data with

We use a small number of specialized service providers ("processors") to run the app. None of them can use your data for their own purposes beyond providing their service to us. TODO(Cameron): confirm a data processing agreement (DPA) is signed with each provider below — this draft assumes standard processor terms but hasn't independently verified each contract.

| Provider | Role | What they receive | Location |
|---|---|---|---|
| **Supabase** | Hosting, database, authentication, file storage, and realtime chat delivery — the backbone the whole app runs on | Effectively all account and profile data described in Section 2 | United States |
| **Sightengine** | Automated photo moderation, when configured (see below) | When our automated moderation provider is active, every photo you upload is sent to Sightengine to be automatically screened for nudity, graphic content, and whether the person in the photo appears to be a minor, before it's shown to anyone else | United States |
| **Expo (push notification service)** | Delivers push notifications | Your device push token and the notification content (e.g. "You matched with X") | United States |
| **Resend** | Sends transactional email (signup confirmation, account emails), if configured as our email provider | Your email address and the content of the email being sent | United States |
| **RevenueCat** | Manages subscriptions and in-app purchases | Your app-level user ID and purchase/subscription events from Apple/Google — never your payment details | United States |
| **Apple (App Store) / Google (Play Store)** | Processes your payment when you buy a subscription or consumable | Your payment details, handled entirely by Apple/Google — we never receive them | Varies by platform |
| **Cloudflare (Turnstile)** | Bot-protection challenge at signup | Device/browser signals used to distinguish humans from bots | Global network (may include US) |
| **Steam / Riot Games** | Only if you choose to link an account | We send your account link request to them and receive back the public profile fields listed in Section 2 | United States (approximate, platform-dependent) |

**Sightengine and Resend are config-gated, not hard-wired.** Our photo-moderation pipeline defaults to routing every photo straight to human review and only calls Sightengine when a provider setting and API credentials are set in our live environment; if that configuration is ever unset, no photo is sent to Sightengine at all. Similarly, transactional email is sent through whatever provider is configured for our authentication service, and Resend is our intended provider, but the repo itself can't confirm what's actually configured in the live environment. TODO(Cameron): confirm before every release that Sightengine and Resend are actually configured as described (the same kind of check already called for on the Cloudflare Turnstile bot-protection row above) — if either is unconfigured, update this table and [Section 2](#2-what-we-collect-and-why)/[Section 8](#8-automated-decision-making-photo-moderation) to match.

**International transfers.** If you're using DuoQueue from outside the United States, your data is transferred to and processed in the United States by the providers above. TODO(Cameron): confirm the legal transfer mechanism (e.g. Standard Contractual Clauses) is in place with each US-based processor for EU/UK/Swiss users — this is a contract-level fact that needs to be verified with each vendor, not something visible from the app's code.

**We do not sell your personal information.** We do not share your data with data brokers or advertising networks, and we don't run any advertising or analytics SDK that would make this a "sale" or "share" under CCPA/CPRA. See [Section 6](#6-your-rights) for the CCPA-specific disclosures.

---

## 4. Legal bases for processing (for users in the EU/UK/EEA)

If you're in a region covered by the GDPR or UK GDPR, here's the legal basis for each category of processing:

- **Performance of a contract** (running the account you signed up for) — email, password, profile data, matching, messaging, purchases, and account deletion all rely on this basis, since we can't provide the app without them.
- **Legitimate interests** — content moderation (photo screening, report handling), fraud/bot prevention (Turnstile), keeping the deck functional (swipe/match history), and security logging. We've weighed these against your privacy interests and believe they're necessary and proportionate to keep the app safe.
- **Consent** — anything genuinely optional: linking a Steam/Riot account, recording a voice intro, sharing your Discord username with a specific match, and push notifications (which require your device-level permission). You can withdraw consent at any time by unlinking the account, deleting the recording, not sharing, or disabling notifications — see [Section 6](#6-your-rights).

---

## 5. How long we keep data

- **Active accounts.** We keep your data for as long as your account exists and you're using the app.
- **Deleted accounts.** DuoQueue has in-app account deletion (Settings → Delete Account). When you delete your account:
  - Your profile, photos, voice intro, messages, matches, swipe history, preferences, linked accounts, and push tokens are **permanently deleted**, including the underlying stored files (not just hidden). Because a conversation is tied to the match between you and your match partner, deleting your account also deletes your match partner's copy of any conversation you shared with them, not just yours.
  - This is irreversible. There is no "undo" or account-recovery grace period once deletion completes.
  - **Exception:** if someone else's report about you is on file when you delete your account, the report record itself, and an internal reference id, are retained after your profile and identifying data are otherwise deleted, so we can maintain a history of safety actions (e.g. confirming a pattern of reported behavior) without your profile continuing to exist. This is a reference id, not an anonymization process — it is not linked to your profile once your profile is gone, but it isn't scrubbed of the report's own content (e.g. the reason and details given) either. This retention currently only works in one direction: **if you are the one who filed a report and you delete your own account, that report record is deleted along with your account, not retained** — we don't yet have a way to preserve a report you filed after you leave. TODO(Cameron): this asymmetry is a known gap (tracked in our [Trust & Safety procedure](./trust-and-safety.md) §4(b)) — update this paragraph once reporter-side preservation is fixed.
- **Backups.** Routine infrastructure backups may retain deleted data for a limited additional period before being purged in the normal course of our hosting provider's backup rotation. TODO(Cameron): confirm Supabase's backup retention window and state it here precisely.
- **Legal holds.** We may retain specific records longer than normal if we're legally required to (e.g. an active law enforcement request), for as long as that requirement lasts.

---

## 6. Your rights

You have the following rights over your data. Most are available directly in the app; the rest are a quick email away.

| Right | What it means | How to exercise it |
|---|---|---|
| **Access** | See what we hold about you | View it directly in the app (profile, matches, messages, settings), or email us for a full export |
| **Correction** | Fix inaccurate data | Edit your profile directly in the app for anything editable; email us for anything you can't change yourself (e.g. date of birth) |
| **Deletion** | Delete your account and data | Settings → Delete Account, or email us if you'd rather we do it |
| **Portability** | Get a copy of your data in a portable format | Email us; TODO(Cameron): there is currently no self-service export button in the app — until one exists, this is handled manually by email, which should stay within a reasonable turnaround (GDPR: 30 days; CCPA: 45 days) |
| **Objection** | Object to processing based on legitimate interests | Email us with what you're objecting to |
| **Withdraw consent** | Revoke any consent-based processing at any time | Unlink a gaming account, delete a voice intro, stop sharing Discord in a chat, or turn off notification permissions — all directly in the app |

### California residents (CCPA/CPRA)

In the last 12 months, we've collected the categories of personal information described in Section 2 (identifiers, profile/characteristics data, commercial/purchase information, internet/app activity, audio recordings if applicable, and — via linked gaming accounts — information about your other online activity). We've disclosed those same categories to the service providers listed in Section 3, for the business purposes described there.

- **We do not sell or share (as CPRA defines "share," which includes cross-context behavioral advertising) your personal information**, and we don't operate any advertising-technology pipeline that would make this happen. There is nothing to opt out of.
- You have the right to know, delete, and correct your personal information, and the right to non-discrimination for exercising any of these rights — we will never charge you more or provide a worse experience because you made a privacy request.
- To exercise any CCPA/CPRA right, use the contact email in Section 1.

### EU/UK/EEA residents (GDPR)

In addition to the rights table above, you have the right to lodge a complaint with your local data protection supervisory authority if you believe we've mishandled your data. TODO(Cameron): if you have an EU/UK representative or lead supervisory authority, name it here.

---

## 7. Security

We take reasonable steps to protect your data, but no system is perfectly secure, and we can't guarantee absolute security.

- **Encryption in transit.** All traffic between the app and our servers is encrypted (HTTPS/TLS), including chat messages, photos, and account data.
- **Encryption at rest.** Our hosting provider, Supabase, encrypts stored data at rest.
- **Access controls.** We use row-level database access controls so that, by default, a user's private data (messages, profile, preferences) is only readable by that user or the specific people it's meant to be shared with (e.g. your match partner in a conversation). Administrative access to broader data (e.g. for moderation) is restricted to designated accounts, gated by an admin flag that isn't self-grantable — but that access is not currently logged. TODO(Cameron): a server-side audit log of admin actions is a known gap tracked in our [Trust & Safety procedure](./trust-and-safety.md) §2.3/§6; this bullet should be updated once one exists.
- **Content moderation.** Photos go through our moderation pipeline (automated when configured, human review otherwise — see [Section 2](#2-what-we-collect-and-why)/[Section 3](#3-who-we-share-data-with)) before becoming visible to others, and reported content can be reviewed by our moderation team.
- **What we don't promise.** We do not claim our systems are unhackable or that a breach could never happen. If one does, we will notify affected users and relevant authorities as required by applicable law.

If you believe you've found a security vulnerability, please report it to the contact email in Section 1 rather than exploiting or publicly disclosing it first.

---

## 8. Automated decision-making (photo moderation)

When you upload a photo, and our automated moderation provider (Sightengine) is configured (see [Section 3](#3-who-we-share-data-with)), it analyzes the photo to check for nudity, graphic content, and whether the person appears to be a minor, and can automatically reject a photo without a human reviewing it first. If your photo is rejected and you believe that was a mistake, you can contact us to request human review. Photos that the automated system can't confidently judge — or every photo, if the automated provider isn't configured — are held for manual review by our team rather than being auto-approved or auto-rejected.

---

## 9. Age restriction

DuoQueue is for adults only — you must be 18 or older to create an account. We verify your date of birth at signup and technically block anyone under 18 from completing a profile.

If we learn that someone under 18 has created an account (for example, through a report using the "underage" report reason, or otherwise), we will terminate that account and delete the associated data as described in Section 5. If you believe a minor is using DuoQueue, please report that profile in the app (profile → Report) or contact us directly using the email in Section 1.

We do not knowingly collect personal information from anyone under 18. If you're a parent or guardian and believe your child has provided us with personal information, contact us and we will investigate and delete it.

---

## 10. Changes to this policy

We may update this policy as the app changes. If we make a material change, we'll update the effective date at the top of this document, and — for significant changes — we'll make a reasonable effort to notify users in-app before the change takes effect. We encourage you to review this policy periodically.

---

## Contact us

TODO(Cameron): insert the final contact email and legal entity/address here (and keep Section 1 in sync).

---

*This document is a thorough draft prepared for legal review based on a direct reading of DuoQueue's codebase and database schema as of this writing. It is not legal advice, and it should not be published or relied upon as DuoQueue's actual privacy policy until it has been reviewed by a qualified attorney, all TODO(Cameron) items have been resolved, and it has been confirmed to match the app's real behavior at the time of publication.*
