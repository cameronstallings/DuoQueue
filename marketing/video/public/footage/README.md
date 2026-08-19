# Source footage

Not tracked in git (see the `.gitignore` rule): these are large binaries that change
whenever they are re-cut, and everything rendered from them is reproducible.

## Clips cut from the 2026-08-18 screen recording

Source: a 2:08 iPhone screen recording at 1180x2556, 60fps, HEVC, signed in as the review
account with the filming photo set applied. Cut to H.264 and stripped of audio, because HEVC
decodes slowly for every downstream tool and the original audio is room noise.

The recording switches from dark to light at about 90s, which was deliberate: the Paper scheme
reads as different enough to double the visual variety from one session. Clips never straddle
that boundary, since a theme change inside a 15-second cut looks like a glitch rather than
variety.

| clip | source | what it shows |
|---|---|---|
| `deck-dark.mp4` | 0s, 8s | Deck browsing, dark |
| `match-kofi.mp4` | 6s, 6s | Match moment banner |
| `chat-typing.mp4` | 22s, 8s | Typing into a chat |
| `deck-cards.mp4` | 32s, 14s | Full card views, Chase and Marcus |
| `duo-locked.mp4` | 46s, 6s | "DUO LOCKED" with a real photo. The best shot in the set |
| `own-profile.mp4` | 70s, 6s | Own profile, the bento grid |
| `settings-sub.mp4` | 82s, 2.5s | Settings, Subscription section, DuoQueue+ Active |
| `paywall.mp4` | 84.5s, 5s | Paywall, premium state, Power-Up at a real $3.99 |
| `appearance.mp4` | 89.5s, 4s | Appearance picker |
| `deck-light.mp4` | 96s, 10s | Deck in Paper (light) |
| `matches-light.mp4` | 110s, 6s | Matches list with parties, light |
| `chat-priya.mp4` | 118s, 8s | The full Priya conversation, light, readable |

## Still needed

`broll-gameplay.mp4` — 3 to 4 minutes of gameplay showing solo queue going badly: a lost
round, a teammate leaving, an empty comms moment. This is the raw material for the `pain`
format, which is the only one of the four that does not use app footage.

## Re-cutting

ffmpeg is installed via winget (Gyan.FFmpeg) but is not on the default PATH in every shell:

    export PATH="$PATH:/c/Users/stall/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin"

Cutting pattern used, with `-ss` before `-i` for a fast seek:

    ffmpeg -ss <start> -i <source> -t <seconds> -an -c:v libx264 -preset veryfast -crf 20 out.mp4
