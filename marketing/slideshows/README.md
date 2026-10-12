# TikTok slideshows

TikTok photo-mode slideshows for DuoQueue's TikTok. Batch 1 (3 Oct 2026) is ten slideshows of
gaming tips: no app screens anywhere, 01 to 06 end with one text-only DuoQueue slide, 07 to 10
never mention the app.

Each slide is an HTML page in the Volt look (Manrope + IBM Plex Mono, off-black, chartreuse),
rendered to a 1080x1920 PNG by headless Chrome. No npm packages: Node talks to Chrome over the
DevTools protocol with its built-in WebSocket.

## Run it

```
node render.mjs                  # all slideshows in slideshows.json
node render.mjs 03 07            # only these
node render.mjs --out <dir>      # a test render somewhere else
node render.mjs --data <file>    # another batch file
node verify.mjs                  # re-check the output folder on disk (no rendering)
node backgrounds.mjs             # build the photo backgrounds (render.mjs does this when one is missing)
node backgrounds.mjs --force     # rebuild them all
node backgrounds.mjs --force v06-w1-exasperated-head-back   # rebuild only the keys named
```

`HOW TO POST.txt`, `sources.txt` and `posting-log.csv` are only rewritten on a full run, and
`cache/report.json` (which `verify.mjs` reads) only holds the slides of the last run, so finish
with a full `node render.mjs` before `node verify.mjs`.

Output goes to `C:\Users\stall\Videos\UGC\Ready to post\Slideshows\`:

- `NN - <Title>\01.png ... NN.png`: the slides, in posting order
- `NN - <Title>\caption.txt`: TikTok title and description, what to switch on before posting
  (01 to 06: Disclose commercial content, then Your brand), and each slide's background and source
- `NN - <Title>\contact-sheet.jpg`: the whole slideshow on one image
- `HOW TO POST.txt`, `sources.txt`, `posting-log.csv` (a full run only; the log is never
  overwritten once it has your numbers in it, a fresh copy goes to `posting-log.new.csv`)

Needs Node 22 or newer, Google Chrome (or set `CHROME_PATH`), and for the backgrounds an ffmpeg
build with libplacebo (the gyan.dev full build has it).

## Instagram: swipe posts and reels

```
node instagram.mjs               # both shapes, all ten, into Videos\UGC\Ready to post
node instagram.mjs swipe 07 09   # one shape, only these
```

Two shapes, because Cameron posts both (12 Oct 2026, testing which reaches more people):

- **swipe** (`Instagram swipe posts`): 1080x1440 (3:4), photos people swipe through with a song
  added in the app. 3:4 is the tallest a feed photo can be. Each slide is captured as a 3:4 window,
  x 0..1000 by y 198..1531, at device scale 1.08; all text sits in x 72..924, y 231..1491, so it
  lands centred, and a slide whose text would fall within 20 px of the crop edge fails.
- **reel** (`Instagram reels`): 1080x1920 (9:16), turned into a Reel with music. A 3:4 photo in a
  Reel is zoomed to fill the screen and cut off at the sides, so Reels get the full slide, on the
  same layout and safe zone as the TikTok ones.

07 to 10 gain a closing DuoQueue slide (`ADDED_CTA`, cta layout), since Instagram has no
account test to protect, which makes 09 and 10 nine slides (`lintShow` takes `maxSlides`).
Captions put the title first (Instagram has no title field) and add the Riot line and #duoqueue.

## What the run checks

The copy is checked before anything renders (`lib/lint.mjs`). The run stops on:

- an em dash, en dash or any other dash character (plain hyphens are fine)
- a word that reads as a dating or meeting app (match, matchmaking, swipe, date, partner, meet,
  ...), a promise like "guaranteed", or any other word on the `BANNED` list in `lib/lint.mjs`
- the same run of 7 words in two different slideshows (headlines, bodies and rails, checked across
  the whole batch even on a partial run): posting one a day, followers would see the same finding
  twice in a week
- `openerInHead` on a hook whose headline doesn't start with its opener
- a Riot hashtag (#leagueoflegends, #lol, #riot, ...)
- DuoQueue spelled any other way
- an app mention anywhere in a slideshow with `"appCta": false`, or anywhere but the last slide in
  one with `"appCta": true`
- a tip slide with no `source` and no `take`
- a title over TikTok's 90 characters, or fewer than 5 or more than 8 slides

Then every rendered slide is checked in the page itself, and a slide that fails is NOT written to
the output (it goes to `cache/failed/`):

- the PNG is exactly 1080x1920 (read back from disk too)
- every line of text, measured by Chrome, is inside x 60 to 940 and y 200 to 1500. TikTok's
  buttons cover the right column and its caption covers the bottom.
- no text box overflows (the type shrinks to fit, down to 0.6x, then it fails)
- no two text blocks overlap
- no ghost number's digits come within 24 px of a text line (the digits are measured from the
  font's real glyph bounds; the run prints the smallest gap as "ghost gap")
- headlines are at least 56 px and body text at least 32 px
- every glyph is drawn with the bundled fonts (no system font fallback)
- contrast: the page is screenshotted again with the text hidden, and each line's text colour is
  compared with the pixels it sits on. Under 3:1 fails, under 4.5:1 warns.

`cache/report.json` has the numbers for every slide.

## Editing slideshows.json

A slideshow has `id` (two digits), `title`, `topic`, `hookType`, `opener`, `appCta`, `caption`
(the TikTok description), `sources` (full citations) and `slides`. `postOrder` sets the order in
HOW TO POST.txt and posting-log.csv.

A slide has a `role` (`hook`, `tip`, `cta`, `closer`), a `layout`, and text fields:

| layout | look | fields |
| --- | --- | --- |
| `hook-photo` | Cameron's frame or photo, opener chip, big headline over a dark fade | `bg`, `opener`, `head`, `mark`, `zone` |
| `tip-photo` | photo with a dark text panel at the bottom | `bg`, `kicker`, `head`, `body`, `source`, `take`, `zone` |
| `card` | T2: tip card on the seam grid, ghost number from a numbered kicker ("2 OF 6", "RANK #3"); with no number the card shrinks to its text and sits centred | `kicker`, `head`, `body`, `source`, `take` |
| `paper` | T3: light paper, highlighted word in olive | `chip`, `kicker`, `head`, `mark`, `body`, `source`, `take` |
| `flood` | T4: full chartreuse, one big line | `kicker`, `head`, `body`, `source`, `take` |
| `log` | T5: generic rows, the last one lit | `rows` (`[["GAME 1", "LOSS"], ...]`), `kicker`, `head`, `body`, `source` |
| `rails` | T6: "you say" / "your duo says" | `rails` (`[[label, text], [label, text]]`), `kicker`, `head`, `body`, `source`, `take` |
| `slab` | T1: big type, optional ghost numeral (placed under the text, at least 90 px clear, or dropped) | `opener`, `head`, `mark`, `body`, `ghost` |
| `cta` | T1 with a plain drawn search box reading DuoQueue (no app screens) | `head`, `line`, `small` |

- `mark`: the words in the headline to highlight (must appear in `head` exactly). A highlight
  never breaks across lines, and punctuation right after it (`,` `?` `.` and so on) is drawn
  inside the box so it never hangs on its own.
- `openerInHead: true` (hooks): the headline already starts with the opener, so no opener chip
  is drawn (08: "Have you ever noticed..."). The slideshow's `opener` still names it for the log.
- A `\n` inside `head` forces a line break on the slide (05 slide 2 breaks after "Worst:").
- `size`: start the type smaller than full size, for example `0.86` (06's hook, so "4 things to
  know" fits on one line). The fit only ever shrinks from there.
- `quote: true` wraps the headline in quotes (used for the myths in 07).
- `take`: the opinion chip text, `MY TAKE` or `MY TAKE ON THE RANKING`.
- `zone`: `{ "top": y, "bottom": y }` moves the text area on a photo so it misses the subject.
- `bg`: a key from `backgrounds.mjs`. FACELESS by Cameron's call (4 Oct 2026): free Unsplash
  photos of gear and rooms, or his cat. Never a still of him, never another person, no readable
  brand logo, no game on any screen. Never IMG_6075 or IMG_6236 (other people), IMG_2785
  (shirtless selfie) or IMG_2825 (sword).
- Straight quotes become curly ones on the slides; captions stay plain.

## Files

- `slideshows.json`: the copy, sources and design choices for the batch
- `render.mjs`: the run (lint, backgrounds, render, check, captions, contact sheets)
- `verify.mjs`: checks the finished folder from disk: every PNG complete and 1080x1920, the right
  number of slides, captions with the right disclosure note, contact sheets, report extents
- `backgrounds.mjs`: builds `cache/bg/*.jpg` (2160x3840): downloads the chosen free Unsplash
  photos once into `cache/stock/` and crops them to 9:16, and crops the cat photo in
  `Pictures\duoqueue-filming` (the monitor in IMG_2746 shows a game screen and is cropped out)
- `stock/CREDITS.md`: who took each stock photo, with its Unsplash page
- `lib/templates.mjs`, `lib/slide.css`: the HTML and CSS for every layout
- `lib/page.js`: runs in the page: fits the type, places the ghost numbers and the photo fade,
  shrinks unnumbered cards, measures text, contrast
- `lib/chrome.mjs`: starts headless Chrome and drives it
- `lib/lint.mjs`, `lib/posting.mjs`: copy rules, and the caption / HOW TO POST / sources / log text
- `fonts/`: Manrope and IBM Plex Mono (full TTFs, SIL Open Font License, see `fonts/OFL-*.txt`)
- `cache/` (git ignores it): backgrounds, the HTML of every slide, failed renders, report.json
