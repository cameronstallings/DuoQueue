# Reference-Video Edit Style Transfer: Niche Players, Agent/Developer Ecosystem, and Research (as of 2026-10-08)

Scope note: Mainstream apps (CapCut, Captions, Opus Clip, Submagic, Descript, VEED) and Cut AI are covered by other researchers and appear here only where they bear directly on reference-based style copying. "True" reference style transfer here means: the user supplies any example edited video, the system analyzes its editing (cuts, pacing, captions, transitions, zooms, effects, color, music) and re-edits the user's own raw footage the same way. GitHub star counts were pulled from the GitHub API on 2026-10-08 unless noted.

## Q1. Startups/websites (2024–2026) that market "copy the editing style of any video" / reference-based editing

### Takeaway
At least five products now market true "upload a reference, we re-edit your footage like it" workflows: Sparki (Copy Style), invideo (Video Reference, also via Claude over MCP), Shorty, Vyra, and to a weaker degree Stanley Studio. Nearly all are web-based, launched or added the feature in 2026, and publish no traction data. The only independent quality test found (Buffer, July 2026) rated Vyra well and found Stanley matched surface colors and fonts but not the style. A second, larger group (Topview, InsMind, CloneViral, RecCloud, Pollo AI, Pippit) "clones viral videos" by generating new content with AI rather than re-editing the user's footage. No native iOS app was found that does reference-to-own-footage style transfer.

### Cited Findings

**A. True reference-video, re-edit-your-footage tools**

- **Sparki — "Copy Style"** (sparki.io; billed as "The First AI Editing Agent")
  - The page says it maps eight layers from the reference: rhythm/pacing, cut points, transitions, text/captions, zoom/motion, speed ramping, B-roll placement, and hook structure. Inputs are an uploaded file or a TikTok or Instagram link, and it claims about 5 minutes per edit. Color isn't listed as a layer on the page, and several FAQ answers (e.g., "which elements are analyzed", "how it differs from templates") are blank. — [Sparki Copy Style](https://sparki.io/features/copy-style)
  - It also ships an API and "agent skills" for OpenClaw, WorkBuddy, Codex, and Claude Code. — [Sparki Copy Style](https://sparki.io/features/copy-style)
  - According to a search snippet of the page, it analyzes "cut frequency, transition types, color grading, text placement, and pacing", accepts TikTok, Reels, Shorts or any file, and "replicates the editing style and visual patterns, not the actual content". A copied style can be saved as a preset and reused. Results are best when the raw footage is similar to the reference (e.g., talking head to talking head). These claims came from search snippets and were not visible in the fetched page text. — [Sparki Copy Style](https://sparki.io/features/copy-style)
  - Pricing: free tier plus roughly $9–$35/month per AlternativeTo; G2 lists "usage-based". Developer: Sparkview Tech Pte. Ltd. (Singapore). There are no reviews on Trustpilot or GetApp, and the Crunchbase funding entries are placeholders. — [AlternativeTo](https://alternativeto.net/software/sparki/about); [G2](https://ai.g2.com/marketplace/tools/sparki); [Crunchbase](https://www.crunchbase.com/organization/sparki); [Trustpilot](https://uk.trustpilot.com/review/sparki.io)
- **invideo — "Video Reference" / "Replicate any video edit with a reference"**
  - The agent studies the reference's shot order, pacing, and the timing and sequence of cuts. It also reads transitions, effects, graphic animations, typography, title-card motion, and sound design (music, ambience, SFX). It then trims and arranges the user's clips to match. Users can point to timestamps to copy a specific transition. References are an upload or a YouTube link, and private or restricted links are not supported. Output is an editable timeline, and the result is "similar in style rather than identical". — [invideo Style & Motion Reference](https://invideo.io/editor/style-and-motion-reference/)
  - invideo's own FAQ (updated 2026-09-13) concedes: "Reference matching works best when your footage can support the requested style". Complex references with many locations, elaborate camera movement, or several shot sizes "can't be reproduced faithfully from one static recording". The agent may generate missing B-roll. — [invideo FAQ: match pacing & style](https://invideo.io/faq/can-an-ai-editing-agent-match-the-pacing-and-style-of-a-reference-video/)
  - Through invideo Editor's MCP connection, Claude can apply a reference's style to an editable timeline. The FAQ (updated 2026-10-06) recommends naming specific qualities rather than "copy the entire style" and building in stages: sequence → pacing → visuals → graphics → sound. — [invideo FAQ: Claude + reference](https://invideo.io/faq/can-i-ask-claude-to-match-a-reference-videos-style-in-my-editor/)
- **Shorty** (shortyedit.com) — "a browser-based, reference-driven AI video editor"
  - It extracts shot structure, pacing, cuts, captions, transitions, colour treatment, and aspect ratio from the reference. It scans the user's clips for usable moments, faces, speech, and motion, then builds a shot plan and cloud-renders an MP4 in 9:16, 4:5, 1:1, 16:9 and other ratios. The reference's analysed soundtrack "may be included". — [Shorty](https://shortyedit.com/)
  - Reference analysis sends the video to Google Gemini, and Anthropic is also named as a processor. Shorty also offers an MCP server for Claude, ChatGPT, Cursor, Claude Code, and Codex. Pricing is credit-based with no figures published. The operator is Tools Products FZ-LLC, and no founders or traction are given. — [Shorty](https://shortyedit.com/)
- **Vyra** (usevyra.com) — browser, chat-driven editor
  - Users can "upload reference videos for the AI to model the edit after". In Buffer's test (81-second talking head plus a reference), it reached a finished edit in about 20 minutes without B-roll or music, versus the reviewer's ~30-minute manual process. It "cut in the right places and added captions" and was "the most consistent performer" of the 11 tools tested. Claude drove the edit via Vyra's MCP. Price: $24/month with your own AI, $54/month with Vyra's AI. — [Buffer, 2026-07-22](https://buffer.com/resources/ai-video-tools/)
  - The MCP registry lists a remote endpoint (api.usevyra.com/mcp), v0.1.0, last updated 2026-05-22. One directory lists plans from $9.99/month, which conflicts with Buffer's figures. None of the sources confirm that reference styling is exposed through MCP. — [search summary of moge.ai / getdrio.com / claudemarketplaces listings](https://www.getdrio.com/mcp/io-github-kale-eb-vyra)
- **Stanley Studio** (by Stan, the creator-store company)
  - Buffer uploaded a reference for text and caption style. Stanley "picked up on things like colors and fonts, without quite nailing the style". It didn't cut repeated takes and kept "slack" pacing despite a "snappy" request. No MCP. Free for one project, then $19/month. — [Buffer, 2026-07-22](https://buffer.com/resources/ai-video-tools/)
  - Stan's own materials describe a chat brief (9:16, duration, silences, captions, zooms, hook, music), not a reference-video feature. They quote Pro at $49/month, which conflicts with Buffer's $19. The product was launched on Product Hunt in roughly mid-2026. — [Stan blog](https://stan.store/blog/stanley-studio/); [Product Hunt](https://www.producthunt.com/products/stanley-studio)
- **Descript** has no reference-video input, which the reviewer said made it hard to get edits "in my style". Its hosted MCP server, added May 2026, let Claude run an edit. — [Buffer, 2026-07-22](https://buffer.com/resources/ai-video-tools/)

**B. "Clone a viral video" tools that regenerate content (generative/ad remakes, not re-editing your footage)**

- **Topview AI Video Clone**: requires an uploaded file and "clones the structure, not the original pixels". It copies hook, cut rhythm, shot order, caption timing, text placement, product reveal, and CTA. Modes are "Recreate structure" or "Replace elements" (swap people or products). Credit-based. — [Topview](https://www.topview.ai/ai-video-clone)
- **InsMind AI Video Cloner** turns "pacing, shot sequence, and visual rhythm into a fresh version for your own idea". **CloneViral** ("Viral Video Replicator") recreates the format from a link plus a brief. — [InsMind](https://www.insmind.com/ai-video-generator/video-clone); [CloneViral](https://www.cloneviral.ai/agent-mode/templates/video-clone-remix)
- **RecCloud AI Video Remaker** (on the App Store) analyzes "style, actions, camera movement, pacing, and transitions" to recreate a reference with products or objects swapped. **Pollo AI** (iOS) has "Clone & Remix: Recreate a reference video's structure and style with your own content" and added "Reference to Video" in v3.4.0. — [RecCloud](https://reccloud.com/ai-video-remaker); [Pollo AI App Store](https://apps.apple.com/us/app/pollo-ai-ai-video-image/id6740024098)
- **Pippit** (ByteDance, launched May 2025, powered by CapCut): a third-party review describes "Inspiration > Trending on TikTok → select a video as your smart template → Generate videos in this style". Its "video style transfer" tool re-renders frames (visual look, not edit structure). — [Pippit (Wikipedia)](https://en.wikipedia.org/wiki/Pippit); [Pippit style transfer](https://www.pippit.ai/tools/video-style-transfer)
- **Vidu / Kling-style "reference-to-video"** features use reference images or videos to generate consistent new footage. That is generation, not editing. — [Vidu reference-to-video](https://www.vidu.com/ai-reference-to-video)

**C. Agentic editors checked that do NOT advertise reference-style copying**

- **Cardboard** (YC W26; founders Saksham Aggarwal and Ishan Sharma) is a browser "vibe editing" tool for first cuts ("make a 60s recap"), semantic footage search, and timeline refinement. Its launch page doesn't mention reference-video style copying. Tracxn reports ~$500K seed (Jan 2026), which is unverified; beware an unrelated Oslo SaaS company also named "Cardboard". — [YC Launch](https://www.ycombinator.com/launches/PM3-cardboard-agentic-video-editor); [Tracxn](https://tracxn.com/d/companies/cardboard/__a-2RJ30LaJ5LmJ3voiGPfo4ES0PscklcCA3OEsPJTag)
- **Mosaic** (YC W25; Adish Jain and Kyle Wade) raised a **$3.8M seed** "to build video editing agents". The founder cites partnerships with TubeScience (Meta's largest ad-creative partner, "8K videos a month") and News Corp. Its homepage text could not be retrieved, so no reference-style feature could be verified. — [Adish Jain on X](https://x.com/_adishj/status/2041562227208302748); [YC job page](https://www.ycombinator.com/companies/mosaic-2/jobs/KyED8hb-founding-product-engineer)
- **Eddie AI** does conversational rough cuts and script-aligned take selection, aimed at long-form and documentary work. V4 was unveiled ahead of IBC 2026. No reference-style feature was found. Funding and revenue data conflict: GetLatka claims ~$550K 2025 revenue and bootstrapped; PitchBook lists Offline Ventures and The Production Board. — [search summary incl. NoFilmSchool V4](https://nofilmschool.com/eddie-ai-v4); [GetLatka](https://getlatka.com/companies/heyeddie.ai); [PitchBook](https://pitchbook.com/profiles/company/599820-04)
- **Kapwing**'s AI tools use prompt, script or footage plus a Brand Kit (your own fonts, colors, subtitle styles). No reference-video copying was found. **Diffusion Studio** (YC) is an open-source "AI-driven video editor for humans and coding agents". An agent could in principle be pointed at a reference, but no documented feature was found. — [search summary: Kapwing, Diffusion Studio](https://www.kapwing.com/ai); [Diffusion Studio GitHub](https://github.com/diffusionstudio/editor); [YC Diffusion Studio](https://ycombinator.com/companies/diffusion-studio)
- **ChatCut** offers an "AI video editing plugin built for Claude Code" with captions, motion graphics, and "style-mode promos". Reference copying is not mentioned. Plans run $25–$160/month (100–800 credits), and it shows a "#1 Product of the Day" Product Hunt badge. — [ChatCut Claude Code plugin](https://chatcut.io/claude-code-plugin)
- **Captions AI Edit** applies styles chosen from a library ("Paper II", "Vinyl II"). Its "reference video" feature is for avatar cloning (AI Creator), not style. — [Captions AI Edit](https://captions.ai/features/edit-with-ai)

### Inferences
- Classification for the report writer:
  - **True any-reference → your-footage edit transfer (vendor claims):** Sparki Copy Style, invideo Video Reference, Shorty, Vyra.
  - **Partial or weak:** Stanley Studio (picks up fonts and colors only, per Buffer).
  - **Generative "clone viral structure" (makes new footage or ads):** Topview, InsMind, CloneViral, RecCloud, Pollo AI, Pippit.
  - **Fixed style libraries or templates:** Captions AI Edit, CapCut templates, ChatCut style modes.
  - **Generic agentic auto-editing (no reference):** Cardboard, Mosaic, Eddie AI, Kapwing, Descript, Diffusion Studio.
- The category went from almost nothing to several web competitors within 2026. Two players (invideo, Shorty) already let Claude or other LLMs drive the reference workflow over MCP. "Claude as the editor that watches the reference" is therefore not novel on the web. The open space appears to be a mobile-native (iOS) product and verified quality.
- Shorty uses Gemini for the reference analysis step and others plug in Claude. Gemini's native video input appears to be the de facto "watch the reference" layer even in Claude-centric stacks (also seen in ghost-editor, Q2).
- Every vendor hedges: "similar not identical", "works best when footage supports the style". Reference transfer is the most likely place for expectation gaps.

### Gaps
- No pricing pages, launch dates, user counts or funding were verified for Sparki, Shorty or Vyra. The Vyra pricing conflict ($24/$54 vs $9.99) is unresolved.
- Couldn't verify these names from the brief (no evidence of reference-style transfer found in this pass, but not exhaustively checked): Cutback/Selects, Gling, AutoPod, Simplified, Edit Mind, Overlap, Shortcut, Rendi, Kino, Vadoo, Quso, Vugola, VidAU. Gling and AutoPod are, to my knowledge, silence/take-removal and podcast multicam tools, but this wasn't re-verified here.
- No independent side-by-side test of Sparki, invideo, Shorty and Vyra on the same reference was found.
- Mosaic's site content and the date of the $3.8M announcement were not retrievable.

## Q2. Claude Code skills, MCP servers, and agent repos — which can analyze a reference video and replicate its style?

### Takeaway
The open-source "Claude/Codex as video editor" ecosystem exploded in 2026. Examples: browser-use's video-use (~28.4k★), OpenMontage (~65k★), FireRed-OpenStoryline (~3.5k★), HeyGen's HyperFrames rendering skills, CapCut/Jianying draft generators (pyJianYingDraft ~4.5k★, VectCutAPI ~2.3k★), DaVinci, Premiere and After Effects MCPs, and an official Descript MCP. Almost none analyze a reference video. Only a few small, very new skill packs explicitly reverse-engineer a reference reel: ghost-editor (66★, Sept 2026, uses Gemini 2.5 Pro to "watch" the reference) and krusemediallc/video-editor-agent (26★, `reel-style-clone`). OpenMontage partially does, keeping a source video's pacing, hook and structure.

### Cited Findings

**Repos that explicitly do reference-reel style analysis**

- **kurbaitaev/ghost-editor** (66★, created 2026-09-24, MIT) is a Claude Code skill on HyperFrames for talking-head reels: "7 styles, face-safe captions, motion scenes, reverse-engineer any reference edit". — [GitHub API search](https://github.com/kurbaitaev/ghost-editor)
  - The reference option "uses Google's Gemini to watch the reference video" (free API key needed). It "studies how that video was edited (the cuts, captions, animations and sounds) and edits yours the same way". You can "save the look as your own style". It works best on vertical single-speaker talking-head video, not screen recordings, and was tested in English and Russian only. — [ghost-editor README](https://github.com/kurbaitaev/ghost-editor)
  - Mechanism: `reference_study.py` produces a contact sheet, full-resolution frames, and "a second-by-second edit log produced by Gemini 2.5 Pro". The log is mapped onto the skill's beats (timed on-screen elements defined in `reel.json`), and the agent "checks the log against the frames before relying on it". — [ghost-editor HOW-IT-WORKS.md](https://github.com/kurbaitaev/ghost-editor/blob/main/docs/HOW-IT-WORKS.md)
- **krusemediallc/video-editor-agent** (26★, created 2026-08-29) is a Claude Code skill pack: "style-clone a reference reel, build a branded motion-graphics edit, ElevenLabs sound design, frame-level QA, timeline-comment review loop". — [GitHub](https://github.com/krusemediallc/video-editor-agent)
  - The `reel-style-clone` skill does the following:
    - Probes with ffprobe and runs ffmpeg scene detection, saving the first frame after each cut.
    - Samples frames at 2 fps at 360 px wide, tiled into 5×4 contact sheets (10 s per sheet).
    - Runs local Whisper, plus spectrogram and waveform images.
    - Uses parallel subagents to analyze sheets, cut frames and audio.
    - Synthesizes everything into `style-guide.md` with sections PACING, CAPTIONS, GRAPHIC LANGUAGE, B-ROLL GRAMMAR, COLOR & GRADE, SOUND DESIGN (written as an ElevenLabs music prompt) and BUILD DIRECTIVES, plus an `evidence/` folder.
  - It extracts cut timestamps, cuts per second, and shot lengths by section (hook/body/CTA). Caption fields are typography, size, color, case, position and animation. It also captures BPM from kick spacing, SFX hit points, the energy arc, and "signature devices".
  - It is analysis-only; rendering is handed to other skills via HyperFrames. Platform downloads need the user's own authenticated session. — [reel-style-clone SKILL.md](https://raw.githubusercontent.com/krusemediallc/video-editor-agent/main/.claude/skills/reel-style-clone/SKILL.md)
- **calesthio/OpenMontage** (65.3k★, created 2026-03-29) bills itself as "World's first open-source, agentic video production system", with 11–12 pipelines and 700+ skill files.
  - It can start from a "YouTube video, Short, Reel, TikTok, or local clip". The agent "analyzes transcript, pacing, scenes, keyframes, and style" and reports what it keeps (pacing, hook style, structure, tone) and what it changes. That is reference-inspired production, not cut-for-cut edit replication.
  - Pipelines are YAML manifests with Markdown director skills. The render runtime (Remotion, HyperFrames or FFmpeg) is locked via `edit_decisions`. — [OpenMontage README](https://github.com/calesthio/OpenMontage)
- A community guide and other repos reference a "reference-style guide" that measures and rebuilds a look without copying assets. One starter prompt includes a field for "1 to 3 reference reel links". **Ootto-AI/claude-content-skills** has a "Reel Analyzer" skill that dissects a viral reel's hook, pacing and visuals for modeling. — [search summary](https://github.com/Ootto-AI/claude-content-skills)

**Major agent/editing repos with no reference-style analysis**

- **browser-use/video-use** (~28.4k★, 3.3k forks, MIT): "Edit videos with coding agents". The LLM never watches footage directly.
  - It reads an ElevenLabs Scribe transcript (word timestamps, speakers, audio events) packed into ~12 KB, plus on-demand `timeline_view` PNGs (filmstrip, waveform, word labels).
  - Pipeline: transcribe → pack → reason → EDL → ffmpeg render → self-evaluate at each cut (up to 3 fix passes). It adds 30 ms audio fades at cuts and defaults captions to 2-word uppercase chunks. Color grade presets include "warm cinematic" and "neutral punch". Animations come via HyperFrames, Remotion, Manim or PIL subagents.
  - "Reference" does not appear in the README. — [video-use GitHub](https://github.com/browser-use/video-use)
  - Star counts reported elsewhere vary (4.2k → 10k → 15k+) because they were captured at different times. — [search summary](https://themenonlab.blog/blog/video-use-ai-video-editing-claude-code)
- **FireRedTeam/FireRed-OpenStoryline** (3,467★, open-sourced 2026-02-10, Apache-2.0) is an LLM editing agent with an MCP server and LangChain.
  - Its "Style Skills" let you "save your complete editing workflow as a custom Skill" and apply it to new media. Style is captured from your own workflow, not extracted from a reference video.
  - It includes BGM recommendation with beat-sync, font matching, ASR rough cuts, and MoviePy and FFmpeg as core dependencies. — [OpenStoryline GitHub](https://github.com/FireRedTeam/FireRed-OpenStoryline)
- **HeyGen HyperFrames** (Apache-2.0) renders HTML to MP4 for agents. A scene is an HTML file with `data-` attributes for timing and transitions, CSS for layout, and GSAP for motion. It ships eight core Claude Code skills, and HeyGen's own launch video was made in Claude Code with it. It is now the rendering layer used by ghost-editor, video-editor-agent and many reel skills. — [HyperFrames GitHub](https://github.com/heygen-com/hyperframes); [noqta guide](https://www.noqta.tn/en/blog/heygen-hyperframes-html-to-mp4-ai-agent-video-2026)
- **remotion-dev/remotion** has 62.5k★ (React video). **mcp-use/remotion-mcp-app** has 55★. — [GitHub API search](https://github.com/remotion-dev/remotion); [GitHub](https://github.com/mcp-use/remotion-mcp-app)
- **CapCut/Jianying draft tooling** (generate editable CapCut drafts from code or agents):
  - **GuanYixuan/pyJianYingDraft** 4,505★
  - **luoluoluo22/jianying-editor-skill** 3,816★
  - **sun-guannan/VectCutAPI** 2,285★ ("Open Cut API", created 2025-07-11)
  - **Hommy-master/capcut-mate** 1,929★
  - **xuliang2024/cutcli-cookbook** 198★ ("JSON templates… Generate editable video drafts from code, Cursor, Claude Code or any MCP agent")
  - **fancyboi999/capcut-mcp** 95★ (archived)
  - **Atx-Guy/capcut-mcp-server** 63★
  - — [GitHub API searches](https://github.com/sun-guannan/VectCutAPI); [cutcli-cookbook](https://github.com/xuliang2024/cutcli-cookbook)
- **NLE MCPs:**
  - **samuelgursky/davinci-resolve-mcp** 3,408★ (since 2025-03)
  - **hetpatel-11/Adobe_Premiere_Pro_MCP** 666★
  - **hiteshK03/davinci-resolve-mcp** 122★
  - **Engine-Room-Games/after-effects-mcp** 27★ (layers, keyframes, effects, expressions)
  - **descriptinc/descript-mcp** 33★ (official, created 2026-05-28)
  - — [GitHub](https://github.com/samuelgursky/davinci-resolve-mcp); [GitHub](https://github.com/hetpatel-11/Adobe_Premiere_Pro_MCP); [GitHub](https://github.com/descriptinc/descript-mcp)
- **Other agentic editors/MCPs** (none advertise reference analysis):
  - **OpenChatCut** 2,192★ (Remotion, Agent Skills, MCP; created 2026-07-15)
  - **concat** 4,257★ (Rust CapCut replacement with MCP)
  - **Nomi** 553★
  - **velorn** 500★
  - **burningion/video-editing-mcp** (Video Jungle) 292★
  - **KyaniteLabs/kinocut** 193★ (guardrailed FFmpeg/HyperFrames MCP)
  - **Cassette-Editor/oh-my-cassette** 157★
  - **Monet** 116★
  - **OpenCardboard** 58★ (created 2026-10-04)
  - **clueso-ai/skills** 27★
  - — [GitHub API search "video editing mcp"](https://github.com/FireRedTeam/FireRed-OpenStoryline)
- **Talking-head reel skills without reference input:** tenfoldmarc/video-edit-skill (8★; three built-in looks "Bold / Cool girl / Cool dude"; ffmpeg, HyperFrames, faster-whisper; optional Apify to pull reels) and similar repos (Mereyani/claude-reel-editor, nimishamundade/edit-reel, antoineblc99/reel-kit). — [tenfoldmarc/video-edit-skill](https://github.com/tenfoldmarc/video-edit-skill); [search summary](https://github.com/antoineblc99/reel-kit)

### Inferences
- The developer ecosystem has strong execution layers: ffmpeg EDLs, HyperFrames/Remotion compositions, CapCut draft JSON, NLE MCPs. The analysis layer ("watch reference → structured style spec") exists only in a handful of tiny 2026 repos. A prototype could combine video-editor-agent's evidence pipeline (scene detection + 2 fps contact sheets + Whisper + spectrogram) or ghost-editor's Gemini edit log with a HyperFrames or CapCut-draft renderer.
- Both reference-aware skills restrict themselves to single-speaker vertical talking-head footage. That suggests the tractable wedge is talking-head reels, not montage/B-roll-heavy or cinematic edits.
- The low stars of reference-aware repos versus video-use and OpenMontage (tens of thousands) show the demand is for agent editing in general. Reference copying is still an emerging niche even among developers.
- Exporting to CapCut drafts (pyJianYingDraft/VectCutAPI style) is a well-trodden path for giving creators an editable output. Relevant to an iOS app, since creators already finish in CapCut.

### Gaps
- The exact Gemini prompt, the `reel.json` schema of ghost-editor, and output quality evidence (beyond demo links) weren't retrievable; the repo has 8 commits.
- No quality evaluations exist for reference cloning in any open-source repo.
- No official Remotion "agent skills" page was retrieved in this pass; Remotion's role is confirmed only via third-party repos (OpenMontage, OpenChatCut, video-use).
- Couldn't confirm whether Sparki's "Claude Code skill" exposes Copy Style to agents.

## Q3. Academic and industry research on edit style transfer and agentic editing

### Takeaway
Research on true reference-to-raw-footage edit transfer is thin. Key items:
- Google-affiliated authors' 2021 CVPR-workshop "Automatic Non-Linear Video Editing Transfer" (framing, speed, lighting per shot).
- A Nov 2025 arXiv paper (ESA) that learns shot-assembly style from reference videos.
- Component-level work on recognizing and recommending transitions and effects (AutoTransition, Edit3K, V-Trans4Style).

LLM-agent editing work (LAVE 2024, EditDuet 2025, Timeline-Bench 2026) shows agents remain far below human editors. They perceive via still frames and transcripts, cut too slowly, under-deliver on graphics, transitions and music, and can't judge their own work. Generative "reference video editing" papers (RefVideo-6M, Kiwi-Edit, PickStyle, Aurora) are pixel or appearance style transfer, not edit-style transfer.

### Cited Findings

**Direct edit-style transfer**
- **Automatic Non-Linear Video Editing Transfer** (Frey, Chi, Yang, Essa; AI for Content Creation Workshop @ CVPR 2021; arXiv 2105.06988) "extracts video editing styles from a source video" using framing, content type, playback speed, and lighting per segment. It transfers "the visual and temporal styles from professionally edited videos to unseen raw footage". It was evaluated on real-world videos with 3,872 shots plus a user survey. — [arXiv](https://arxiv.org/abs/2105.06988)
- **ESA: Energy-Based Shot Assembly Optimization for Automatic Video Editing** (Chen et al., arXiv 2511.02505, Nov 2025) "learns the assembly style of reference videos".
  - It segments and labels reference shots (shot size, camera motion, semantics) and scores candidate sequences with energy-based models plus syntax rules.
  - Candidate shots come from an LLM script matched to a library.
  - The abstract reports no quantitative results. — [arXiv](https://arxiv.org/abs/2511.02505)
- **Write-A-Video** (Wang, Yang, Hu, Yau, Shamir; SIGGRAPH Asia 2019) builds text → shot retrieval → montage via graph optimization. "Style" is user-chosen idioms plus controls such as Extend/Reduce Shot Duration and More Movement. Novices sometimes made quality edits faster than pros. — [SIGGRAPH Asia pressroom](https://pressroom.asia.siggraph.org/blog/lights-camera-and-text-novel-video-editing-tool-for-user-friendly); [paper PDF](https://faculty.runi.ac.il/arik/site/includes/papers/WriteAVideo.pdf)
- **Learning to Cut by Watching Movies** (KAUST + Adobe Research, ICCV 2021) ranks cut plausibility, trained on >255–260K cuts from >10K videos; it beats random and baselines in human studies. — [CVF Open Access](https://openaccess.thecvf.com/content/ICCV2021/html/Pardo_Learning_To_Cut_by_Watching_Movies_ICCV_2021_paper.html)

**Recognizing and transferring editing components (transitions, effects, text animations)**
- **AutoTransition** (ECCV 2022, arXiv 2207.13479) recommends transitions. Its dataset has 104 transitions, of which only 30 were used for the recommendation task. — [Edit3K paper discussing AutoTransition](https://arxiv.org/html/2403.16048v1); [AutoTransition arXiv](https://arxiv.org/pdf/2207.13479)
- **Edit3K: Universal Representation Learning for Video Editing Components** (Gu et al., arXiv 2403.16048, Mar 2024, rev. Feb 2025) covers six component types: effects, animation, transition, filter, sticker, text.
  - Dataset: ~3,094 components rendered on 618,800 videos.
  - Key difficulty: "it is difficult to disentangle the visual appearance of editing components from raw materials", and standard encoders trained on action recognition do poorly.
  - Downstream uses: component recognition, retrieval, recommendation. — [arXiv](https://arxiv.org/html/2403.16048v1)
- **V-Trans4Style** (Guhan, Manocha et al., Univ. of Maryland and collaborators) takes ordered clips plus a named target production style and recommends transition sequences.
  - It uses a transformer encoder-decoder plus an inference-time style-conditioning module (activation maximization).
  - It introduces AutoTransition++: 6,000 videos, five production styles, >1,300 style-verified samples.
  - Results: up to 80% better transition recall/ranking, 12% higher style similarity, and a 102-participant user study.
  - Venue conflict: listed as ECCV 2024 by ECVA/mlanthology, and also appears on the NeurIPS 2025 virtual site. — [ECCV 2024](https://eccv2024.ecva.net/virtual/2024/poster/662); [NeurIPS listing](https://neurips.cc/virtual/2025/133898); [arXiv](https://arxiv.org/html/2501.07983v1)
- **VEU-Bench** (CVPR 2025, arXiv 2504.17828) tests 19 tasks from shot size to cut types and transitions (recognition, reasoning, judging). Of 11 SOTA Video LLMs, "some performed worse than random guessing". Their fine-tuned "Oscars" model beat open-source Video LLMs by >28.3% and approached GPT-4o. — [arXiv](https://arxiv.org/abs/2504.17828)

**LLM/agentic editing systems**
- **LAVE** (Univ. of Toronto, Meta Reality Labs, UCSD; ACM IUI 2024) generates language descriptions of footage, which a plan-and-execute LLM agent then edits over. Users can edit via the agent or the UI. User study: n=8. — [LAVE project](https://www.dgp.toronto.edu/~bryanw/lave/)
- **EditDuet** (Adobe Research; SIGGRAPH 2025; arXiv 2509.10761) pairs an Editor agent with a Critic agent that iterate over an NLE timeline. The authors report it "vastly outperforms" baselines on coverage, time-constraint satisfaction and human preference. A third-party summary cites 86.9% human preference for B-roll sequences, unverified. — [Adobe Research](https://research.adobe.com/publication/editduet-a-multi-agent-system-for-video-non-linear-editing); [arXiv](https://arxiv.org/html/2509.10761v1)
- **Prompt-Driven Agentic Video Editing** (arXiv 2509.16811) targets long-form story media; users reported recap pacing could be wrong and multiple tries were needed. — [arXiv](https://arxiv.org/html/2509.16811v1)
- **Timeline-Bench** (Gupta, Arora, Tankala; TensorTest/Ritivel Labs; arXiv 2609.35143, 2026-09-28) has 56 raw-footage-to-final-cut tasks, including 15 UGC portrait tasks that all require captions, color matching and reframing.
  - Scores:
    - The best agent (GPT-6 Astra in Codex CLI with curated guidance) resolved 26.8%.
    - Claude Opus 5 in Claude Code resolved 23.2%.
    - The mean across 16 agents was 14.0%.
    - Computer-use in DaVinci Resolve resolved 3.6%.
  - Human editors preferred the professional reference edit in 83.5% of 2,582 judgments. — [arXiv](https://arxiv.org/html/2609.35143v1)
  - Pacing: agents cut at 0.72× the reference cut rate and hold their longest static shot 1.5× as long. Each halving of cut rate below the reference costs 6.6 points of win-or-tie rate. Editors penalize slower but not faster pacing. — [arXiv](https://arxiv.org/html/2609.35143v1)
  - Notes favoring the reference most often cite:
    - text/graphics (29.4% of notes favoring the reference vs 8.9% citing agent problems)
    - transitions/effects (26.6% vs 6.7%)
    - shot selection (29%)
    - music choice (15.7%)
  - Perception:
    - 83% of agent reads are frames or contact sheets; audio comes via transcripts and levels.
    - 98% of perception happens before the first render.
  - Self-judgment:
    - Only 5.5% of self-reported post-render problems concern pacing, story or shot choice, vs 66% of human notes.
    - Agents claim success in 93% of runs, including 95.5% of failing edits.
  - Curated editing guidance raised resolution from 21.4% to 26.8% (within confidence intervals). — [arXiv](https://arxiv.org/html/2609.35143v1)
- **Beyond Coherence** (arXiv 2609.08275) benchmarks 13 generative models on professional editing techniques. It finds unstable shot structures, weak transition control, and sharp degradation on higher-order montage. — [arXiv](https://arxiv.org/html/2609.08275v2)
- Other 2024–2026 agentic work without reference-edit transfer: Agent-based Video Trimming (2412.09513), "Unified Agentic Video Editing Across Levels of Complexity and Creativity" (2609.12769; previews, summaries, trailers), and Aurora (2605.18748; tool-using VLM agent plus a video diffusion transformer; references are images). — [2412.09513](https://arxiv.org/html/2412.09513v1); [2609.12769](https://arxiv.org/abs/2609.12769); [Aurora](https://arxiv.org/abs/2605.18748)
- Generative "reference" editing is a different problem (appearance/pixels): RefVideo-6M (335K style-transfer pairs), Kiwi-Edit, PickStyle, AnyV2V. — [RefVideo-6M](https://arxiv.org/html/2608.26101); [Kiwi-Edit](https://arxiv.org/pdf/2603.02175); [PickStyle](https://arxiv.org/html/2510.07546v1)

### Inferences
- What research says is hard, synthesized:
  - **Perception of edits:** recognizing transitions, effects and cut types is hard; some video LLMs are below chance, and component appearance is entangled with footage.
  - **Pacing and rhythm:** agents systematically cut too slowly.
  - **Finishing:** graphics, typography, transitions, sound and color are where human edits win most.
  - **Self-evaluation:** agents can't tell when the edit is creatively bad.
  - **Footage mismatch:** a reference's shot variety can't be recreated from one static take (also conceded by invideo).
- No paper found evaluates "short-form social reference → creator's raw footage" transfer end to end. Measurable sub-targets exist, though: cut rate vs reference (Timeline-Bench), caption/graphic style, transition recognition (Edit3K/VEU). These give an app team ready-made eval metrics.
- "Measure, don't eyeball" pipelines (ffmpeg scene detection for exact cut times, Whisper word timings, BPM from audio) directly address the weak spots LLMs show in timing precision and edit recognition.

### Gaps
- No papers titled "Representing Editing Styles" or "Reframe" (as named in the brief) were found. They may not exist under those titles; no claim made.
- Google-specific "video editing agent" work beyond the 2021 transfer paper was not located in this pass.
- EditDuet quantitative figures and Timeline-Bench's beat-sync analysis weren't verified (the paper reports no beat-sync measurement).

## Q4. How tools represent "style", and shared lessons on what works and what fails

### Takeaway
Representations fall into four families:
1. Natural-language style guides (Markdown) produced by an LLM from evidence.
2. Structured timed-beat JSON (ghost-editor `reel.json`, CapCut/Jianying draft JSON, EDLs).
3. Render-code compositions (HyperFrames HTML+GSAP, Remotion React).
4. Opaque vendor presets ("save style as preset", Captions style library, CapCut templates and the new CapCut "Skills").

Shared lessons: measure timing with deterministic tools rather than relying on a VLM; restrict to footage similar to the reference; copy specific named qualities rather than "everything"; expect fonts and colors to be easier than pacing and "feel".

### Cited Findings
- **Markdown style guide + evidence:** video-editor-agent outputs `style-guide.md` (PACING, CAPTIONS, GRAPHIC LANGUAGE, B-ROLL GRAMMAR, COLOR & GRADE, SOUND DESIGN, BUILD DIRECTIVES) plus `evidence/` (cuts, cut frames, contact sheets, spectrogram, waveform, transcript). — [reel-style-clone SKILL.md](https://raw.githubusercontent.com/krusemediallc/video-editor-agent/main/.claude/skills/reel-style-clone/SKILL.md)
- **Timed beats JSON + recipes:** ghost-editor maps a Gemini 2.5 Pro second-by-second edit log onto `reel.json` beats. Named styles are "full recipes" in `recipes/`. — [HOW-IT-WORKS.md](https://github.com/kurbaitaev/ghost-editor/blob/main/docs/HOW-IT-WORKS.md); [README](https://github.com/kurbaitaev/ghost-editor)
- **EDL → ffmpeg:** video-use builds an edit decision list, renders with ffmpeg, then self-checks each cut boundary. — [video-use](https://github.com/browser-use/video-use)
- **YAML pipeline manifests + `edit_decisions`** (OpenMontage), with runtime locked to Remotion, HyperFrames or FFmpeg. — [OpenMontage](https://github.com/calesthio/OpenMontage)
- **HTML composition:** HyperFrames scenes are HTML with `data-` timing and transition attributes, CSS and GSAP. — [noqta guide](https://www.noqta.tn/en/blog/heygen-hyperframes-html-to-mp4-ai-agent-video-2026)
- **CapCut draft JSON:** cutcli-cookbook ships "JSON templates" for generating editable CapCut/Jianying drafts from agents. pyJianYingDraft and VectCutAPI generate drafts programmatically. — [cutcli-cookbook](https://github.com/xuliang2024/cutcli-cookbook); [pyJianYingDraft](https://github.com/GuanYixuan/pyJianYingDraft)
- **Workflow-as-skill:** OpenStoryline "Style Skills" save an editing workflow as an Agent Skill for reuse. CapCut has introduced a "Skills" feature to "store and share the style, techniques and workflow behind each creation" (reported Sept 10, 2026, alongside 660M+ users, 6M+ template creators, 400K+ new templates/day; company-supplied figures). — [OpenStoryline](https://github.com/FireRedTeam/FireRed-OpenStoryline); [Vietnam News](https://vietnamnews.vn/life-style/1799360/viet-nam-emerges-as-one-of-capcut-s-leading-regional-markets.html)
- **Named style categories (research):** V-Trans4Style conditions on one of five named production styles. ESA represents style via shot attributes (shot size, camera motion, semantics) scored by energy models. — [V-Trans4Style](https://arxiv.org/html/2501.07983v1); [ESA](https://arxiv.org/abs/2511.02505)
- **Lessons and failure evidence:**
  - Stanley Studio's reference matching captured colors and fonts but not the style or pacing. — [Buffer](https://buffer.com/resources/ai-video-tools/)
  - invideo says vague "make it like this" briefs underperform; name what to borrow (pacing, structure, mixed-media treatment). References with varied locations and shot sizes can't be reproduced from one static recording. — [invideo FAQ](https://invideo.io/faq/can-an-ai-editing-agent-match-the-pacing-and-style-of-a-reference-video/)
  - ghost-editor verifies the Gemini edit log against extracted frames before trusting it, implying VLM logs can be wrong. — [HOW-IT-WORKS.md](https://github.com/kurbaitaev/ghost-editor/blob/main/docs/HOW-IT-WORKS.md)
  - A Claude Code reel-editing guide found its first cut clipped words ("reels", "part") and added a transcript check to catch clipped or doubled words at cut points. — [Charlie Hills Substack](https://charliehills.substack.com/p/ai-video-editing-guide)
  - video-use adds 30 ms audio fades at every cut and self-evaluates cut boundaries (up to 3 fixes). — [video-use](https://github.com/browser-use/video-use)
  - Agents cut too slowly (0.72× reference) and lose most on graphics, transitions and music. — [Timeline-Bench](https://arxiv.org/html/2609.35143v1)
  - Creators who get better results "copy the structure" (pacing, reveal style, caption rhythm, hook format) rather than the literal template; one blogger reports, anecdotally, a 40–60% engagement drop after ~3 uses of the same template type in a week. — [NemoVideo blog](https://www.nemovideo.com/blog/capcut-new-trend-templates)

### Inferences
- A robust style spec for a mobile app likely needs to be hybrid:
  - **Deterministic measurements:** cut timestamps via scene detection, shot-length distribution per section, BPM/beat grid, caption word-chunk size and timing from OCR plus Whisper.
  - **VLM-described qualitative attributes:** font family or closest match, color/case/stroke, position, animation type, zoom/punch-in pattern, transition types, grade.
  - **Renderer:** a deterministic engine (HyperFrames/Remotion/ffmpeg, or CapCut draft export for editability).
- Font matching specifically has no dedicated solution in any tool found. Vendors and repos describe "typography" only qualitatively, so expect closest-match approximations.
- Caption style, color and fonts are easier to copy than "feel" (pacing, shot selection, energy arc), which is where both commercial tools and benchmarks show failures.

### Gaps
- No tool publishes its internal style schema in enough detail for a field-by-field comparison (Sparki, invideo, Shorty and Vyra are closed).
- No data was found on font-identification accuracy, beat-sync precision, or transition-recognition accuracy in commercial products.

## Q5. Evidence of demand

### Takeaway
Demand evidence is mostly indirect but strong in aggregate:
- CapCut's template economy (company-reported 6M+ template creators, 400K+ templates/day, Sept 2026).
- A 2026 wave of vendors explicitly marketing "copy/clone a viral edit".
- Claude/agent tutorials and repos for "copy viral reels".
- Buffer's reviewer calling reference upload "an incredible ability".

No Reddit threads, search-volume data, or viral X/TikTok posts specifically about "copy this edit with AI" could be located in this pass.

### Cited Findings
- CapCut (company figures via Vietnam News, 2026-09-10): 660M+ users, 6M+ template creators, 400K+ templates uploaded daily, plus a new "Skills" feature for sharing the style and workflow behind a creation. — [Vietnam News](https://vietnamnews.vn/life-style/1799360/viet-nam-emerges-as-one-of-capcut-s-leading-regional-markets.html)
- Templates spread on TikTok, and videos labeled with a CapCut template open directly into CapCut. — [NemoVideo](https://www.nemovideo.com/blog/capcut-new-trend-templates)
- Buffer's reviewer called Vyra's reference-video upload "an incredible ability" and flagged Descript's lack of reference input as a reason it couldn't edit "in my style". — [Buffer, 2026-07-22](https://buffer.com/resources/ai-video-tools/)
- Supply-side signal: at least nine 2025–2026 products market reference- or viral-clone features (Sparki, invideo, Shorty, Vyra, Topview, InsMind, CloneViral, RecCloud, Pollo AI), plus Pippit's "Generate videos in this style". — [Sparki](https://sparki.io/features/copy-style); [invideo](https://invideo.io/editor/style-and-motion-reference/); [Shorty](https://shortyedit.com/); [Topview](https://www.topview.ai/ai-video-clone); [Pollo AI](https://apps.apple.com/us/app/pollo-ai-ai-video-image/id6740024098)
- Creator tutorials: the YouTube video "Copy Viral AI Reels in Seconds with This Claude Workflow" (~mid-2026), Ootto's "Reel Analyzer" Claude skill, and a $10 Gumroad n8n workflow ("Paste any TikTok URL… mimicking proven high-performing formats"). — [YouTube](https://www.youtube.com/watch?v=Es-Kpx9mnMo); [Ootto skills](https://github.com/Ootto-AI/claude-content-skills); [Gumroad](https://pinkkdigital.gumroad.com/l/aicreatortoolkit)
- Broad interest in agent video editing: video-use ~28.4k★, OpenMontage ~65k★, OpenCut ~93k★ (open-source CapCut alternative). — [video-use](https://github.com/browser-use/video-use); [OpenMontage](https://github.com/calesthio/OpenMontage); [OpenCut](https://github.com/OpenCut-app/OpenCut)
- Funding signal for agentic editors: Mosaic $3.8M seed (YC W25); Cardboard in YC W26. — [Adish Jain on X](https://x.com/_adishj/status/2041562227208302748); [YC Launch](https://www.ycombinator.com/launches/PM3-cardboard-agentic-video-editor)

### Inferences
- The behavior "see a video → want my video edited like that" is already monetized at massive scale through CapCut templates. The unmet part is that templates require the creator to fit their footage into a fixed slot structure, whereas reference transfer adapts the style to arbitrary footage. CapCut's new "Skills" feature suggests ByteDance is moving toward style/workflow sharing, a potential direct threat.
- Rights framing appears across vendors ("replicates the style, not the content"; Topview avoids reusing face, music or brand). A product should copy structure and treatment, not media, especially music.

### Gaps
- No Google Trends or keyword-volume data for "copy edit style", "edit like [creator]" or "CapCut template" was retrieved.
- No Reddit (r/VideoEditing, r/NewTubers, r/CapCut) threads were surfaced by search. Demand from creators' own words remains unquantified.
- No traction (users, revenue, downloads) was found for any reference-style vendor (Sparki, Shorty, Vyra, invideo's feature specifically).
