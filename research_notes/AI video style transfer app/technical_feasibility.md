# Technical Feasibility: iOS App Where an LLM "Watches" a Reference Short-Form Video and Edits Raw Footage in That Style

Research date: 2026-10-08. Prices and model names change quickly; every price below is from the vendor page fetched on this date unless flagged. Items tagged **(not re-fetched)** are canonical docs/repos cited from prior knowledge that I did not re-open this session, so the writer should treat them as lower-confidence.

---

## 1. Video understanding: Claude vs Gemini vs OpenAI, and is a hybrid sensible?

### Takeaway
Claude still has **no native video (or audio) input** as of Oct 2026. You send sampled frames as images (up to 600 per request on 1M-context models, billed at ⌈w/28⌉×⌈h/28⌉ tokens per frame). Gemini takes video and audio natively, but its default sampling is 1 fps and its timestamps are whole-second `MM:SS`. Neither model is frame-accurate enough to find cuts in TikTok-paced edits. The sensible design is a hybrid: classical CV/DSP for frame-accurate perception, a cheap video-native model (Gemini Flash) for semantic labelling of the reference if wanted, and Claude for planning the edit and producing a schema-constrained timeline.

### Cited Findings
**Claude (Anthropic API)**
- Images go to Claude as `image` content blocks (base64, URL, or Files API `file_id`). Supported formats are JPEG, PNG, GIF and WebP. "Animations are unsupported, and only the first frame is used." The vision docs mention no video format. — [Anthropic Vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)
- Images per request: 100 for 200k-context models and 600 for all other models on the API (20 per message on claude.ai). Max 8000×8000 px per image. — [Anthropic Vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)
- If a request holds more than 20 images, a stricter per-image dimension limit applies. To stay safe, keep each dimension ≤2000 px. Requests also have a 32 MB size limit, and Anthropic recommends the Files API for many images. — [Anthropic Vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)
- Token formula: each 28×28-px patch is one visual token, so a frame costs `⌈width/28⌉ × ⌈height/28⌉` tokens. On "Claude 4.7 and later models" the high-resolution tier allows a 2576 px long edge and 4784 max tokens. Other models are capped at 1568 px / 1568 tokens. A 1920×1080 frame costs 2,691 tokens on the high-res tier. — [Anthropic Vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)
- Documented limitations: spatial/coordinate outputs are approximate, counting is approximate, and Claude may hallucinate on low-quality or very small images (<200 px). — [Anthropic Vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)
- Current Claude prices (per MTok, input/output): Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0.10/$0.50 for prompts ≤100k tokens ($0.50/$2.50 above that), Fable 5.1 $10/$50. Cache hits on Opus 5.5 and Sonnet 5.5 cost 0.05× base input. The Batch API is 50% off. Opus 5.5 fast mode costs $8/$40. — [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Opus 5.5, Sonnet 5.5 and Haiku 5.5 all have a 1M-token context and 128K max output. On Opus 5.5, thinking cannot be disabled and effort defaults to `medium`. Forced `tool_choice` returns a 400, so schema-valid output comes from `strict: true` tools or structured outputs (`output_config.format`). — Anthropic claude-api skill reference (bundled docs, model table cached 2026-10-06; live equivalent: [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview))
- Anthropic's own guidance for Fable 5.1: for complex visual inputs "including video", run the model as an agent with a container that holds the raw media and PIL/OpenCV, or give it a crop-and-zoom tool, which scales compute with image tokens. — Anthropic claude-api skill, `shared/model-migration.md` (bundled Anthropic docs)
- Tokenizer note: Claude 4.7+ models use a newer tokenizer that produces about 30% more tokens for the same text. — [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing)

**Google Gemini**
- Native video input through the File API (up to 20 GB paid / 2 GB free), Cloud Storage, inline data (<20 MB request), or public YouTube URLs (preview). With 1M-context models it handles up to 3 hours at low media resolution or 1 hour at default. — [Gemini video understanding docs](https://ai.google.dev/gemini-api/docs/video-understanding)
- Default sampling is 1 FPS. A custom `fps` can be set in the `processing` object (static mode only), and `start_offset`/`end_offset` clipping is supported. — [Gemini video understanding docs](https://ai.google.dev/gemini-api/docs/video-understanding)
- Tokens: 258 per frame at default resolution and 66 at low; audio is 32 tokens/s. That comes to about 300 tokens/s at default and about 100 tokens/s at low. — [Gemini video understanding docs](https://ai.google.dev/gemini-api/docs/video-understanding)
- Timestamps use `MM:SS` format. The docs warn that at 1 FPS "fast action sequences might lose detail" and that the model may miss "quick scene changes." The docs recommend "agentic mode" generally, and static mode for latency-sensitive clips under 5 minutes or when frame-level precision is needed. Agentic-capable models listed: Gemini 3.8 Flash, 3.7 Flash, 3.6 Flash, 3.5 Flash Lite. — [Gemini video understanding docs](https://ai.google.dev/gemini-api/docs/video-understanding)
- Prices (per 1M tokens, paid tier):
  - gemini-3.8-flash: $0.75 input (text/image/video/audio) and $3.75 output through Dec 31, 2026, **doubling to $1.50/$7.50 on Jan 1, 2027**
  - gemini-3.5-flash: $1.50/$9.00
  - gemini-3.5-flash-lite: $0.30/$2.50
  - gemini-3.1-pro-preview: $2.00/$12.00 (≤200k)
  - gemini-2.5-flash: $0.30/$2.50
  - Batch is about 50% off.
  - [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)

**OpenAI**
- Secondary source (Fora Soft, May 2026): the original GPT-5 (Aug 2025) was image-only, so video meant extracting frames yourself at about 1 fps. The same article says GPT-5.4 (Mar 2026) and GPT-5.5 (Apr 2026) added native video input, and lists GPT-5.5 at $5/$30 per MTok with a 1M context. It also says Claude's video input is "image-and-screenshot based rather than native-file." — [Fora Soft, "Closed Frontier" (2026-05-31)](https://www.forasoft.com/learn/ai-for-video-engineering/articles-ai/gemini-gpt5-claude-opus-4-closed-frontier-2026)
- **Contradiction:** an openai-node GitHub issue says the Responses API does not accept video files (mp4/webm/mov) and that the workaround is ffmpeg frame extraction. — [openai/openai-node issue #1778](https://github.com/openai/openai-node/issues/1778). I could not reach OpenAI's own docs to settle this.

### Inferences
- **None of the three is a frame-accurate cut detector.** TikTok/Reels edits often hold shots for 0.3–1.0 s. Gemini's 1 fps default and whole-second timestamps will miss or misplace cuts. Claude sees only the frames you send, so its time resolution is your sampling rate. Cut times, beat times, word times and zoom keyframes should therefore come from deterministic tools (Section 2) and be handed to the LLM as structured data. The LLM's job is to interpret "style" (caption tone, hook structure, B-roll usage, pacing intent) and to make editing decisions.
- **Claude can still do the visual style read well** if you give it a few frames per detected shot rather than a blind fps sample. A 60 s reference with about 25 shots needs about 50–75 frames at 504×896 (576 tokens each), roughly 30–45k tokens, well within limits. Label frames with timestamps and shot IDs in interleaved text ("Shot 7, t=12.40s:").
- **Hybrid is sensible and probably optimal on cost:**
  - Gemini 3.8 Flash costs about $0.013 per 60 s reference at default settings (17,400 tokens × $0.75/M) and also "hears" the audio (music vs voice, SFX).
  - Claude Sonnet 5.5 or Opus 5.5 does the planning: choosing takes, writing the timeline JSON with `strict` schemas, and reasoning over the transcript.
  - Two providers add integration and privacy-disclosure work, though. An all-Claude MVP (frames plus on-device transcription) is viable and simpler.
- OpenAI is not recommended as the primary until its video-input support is verified against first-party docs.

### Gaps
- No first-party OpenAI documentation was retrieved, so GPT-5.4/5.5 native video support and pricing remain unverified.
- I found no published benchmark of LLM accuracy on edit-analysis tasks (cut timing, transition type, zoom detection) for any vendor.
- No published output tokens-per-second figures for Opus 5.5 / Sonnet 5.5 / Gemini 3.8 Flash were found, so latency estimates in Section 7 are inferred.
- Gemini docs do not state the units for `start_offset`/`end_offset` or any sub-second timestamp precision.

---

## 2. Perception building blocks: extracting "style" deterministically

### Takeaway
Nearly every measurable style feature has a mature open-source or Apple-native extractor. Shot boundaries come from TransNetV2/AutoShot or PySceneDetect, beats from Beat This!/madmom/librosa, word timestamps from WhisperX or Apple SpeechAnalyzer, and OCR, optical flow, saliency and sound classification from Apple Vision/SoundAnalysis. Music ID comes from ShazamKit. The hard, mostly unsolved parts are typography/animation recognition, transition-type classification beyond cut vs gradual, and exact grade/LUT recovery.

### Cited Findings
**Shot boundary detection**
- TransNetV2 F1: 77.9 on ClipShots, 96.2 on BBC Planet Earth, 93.9 on RAI. — [TransNetV2 repo (fork mirroring README)](https://github.com/jebin2/TransNetV2)
- AutoShot (Kuaishou, CVPR 2023 Workshops) was built specifically for short-form video. It ships the SHOT dataset (853 videos, 11,606 shot annotations) and beats TransNetV2 by 4.2% F1 on SHOT, plus 1.1/0.9/1.2% on ClipShots/BBC/RAI over the prior SOTA. — [AutoShot paper (CVF)](https://openaccess.thecvf.com/content/CVPR2023W/NAS/html/Zhu_AutoShot_A_Short_Video_Dataset_and_State-of-the-Art_Shot_Boundary_Detection_CVPRW_2023_paper.html); [arXiv 2304.06116](https://arxiv.org/abs/2304.06116)
- PySceneDetect provides threshold-, content- (HSV delta) and adaptive-detectors and runs on CPU without a GPU. — [PySceneDetect repo](https://github.com/Breakthrough/PySceneDetect) **(not re-fetched)**

**Beat / onset / tempo**
- Beat This! (ISMIR 2024) reports higher F1 than the prior SOTA without DBN postprocessing, but it can fail on hard and underrepresented genres. — [arXiv 2407.21658](https://arxiv.org/pdf/2407.21658)
- On the hard SMC set, Beat This! raw peak-picking F scored 0.627 and a per-track-tuned madmom DBN scored 0.642. The PyPI madmom build only supports Python <3.10 / numpy <1.20, so use the CPJKU fork. — [arXiv 2605.12287 (SMC failure analysis)](https://arxiv.org/pdf/2605.12287); [Beat This! repo notes](https://gitblind.noratr.app/CPJKU/beat_this)
- BeatNet does joint beat/downbeat/tempo/meter tracking (CRNN + particle filtering) with real-time and offline modes. Its performance claims are self-reported. — [BeatNet repo](https://github.com/davies-w/BeatNet)
- librosa was best at global average tempo in one string-quartet comparison, while madmom's RNN captured rhythmic structure better. — [AI and Tempo Estimation review, arXiv 2401.00209](https://arxiv.org/pdf/2401.00209)

**Speech transcription with word timestamps**
- Apple SpeechAnalyzer/SpeechTranscriber (iOS 26 / macOS 26, WWDC25 session 277) runs on device. Word-level timing is requested through attribute options (audio time range). Some presets, such as progressive live transcription, have no timestamps. — [WWDC25 session 277](https://developer.apple.com/la/videos/play/wwdc2025/277/)
- A third-party benchmark reports SpeechAnalyzer at 2.12% WER on LibriSpeech clean, said to beat on-device Whisper variants (secondary source). — [rohitraj.tech comparison](https://rohitraj.tech/en/notes/apple-speechanalyzer-vs-whisper-on-device-stt-2026)
- A third-party Core ML project ("Align") tightens SpeechTranscriber's word timings (e.g. "world" 2.61–3.04 s → 2.57–2.98 s), which suggests stock timings are somewhat loose. These are self-reported figures. — [Align on Hugging Face](https://huggingface.co/desert-ant-labs/align)
- WhisperX adds wav2vec2 forced alignment for word-level timestamps, VAD and diarization on top of Whisper. — [WhisperX repo](https://github.com/m-bain/whisperX) **(not re-fetched)**
- Cloud STT prices (secondary sources, conflicting): Deepgram Nova-3 is about $0.0077/min ($0.46/hr) pay-as-you-go and bills per second. AssemblyAI Universal-2 async is about $0.15/hr and Universal-3.5 Pro about $0.21/hr. One source quotes Nova-3 at $0.0043/min, which another says is the older Nova-2 rate. — [convertaudiototext.com pricing 2026](https://convertaudiototext.com/blog/speech-to-text-api-pricing-2026); [costbench](https://costbench.com/compare/assemblyai-vs-deepgram)

**Apple on-device vision/audio primitives** (not re-fetched; canonical Apple docs)
- Text OCR with bounding boxes: [`VNRecognizeTextRequest` / `RecognizeTextRequest`](https://developer.apple.com/documentation/vision/vnrecognizetextrequest)
- Dense optical flow between frames (for zoom/pan/whip detection): [`VNGenerateOpticalFlowRequest`](https://developer.apple.com/documentation/vision/vngenerateopticalflowrequest)
- Attention saliency for reframing: [`VNGenerateAttentionBasedSaliencyImageRequest`](https://developer.apple.com/documentation/vision/vngenerateattentionbasedsaliencyimagerequest)
- Built-in sound classifier (hundreds of sound classes) for SFX/laughter/applause/music detection: [`SNClassifySoundRequest`](https://developer.apple.com/documentation/soundanalysis/snclassifysoundrequest)
- Music identification against the Shazam catalog: [ShazamKit](https://developer.apple.com/shazamkit/)

### Inferences
**Recommended "StyleSpec" extraction recipe** (each metric maps to a deterministic tool)
1. **Cuts and pacing.** Run TransNetV2 or AutoShot server-side, or PySceneDetect AdaptiveDetector as a cheaper/on-device-portable fallback. Output: shot list, median/mean/percentile shot length, cuts per second over time (pacing curve), and the fraction of cuts within ±1–2 frames of a beat.
2. **Beat alignment.** Run Beat This! or madmom on the reference audio for beats and downbeats, and librosa onset strength for accents. Then compute cut-to-beat offsets to tell whether the editor cuts on beat, on downbeat, or every N beats.
3. **Speech and captions.** Transcribe with word timestamps, then OCR every 2–3 frames (about 10–15 fps) to recover on-screen text. Diffing OCR text against the transcript classifies captions as verbatim (auto-captions) or editorial (hooks, labels). OCR boxes over time give position (top/center/lower-third), words per caption card, and appearance timing (word-by-word pop vs phrase). Sample OCR at ≥10 fps here, since word-by-word captions change every 150–400 ms.
4. **Typography.** Measure font size relative to frame height, stroke/outline, drop shadow, and highlight color of the "active word" with pixel stats inside OCR boxes. Then ask the LLM to *pick from a closed catalog* of pre-built caption presets using crops of caption frames. Exact font identification is unreliable (see Gaps).
5. **Zoom/punch-ins and camera motion.**
   - Optical flow divergence (radial expansion) or the scale term of a frame-to-frame similarity/affine fit (ORB + RANSAC) detects digital zooms (step jumps in scale within a shot = punch-in; smooth ramps = Ken Burns/zoom).
   - Translation spikes with motion blur suggest whip pans.
6. **Transitions.** TransNetV2 already separates hard cuts from gradual transitions. Telling a dissolve from a whip, zoom-blur, flash or glitch takes a small classifier or an LLM look at 3–5 frames around the boundary. Treat this as best-effort.
7. **Color.** Compute per-shot Lab mean/std, saturation, contrast, highlight/shadow tint and grain/vignette estimates. Apply via Reinhard-style statistical transfer or a fitted 3D LUT (Core Image `CIColorCube`, or FFmpeg `lut3d`). Recovering the creator's actual LUT is not realistic; approximating the "look" is.
8. **Audio events.** SoundAnalysis or YAMNet/PANNs-style classifiers find whooshes, risers, booms and record scratches, which are timestamps where SFX should be placed. ShazamKit identifies the music track so the user can add the same sound in TikTok/IG at upload time.
- Run the cheap, privacy-friendly parts on device: Apple Vision OCR, saliency, optical flow, SpeechAnalyzer, SoundAnalysis, ShazamKit. TransNetV2 and Beat This! are PyTorch/TensorFlow models. They can be converted to Core ML with some effort, or run on a small server only on the *reference* video (which is not the user's private footage).

### Gaps
- I found no reliable open-source font identifier for stylized social captions (outlined, animated, emoji-mixed). The commercial font-ID services I know of target static images and Latin fonts, and I did not verify any.
- I found no benchmark for transition-type classification (whip/zoom/glitch vs dissolve) on short-form video.
- Whether TransNetV2/AutoShot have maintained Core ML ports is unverified.
- Apple's exact SpeechTranscriber word-timestamp accuracy is not published by Apple.

---

## 3. Representing the edit: EDL/timeline schema, LLM output and validation

### Takeaway
Use your own compact, domain-specific JSON schema (a "StyleSpec" for the reference plus an "EditPlan" timeline) as the LLM's output contract, enforced with Claude structured outputs / `strict` tool schemas and then a deterministic semantic validator. Compile it to AVFoundation for rendering, and optionally export OTIO/FCPXML for "open in Final Cut/Resolve." Don't make the LLM write OTIO/FCPXML directly. Those formats are verbose and leave effects application-defined.

### Cited Findings
- OTIO models clips (media reference, source range, effects, markers) and transitions (type such as SMPTE dissolve, in/out offsets). A transition is an *overlap* of neighbouring clips, not a clip. OTIO leaves effect rendering to each application. — [OTIO Timeline Structure docs](https://opentimelineio.readthedocs.io/en/latest/tutorials/otio-timeline-structure.html)
- The FCPXML (Final Cut Pro X) adapter is a separate contrib plugin package (`otio-fcpx-xml-adapter`) with read/write support. The FCP7 XML adapter (`fcp_xml`) is separate. — [PyPI otio-fcpx-xml-adapter](https://pypi.org/project/otio-fcpx-xml-adapter); [PyPI otio-fcp-adapter](https://pypi.org/project/otio-fcp-adapter); [OTIO plugin docs](https://opentimelineio.readthedocs.io/en/v0.15/tutorials/otio-plugins.html)
- Claude structured outputs: `output_config: {format: {...}}` constrains the response to a JSON schema, and `strict: true` on a tool guarantees `tool_use.input` validates against the schema. Forced `tool_choice` is rejected on Opus 5.5 / Sonnet 5.5, so use `auto` + `strict` or structured outputs. — Anthropic claude-api skill (bundled docs); live doc: [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) **(not re-fetched)**

### Inferences
**Schema design**
- **"Selection over generation":** don't let the LLM invent timestamps. Give it IDs for everything grounded, and have it reference those IDs:
  - `shot_id` for raw-footage shots/takes from shot detection
  - `word_id` for transcript words with start/end
  - `beat_idx` for the beat grid
  - `caption_preset_id`, `transition_id`, `lut_id` from closed enums
  
  A deterministic compiler then converts IDs into frame-exact times. This removes most hallucination risk and makes validation trivial.
- **Suggested EditPlan shape (sketch):**
  - `{ fps, canvas: {w:1080,h:1920}, duration_target_s, music: {source:"user_track|none|reference_hint", beat_grid_ref} }`
  - `segments[]`: `{ src_clip_id, in_word_id|in_s, out_word_id|out_s, snap: "beat|downbeat|none", speed, transform: {crop_center_track:"subject|static", zoom_keyframes:[{at_rel, scale}]}, transition_in: enum }`
  - `captions[]`: `{ word_ids[], preset_id, position:"upper|center|lower", emphasis_word_ids[] }`
  - `overlays[]`: text hooks, emoji, B-roll `{ asset_id, at_s, dur_s }`
  - `sfx[]`: `{ type_enum, at_s }`
  - `color: { lut_id, intensity }`
- **Validator checks** (run after JSON Schema passes):
  - every in/out lies within the source clip duration, with `out > in`
  - segment durations ≥ a minimum frame count
  - total duration lands within ±X% of the target
  - snapped cuts sit within tolerance of the beat grid
  - caption `word_ids` exist and are in order
  - no overlapping captions in the same region
  - transitions are possible given handles (OTIO-style overlap needs media beyond the cut point)
- On failure, send the validator's error list back to Claude for a repair turn, capped at 1–2 retries, then fall back to a rules-based edit.
- Keep the EditPlan independent of any renderer. Write compilers to AVFoundation (on-device), to FFmpeg filtergraph or Remotion props (server), and to OTIO→FCPXML (pro export).
- CapCut "draft JSON" is undocumented and proprietary. Do not target it (see Gaps).

### Gaps
- CapCut draft format: I found no official documentation. My understanding (unverified) is that recent CapCut desktop versions encrypt `draft_content.json`, so treating it as an interchange format is risky.
- I found no public benchmark of LLM reliability at emitting long timeline JSON. Measure this in an eval.

---

## 4. Matching raw footage to the style

### Takeaway
"Matching" is mostly deterministic signal processing plus LLM judgment on content:
- Pick takes using transcript similarity and quality scores.
- Remove silences with VAD/word gaps.
- Snap cuts to the beat grid at the reference's measured cut-per-beat ratio.
- Render captions word-by-word in the closest preset.
- Reframe to 9:16 by tracking saliency, faces or bodies.

The LLM decides narrative order, the hook, which takes are "best," where B-roll or punch-ins go, and caption emphasis.

### Cited Findings
- Apple Vision provides saliency, human/face detection, optical flow and OCR on device (see Section 2 citations). — [Apple Vision framework](https://developer.apple.com/documentation/vision) **(not re-fetched)**
- Word-level timestamps are available on device via SpeechTranscriber (WWDC25 session 277) or server-side via WhisperX forced alignment. — [WWDC25 session 277](https://developer.apple.com/la/videos/play/wwdc2025/277/); [WhisperX](https://github.com/m-bain/whisperX) **(not re-fetched)**
- Beat grids come from Beat This!/madmom/BeatNet (see Section 2). — [arXiv 2407.21658](https://arxiv.org/pdf/2407.21658)

### Inferences
**Pipeline for raw footage (on device where possible)**
1. Import clips from Photos via PHPicker and keep originals untouched.
2. For each clip:
   - Transcribe with word timestamps.
   - Run VAD, i.e. silence gaps > ~250–400 ms between words, for jump-cut "dead air" removal.
   - Detect shots inside long clips.
   - Score quality: blur via Laplacian variance, exposure, face present/eyes open, camera shake from flow magnitude, and audio loudness/clipping.
   - Make a low-res keyframe strip of about 1 frame/2 s at 360×640, which costs 299 tokens per frame for Claude.
3. **Best-take selection.** Group repeated lines by fuzzy-matching transcript n-grams across takes (people often re-record a line), then choose with quality scores. The LLM breaks ties and picks the strongest hook.
4. **Beat alignment.** If the user adds music, snap each cut to the nearest beat (or downbeat) within ±1/2 beat. Trim or extend the in/out by moving into the silence handles. For talking-head content without music, match the reference's *cuts-per-second* distribution instead of beats.
5. **Auto-captions in matched style.** Map the reference's measured caption properties (words per card, position, active-word highlight, case, outline) to the nearest preset and render from word timestamps.
6. **B-roll.** The LLM picks B-roll moments from transcript nouns and verbs, chosen from the user's own non-speech clips (classified via Vision). Stock B-roll via an API such as Pexels/Pixabay is possible but adds licensing review (not researched here).
7. **Reframing to 9:16.** Per shot, compute a crop window following face/body boxes or the saliency centroid. Smooth it with a low-pass/one-euro filter and cap crop velocity to avoid jitter. Lock it static when the subject is stable. Google's open-source AutoFlip (MediaPipe) implemented this approach. — [MediaPipe repo](https://github.com/google/mediapipe) **(not re-fetched; AutoFlip status unverified)**
8. **Punch-ins.** Reproduce the reference's punch-in frequency, e.g. a 1.1–1.3× scale step every N seconds or on emphasis words chosen by the LLM. This is cheap to render and is a large part of the "TikTok talking-head style."

### Gaps
- I found no benchmark for automated "best take" selection quality.
- I did not verify the current maintenance status of MediaPipe AutoFlip.

---

## 5. Rendering: on-device iOS vs server-side; JSON-timeline SDKs/APIs

### Takeaway
For an MVP, render **on device with AVFoundation**. It's free, private, avoids uploading 4K files, and the hardware encoders are fast. The cost is building a mini-compositor: Core Image/Metal transforms, LUTs, caption animation. Server renderers (FFmpeg, Remotion Lambda, Shotstack/Creatomate) are quicker to iterate on but force large uploads, privacy disclosures and per-minute fees. Commercial iOS SDKs (IMG.LY CE.SDK, Banuba) can shortcut the editor UI, but none was confirmed to render an arbitrary JSON timeline headlessly on iOS.

### Cited Findings
- Remotion Lambda costs about $0.01 per minute of video (ARM64, 2048 MB, warm, us-east-1, excluding S3/egress). Its cost-example page shows $0.021 for a 1-min 720p video loaded from S3 and $0.162 for a 10-min 720p remote video. Embedding video in a composition "raises the price significantly." Remotion is free for individuals and small businesses, and larger companies need a paid license. — [Remotion Lambda docs](https://www.remotion.dev/docs/lambda); [Remotion cost example](https://remotion.dev/docs/lambda/cost-example)
- Shotstack, per secondary sources: 1 credit = 1 rendered minute; about $0.40/min on small PAYG packs, $0.195/min on a $39/200-credit plan, falling toward about $0.07/min at volume. Sources conflict on whether resolution affects price. — [Wireflow Shotstack pricing](https://www.wireflow.ai/blog/shotstack-pricing); [Shotstack vs Creatomate (vendor)](https://shotstack.io/vs/creatomate-alternatives/)
- Creatomate (vendor blog): $41 for 144 min at 720p ($0.28/min), $99 for 723 min ($0.14/min), down to about $0.06/min at higher tiers. — [Creatomate blog](https://creatomate.com/blog/the-best-video-generation-apis)
- IMG.LY CE.SDK has a headless CreativeEngine (JS) and a server-side "Renderer," and IMG.LY markets client-side (device GPU) or server-side (Node.js) rendering. A competitor (Banuba) says the engine spans iOS and a Node renderer, licensed per platform. No iOS JSON-scene headless-render recipe was found. — [IMG.LY CE.SDK API guide](https://img.ly/docs/cesdk/guides/api); [Banuba iOS SDK comparison](https://www.banuba.com/blog/best-ios-video-editor-sdks)
- On-device building blocks: `AVMutableComposition` (multi-track assembly), `AVMutableVideoComposition` with custom compositors (Core Image/Metal per-frame effects), `CIColorCube` (3D LUT), `AVVideoCompositionCoreAnimationTool` (Core Animation text overlays), and `AVAssetWriter`/`AVAssetExportSession` with VideoToolbox hardware HEVC/H.264 encoding. — [AVMutableComposition](https://developer.apple.com/documentation/avfoundation/avmutablecomposition); [CIColorCube](https://developer.apple.com/documentation/coreimage/cicolorcube) **(not re-fetched)**
- FFmpeg filters for a server path: trim/concat, `xfade` transitions, `zoompan`, `lut3d`, `subtitles`/ASS for styled captions. — [FFmpeg filters docs](https://ffmpeg.org/ffmpeg-filters.html) **(not re-fetched)**

### Inferences
**Trade-off matrix**

| Dimension | On-device AVFoundation | Server (FFmpeg / Remotion / Shotstack) |
|---|---|---|
| Upload | None, or low-res proxies only | Full-res originals. 4K30 HEVC is roughly 170 MB/min and 4K60 roughly 400 MB/min (iOS camera-settings figures, not re-verified), so 5 min of 4K means about 0.85–2 GB per edit |
| Marginal render cost | $0 | ~$0.01–0.02/min (Remotion, more with embedded video) to ~$0.07–0.40/min (Shotstack/Creatomate), plus storage/egress |
| Privacy / App Review | Footage never leaves the device. Simplest privacy label | Must disclose upload and third-party processing, plus data retention |
| Dev effort | High: build compositor, caption animation, transitions | Lower for Remotion (React/CSS animations) or Shotstack (JSON); FFmpeg filtergraphs are brittle |
| Visual fidelity of "TikTok" animations | Need to hand-build each caption/transition preset in Core Animation/Metal | Remotion makes animated captions easy (web tech) |
| Speed | Hardware encode is typically faster than real time on recent iPhones (not benchmarked here); export can be interrupted if backgrounded | Upload-bound for large files; render parallelizes on Lambda |

- **Recommended:** on-device render with a small fixed library of presets (about 10 caption styles, 6–8 transitions, punch-in, about 10 LUTs, Ken Burns, speed ramps). Each preset is implemented once in Swift and Metal. The EditPlan only references preset IDs.
- **Preview** can use `AVPlayer` with the same `AVVideoComposition` in real time before export, which the server path can't offer without a round-trip.
- **IMG.LY or Banuba** can save months on the editing UI (timeline scrubbing, manual tweaks). Licensing is quote-based and per platform, though, and programmatic population of video scenes on iOS must be verified with the vendor before committing.
- **Remotion fallback:** if animation fidelity on device becomes a bottleneck, a hybrid server render of *overlay-only* layers (captions/graphics as transparent ProRes 4444/HEVC-alpha) that the device composites over the full-res footage keeps uploads small. This is my design suggestion and not validated.

### Gaps
- IMG.LY CE.SDK iOS: no confirmation found that a JSON scene can be loaded and video-exported headlessly on iOS; check with the vendor. Pricing is not public.
- Banuba, VEED API and JSON2Video were not researched in detail (no fetched sources).
- No first-party benchmark of iPhone export speed for 1080p/4K compositions with Core Image filters.
- iOS background-execution rules for long exports (e.g. any iOS 26 continued-processing task API) were not verified.

---

## 6. Getting the reference video in

### Takeaway
Have the user bring the reference as a **file**: TikTok/IG "Save video" to the camera roll, a screen recording, or a share-sheet export, imported through PHPicker or a Share Extension. A paste-a-link downloader breaks platform ToS and is a known App Store rejection path under Guideline 5.2.3. Watermarks, end cards and recompression in saved files have to be handled in perception.

### Cited Findings
- App Store Review Guideline 5.2.3: apps should not "include the ability to save, convert, or download media from third-party sources (e.g. Apple Music, YouTube, SoundCloud, Vimeo, etc.) without explicit authorization from those sources." — quoted in [Apple Developer Forums thread 765340](https://developer.apple.com/forums/thread/765340)
- A TikTok downloader app was rejected under 5.2.3. In another case the developer pointed to existing TikTok downloaders still in the store and was still rejected (5.0 + 5.2.3). Apple's forum reply says other apps passing review is not a defense. — [Apple Developer Forums 704584](https://developer.apple.com/forums/thread/704584); [Apple Developer Forums 715102](https://developer.apple.com/forums/thread/715102)
- A Facebook-video-saving feature was rejected even after the developer submitted Facebook developer approval documents. — [Apple Developer Forums 67456](https://developer.apple.com/forums/thread/67456?page=2)
- TikTok saved-video characteristics (vendor/SEO sources only, low confidence): most videos are served at 1080×1920 or 720×1280, mostly H.264 in MP4 with some HEVC. One vendor claims in-app saves burn in a moving watermark and recompress. — [TechBullion downloader guide](https://techbullion.com/mastering-the-tiktok-downloader-no-watermark-the-2025-tech-guide/); [Usama.dev](https://connect.usama.dev/blogs/43677/Best-TikTok-HD-Downloaders-2025)

### Inferences
**Implications of saved files**
- **Watermark/username overlay.** OCR will pick up the TikTok logo and @handle as "on-screen text." Mask known watermark regions, or drop OCR text that matches `@\w+` and "TikTok"/"Instagram" tokens or persists across shots while moving to fixed corners.
- **End card.** If the saved file has an appended branded outro (my understanding of TikTok's saved-video behaviour; unverified), detect and trim it so it doesn't count as a shot or skew pacing stats.
- **Compression.** Heavy recompression lowers OCR accuracy on small captions and can create spurious low-confidence shot boundaries from blocking. Use a slightly higher detection threshold and require a minimum shot length of 3–4 frames. Grade estimation on recompressed 8-bit video is approximate anyway.
- **Screen recordings** may include status bar and UI chrome (like/comment rail, caption text, progress bar). Auto-crop by detecting static UI regions, i.e. pixels unchanged across the whole video. They also carry device-mixed audio and may be at the device's screen resolution rather than 9:16 1080p.

**Link input**
- A pasted link can safely be used only for metadata, e.g. a public embed/oEmbed thumbnail and caption, without fetching the media file. My understanding is that TikTok offers an embed/oEmbed endpoint (unverified this session). Server-side scraping of the MP4 creates ToS exposure and invites 5.2.3 rejection.
- **Product implication:** pre-analyse a curated library of popular "style templates" (references the team has rights to, or that are described rather than stored). This sidesteps per-user downloads and lets analysis cost be amortised (see Section 7).

### Gaps
- No first-party TikTok/Instagram documentation on saved-video bitrate, watermark behaviour or end cards was found.
- TikTok's current developer ToS and embed API terms were not fetched.
- Apple's November 2025 guideline update on disclosing data sharing with third-party AI (my recollection: apps must disclose and get explicit permission before sharing personal data with third-party AI) was **not verified this session** and should be checked against the current App Review Guidelines.

---

## 7. Cost and latency per edit (with math)

### Takeaway
For a typical job (60 s reference, about 5 min of raw footage, 30–60 s output), the recommended hybrid costs about **$0.30 per edit** with Claude Sonnet 5.5 planning and about **$0.60** with Opus 5.5. An all-Claude pipeline costs about **$0.52 (Sonnet) to $1.04 (Opus)**. A Haiku-class budget path is a few cents. Rendering on device adds $0. Server rendering adds about $0.01–0.40 per output minute, plus upload/storage. Estimated end-to-end latency is about 1–3 minutes, dominated by LLM output tokens and on-device analysis. That figure is inferred, not measured.

### Cited Findings (price inputs)
- Claude per-MTok input/output: Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0.10/$0.50 (≤100k-token prompts). Cache read 0.05× on Opus/Sonnet 5.5. Batch 50% off. — [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Claude image tokens = ⌈w/28⌉×⌈h/28⌉. — [Anthropic Vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)
- Gemini video is about 258 tokens/frame at default (66 at low) plus 32 tokens/s of audio. gemini-3.8-flash costs $0.75 in / $3.75 out per MTok through 2026-12-31, then $1.50/$7.50. gemini-3.1-pro-preview costs $2/$12. — [Gemini video docs](https://ai.google.dev/gemini-api/docs/video-understanding); [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- STT: AssemblyAI Universal-2 about $0.15/hr; Deepgram Nova-3 about $0.0077/min (secondary sources). Apple SpeechAnalyzer is on device. — [convertaudiototext.com](https://convertaudiototext.com/blog/speech-to-text-api-pricing-2026); [WWDC25 277](https://developer.apple.com/la/videos/play/wwdc2025/277/)
- Remotion Lambda about $0.01–0.02/min HD. Shotstack about $0.07–0.40/min. Creatomate about $0.06–0.28/min. — [Remotion cost example](https://remotion.dev/docs/lambda/cost-example); [Wireflow](https://www.wireflow.ai/blog/shotstack-pricing); [Creatomate blog](https://creatomate.com/blog/the-best-video-generation-apis)

### Inferences (math; token counts computed from the documented formulas)

**Per-frame Claude token cost (9:16 frames)**

| Frame size | Tokens/frame | 60 s @1 fps (60 frames) | 60 s @2 fps (120 frames) |
|---|---|---|---|
| 360×640 | 13×23 = 299 | 17,940 | 35,880 |
| 504×896 | 18×32 = 576 | 34,560 | 69,120 |
| 720×1280 | 26×46 = 1,196 | 71,760 | 143,520 |
| 1080×1920 (high-res tier) | 39×69 = 2,691 | 161,460 | 322,920 |

Image-input cost only, for 60 s at 2 fps:

| Frame size | Opus 5.5 | Sonnet 5.5 | Haiku 5.5 |
|---|---|---|---|
| 504×896 | 69,120 × $4/M = **$0.28** | **$0.14** | **$0.007** |
| 720×1280 | **$0.57** | **$0.29** | — |
| 1080×1920 | **$1.29** | **$0.65** | — |

Sending full-res frames is the main avoidable cost. 504×896 (or lower) is enough for style reading, with crops for caption close-ups.

**Gemini native video, 60 s reference**

| Setting | Tokens | gemini-3.8-flash (2026 / from 2027) | gemini-3.1-pro-preview |
|---|---|---|---|
| Default (1 fps + audio) | (258+32)×60 = 17,400 | $0.013 / $0.026 | $0.035 |
| fps = 2 | (516+32)×60 = 32,880 | $0.025 | — |
| Low resolution | (66+32)×60 = 5,880 | $0.004 | — |

Plus about 4k output tokens: $0.015 on 3.8 Flash, $0.048 on 3.1 Pro.

**Assumptions for the planning call** (Claude; 5 min raw footage)
- Raw keyframes: 150 frames (1 per 2 s) at 360×640 → 150×299 = 44,850 tokens.
- Text (StyleSpec JSON, transcripts with word IDs, shot/quality tables, system prompt) about 15,000 tokens, for a total input ≈ 59,850 tokens.
- Output (thinking + EditPlan JSON) about 16,000 tokens.

**Scenario totals per edit**

| Pipeline | Reference analysis | Planning | STT | Render | **Total** |
|---|---|---|---|---|---|
| **A. Recommended hybrid** — on-device CV/STT, Gemini 3.8 Flash reference pass, Claude Sonnet 5.5 plan, on-device render | ~$0.03 | $0.28 | $0 | $0 | **≈ $0.31** |
| A with Opus 5.5 planning | ~$0.03 | $0.56 | $0 | $0 | **≈ $0.59** |
| **B. All-Claude**, Sonnet 5.5 (reference 79,120 in [69,120 image + 10k text] + 8k out) | $0.24 | $0.28 | $0 | $0 | **≈ $0.52** |
| B. All-Claude, Opus 5.5 | $0.48 | $0.56 | $0 | $0 | **≈ $1.04** |
| **C. Budget**, Haiku 5.5 throughout (quality unverified) | $0.012 | $0.014 | $0 | $0 | **≈ $0.03** |
| **D. Server-heavy** = A + cloud STT + server render, 1 min output | ~$0.03 | $0.28 | $0.015–0.05 (6 min audio: AssemblyAI $0.015, Deepgram $0.046) | ~$0.02 (Remotion) to $0.07–0.40 (Shotstack/Creatomate) | **≈ $0.35–0.75**, plus S3 storage/egress for 0.1–2 GB uploads |

Planning-call arithmetic:
- Opus 5.5: 59,850×$4/M + 16,000×$20/M = $0.24 + $0.32 = **$0.56**
- Sonnet 5.5: $0.12 + $0.16 = **$0.28**
- Haiku 5.5: $0.006 + $0.008 = **$0.014**

All-Claude reference-call arithmetic (B):
- Sonnet 5.5: 79,120 × $2/M + 8,000 × $10/M = $0.16 + $0.08 = $0.24
- Opus 5.5: 79,120 × $4/M + 8,000 × $20/M = $0.32 + $0.16 = $0.48

**Cost levers**
- **Repair retries.** Budget about +10–20% for validation repair turns.
- **Template reuse.** Cache StyleSpecs per reference. Popular trending references get reused across many users, so reference analysis becomes near-zero marginal cost. The StyleSpec is text, so reuse across users needs only a DB lookup, not prompt caching.
- **Prompt caching** of a large static system prompt (schema, preset catalog, few-shot EditPlans) cuts input cost to 5% on cache hits for Opus/Sonnet 5.5 and reduces time-to-first-token.
- **Effort** `low`/`medium` cuts thinking tokens, which are billed as output and dominate planning cost.
- **Batch API** (50% off) doesn't fit interactive edits. It could serve an "edit overnight" mode or bulk template pre-analysis.

**Latency budget (estimated; no vendor throughput numbers verified)**

| Step | Estimate |
|---|---|
| Import + on-device analysis: SpeechAnalyzer on 5 min audio, Vision OCR/flow on the reference, keyframe extraction | ~10–40 s; parallelizable, can start while the user is choosing clips |
| Reference upload (5–20 MB) + Gemini Flash static-mode analysis | ~10–30 s; skip entirely for cached templates |
| Claude planning, ~16k output tokens | the dominant term; ~1–3+ min at an assumed 60–150 tok/s. Trim with lower effort, compact JSON (IDs, not prose), or Opus 5.5 fast mode (up to 2.5× output speed at 2× price) |
| On-device export, 30–60 s 1080p | estimated 5–30 s on recent iPhones |
| **Realistic total** | **~1–3 min.** Stream progress UI. Show a rough "assembly cut" preview from deterministic rules within seconds while the LLM refines |

### Gaps
- No measured tokens/sec for Opus 5.5, Sonnet 5.5 or Gemini 3.8 Flash. Latency numbers above are estimates to validate with a prototype.
- Thinking-token volume per planning call is an assumption (it varies with effort level). Measure with `usage.output_tokens`.
- Whether Haiku 5.5 is good enough at visual style reading is unknown and needs an eval.
- STT prices are from secondary sources that conflict. Verify on the Deepgram/AssemblyAI pricing pages.

---

## 8. What can't be replicated well, and graceful degradation

### Takeaway
The app can reliably reproduce **structure and rhythm**: cut pacing, beat sync, jump-cut silence removal, punch-ins, caption *layout and timing*, approximate color look, and SFX placement. It **cannot** faithfully reproduce licensed music and trending sounds, proprietary fonts, bespoke motion graphics, masking/rotoscoping, complex VFX, or content-dependent creativity. Design the product around a closed preset library, and tell users "closest match" rather than promising cloning.

### Cited Findings
- Claude's documented vision limitations (approximate spatial reasoning and counting, trouble with small or low-quality images) limit precise extraction of graphic-element positions and small text. — [Anthropic Vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)
- Gemini's 1 fps default can miss fast action and quick scene changes, so rapid VFX and flash transitions are under-sampled. — [Gemini video understanding docs](https://ai.google.dev/gemini-api/docs/video-understanding)
- Guideline 5.2.3 restricts downloading media from third-party services without authorization, which also covers pulling trending audio out of a reference. — [Apple Developer Forums 765340](https://developer.apple.com/forums/thread/765340)
- ShazamKit identifies music against the Shazam catalog. Identification does not grant a license. — [ShazamKit](https://developer.apple.com/shazamkit/) **(not re-fetched)**

### Inferences
| Element | Feasibility | Degrade gracefully by |
|---|---|---|
| Cut pacing, rhythm, shot-length distribution | High | n/a; core feature |
| Beat-synced cuts | High *if* the user supplies music | Without music, match cut cadence. Suggest the user add the identified trending sound in TikTok/IG at post time, and export a "beat-synced to [song], add the sound when posting" version timed to the original track's beat grid |
| Licensed music / trending sounds | Not shippable (rights) | Identify with ShazamKit and deep-link/instruct. Offer royalty-free tracks with similar tempo/energy. Never extract the audio from the reference |
| Caption style (position, word-by-word, highlight color, case, outline) | Medium-high via presets | Closest preset plus color sampling. Note "font approximated" |
| Exact fonts | Low | Map to a curated set of OFL/Google Fonts lookalikes |
| Custom motion graphics, animated stickers, 3D text | Low | Substitute generic animated text/emoji presets, or skip and flag "custom graphic at 0:04 not reproduced" |
| Masking, rotoscope, green-screen, object removal, clone effects | Very low for MVP | Detect and skip. Person segmentation via Vision could support a simple "background swap" later |
| Complex transitions (whip, zoom-blur, glitch, match cuts) | Medium for a fixed set; match cuts low | Classify into the nearest of 6–8 built-in transitions, else hard cut |
| Color grade | Medium (approximate look) | Statistical color transfer or nearest LUT from a library, with an intensity slider |
| Speed ramps | Medium | Detect via frame-difference/flow rate. Implement with `AVMutableComposition` time scaling (no optical-flow interpolation in MVP) |
| Content-dependent creativity (jokes, reaction inserts, meme cutaways) | Low | The LLM can propose text hooks and B-roll from the user's own footage. Accept "inspired by," not "identical" |
| Reference shot on different content (dance vs talking head) | n/a | Detect a content-type mismatch and warn. Transfer only content-agnostic attributes (pacing, captions, color) |

- **UX principle:** show a "style match report" listing what was matched and what was approximated or skipped, and expose every decision as an editable preset. That builds trust and keeps App Review happy (no misleading claims).

### Gaps
- No user research found on how closely users expect the output to match. This is a product question for another workstream.

---

## 9. Recommended MVP architecture (synthesis)

### Takeaway
Ship an **on-device-first** pipeline: perception and render on device, with only compact feature JSON and low-res keyframes sent to the cloud. Use **Claude (Sonnet 5.5 by default, Opus 5.5 as a "pro" tier) for planning against a strict EditPlan schema**, optionally with **Gemini 3.8 Flash** as a cheap native-video perception pass on the reference. Validate deterministically, compile to AVFoundation, and cache StyleSpecs per reference. Expect about $0.30–0.60 in model cost per edit and about 1–3 minutes of latency.

### Cited Findings
- Claude: frames as images (up to 600 per request), ⌈w/28⌉×⌈h/28⌉ tokens, no native video. — [Anthropic Vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)
- Gemini: native video + audio, about 300 tokens/s default, 1 fps default, `MM:SS` timestamps. — [Gemini video docs](https://ai.google.dev/gemini-api/docs/video-understanding)
- Prices as above. — [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing); [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Guideline 5.2.3 downloader risk. — [Apple Developer Forums 765340](https://developer.apple.com/forums/thread/765340)

### Inferences
**Pipeline**
1. **Ingest (iOS).** PHPicker/Share Extension for the reference file plus raw clips. No link downloading.
2. **On-device perception (Swift):**
   - SpeechAnalyzer word timestamps
   - Vision OCR at about 10 fps on the reference
   - Vision saliency/face/body for reframing
   - Optical flow for zoom/motion
   - SoundAnalysis for SFX
   - ShazamKit for music ID
   - Shot detection (PySceneDetect-style content diff ported to Swift/Metal for MVP, or a Core ML-converted TransNetV2 later)
   - Beat tracking (port librosa-style onset/beat tracking or a converted Beat This!/BeatNet model)
   - Quality scores per clip
3. **Thin backend (server proxy, never ship API keys in the app):**
   - (a) Optionally upload the *reference only* (5–20 MB) to Gemini 3.8 Flash for a semantic StyleSpec pass. Alternatively, send per-shot reference frames to Claude.
   - (b) Claude planning call: StyleSpec + raw-footage index (IDs, transcript, scores, 360×640 keyframes) → EditPlan via `strict` tool / structured output.
   - (c) Validate → repair loop (≤2 retries) → return EditPlan.
   - (d) Cache StyleSpec by reference perceptual hash.
4. **Compile and render (iOS).** EditPlan → AVMutableComposition + custom compositor (Core Image/Metal) + Core Animation captions → real-time AVPlayer preview → AVAssetWriter/VideoToolbox HEVC/H.264 export.
5. **Editing UI.** Every LLM decision maps to editable presets. A "regenerate" button re-runs only the planning call, using cached features and a cached prompt prefix.
6. **Pro export (later).** EditPlan → OTIO → FCPXML via the contrib adapter.

**Why this shape**
- Minimal upload and best privacy story. Footage stays on device except low-res keyframes, which can also be made opt-in.
- LLM cost is bounded by sending features rather than raw video.
- Frame accuracy comes from deterministic tools.
- The LLM handles judgment.
- No per-minute render bill.

**Build order for a solo/small team (rough)**
1. Deterministic "assembly editor": silence removal + captions + 9:16 reframe + beat snap. This is valuable even without an LLM.
2. Reference StyleSpec extraction for pacing, captions and punch-ins.
3. Claude planning with schema + validator.
4. Preset library growth (transitions/LUTs/caption styles).
5. Optional Gemini perception pass and pro export.

**Risks to flag**
- App Review §5.2.3 (no downloaders) and third-party-AI data-sharing disclosure requirements (verify current guideline text).
- The Gemini 3.8 Flash price doubles on 2027-01-01.
- OpenAI video capabilities are unverified.
- Font/music licensing.
- Planning-call latency.
- Building a robust on-device compositor is the largest engineering cost.

### Gaps
- No prototype measurements: accuracy of LLM style extraction, real latency, and real iPhone export speed all need a spike.
- Competitor implementations (e.g. CapCut templates and other "AI edit like this video" apps) are outside this note's scope and covered by another researcher.
