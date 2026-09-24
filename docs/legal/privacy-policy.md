<!--
  INTERNAL NOTE (do not publish): this document is a thorough draft prepared for legal
  review based on a direct reading of DuoQueue's codebase and database schema as of this
  writing. It is not legal advice, and it should not be relied upon as DuoQueue's actual
  privacy policy until it has been reviewed by a qualified attorney, all open markers
  below directed at Cameron or at a lawyer have been resolved, and it has been confirmed
  to match the app's real behavior at the time of publication. This comment is HTML and
  never renders on the published site — keep it here for whoever edits this file next.

  SIGN IN WITH APPLE ADDITIONS (drafted 2026-09-23, published 2026-09-23 as version 1.2):
  Section 2 (account information), Section 3 (the Apple sign-in row), Section 4 (Sign in with
  Apple under performance of a contract), Section 5 (deletion revokes the Apple grant, and
  deletion before a profile exists), Section 6 (the Deletion row) and Section 9 (the date of
  birth is asked after an Apple sign-in). They describe build 11 and later, and were checked
  against apps/mobile/src/features/auth/appleSignIn.ts, appleDisplayName.ts,
  supabase/functions/apple-authorization, supabase/functions/delete-account and migrations
  0067 and 0068, all of which are live along with the Apple provider. Published with the
  effective date and the version (1.1 to 1.2) bumped, as the earlier open marker here asked.

  LEAGUE OF LEGENDS RANK ADDITION (drafted 2026-09-23, published 2026-09-23 as version 1.2):
  the last two sentences of the Games bullet in Section 2. The deck order and the "Can duo
  with you" label come from migration 0069's get_deck (live); the structured rank and its
  label on other people's cards ship in build 11 (design:
  docs/superpowers/specs/2026-09-23-league-rank-duo-design.md). No new kind of data is
  collected: the rank per game was already listed.

  WEBSITE (published 2026-09-23 as version 1.2): the "No cookies" bullet of the website
  section in Section 2 and the GitHub row in Section 3 now mention the launch film and its
  poster, which scripts/build-site.mjs serves from site/assets/ on duoqueue.io itself and
  plays with a plain <video> element, no script.

  TRAILER PAGE AND GENDER (version 1.3, effective date September 23, 2026; design:
  docs/superpowers/specs/2026-09-23-duoqueue-io-watch-page-design.md): the "No cookies" bullet of the
  website section in Section 2 now says the film and its poster are on the trailer page
  (duoqueue.io/watch/, and its /tt/, /ig/ and /yt/ copies), because the home page no longer
  embeds them. The Gender bullet in Section 2 no longer says gender is shown on your profile
  to other users, because no screen in apps/mobile renders it (GENDER_LABELS is unused). It
  still says gender reaches other users, because it does: get_deck (0069), get_online_now
  (0060) and get_profile_card (0067) all return a `gender` column for other people's
  profiles, and useProfileCard.ts and useOnlineNow.ts load it onto other users' devices, so
  any signed-in user can read the gender of anyone in their deck with one RPC call. Do not
  shorten this to "not shown to anyone" unless a migration first removes gender from those
  three functions. Gender is not used in any filter or in the deck score (0060 removed the
  filter; 0069's get_deck only passes the column through).
-->
# DuoQueue Privacy Policy

**Effective date:** September 23, 2026
**Version:** 1.3

This policy explains what DuoQueue collects, why, who we share it with, and what control you have over it. It's written in plain language on purpose. If anything here is unclear, contact us using the details below.

---

## 1. Who we are

DuoQueue is a swipe-based app for finding gaming duos, built for players 18 and older.

- **Legal entity:** DuoQueue is operated by Cameron Shaw Stallings, as an individual (a sole proprietor), not a company or LLC.
- **Mailing address:** {{POSTAL_ADDRESS}}
- **Contact email for privacy questions and rights requests:** `support@duoqueue.io`, the same monitored address used for support and safety reports throughout the app (see `apps/mobile/src/lib/legal.ts`).
- **Data Protection Officer / EU representative:** Not applicable. DuoQueue is currently offered only in the United States and is not directed to users in the EU, UK, or EEA. If that changes, we'll appoint a DPO or EU representative as required and update this policy before expanding there.

Wherever this policy says "contact us," use the email above.

---

## 2. What we collect, and why

We only collect what the app actually uses. Here's every category, itemized.

### Account information
- **Email address and password, if you sign up with email.** Your password is never stored or seen by us in plain text. Authentication is handled by our infrastructure provider, Supabase Auth, which stores a salted hash. We use your email to let you sign in, confirm your address (a one-time 6-digit code), and send account-related messages.
- **What Apple shares, if you sign in with Apple.** Apple signs you in, and we never see your Apple ID password. Apple gives us:
  - **An email address.** Either your real one, or, if you choose Hide My Email, a private relay address that Apple creates for DuoQueue and forwards to you. We use it for your account and for account-related messages, the same way we use the address of someone who signed up with email.
  - **Your name, if you choose to share it.** Apple sends it only the first time you sign in with Apple to DuoQueue, and you can edit or remove it on Apple's screen first. We use only your first name (or a nickname, if that is all Apple sends), and only as a suggested display name: it is filled in on the first step of setting up your profile, where you can change it before anyone sees it. Your profile is not shown to anyone until you finish setting it up. We do not store your last name.
  - **An identifier for your Apple ID.** A stable ID that Apple issues only to apps from our developer account, which is how we recognize you the next time you sign in with Apple. Other companies' apps cannot use it to recognize you.
  - **Not your date of birth.** Apple does not share it, so we ask for it right after you sign in, before your profile is created. See [Section 9](#9-age-restriction).
- **An Apple token kept only to revoke access.** When you sign in with Apple, our server exchanges a one-time code from Apple for a token (Apple calls it a refresh token) that lets us revoke DuoQueue's access to your Apple ID. We keep it for that one purpose: when you delete your account, we use it to tell Apple to remove DuoQueue from the apps using Sign in with Apple in your Apple ID settings, and then it is deleted with the rest of your account. It is stored where only our servers can read it, it is never shown to anyone, and it is never used for anything else.

### Profile information
- **Display name:** shown on your profile and in chat.
- **Date of birth:** collected once at signup. We use it for two things: confirming you're 18 or older (DuoQueue is not available to anyone younger; see [Section 9](#9-age-restriction)) and calculating the age shown on your profile. Your exact birth date is never shown to other users, only your calculated age.
- **Gender:** collected at onboarding. The current version of the app does not display it to other users, but it is part of the profile information our servers send to another user's app when your card is shown to them (in their deck, in Online Now, or when they open your profile), so it is not private from other signed-in users. It is never used to filter or rank who you're shown.
- **Region:** collected at onboarding and shown on your profile to other users; also used to filter candidates when someone sets a region preference, and to slightly favor same-region matches in ranking.
- **Spoken language(s):** collected at onboarding; used as a premium filter so users can require a shared language, and to favor candidates who share a language with you in ranking.
- **Photos:** a profile photo, an optional header photo, and up to six gallery photos. Every uploaded photo is automatically re-processed to strip embedded location and camera metadata (EXIF/GPS data) before it's stored. Every photo also goes through our moderation pipeline before it becomes visible to anyone else. When our automated moderation provider (Sightengine) is configured, most photos are screened automatically and only borderline or undetermined cases go to a human moderator; if the automated provider isn't configured, every photo instead goes straight to human review. See [Section 3](#3-who-we-share-data-with).
- **Bio and prompt answers:** free-text fields you write about yourself.
- **Games, shows/movies/anime, and platforms:** what you play or watch, your self-reported skill level and rank per game, and which platforms (PC, PlayStation, Xbox, Switch, mobile) you play on. Your League of Legends rank, if you add one, is a tier and, for most tiers, a division (for example, "Gold II"), and it is shown to other users. We also compare it with another player's League rank, using League's published rules for who can queue together, to mark players you can duo with in Ranked Solo/Duo with "Can duo with you" and to show them nearer the top of your deck. Other players see the same about you.
- **Playstyle tags and "vibe" answers:** self-reported traits (e.g. chill vs. competitive, mic preference) and three sliders (session intensity, communication style, coaching preference) plus a tilt-handling answer, used to help match you with compatible players.
- **Schedule/timezone:** your device timezone (detected automatically at signup) and an optional "usual play window" (hours of day you typically play), used to rank candidates who are actually awake and playing when you are.
- **Discord username (optional):** never shown automatically. It's only revealed to a specific match if and when you tap "Share my Discord" in that conversation.

### Content
- **Messages.** Chat messages you send to a match (or a party) are stored so the conversation is available across your devices. Messages are automatically screened by an on-device-adjacent profanity filter before being delivered. Messages are intended to be private between the participants of that conversation, with one exception: if a message is reported, a human moderator on our team reviews the reported conversation to investigate. This is a **policy commitment about how we access messages, not an absolute technical restriction**: our moderation tooling is built so an admin account is able to open any conversation to investigate a report, and admins are instructed to only do so in direct response to an open report. The limits of that control are described plainly in [Section 7](#7-security).

### Usage information
- **Presence / "Online Now" status:** an explicit toggle you turn on to signal you're free to duo right now (it expires automatically after 60 minutes). We also track a general "last active" timestamp used to rank the deck and to show partners when you're around.
- **Swipes and matches:** who you liked, passed on, or matched with, needed to run the core matching feature and prevent the same profile from being shown to you twice.
- **Reports and blocks:** who you've reported or blocked, and why, so we can act on it and keep that person from reappearing in your deck.
- **Match feedback tags:** optional, non-public tags ("good comms," "showed up on time," "flaked," etc.) you can leave about a match after the fact, used to build a lightweight reputation signal.

### Device information
- **Push notification token.** If you grant notification permission, we store a device-specific push token (via Expo's push service) so we can deliver notifications like new matches and messages. No other device identifiers are collected. (Our schema has a `device_info` column reserved for future use; as of this writing no code path writes to it, so nothing is collected there.)

### Purchases
- **Subscription and purchase status** (DuoQueue+, Power-Ups, Legendary Likes). Purchases are handled entirely by Apple's App Store or Google Play, and processed for us by RevenueCat. **We never see or store your card number, billing address, or any other payment credential.** We only receive purchase/subscription status (active, expired, product purchased, renewal date) from RevenueCat.

### Optional linked gaming accounts
- **Steam.** If you choose to link your Steam account, we verify it's really yours via Steam's own sign-in (OpenID), then store your Steam ID, persona name, and avatar. We separately pull your owned-games playtime for titles in our catalog (e.g. "42.3h on Counter-Strike 2") so your stats are verified rather than self-reported. Steam's profile lookup can return additional public-profile fields (real name, country/state, account-creation time, and more, depending on the linked account's own Steam privacy settings). Our server only persists the Steam ID, persona name, and avatar into your profile; the rest of that response is discarded and never stored.
- We only ever read the specific fields disclosed above. We do not read your friends list, purchase history, private messages, or anything else on Steam.

### Bot-protection signals
- At signup, we may run Cloudflare Turnstile, an anti-bot challenge, to block automated account creation. Cloudflare processes device/browser signals for this purpose; we don't receive or store the details itself, only a pass/fail token.

### Invites

DuoQueue gives every account a personal invite code so you can bring someone you already play with. Using one records a relationship between two accounts, so it is its own category rather than a footnote under profile data.

- **Who invited whom.** When you sign up with someone's invite code, we store your account ID, their account ID, the code that was used, and the date. We use it for two things: to show you their profile when you arrive, so the person who invited you is the first face you see rather than a stranger, and to understand how many people join this way. **You have one inviter, and it is whoever's code you used first.** Redeeming a second code does not change it.
- **Whether the two of you actually connected.** If you tap the button to duo up with the person who invited you, we record the date you did. That is a separate fact from the invite itself, and it is the only thing we record about what happened next; the conversation you have afterwards is an ordinary chat and is covered under Content above.
- **Your own invite code.** We store one code per account, when it was created, and whether it has been turned off. The code is a random string. It is not derived from your name, your email address, or anything else about you, and it cannot be reversed into any of them.
- **We do not learn who you sent an invite to unless they join.** The invite travels in a message you send, through whatever app you send it in. We are not in that conversation, we never see the recipient, and nothing is stored about anybody who receives a code and does not sign up. There is no address book access, no contact upload, and no way for us to know an invite was sent at all until somebody uses it.
- **Deleting your account removes it.** The invite records are attached to the accounts in them, so deleting yours deletes your code and any record of who invited you. See [Section 5](#5-how-long-we-keep-data).

### Website and waitlist (duoqueue.io)

This is the one category on this list that is about our website rather than the app.

- **Your email address, if you give it to us on duoqueue.io.** DuoQueue has not launched yet, and while it hasn't, our website runs a waitlist. If you enter your email address there, we store that address, the date, and which of our links you arrived from (so we know which channel worked), and we use it for two things and nothing else: an immediate email confirming you are on the list, and one message on the day the app goes live. That second message is marketing, and we are calling it that rather than describing it as transactional. We do not add waitlist addresses to any other mailing list, we do not sell or rent them, and we do not use them to advertise to you anywhere else. You can ask us to remove your address at any time by replying to either email or contacting us at the address in [Section 1](#1-who-we-are).
- **A short-lived hash of your IP address, only to stop bots.** We do not store your IP address alongside your signup. When the form is submitted we compute a salted, one-way hash of the connecting IP address and keep only that, for 48 hours, purely to rate-limit automated abuse of the form. It is deleted automatically after that and it is never linked to your email address.
- **The 18-or-older box on that form is a self-declaration.** You tell us your age; we do not check it, and we do not describe it as verification or age assurance. It is there because DuoQueue is an adults-only product and we do not want an underage person on a mailing list for it.
- **No cookies, no analytics, and no advertising scripts on duoqueue.io.** Our pages set no cookies, carry no analytics or advertising tag, and load nothing from a third-party server: every page is self-contained HTML, and the only files it requests are its own fonts and icon and, on the trailer page (duoqueue.io/watch/), a short video about the app and its poster image, all served from duoqueue.io itself. The video plays in your browser's own built-in player. There is no JavaScript on the site at all.
- **Two things do happen off our pages, and we would rather say so than let "no third parties" stand unqualified.** First, duoqueue.io is published as a static site on **GitHub Pages**, so GitHub operates the server that answers your request and sees your IP address and user agent the way any web host would. Second, submitting the waitlist form posts it to our backend at `supabase.co`, which sits behind **Cloudflare**; Cloudflare's bot protection sets a short-lived cookie called `__cf_bm` on that `supabase.co` domain, not on duoqueue.io. It lasts 30 minutes, it is not readable by our pages, and it is not used for advertising or cross-site tracking. Both providers are listed in [Section 3](#3-who-we-share-data-with).

### What we do NOT collect
We do not collect precise GPS location, contacts-list access, or browsing history outside the app. We do not run any advertising or analytics SDK: there is no Meta/Google ad pixel, no Mixpanel/Amplitude/Segment-style tracker, or any comparable dependency anywhere in the app's code today.

---

## 3. Who we share data with

We use a small number of specialized service providers ("processors") to run the app and the website: Supabase, Sightengine, Expo, Resend, RevenueCat, Apple, Google, Cloudflare, GitHub, and Steam. We use each of them as a service provider/processor under that provider's own standard terms of service, and none of them can use your data for their own purposes beyond providing their service to us.

| Provider | Role | What they receive | Location |
|---|---|---|---|
| **Supabase** | Hosting, database, authentication, file storage, and realtime chat delivery (the backbone the whole app runs on) | Effectively all account and profile data described in Section 2 | United States |
| **Sightengine** | Automated photo moderation, when configured (see below) | When our automated moderation provider is active, every photo you upload is sent to Sightengine to be automatically screened for nudity, graphic content, and whether the person in the photo appears to be a minor, before it's shown to anyone else | United States |
| **Expo (push notification service)** | Delivers push notifications | Your device push token and the notification content (e.g. "You matched with X") | United States |
| **Resend** | Sends our email: transactional messages (signup confirmation, account emails) and the two waitlist messages described in Section 2, one of which is a marketing announcement | Your email address and the content of the email being sent | United States |
| **GitHub (GitHub Pages)** | Hosts duoqueue.io, our public website: the waitlist page, a short video about the app, and these legal documents | The IP address, user agent, and requested URL of every visit to duoqueue.io, as any web host receives. We do not receive or keep server logs from GitHub, and there is no analytics on the site | United States / global edge network |
| **RevenueCat** | Manages subscriptions and in-app purchases | Your app-level user ID and purchase/subscription events from Apple/Google (never your payment details) | United States |
| **Apple (App Store) / Google (Play Store)** | Processes your payment when you buy a subscription or consumable | Your payment details, handled entirely by Apple/Google; we never receive them | Varies by platform |
| **Apple (Sign in with Apple)** | Only if you choose to sign in with Apple: signs you in, and later lets us revoke that access | Apple authenticates you itself. Our server sends Apple the one-time code from your sign-in to obtain the revocation token described in Section 2, and, when you delete your account, that token (or a fresh code from the same Apple ID) so Apple can revoke DuoQueue's access | United States |
| **Cloudflare** | Two separate roles: the Turnstile bot-protection challenge at signup in the app, and the network in front of our Supabase backend, which every waitlist form submission passes through | Device/browser signals used to distinguish humans from bots. Its bot protection sets a 30-minute `__cf_bm` cookie on the `supabase.co` domain when you submit the waitlist form, never on duoqueue.io, and never for advertising | Global network (may include US) |
| **Steam** | Only if you choose to link an account | We send your account link request to Steam and receive back the public profile fields listed in Section 2 | United States (approximate, platform-dependent) |

**Sightengine and Resend are config-gated, not hard-wired.** Our photo-moderation pipeline defaults to routing every photo straight to human review and only calls Sightengine when a provider setting and API credentials are set in our live environment; if that configuration is ever unset, no photo is sent to Sightengine at all. As of this writing, our live production environment has that provider setting and both Sightengine credentials configured, so automated screening is active. Transactional email (account confirmation codes and similar) is sent through Resend, which is configured as our custom SMTP provider. The waitlist emails described in Section 2 are sent through Resend as well.

**Where your data is processed.** DuoQueue is currently offered only in the United States, and your data is processed in the United States by the providers listed above. DuoQueue is not directed to, and is not currently offered to, users in the EU, UK, or Switzerland. If that changes, we'll put an appropriate international transfer mechanism in place and update this section before it does.

**We do not sell your personal information.** We do not share your data with data brokers or advertising networks, and we don't run any advertising or analytics SDK that would make this a "sale" or "share" under CCPA/CPRA. See [Section 6](#6-your-rights) for the CCPA-specific disclosures.

---

## 4. Legal bases for processing (for users in the EU/UK/EEA)

DuoQueue is currently offered only in the United States and is not directed to users in the EU, UK, or EEA (see [Section 1](#1-who-we-are)). We're including this section for completeness in case that changes. If you're in a region covered by the GDPR or UK GDPR, here's the legal basis for each category of processing:

- **Performance of a contract:** running the account you signed up for. Email, password, Sign in with Apple, profile data, matching, messaging, purchases, and account deletion all rely on this basis, since we can't provide the app without them.
- **Legitimate interests:** content moderation (photo screening, report handling), fraud/bot prevention (Turnstile), keeping the deck functional (swipe/match history), and security logging. We've weighed these against your privacy interests and believe they're necessary and proportionate to keep the app safe.
- **Consent:** anything genuinely optional, including linking a Steam account, sharing your Discord username with a specific match, and push notifications (which require your device-level permission). You can withdraw consent at any time by unlinking the account, not sharing, or disabling notifications (see [Section 6](#6-your-rights)).

---

## 5. How long we keep data

- **Active accounts.** We keep your data for as long as your account exists and you're using the app.
- **Deleted accounts.** DuoQueue has in-app account deletion (Settings → Sign out or delete account → Delete account). When you delete your account:
  - Your profile, photos, messages, matches, swipe history, preferences, linked accounts, and push tokens are **permanently deleted**, including the underlying stored files (not just hidden). Because a conversation is tied to the match between you and your match partner, deleting your account also deletes your match partner's copy of any conversation you shared with them, not just yours.
  - This is irreversible. There is no "undo" or account-recovery grace period once deletion completes.
  - **If you signed in with Apple**, deleting your account also tells Apple to revoke DuoQueue's access to your Apple ID, so DuoQueue is removed from the apps using Sign in with Apple in your Apple ID settings. We do this with the token kept from your sign-in. Your iPhone may also ask you to confirm with your Apple ID, which gives us a fresh code to use instead if that token is missing or no longer works; we use it only if it belongs to the same Apple ID you signed in with. If you dismiss that confirmation, or Apple cannot be reached, your account is still deleted. If DuoQueue is still listed in your Apple ID settings under Sign in with Apple afterwards, you can remove it there yourself. That token is deleted with your account either way.
  - **Before your profile is finished.** If you signed in but have not finished setting up your profile (for example, you signed in with Apple and stopped at the date of birth screen), you can delete the account with "Delete this sign-in", on that screen or, on any step of profile setup, under "Sign out or delete". It goes through the same deletion described here.
  - **Exception:** if someone else's report about you is on file when you delete your account, the report record itself, and an internal reference id, are retained after your profile and identifying data are otherwise deleted, so we can maintain a history of safety actions (e.g. confirming a pattern of reported behavior) without your profile continuing to exist. This is a reference id, not an anonymization process: it is not linked to your profile once your profile is gone, but it isn't scrubbed of the report's own content (e.g. the reason and details given) either. This retention currently only works in one direction: **if you are the one who filed a report and you delete your own account, that report record is deleted along with your account, not retained.** We don't yet have a way to preserve a report you filed after you leave.
  - **Safety holds.** Three things are kept, or stop a deletion, for safety reasons:
    - A photo or voice intro that never passed our safety check (one that was rejected, or one still waiting for review) is not deleted with your account. We keep the stored file and a record of it so a moderator can still review it and, where the law requires, report it, for as long as that review or legal obligation lasts.
    - An account that has been banned cannot be deleted in the app; contact support@duoqueue.io. A record of the ban is kept after any deletion so the same address cannot sign up again; it holds a one-way hash of the account's email address, not the address itself.
    - If there is an open report that the account holder may be under 18, the account is frozen and banned instead of deleted: its display name, bio and Discord username are removed and it is hidden from everyone, but its matches, messages, photos and voice intro are kept for that review.
- **Invites.** Your invite code and any record of who invited you are attached to your account and are deleted with it. The same is true in the other direction: if somebody you invited deletes their account, the record of you having invited them goes with theirs. This means an invite record only ever exists while both accounts do, and neither of you can be left in a record the other has deleted.
- **Waitlist signups (duoqueue.io).** The salted hash of the IP address that submitted the form is deleted automatically 48 hours after it was created. Your email address and the link you arrived from are kept until you ask us to delete them, or until we delete the list, whichever comes first. Waitlist rows are stored separately from app accounts and are not connected to one: joining the waitlist does not create an account, and deleting your DuoQueue account does not remove your address from the waitlist. If you want both gone, tell us and we will do both.
- **Backups.** As of this writing, our hosting provider's automated point-in-time recovery and scheduled backup snapshots are not enabled for our production database, so there is no additional backup-retention window beyond the deletion described above. If backups are enabled in the future, deleted data could persist in a backup for that backup's retention period before being purged in the normal course of our hosting provider's backup rotation.
- **Legal holds.** We may retain specific records longer than normal if we're legally required to (e.g. an active law enforcement request), for as long as that requirement lasts.

---

## 6. Your rights

You have the following rights over your data. Most are available directly in the app; the rest are a quick email away.

| Right | What it means | How to exercise it |
|---|---|---|
| **Access** | See what we hold about you | View it directly in the app (profile, matches, messages, settings), or email us for a full export |
| **Correction** | Fix inaccurate data | Edit your profile directly in the app for anything editable; email us for anything you can't change yourself (e.g. date of birth) |
| **Deletion** | Delete your account and data | Settings → Delete Account ("Delete this sign-in" if your profile isn't finished yet), or email us if you'd rather we do it |
| **Portability** | Get a copy of your data in a portable format | Email us. There's no self-service export button in the app yet, so this is handled manually, within a reasonable turnaround (GDPR: 30 days; CCPA: 45 days) |
| **Objection** | Object to processing based on legitimate interests | Email us with what you're objecting to |
| **Withdraw consent** | Revoke any consent-based processing at any time | Unlink a gaming account, stop sharing Discord in a chat, or turn off notification permissions (all directly in the app) |

### California residents (CCPA/CPRA)

In the last 12 months, we've collected the categories of personal information described in Section 2 (identifiers, including an email address given to us on our website; profile/characteristics data; commercial/purchase information; internet/app activity, including a short-lived salted hash of the IP address that submitted our website's waitlist form; a record of which account invited you to DuoQueue, where you joined using someone's invite code; and information about your other online activity from linked gaming accounts). We've disclosed those same categories to the service providers listed in Section 3, for the business purposes described there.

Sending you the one-time launch announcement you asked for by joining our waitlist is direct marketing, not a sale or a share, and it is not cross-context behavioral advertising. We do not disclose waitlist addresses to anyone except the email provider that delivers the message.

- **We do not sell or share (as CPRA defines "share," which includes cross-context behavioral advertising) your personal information**, and we don't operate any advertising-technology pipeline that would make this happen. There is nothing to opt out of.
- You have the right to know, delete, and correct your personal information, and the right to non-discrimination for exercising any of these rights. We will never charge you more or provide a worse experience because you made a privacy request.
- To exercise any CCPA/CPRA right, use the contact email in Section 1.

### EU/UK/EEA residents (GDPR)

DuoQueue is currently offered only in the United States and is not directed to users in the EU, UK, or EEA. We don't have a lead EU/UK supervisory authority because we don't yet operate there. If we expand to those regions, we'll designate one and update this section before we do.

---

## 7. Security

We take reasonable steps to protect your data, but no system is perfectly secure, and we can't guarantee absolute security.

- **Encryption in transit.** All traffic between the app and our servers is encrypted (HTTPS/TLS), including chat messages, photos, and account data.
- **Encryption at rest.** Our hosting provider, Supabase, encrypts stored data at rest.
- **Access controls.** We use row-level database access controls so that, by default, a user's private data (messages, profile, preferences) is only readable by that user or the specific people it's meant to be shared with (e.g. your match partner in a conversation). Administrative access to broader data (e.g. for moderation) is restricted to designated accounts and gated by an admin flag that isn't self-grantable. That access is not currently logged.
- **Content moderation.** Photos go through our moderation pipeline (automated when configured, human review otherwise; see [Section 2](#2-what-we-collect-and-why)/[Section 3](#3-who-we-share-data-with)) before becoming visible to others, and reported content can be reviewed by our moderation team.
- **What we don't promise.** We do not claim our systems are unhackable or that a breach could never happen. If one does, we will notify affected users and relevant authorities as required by applicable law.

If you believe you've found a security vulnerability, please report it to the contact email in Section 1 rather than exploiting or publicly disclosing it first.

---

## 8. Automated decision-making (photo moderation)

When you upload a photo, and our automated moderation provider (Sightengine) is configured (see [Section 3](#3-who-we-share-data-with)), it analyzes the photo to check for nudity, graphic content, and whether the person appears to be a minor, and can automatically reject a photo without a human reviewing it first. If your photo is rejected and you believe that was a mistake, you can contact us to request human review. Photos that the automated system can't confidently judge (or every photo, if the automated provider isn't configured) are held for manual review by our team rather than being auto-approved or auto-rejected.

---

## 9. Age restriction

DuoQueue is for adults only: you must be 18 or older to create an account.

We ask for your date of birth at signup, and we enforce the 18+ rule on the date you give us: a date of birth under 18 is rejected by the app and again by our database, which will not store a profile with one, so an under-18 date cannot complete a profile. If you sign in with Apple, which does not share a date of birth, we ask for it right after you sign in instead, and no profile is created until you give one that is 18 or older. Until then the account can see no one's profile and no one can see it, and you can delete it from that screen. What we do **not** do is verify that the date is true. We do not check identity documents and we do not use a third-party age-assurance service. It is a self-declaration that we then enforce, and we describe it that way here rather than calling it verification, which would imply a check we do not perform. The 18-or-older box on our website's waitlist form ([Section 2](#2-what-we-collect-and-why)) is a self-declaration in the same sense, with no profile behind it to enforce against.

If we learn that someone under 18 has created an account (for example, through a report using the "underage" report reason, or otherwise), we will terminate that account and delete the associated data as described in Section 5. If you believe a minor is using DuoQueue, please report that profile in the app (profile → Report) or contact us directly using the email in Section 1.

We do not knowingly collect personal information from anyone under 18. If you're a parent or guardian and believe your child has provided us with personal information, contact us and we will investigate and delete it.

---

## 10. Changes to this policy

We may update this policy as the app changes. If we make a material change, we'll update the effective date at the top of this document. For significant changes, we'll also make a reasonable effort to notify users in-app before the change takes effect. We encourage you to review this policy periodically.

---

## Contact us

Email `support@duoqueue.io` with any question about this policy. For our full legal entity name and business address, see [Section 1](#1-who-we-are).
