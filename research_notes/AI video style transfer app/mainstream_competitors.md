# Mainstream AI Short-Form Video Editors: Competitive Landscape and "Edit My Footage Like This Video" Capability

Research date: 2026-10-08. All figures are dated inline. Many revenue/user numbers come from third-party estimators or aggregators and are flagged as such. Niche reference-style-transfer startups and Cut AI are out of scope (covered separately); they appear here only where a mainstream review compared them against mainstream tools.

---

## Q1. CapCut (ByteDance): templates, AutoCut, AI features, US status, and whether templates already solve "edit my footage like this video"

### Takeaway
CapCut is the scale leader (736M monthly active mobile users per a16z/Sensor Tower, Jan 2026) and is fully available in the US under the TikTok USDS joint venture that closed Jan 22, 2026. Its TikTok-linked "Use template" flow does replicate a video's edit structure (clip count, per-slot durations, audio, text/effects at the same timestamps), but **only for videos that were themselves built as CapCut templates by template creators**. It cannot take an arbitrary reference video and infer its style. Its 2026 AI features (AutoCut, the AI template generator, Auto-Edit) generate edits from scripts, beats, or speech. None of them is documented as analyzing a user-supplied reference video.

### Cited Findings

**Scale and revenue**
- a16z's Top 100 Gen AI Consumer Apps, 6th edition (posted Mar 9, 2026): "CapCut, a video editor with 736 million monthly active mobile users, relies on AI for its most popular features". CapCut appears on both the web and mobile lists. Mobile rankings use Sensor Tower MAU as of Jan 2026. — [a16z](https://a16z.com/100-gen-ai-apps-6/)
- An older figure of ~323M MAU (SCMP, cited by Wikipedia) conflicts with a16z's 736M. The two likely use different dates or definitions. — [Wikipedia](https://en.wikipedia.org/wiki/CapCut)
- Sensor Tower data cited by TechCrunch (Jan 9, 2025): over 1.3B downloads in the prior two years, 51.2M average DAU, and over $460M in in-app purchases. — [TechCrunch](https://techcrunch.com/2025/01/09/video-editing-app-captions-switches-to-a-freemium-model-to-boost-growth)
- Sensor Tower US snapshots: weekly US revenue peaked around $4.6M in mid-June 2025, with ~22.5M US active users. In Q4 2025, weekly revenue reached ~$4.8M before Christmas and US active users passed 25M. — [Sensor Tower Q2 2025](https://sensortower.com/blog/2025-q2-unified-top-5-photo%20and%20video-units-us-615c8a30ad269d38a8b6acd0); [Sensor Tower Q4 2025](https://sensortower.com/blog/2025-q4-unified-top-5-photo-and-video-revenue-us-615c8a30ad269d38a8b6acd0)
- No verified global 2025 revenue figure was found. An unsourced claim of "$815M revenue in 2025" exists on an SEO comparison page and should not be relied on. — [geo.sig.ai](https://geo.sig.ai/compare/capcut-vs-midjourney)

**US availability (2025 to 2026)**
- CapCut was pulled from the US App Store and Google Play on Jan 19, 2025, along with TikTok. It was reinstated by mid-February 2025. — [Hooked (updated Sept 2026)](https://www.hooked.so/guides/is-capcut-getting-banned); [Yahoo News](https://www.yahoo.com/news/tiktok-sister-app-returns-us-174635954.html)
- US CapCut now falls under TikTok USDS Joint Venture LLC, which closed Jan 22, 2026. Oracle, Silver Lake and MGX hold 15% each and ByteDance holds 19.9%. TikTok's announcement says the venture's safeguards "will also cover CapCut, and Lemon8." As of Sept 2026 CapCut is listed on the US App Store and Google Play. — [Hooked](https://www.hooked.so/guides/is-capcut-getting-banned)
- Sources conflict on whether a separate "CapCut US" app shipped. One says it launched Sept 2025 with mandatory migration completed by March 2026. A more recent source says it never appeared. — [nodemaven](https://nodemaven.com/blog/capcut-ban/); [Hooked](https://www.hooked.so/guides/is-capcut-getting-banned)

**Pricing**
- Newsweek reports the annual Pro plan rose from about $77 to $179.99 ($19.99/month). The old ~$9.99 tier was reportedly repositioned as "Standard." CapCut made no formal announcement. — [Newsweek](https://newsweek.com/app-used-millions-nearly-doubles-subscription-price-overnight-11535999); [eesel](https://www.eesel.ai/blog/capcut-pricing)
- CapCut's own help center confirms that some features launched as free trials later moved into Pro. — [CapCut Help](https://www.capcut.com/help/features-needs-to-paid)
- Reported newly paywalled features include some 1080p export options, many effects and dynamic captions, and watermark removal. These reports are partly anecdotal or come from competitors. — [Newsweek](https://newsweek.com/app-used-millions-nearly-doubles-subscription-price-overnight-11535999); [VEED review](https://www.veed.io/learn/capcut-review); [unstar.app](https://unstar.app/blog/capcut-everything-is-pro-now-cant-export-reviews-2026)
- Buffer's July 2026 review lists a free plan and paid plans from $9.99/month, and says CapCut's AI features are "scattered across menus." — [Buffer](https://buffer.com/resources/ai-video-tools/)

**How templates work (the closest thing CapCut has to "copy this edit")**
- From TikTok, users tap a "CapCut • Try this template" / "Use template in CapCut" link, which opens the CapCut mobile app with the template loaded. — [SocialKit](https://socialk.it/en/blog/capcut-templates-for-tiktok); [CapCut Help](https://www.capcut.com/help/use-and-export-templates-in-capcut)
- A template locks in a clip count, a duration for each slot, and a sound. CapCut auto-trims inserted media to the slot lengths. Slots are often under 2 seconds, and if you insert a 10-second clip CapCut "takes the first slice." Choosing "Edit more" converts the template into a normal editable project. — [SocialKit](https://socialk.it/en/blog/capcut-templates-for-tiktok)
- The full template experience is mobile-only. CapCut Web does not offer trending or community templates, and the desktop app cannot access the template library. — [SocialKit](https://socialk.it/en/blog/capcut-templates-for-tiktok)
- The Split (Turner Novak, Dec 20, 2022) wrote that "CapCut's templates allow you to copy the editing style of any video." It described clip lengths preset to match the original's scenes, with audio, text and filters placed at the same timestamps. — [The Split](https://thesplit.beehiiv.com/p/capcut-ai-unlocks-human-creativity)
- Templates are made by people. CapCut's Template Creator Program pays creators "based on how often their templates are used and exported," and applicants are expected to have a solid grasp of editing techniques. — [CapCut US Template Creator Program](https://capcut.com/partners/template-creator-us)
- CapCut's guide to making a template is a manual process: start a new project, add transitions, filters, text and audio, then mark placeholders. — [CapCut resource](https://www.capcut.com/resource/how-to-make-a-capcut-template)

**AI features relevant to auto-editing**
- Auto Cut (help center, Feb 2026) picks cut points from speech, music beats, or on-screen text. It is aimed at "TikTok edits, vlogs, or promo reels" and is available on mobile and desktop but not web. — [CapCut Help](https://www.capcut.com/help/auto-cut-in-capcut)
- The AI template generator turns a typed script into a draft with media, captions, music, transitions and effects. Its page claims: "Using CapCut's smart AI templates, you can instantly replicate trending formats, transitions, and pacing" and "The template maker studies viral patterns and rebuilds them inside your project." The input is a script, not a reference video. — [CapCut AI template generator](https://www.capcut.com/tools/ai-template-generator)
- A third-party write-up (Apr 27, 2026) says Auto-Edit builds an initial edit "including pacing, transitions, and music sync, within seconds" and became the default starting point for new projects after a beta. This is secondary and promotional. — [BibiGPT](https://bibigpt.co/en/features/capcut-2026-ai-suite-explained)
- No documentation was found of a CapCut or Pippit (ByteDance's marketing-video tool) feature that ingests an arbitrary reference video and copies its style. Pippit relies on a template library plus "link-to-video." — [Pippit template pages](https://www.pippit.ai/templates/new-trending-template-2026-viral-capcut-for-one-video); [joinsecret](https://www.joinsecret.com/de/pippit-ai/alternatives)

### Inferences
- CapCut's template system addresses "edit my footage like this video" only when the reference was published from a CapCut template. Most viral videos (edited manually in CapCut, Premiere, or other tools) carry no template metadata, so they cannot be "used." Templates also impose fixed slot counts and lengths: the user fills slots rather than having their footage analyzed and cut intelligently, and long clips get truncated to the first slice.
- CapCut already has the main ingredients for a true "copy any edit" feature: beat and speech-aware AutoCut, a marketing claim about replicating viral pacing and transitions, a huge corpus of creator template metadata, and ByteDance's in-house models. It is the most credible fast follower and the biggest strategic threat to a startup in this space.
- Users resent CapCut's 2025–2026 price hikes and paywalling, which opens room for alternatives on price and trust. CapCut remains the default free choice for creators, though.

### Gaps
- No verified global CapCut revenue for 2025 or 2026. Sensor Tower's global data is behind an enterprise paywall.
- Whether a "CapCut US" app separate from the global app exists in Oct 2026 is unresolved; sources conflict.
- No official CapCut changelog entry on AutoCut or Auto-Edit dated after April 2026 was found.

---

## Q2. Edits (Meta/Instagram) and platform-native AI editing (Instagram Reels templates, YouTube "Edit with AI," TikTok Smart Split)

### Takeaway
Edits (launched Apr 22, 2025) is a free, mobile-only CapCut competitor that has added 130+ features. Its AI is mostly generative-visual: Restyle, AI font styling, AI animation of stills, and a 2026 AI assistant for performance insights and ideas. Like CapCut, it offers "Use template," which carries over the source Reel's audio, text and clip timings. Instagram documents a key limit: Reels edited in another app (one continuous clip) cannot be used as templates. YouTube's "Edit with AI" makes a first draft from camera-roll clips using preset templates. TikTok's Smart Split turns long videos into shorts. None of the platform tools analyzes an arbitrary reference video's editing style.

### Cited Findings

**Edits (Meta)**
- Launched Apr 21–22, 2025. Appfigures-based estimates via TechCrunch put first-week downloads at about 7.1M (≈1.2M iOS, ≈5.9M Android). — [TechCrunch](https://techcrunch.com/2025/04/26/instagram-edits-topped-7m-downloads-in-first-week-a-bigger-launch-than-capcuts); [Wikipedia](https://en.wikipedia.org/wiki/Edits_(app))
- Edits appears on a16z's Mar 2026 mobile Top 100 list. No rank or MAU is given. — [a16z](https://a16z.com/100-gen-ai-apps-6/)
- Mosseri said Edits is more "professionally oriented" than CapCut. He floated a future paywall for heavier AI effects, with the core toolset staying free. — [Tubefilter](https://newsletter.tubefilter.com/p/can-meta-s-editing-app-challenge-capcut)
- A third-party guide reports 130+ features in the first year, including AI object segmentation (SAM), Restyle, Storyboards, Templates, Teleprompter, Keyframes, Beat Markers, Freeze Frame and Lip Sync. Edits was still free and mobile-only (iOS/Android) as of May 2026. — [Inro](https://www.inro.social/blog/edits-new-meta-app)
- AI features: "Restyle" re-contextualizes a clip into a new scene, "AI Style" generates custom fonts, and an AI assistant (announced June 2026, expanded around Oct 2026) analyzes follows, views, retention and trending audio to suggest concepts, hooks and captions. Sources conflict on whether a desktop version has launched or is still in development. — [Croma](https://www.croma.com/unboxed/instagram-edits-gets-new-ai-style-fonts-precise-controls-and-better-content-discovery); [ETV Bharat](https://www.etvbharat.com/amp/en/technology/metas-edit-app-to-receive-ai-assistant-desktop-version-and-new-creator-tools-enn26061203419); [SocialBee](https://socialbee.com/blog/instagram-updates/)
- Edits templates: the Inspiration tab offers "Use template," which gives you the source video's text and audio, and you add your own clips. Presets sync clips to the beat of trending audio. One report says the template section was limited to select regions such as the UK, US and Australia, and that the library is smaller than CapCut's. — [Croma](https://www.croma.com/unboxed/instagram-edit-app-massive-update); [Napoleoncat (2026)](https://napoleoncat.com/blog/instagram-edits/)
- Template-making reportedly gained motion elements, adjustable speed and transitions. One 2026 review instead lists "No pre-built templates available (unlike CapCut)" as a drawback, so sources conflict. — [Inro](https://www.inro.social/blog/edits-new-meta-app)

**Instagram Reels "Use template" (inside the Instagram app)**
- When you create from a template, "the audio, number of clips, duration of the clips and AR effects will automatically be added." Instagram said text and transitions from the original would follow. Users can add or remove clips and adjust timing. — [TechCrunch (Jul 2023)](https://techcrunch.com/2023/07/18/instagram-making-easier-create-reels-using-templates); [Planoly](https://www.planoly.com/blog/instagram-reels-templates)
- Eligibility: "Any Reel using three or more clips can be used as a template. If you edit your Reel in another app, Instagram will recognize it as one continuous clip and it can't be used as a template." — [Planoly](https://www.planoly.com/blog/instagram-reels-templates) (2022–2023 era guidance; may have changed)

**YouTube Shorts "Edit with AI"**
- Rolled out on iOS/Android (Nov 2025 coverage). It turns raw camera-roll footage into a first draft by finding and arranging highlights and adding music, transitions and an optional AI voiceover (English/Hindi). Users pick a template. Total uploads are capped at 3 minutes. Outputs carry SynthID watermarks and AI labels. — [AlternativeTo](https://alternativeto.net/news/2025/11/youtube-rolls-out-edit-with-ai-to-streamline-shorts-creation-on-ios-and-android/); [YouTube Help](https://support.google.com/youtube/answer/16631240); [PPC Land](https://ppc.land/youtube-launches-edit-with-ai-for-automated-shorts-creation/)

**TikTok Smart Split / AI Outline**
- Launched Oct 28, 2025 in TikTok Studio Web (global). Smart Split clips, reframes, captions and transcribes videos longer than 60 seconds into multiple shorts. AI Outline helps with pre-production planning. — [TikTok Newsroom](https://newsroom.tiktok.com/new-ai-powered-tools-to-make-it-easier-to-create-and-share-on-tiktok); [Social Media Today](https://www.socialmediatoday.com/news/tiktok-adds-ai-creation-tools-creator-subscription-revenue-share-update/804050)

### Inferences
- Meta's and TikTok/CapCut's template systems both replicate edit structure (timing, audio, text) via native project metadata, not by analyzing pixels. Instagram's own rule that externally edited Reels "can't be used as a template" is the clearest documented evidence that platform templates don't solve copying any video's style.
- Platforms are pouring AI into first-draft generation (YouTube) and long-to-short clipping (TikTok), and Edits is free. A paid "copy this style" app would compete with free platform tools on basic auto-editing, so its differentiation must be the arbitrary-reference analysis.
- Meta tests features in Edits before bringing them to Instagram ([SocialBee](https://socialbee.com/blog/instagram-updates/)), and it owns SAM segmentation and Restyle. If "remix this Reel's edit" proves popular, Meta could extend templates toward pixel-based analysis.

### Gaps
- No current (2026) Edits MAU or download total from Meta was found.
- Whether Instagram/Edits templates can now be generated from externally edited videos (post-2023) was not confirmed.

---

## Q3. Captions (company now "Mirage"): AI Edit, AI Shorts, caption styles, funding and revenue

### Takeaway
Captions (made by Mirage, legal entity NOCAP, Inc. d/b/a Captions) offers "AI Edit," which turns raw footage into a finished video from a **library of named preset styles** (Paper II, Vinyl II, Prism Pro, Impact II, Y2K, etc.) plus text-prompt tweaks. It does not offer reference-video upload. Mirage reports 20M+ users and 250M+ videos created. It raised a $75M non-dilutive growth financing from General Catalyst (Mar 24, 2026), bringing total funding above $175M. App-store revenue was roughly $28M over the trailing year (Appfigures). No company ARR figure has been disclosed.

### Cited Findings
- AI Edit: "Turn raw footage into finished videos in minutes." Styles "automatically apply B-roll, transitions, music, and other elements." Named styles include Paper II, Vinyl II, Prism Pro, Prime, Elevate, Impact II, Sketch, Lens, Vista, Pop, Orbit, Y2K, Form, Bloom, Chalk, Linen, Evo, Focus, Lift, Stack and Align. Text prompts can add B-roll, zooms or sound effects. The page makes no mention of matching a reference video. Exports go to TikTok, Reels, Shorts and LinkedIn with no watermark. The page cites "4.7 on the App Store" and "20M creators." — [Captions AI Edit](https://captions.ai/features/edit-with-ai)
- Funding (company blog, Mar 24, 2026): $75M growth financing from General Catalyst's Customer Value Fund (non-dilutive). Total funding is "more than $175 million," with "Over 20 million global users" and "more than 250 million videos." Named customers include HubSpot, CoreWeave and King. The expansion focus is Asia. — [Captions/Mirage blog](https://captions.ai/blog/announcing-mirages-usd75m-growth-financing-with-general-catalyst)
- CB Insights lists $172.5M over 6 rounds and a July 2024 valuation of $500M. — [CB Insights](https://cbinsights.com/company/captions/financials)
- Appfigures data (cited Mar 2026): about 3.2M downloads and $28.4M in in-app revenue over the prior 365 days. US revenue is only about 25% of the total. — [Trending Topics](https://trendingtopics.eu/mirage-raises-75m-to-push-ai-video-app-captions-into-asian-markets/)
- CB Insights' "2025 revenue $6.1M" conflicts with the Appfigures in-app figure and appears unreliable. — [CB Insights](https://cbinsights.com/company/captions/financials)
- Captions switched from paid-only to freemium in Jan 2025, explicitly to capture users if CapCut were banned. Basic editing runs on-device, so it carries no server cost. Backers include Kleiner Perkins, Sequoia and a16z. — [TechCrunch, Jan 9 2025](https://techcrunch.com/2025/01/09/video-editing-app-captions-switches-to-a-freemium-model-to-boost-growth)
- Pricing (iOS, 2026): Max is $24.99/month with 500 credits and includes AI Edit styles. Frontier/Scale tiers run $69.99, $139.99 and $279.99 per month. Generated Mirage video costs 8 credits per second. A pricing tracker says the $9.99 Pro tier was removed on Jul 23, 2026, and Captions' help docs say "Basic" was formerly "Pro," so sources conflict. — [Hooked](https://www.hooked.so/compare/captions-ai-pricing); [usagepricing](https://usagepricing.com/blueprint/activity/captions-2026-07-23-packaging); [Captions help](https://captions.ai/help/docs/subscriptions)
- Rebrand: Mirage is used as the company name (reported as 2025, possibly September). The product is still "Captions." — [Ben's Bites](https://news.bensbites.co/posts/61880-mirage-formerly-captions-which-develops-an-ai-video-editing-and-marketing-suite-raised-75m-from-general-catalyst-after-moving-to-a-freemium-model-in-2025); [Captions/Mirage blog](https://captions.ai/blog/announcing-mirages-usd75m-growth-financing-with-general-catalyst)
- An earlier a16z ranking listed Splice, Captions and Videoleap as the top-performing mobile video editors by revenue. — [a16z genai100-4 via search](https://a16z.com/genai100-4)

### Inferences
- Captions is the closest mainstream analogue to the proposed app's UX (raw footage in, finished short out, AI-chosen B-roll, zooms and music). It differs on the key dimension: styles are a fixed, vendor-curated menu, not learned from a user-chosen reference. Captions could add "create a style from a reference" on top of its existing style engine, which makes it a plausible fast follower.
- A ~$28M/yr in-app run rate with 20M+ cumulative users suggests low conversion and ARPU even for a category leader. The proposed app should expect similar consumer-subscription economics unless it targets prosumers or brands.

### Gaps
- No company-disclosed ARR for Captions/Mirage was found.
- "AI Shorts" was not separately documented in sources reviewed (Captions also lists "Clips"/AI Creator/AI actors in plan descriptions per [Hooked](https://www.hooked.so/compare/captions-ai-pricing)).

---

## Q4. Other mainstream players: features, style/template/remix/reference capability, platform, pricing, traction

### Takeaway
Most tools fall into four buckets: (a) **long-to-short repurposers** (Opus Clip, Submagic, Vizard, Klap, TikTok Smart Split) with caption-style presets and "brand templates"; (b) **mobile timeline editors** with creator-made template marketplaces (Videoleap, VN, InShot, Splice, Filmora's template packs); (c) **agentic/chat editors** (Descript Underlord, invideo Editor, VEED, Adobe Premiere for iPhone with Firefly credits); and (d) **generative video** (Runway Aleph, Higgsfield, Pika, Hedra), which does visual style transfer ("make it look like X"), not editing-style transfer. Only invideo (Q5) explicitly ships reference-based edit matching.

### Cited Findings

**Comparison matrix** (sources in the per-tool bullets below)

| Tool | Core AI for short-form | Style / template / reference capability | Platform | Pricing (latest seen) | Traction / funding |
|---|---|---|---|---|---|
| CapCut | AutoCut, Auto-Edit, AI template generator (script→video), captions, avatars | Creator-made templates with fixed slots via TikTok "Use template"; no arbitrary reference | iOS, Android, desktop, web (templates mobile-only) | Free; Pro $19.99/mo or $179.99/yr | 736M mobile MAU (Jan 2026) |
| Edits (Meta) | Restyle, AI fonts, AI assistant, SAM segmentation | "Use template" (text + audio from source Reel) | iOS, Android | Free | 7.1M week-1 downloads (Apr 2025) |
| Captions / Mirage | AI Edit (raw → finished), AI avatars, Mirage video model | ~20 named preset styles; no reference input | iOS, Android, web | Max $24.99/mo (500 credits) | 20M+ users; >$175M raised; ~$28M trailing in-app rev (Mar 2026) |
| invideo | Agent Two (gen video), invideo Editor assistant | **Reference matching: upload or YouTube link → match pacing, structure, style** (Sept 2026) | Web (works on phone browser); iOS/Android apps exist | Manual editor free; AI uses credits | ~$70M ARR est.; $52.5M raised |
| Opus Clip | ClipAnything, AI clipping/reframing, Agent Opus | Brand templates (logo, caption style, B-roll, emoji rules) | Web (+ API/MCP) | Free 60 min/mo; from $15/mo | 16M+ users (2026 claim); "eight-figure ARR" (2024); $215M val (2025) |
| Submagic | Captions (48 langs), B-roll, silence cut, hooks | Caption-style templates, Brand Kit | Web (mobile availability not verified) | $15 / $30 per mo (own page) | $8M ARR, bootstrapped (Jun 2025) |
| Vizard | Long→short clipping, captions, calendar | Caption templates | Web | Free; ~$15/mo | n/a |
| Klap | Link→scored clips, dubbing | Caption styling | Web | $23 / $63 / $151 per mo | n/a |
| Descript | Underlord agentic editor (beta Jul 2025) | No reference input; Brand Studio (Business) | Desktop, web | Free; $24–35 Creator; $50–65 Business | ~$100M raised; ~$550M val (2022) |
| VEED | Transcription, AI editing | No reference feature found | Web | From $12/mo | $40M+ ARR (Jun 2025 claim) |
| Videoleap (Lightricks) | AI restyle, beat sync, AI effects | Creator-made template marketplace | iOS, Android | ~$10/mo | Lightricks ~$250M ARR (Jul 2025) |
| Adobe Premiere (iPhone) | Firefly gen-AI (sound FX, images, backgrounds), Enhance Speech, auto-captions | Not found | iOS (Android in dev) | Free; gen-AI uses Firefly credits | n/a |
| Filmora 15 | Smart Short Clips, Dynamic Captions, AI Extend | 1,000+ built-in templates | Desktop | Paid license; AI credits | n/a |
| Runway Aleph | Video-to-video restyle | Visual style via text/reference images (not cut/pacing) | Web/API | n/a | n/a |
| Higgsfield | Generative video | Not researched in depth | Web | n/a | $5.4B val; ~$700M annualized rev (Aug 2026) |
| Pika | Selfie-to-video social app | "Remix trending styles, sounds, lipsync templates" | iOS | n/a | $135M raised; $470M val (2024) |
| Hedra | Character / talking-head video | n/a | Web | n/a | $32M Series A, ~$200M val (May 2025) |

**Opus Clip**
- SoftBank Vision Fund 2 led a $20M round announced Mar 11, 2025 at a reported $215M valuation, alongside the launch of OpusSearch. — [Opus blog](https://www.opus.pro/fr-fr/blog/opusclip-raises-a-new-round-of-funding-from-softbank-and-launches-opussearch); [Net Influencer](https://www.netinfluencer.com/?p=33772)
- An earlier announcement (Aug 2024) reported $30M total funding, 6M+ users and "eight-figures in ARR." — [Opus blog](https://www.opus.pro/es-es/blog/opusclip-celebrates-30m-in-funding-and-the-launch-of-clipanything); [aiwiki](https://www.aiwiki.ai/wiki/opus_clip/raw)
- Brand templates save a logo, caption styling, B-roll behavior and emoji rules. Agent Opus (2026) generates net-new videos from a brief, URL or script, applying a brand kit. A media kit claims 16M+ creators and businesses by 2026. — [mer.vin (Jul 2026)](https://mer.vin/2026/07/agent-opus-explained-opusclip-end-to-end-ai-video-agent/); [AI Agent Index](https://theaiagentindex.com/agents/opus-clip); [yespress](https://yespress.io/opusclip.md)
- Buffer (Jul 2026): free plan with 60 processing minutes/month; paid from $15/month. Output can be tweaked to a preferred style on paid plans, but "It won't do what the first three tools on this list do" (the first three being the reference-capable or AI-led editors). — [Buffer](https://buffer.com/resources/ai-video-tools/)
- Latka estimates 2025 revenue at $10.3M (third-party estimate, low confidence). — [Latka](https://getlatka.com/companies/opus.pro/team)

**Submagic**
- $8M ARR as of June 5, 2025, with a team of 13, entirely bootstrapped. 80% gross margin, 85% NDR, about 15% monthly gross logo churn. Spend is ~$50K/month on paid ads and ~$45K/month on affiliates. Affiliates (10,000+, 30% lifetime revenue share) drive about 20% of ARR. 5–10K signups per day. It hit $1M ARR three months after its first customer (May 2023). — [Latka interview](https://getlatka.com/interviews/submagic-david-zitoun-2025); [Baremetrics](https://baremetrics.com/videos/how-david-zitoun-bootstrapped-submagic-to-8m-revenue)
- Features: captions in 48 languages, stock B-roll, silence and bad-take removal, hook generation, and a Brand Kit with templates. Pricing on Submagic's own page is $15 basic / $30 pro, while one directory cites a single $39 plan. — [Jupitrr](https://jupitrr.com/alternatives/submagic-alternatives); [Submagic vs Klap](https://www.submagic.co/alternatives/klap)

**Vizard / Klap**
- Klap: paste a link to get scored clips with caption styling and scheduling. Pricing is $23 / $63 (includes dubbing in 29 languages) / $151 per month. Vizard: free plan and about $15/month billed yearly (another source lists $9.90 / $19.90 / $49.90), auto clipping with a content calendar, and limited customization. — [Submagic vs Klap](https://www.submagic.co/alternatives/klap); [Jupitrr](https://jupitrr.com/alternatives/submagic-alternatives); [GTM Directory](https://thegtmdirectory.com/compare/klap-vs-submagic)

**Descript (Underlord)**
- Underlord, described as an "Agentic Video Editor," entered public beta in July 2025. A job posting says the 2026 focus is "driving quality to move from beta to GA." — [Teamblind job post](https://www.teamblind.com/jobs/314652117)
- Buffer (Jul 2026): no reference-video input, and returned edits are "hard to get... in my style." The reviewer said "Descript got me 40% of the way to a complete video." — [Buffer](https://buffer.com/resources/ai-video-tools/)
- Pricing (verified by third parties Aug–Sept 2026): Free (60 min, 720p watermark); Hobbyist $16 annual / $24 monthly; Creator $24 / $35 (full Underlord, 4K); Business $50 / $65 (Brand Studio). Underlord draws on AI credits. — [Descript pricing](https://www.descript.com/pricing-new); [Castmagic](https://www.castmagic.io/de/blog/descript-pricing)
- Funding: $50M Series C in late 2022 led by the OpenAI Startup Fund, roughly $100M raised in total, and a reported ~$550M valuation (directory). No newer round was found. — [Goodwin](https://www.goodwinlaw.com/en/news-and-events/news/2022/11/11_30-descript-raises-50-million-series-c); [The SaaS News](https://www.thesaasnews.com/news/descript-raises-50-million-in-series-c/); [komo](https://komo.ai/directory/descript-funding)

**VEED**
- A June 2025 SXSW London session title cites "how to scale to over $40M ARR," and the company reportedly has 10M+ monthly users. An aggregator logs a "$50M ARR" milestone dated Jun 17, 2026 (unverified). Sequoia invested in 2022. — [SXSW London](https://sxswlondon.com/session/breaking-the-rules-how-to-scale-to-over-40m-arr-b45606b6); [arr.club](https://www.arr.club/veed/10m-monthly-users)
- Buffer (Jul 2026): "transcription is also the most accurate among all tools on this list." Free plan has a 10-minute monthly export cap and watermark; paid from $12/month. No reference feature was noted. VEED is on a16z's Mar 2026 web Top 100. — [Buffer](https://buffer.com/resources/ai-video-tools/); [a16z](https://a16z.com/100-gen-ai-apps-6/)

**invideo** (see Q5 for the reference feature)
- Estimated ~$70M ARR (2025 or early 2026; timing varies by source) and $52.5M raised over three rounds (Peak XV/Sequoia India, Tiger Global). No new round since 2022. One review reports the CEO said he is deliberately not raising. Acquired GoBo Labs in Feb 2026. — [Dealroom](https://dealroom.co/companies/invideo/); [ai-market-watch](https://www.ai-market-watch.com/company/invideo); [Chatforest](https://chatforest.com/reviews/invideo-ai-video-automation-marketing-content-pipeline/); [valueforstartups](https://valueforstartups.in/22-invideo-ai)

**Videoleap / Lightricks**
- Videoleap's App Store copy offers "use templates made by creators" for Reels, TikToks and Shorts, an AI editor for "transforming the styles of your videos," and beat sync. Pricing is about $10/month or $69.99–$119.99/year. Coverage is stale (late 2025). — [Sonary](https://sonary.com/reviews/videoleap/); [Apptopia](https://apptopia.com/ios/app/1255135442/about)
- Lightricks reached ~$250M ARR company-wide by July 2025 (traced to Calcalist). A June 2026 CTech report described plans to separate Facetune (~$300M revenue) from the LTX video unit, with 75 layoffs. LTX-2, an open 4K audio-video model, was released Jan 2026. — [Wikipedia](https://en.wikipedia.org/wiki/Lightricks); [startuphub](https://www.startuphub.ai/startups/lightricks.md); [ai-market-watch](https://www.ai-market-watch.com/company/lightricks)

**VN, InShot, Splice** (sources are mostly Splice's own blog, a competitor)
- VN: multi-track timeline, keyframes, speed curves, 4K60 export, background removal and auto-beat detection; free with optional Pro. VN is on a16z's Mar 2026 mobile Top 100. — [Splice blog](https://spliceapp.com/blog/which-apps-deliver-the-most-advanced-editing-tools); [a16z](https://a16z.com/100-gen-ai-apps-6/)
- InShot: AI captions and tracking, background removal; Pro removes watermark and ads. — [Splice blog](https://spliceapp.com/blog/apps-like-inshot-with-more-features)
- Splice emphasizes overlays, masks and chroma key ahead of generative AI. — [Splice blog](https://spliceapp.com/blog/which-apps-use-ai-features-in-2026-video-editing)
- No reference or style-copy feature was found for VN, InShot or Splice.

**Adobe Premiere for iPhone**
- Launched Sept 30, 2025, free. It has a multi-track timeline, 4K HDR, auto-captions, Lightroom presets and direct export to TikTok/IG/Shorts. Firefly generative features (text-to-sound effects, humming to SFX, image-to-video, background extend/replace) require Firefly credits. Requires iOS 17+; Android in development (as of launch). — [AppleInsider](https://appleinsider.com/articles/25/09/30/adobe-premiere-launches-on-iphone-free-to-download-now); [BGR](https://bgr.com/1982541/adobe-premiere-iphone-ipad-app-free-download/); [Business Today](https://www.businesstoday.in/amp/technology/news/story/adobe-premiere-is-coming-to-iphones-with-pro-level-video-editing-and-ai-features-for-free-492707-2025-09-05)
- No template, style-copy or reference-matching feature was found in launch coverage.

**Filmora 15 (Wondershare)**
- Launched Nov 11, 2025 with AI Extend, Smart Cutout, Dynamic Captions, Voice Clone and TTS. Smart Short Clips auto-extracts highlights. 1,000+ built-in templates. Generation reportedly uses Google Veo 3.1 (single source). — [PR Newswire](https://tools.prnewswire.com/en-us/live/20813/release/20251111EN19004); [vantaige](https://vantaige.io/ai-tool/filmora); [Atomi review](https://atomisystems.com/screencasting/wondershare-filmora-15-review-2026-honest-pros-cons-real-verdict/)

**Generative players (visual style, not editing style)**
- Runway Aleph (Jul 25, 2025) and Aleph 2 are video-to-video models that restyle footage from text prompts. Gen-4 Aleph accepts reference images for style. Aleph 2 uses up to 5 keyframe images. — [Picsart API docs](https://picsart.com/api-platform/models/runway-aleph2/advanced); [Layer](https://layer.ai/docs/models/runway-aleph2); [Cliprise](https://www.cliprise.app/learn/guides/model-guides/runway-aleph-complete-guide)
- Higgsfield raised a $400M Series B at a $5.4B valuation (Aug 2026, led by DST Global). It claims ~$700M annualized revenue, up from $200M in January, with enterprise now the majority of revenue (company and FT reporting; run-rate, not booked revenue). It is on a16z's Mar 2026 web list. — [The Next Web](https://thenextweb.com/news/higgsfield-series-b-400m-5-4bn-valuation-700m-revenue); [Business Today MY](https://www.businesstoday.com.my/2026/08/26/higgsfield-secures-us400-million-series-b-at-us5-4-billion-valuation/); [a16z](https://a16z.com/100-gen-ai-apps-6/)
- Pika pivoted to a consumer iOS social app ("AI Video & Trend Maker"). Users start from a selfie and can "remix trending styles, sounds, and lipsync templates." Last confirmed funding was an $80M Series B in Jun 2024 at a $470M valuation ($135M total). — [App Store](https://apps.apple.com/gb/app/pika-ai-video-trend-maker/id6744712684); [Techleap](https://finder.techleap.nl/news/feed/pika-ai-app-raises-135m-funding); [Sacra](https://sacra.com/research/pika)
- Hedra (character/talking-head video): $32M Series A led by a16z in May 2025, with a reported ~$200M valuation. — [Verdict](https://www.verdict.co.uk/ai-video-hedra-32m-funding/)

**Independent hands-on comparison (Buffer, Jul 22, 2026)**
- Of 11 tools tested, only the AI-led editors accepted a reference video. Vyra "turned out great"; Stanley Studio "picked up colors and fonts... without quite nailing the style." Mainstream tools (CapCut, Canva, Adobe Express, VEED, OpusClip, Descript, Riverside) had no reference input. — [Buffer](https://buffer.com/resources/ai-video-tools/)

### Inferences
- "Templates" in the mainstream market means one of three things: (1) creator-built slot templates distributed through social platforms (CapCut, Edits/Instagram, Videoleap); (2) vendor-curated style presets (Captions AI Edit styles, YouTube Edit with AI templates); or (3) saved brand kits (Opus Clip, Submagic, Descript Brand Studio). None of these derives a style automatically from an arbitrary video a user brings.
- The "style transfer" that generative players (Runway Aleph, Edits Restyle, Videoleap restyle) do is visual and aesthetic, not editorial (cuts, pacing, caption timing, zoom punches). The proposed app's "editing-style DNA" framing is clearly distinct from them, but marketing must make that distinction obvious.
- Repurposers (Opus, Submagic, Klap, Vizard) target long-form-to-short podcasters and businesses. Their scale ($8M to eight-figure ARR) shows creator willingness to pay $15–30/month for automation.

### Gaps
- Funding or revenue for Vizard, Klap, Splice, VN, InShot and Runway was not found or not researched within budget.
- No independent test of Captions AI Edit quality vs. a reference-based tool.
- Adobe Premiere iPhone download and usage figures were not found.
- Higgsfield's specific short-form editing features (vs. pure generation) were not researched.

---

## Q5. Is any mainstream player explicitly marketing "upload a video and we'll edit yours the same way" / "copy any video's editing style"?

### Takeaway
**Yes: invideo.** It is an established player (about $70M ARR est., $52.5M raised). On Sept 1, 2026 it launched **invideo Editor**, a browser-based editor with an AI assistant that will "match that reference's pacing, structure, and style in your cut" from an uploaded video or YouTube link, applied either to the whole edit or to a timestamped effect or transition. It runs in the browser (including phone browsers) and uses credits. No independent quality test was found yet. No other mainstream app (CapCut, Edits, Captions, Descript, Opus, VEED, Premiere, Videoleap) offers arbitrary-reference matching. CapCut's and Instagram's "Use template" flows approximate it only for template-native source videos.

### Cited Findings
- invideo Editor announcement (Sept 1, 2026): "a professional video editor that runs in the browser with an AI assistant editor you can hand real editing work to." "Point it at a video you like and it matches that reference's pacing, structure, and style in your cut." "It works from a desktop, laptop, tablet, or phone." "The manual editor is free with no limit on projects or footage." "The assistant editor and generative models use credits." The assistant also does first drafts, multicam, footage search, B-roll generation or stock, subtitles, and dubbing with lip sync. 200+ models are available, and Agent Two runs in the same project. — [invideo news](https://invideo.io/news/introducing-invideo-editor/)
- Feature page ("Match an edit using reference videos" / "Replicate any video edit with a reference"): "studies your reference and builds anything from a single effect to a complete edit using your footage." It "studies the timing and sequence of its cuts, then trims and arranges your footage to create a similar pace." Users can point to a timestamp to recreate a transition or effect. It also studies sound design (music, ambience, SFX) and text and title typography, motion and timing. Inputs are an upload or a YouTube link; private and access-restricted links can't be used. TikTok/IG links are not mentioned. Results land on an editable timeline. — [invideo feature page](https://invideo.io/make/style-and-motion-reference/); [invideo editor page](https://invideo.io/editor/style-and-motion-reference/)
- invideo FAQ (updated Sept 13, 2026): the agent analyzes "a reference video's pacing, structure, shot rhythm, transitions, visual treatment, and use of sound." It studies where cuts occur, shot durations, section structure, when B-roll replaces the speaker, and how music supports the edit. Limitations: footage must support the style ("a reference with many locations, complex camera movement, and several shot sizes can't be faithfully recreated from one static recording"), and missing B-roll may be sourced or generated. — [invideo FAQ](https://invideo.io/faq/can-an-ai-editing-agent-match-the-pacing-and-style-of-a-reference-video/)
- invideo also launched an MCP server (Sept 30, 2026) so Claude, ChatGPT, Codex, Cursor and others can drive invideo Editor, including reference-style requests. — [invideo MCP](https://invideo.io/news/introducing-invideo-mcp/); [invideo FAQ (Claude)](https://invideo.io/faq/can-i-ask-claude-to-match-a-reference-videos-style-in-my-editor/)
- invideo has native iOS/Android apps ("invideo: AI Video Editor"), but its pages don't say whether reference matching is available inside them, as opposed to the mobile browser. — [Google Play](https://play.google.com/store/apps/details?id=io.invideo.ai&hl=en_US); [invideo feature page](https://invideo.io/make/style-and-motion-reference/)
- Independent coverage is thin. A Yespress review of the Sept editor lists keyframes, color, audio mixing, version control and semantic search, but doesn't mention reference matching. — [Yespress](https://yespress.io/products/invideo-ai)
- CapCut's closest marketing claim is that its AI template generator can "instantly replicate trending formats, transitions, and pacing" by studying "viral patterns." The input is a script, not a specific reference. — [CapCut](https://www.capcut.com/tools/ai-template-generator)
- For context only (niche, covered separately): Buffer's Jul 2026 hands-on found Vyra's reference-upload feature produced a good result on an 81-second talking-head clip. Sparki "Copy Style," CopyViral (link-based, Instagram) and Clypmint market the same concept. — [Buffer](https://buffer.com/resources/ai-video-tools/); [Sparki](https://sparki.io/features/copy-style); [CopyViral](https://www.copyviral.com/); [Clypmint](https://clypmint.com/)

### Inferences
- The core idea is no longer unclaimed. An established, profitable-scale company (invideo) shipped exactly this positioning one month before this research date, plus an MCP integration. It is web-first and broad (generative video, B-roll, dubbing), not a focused iOS creator app, and its reference inputs are uploads or YouTube links, not TikTok/IG share-sheet links.
- Remaining white space for an iOS app: (1) native mobile-first UX with share-sheet import from TikTok/Reels; (2) creator-specific style elements (caption animation styles, zoom punches, SFX hits, beat-synced cuts) extracted precisely from short-form references; (3) saved "style DNA" profiles creators reuse; (4) speed and price below invideo's credit model. These are inferences, not validated demand.
- The most likely fast followers are CapCut (template corpus + AutoCut + ByteDance models), Captions/Mirage (existing style-preset engine), and Meta Edits (templates + SAM).

### Gaps
- No independent review or user testimony on how well invideo's reference matching works.
- invideo's credit cost per reference-matched edit was not published on the pages reviewed.
- No Reddit or creator-forum threads surfaced in searches. Demand evidence for "copy this edit" from creators remains anecdotal (the 2022 Split quote and the popularity of CapCut/Instagram templates).

---

## Q6. Revenue, funding and user benchmarks to size the category

### Takeaway
At the top, CapCut has 736M mobile MAU and over $460M in in-app purchases across the two years to early 2025 (Sensor Tower), which works out to roughly $230M/yr by my own division. Among independent AI editors, invideo (~$70M ARR est.), VEED ($40–50M ARR), Captions/Mirage (~$28M trailing in-app revenue, >$175M raised), Opus Clip (eight-figure ARR, $215M valuation) and Submagic ($8M ARR, bootstrapped) show that $10–70M ARR outcomes are common. Generative-video players (Higgsfield, at ~$700M claimed annualized revenue) are an order of magnitude larger but sell mostly to enterprise.

### Cited Findings

| Company | Metric | Date | Source quality | Source |
|---|---|---|---|---|
| CapCut | 736M monthly active mobile users | Jan 2026 (Sensor Tower via a16z) | High | [a16z](https://a16z.com/100-gen-ai-apps-6/) |
| CapCut | >$460M in-app purchases over 2 yrs; 51.2M DAU; 1.3B downloads | ~Jan 2025 (Sensor Tower via TechCrunch) | High | [TechCrunch](https://techcrunch.com/2025/01/09/video-editing-app-captions-switches-to-a-freemium-model-to-boost-growth) |
| CapCut US | ~$4.6–4.8M weekly revenue peaks; 22.5M→25M+ US active users | Q2–Q4 2025 | High (Sensor Tower) | [Sensor Tower](https://sensortower.com/blog/2025-q4-unified-top-5-photo-and-video-revenue-us-615c8a30ad269d38a8b6acd0) |
| Edits | ~7.1M downloads in week 1 | Apr 2025 (Appfigures) | Medium | [TechCrunch](https://techcrunch.com/2025/04/26/instagram-edits-topped-7m-downloads-in-first-week-a-bigger-launch-than-capcuts) |
| Captions/Mirage | >$175M total raised; $75M GC CVF; 20M+ users; 250M videos | Mar 24, 2026 | High (company) | [Mirage blog](https://captions.ai/blog/announcing-mirages-usd75m-growth-financing-with-general-catalyst) |
| Captions/Mirage | $28.4M in-app revenue, 3.2M downloads (trailing 365 days); 75% non-US revenue | ~Mar 2026 (Appfigures) | Medium | [Trending Topics](https://trendingtopics.eu/mirage-raises-75m-to-push-ai-video-app-captions-into-asian-markets/) |
| Captions/Mirage | $500M valuation | Jul 2024 | Medium (CB Insights) | [CB Insights](https://cbinsights.com/company/captions/financials) |
| Opus Clip | $20M from SoftBank VF2 at $215M valuation | Mar 2025 | Medium-High | [Net Influencer](https://www.netinfluencer.com/?p=33772) |
| Opus Clip | 6M+ users, "eight-figure ARR", $30M raised | Aug 2024 (company) | High but stale | [Opus blog](https://www.opus.pro/es-es/blog/opusclip-celebrates-30m-in-funding-and-the-launch-of-clipanything) |
| Submagic | $8M ARR, 13 people, bootstrapped, 15%/mo logo churn | Jun 2025 | Medium (founder interview) | [Latka](https://getlatka.com/interviews/submagic-david-zitoun-2025) |
| invideo | ~$70M ARR (est.); $52.5M raised | 2025 to early 2026 | Low-Medium (aggregators) | [Dealroom](https://dealroom.co/companies/invideo/); [Chatforest](https://chatforest.com/reviews/invideo-ai-video-automation-marketing-content-pipeline/) |
| VEED | $40M+ ARR (co-founder talk); 10M+ monthly users; $50M ARR (aggregator) | Jun 2025 / Jun 2026 | Medium / Low | [SXSW London](https://sxswlondon.com/session/breaking-the-rules-how-to-scale-to-over-40m-arr-b45606b6); [arr.club](https://www.arr.club/veed/10m-monthly-users) |
| Descript | ~$100M raised; $50M Series C (OpenAI Startup Fund); ~$550M val | 2022 | Medium, stale | [Goodwin](https://www.goodwinlaw.com/en/news-and-events/news/2022/11/11_30-descript-raises-50-million-series-c); [komo](https://komo.ai/directory/descript-funding) |
| Lightricks | ~$250M ARR company-wide | Jul 2025 | Medium | [Wikipedia](https://en.wikipedia.org/wiki/Lightricks) |
| Higgsfield | $400M Series B @ $5.4B; ~$700M annualized revenue (claimed) | Aug 2026 | Medium-High | [The Next Web](https://thenextweb.com/news/higgsfield-series-b-400m-5-4bn-valuation-700m-revenue) |
| Pika | $135M raised; $470M val | Jun 2024 | Medium, stale | [Techleap](https://finder.techleap.nl/news/feed/pika-ai-app-raises-135m-funding) |
| Hedra | $32M Series A; ~$200M val | May 2025 | Medium | [Verdict](https://www.verdict.co.uk/ai-video-hedra-32m-funding/) |

### Inferences
- Consumer mobile editing is dominated by free or cheap incumbents (CapCut, Edits, Premiere iPhone, VN, YouTube/TikTok native tools). Independent AI-editor winners reached $8–70M ARR mostly through web and prosumer/business pricing ($15–35/month) rather than pure consumer iOS subscriptions.
- Submagic is the closest analogue for a small team: $0 to $8M ARR in about 2 years, bootstrapped, with affiliate-led growth. Its ~15% monthly logo churn is a warning sign for one-feature short-form tools.
- Captions/Mirage's ~$28M/yr app-store revenue against >$175M raised suggests that consumer AI video editing is capital-intensive (compute and paid acquisition) and that freemium conversion is modest.

### Gaps
- CapCut's verified 2025 global revenue is not public. Sensor Tower's global data is paywalled, and the only "$815M 2025" figure found is unsourced.
- No current ARR for Opus Clip, Captions/Mirage, or Descript was found; latest figures are 2022–2024.
- No Edits MAU or engagement data has been released by Meta since launch week.
