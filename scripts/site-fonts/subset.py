#!/usr/bin/env python3
"""
ONE-SHOT WOFF2 SUBSETTER for the duoqueue.io site fonts. Its outputs are committed;
this script is not part of the site build and never runs during a deploy.

WHY THIS EXISTS
---------------
scripts/build-site.mjs promises, in its own header, "no external requests of any kind".
The brand's typefaces are Unbounded (display), Manrope (text) and IBM Plex Mono (the
machine voice), which are the app's own tokens (apps/mobile/src/theme/tokens.ts). Linking
them from fonts.googleapis.com would break that promise AND add a processor to the privacy
policy for a landing page whose entire pitch is "we do not track you". So they are
self-hosted.

Raw they are far too heavy to inline or ship whole: Unbounded 700 is 371 KB of TTF for a
page that sets exactly one word in it. Subsetting is therefore mandatory, not an
optimisation, and it is done here rather than in build-site.mjs so that the build stays
zero-dependency. build-site.mjs only asserts the .woff2 files exist and are non-empty, so
a missing face is a loud build failure instead of a silent fallback to system sans.

WHY PYTHON AND NOT NODE
-----------------------
pyftsubset (fontTools) is the subsetter Google Fonts itself uses, it prunes the layout
tables properly, and it adds nothing at all to this repo's pnpm workspace: no package.json,
no lockfile, no node_modules. The repo's constraint is that the site must not grow root
dependencies, and the cheapest way to honour that is to not create a JavaScript toolchain
for a job that runs once.

HOW TO RUN IT (only needed if the character set or a source face changes)
------------------------------------------------------------------------
    python -m pip install --target <somewhere-outside-this-repo> fonttools brotli
    PYTHONPATH=<that-somewhere> python scripts/site-fonts/subset.py

Sources are the repo's own installed copies under node_modules/@expo-google-fonts, which
is the same place marketing/video/scripts/sync-assets.ts takes them from, so the site, the
app and the ad campaign are provably setting type in the same files.

THE CHARACTER SET
-----------------
Basic Latin (U+0020-U+007E) plus the exact non-ASCII characters that appear in
docs/legal/*.md, measured rather than guessed (section sign, em dash, rightwards arrow),
plus the middle dot the app's own profile line uses and the smart quotes / ellipsis a
future copy edit is most likely to introduce. Anything outside this set renders as tofu,
which is loud, rather than as a silently substituted system face, which is not.
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GF = ROOT / "node_modules" / "@expo-google-fonts"
OUT = ROOT / "site" / "fonts"

# (source ttf, output woff2). Family/weight mapping lives in build-site.mjs's @font-face
# block; this file only cares about bytes in and bytes out.
FACES = [
    (GF / "unbounded" / "700Bold" / "Unbounded_700Bold.ttf", "unbounded-700.woff2"),
    (GF / "manrope" / "800ExtraBold" / "Manrope_800ExtraBold.ttf", "manrope-800.woff2"),
    (GF / "manrope" / "700Bold" / "Manrope_700Bold.ttf", "manrope-700.woff2"),
    (GF / "manrope" / "500Medium" / "Manrope_500Medium.ttf", "manrope-500.woff2"),
    (GF / "ibm-plex-mono" / "600SemiBold" / "IBMPlexMono_600SemiBold.ttf", "plex-mono-600.woff2"),
]

# Measured against docs/legal/*.md on 2026-08-21: the only codepoints above U+007E in
# either document are U+00A7, U+2014 and U+2192. The rest are pre-emptive.
UNICODES = ",".join(
    [
        "U+0020-007E",  # basic latin
        "U+00A7",       # § — section references in the legal documents
        "U+00B7",       # · — the app's own "26 · Africa · EN" separator
        "U+2013-2014",  # – — en/em dash (em dash appears in the legal documents)
        "U+2018-201D",  # curly quotes
        "U+2026",       # …
        "U+2192",       # → — "Settings → Delete Account"
    ]
)

# kern and calt are what these families actually ship and want; everything else in GSUB /
# GPOS is dead weight for a page that sets no ligatures on purpose.
LAYOUT_FEATURES = "kern,calt"


def main() -> int:
    try:
        from fontTools.subset import main as pyftsubset  # noqa: F401
    except ImportError:
        print(
            "fontTools is not importable. See this file's header for the one-shot install.",
            file=sys.stderr,
        )
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    failures = 0

    for src, dest_name in FACES:
        if not src.exists():
            print(f"MISSING SOURCE: {src}", file=sys.stderr)
            failures += 1
            continue
        dest = OUT / dest_name
        cmd = [
            sys.executable,
            "-m",
            "fontTools.subset",
            str(src),
            f"--unicodes={UNICODES}",
            f"--layout-features={LAYOUT_FEATURES}",
            "--flavor=woff2",
            "--desubroutinize",
            "--no-hinting",
            "--drop-tables+=DSIG",
            f"--output-file={dest}",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"FAILED: {src.name}\n{result.stderr}", file=sys.stderr)
            failures += 1
            continue
        before = src.stat().st_size
        after = dest.stat().st_size
        print(f"{dest_name:<22} {before / 1024:8.1f} KB -> {after / 1024:6.1f} KB  ({after / before:.1%})")

    if failures:
        print(f"\n{failures} face(s) failed.", file=sys.stderr)
        return 1
    print(f"\nWrote {len(FACES)} faces to {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
