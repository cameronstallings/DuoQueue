#!/usr/bin/env python3
"""
ONE-SHOT: turns the three strings on the Open Graph card into SVG path data.

WHY, since this looks like a lot of machinery for a link preview.

scripts/make-og.mjs renders site/og.png with sharp, whose SVG rasteriser resolves fonts
through the operating system's font stack. Unbounded and Manrope are not installed on
this machine and must not be, so an SVG that names them would silently rasterise in
whatever the system substitutes and the link preview would ship in the wrong typeface.
`@font-face` with a data: URI is not reliably supported by that rasteriser either.

Text converted to outlines has neither problem: the path data IS the letterform, so the
card renders identically on any machine, with no font installed, forever. It also means
make-og.mjs stays a pure sharp script with no font handling in it at all.

Kerning is deliberately NOT applied. These faces carry their kern pairs in GPOS, and
applying them needs a shaping engine. The three strings here are set at wide positive or
mild negative tracking, where the difference is under half a pixel at the sizes the card
uses; make-og.mjs prints each string's total advance so it can be compared against the
browser's own measurement of the same string if anyone ever doubts it.

    python -m pip install --target <somewhere-outside-this-repo> fonttools brotli
    PYTHONPATH=<that-somewhere> python scripts/site-fonts/export-og-glyphs.py
"""

import json
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
GF = ROOT / "node_modules" / "@expo-google-fonts"
OUT = ROOT / "scripts" / "og-glyphs.json"

# (key, ttf, string, tracking in em). Tracking matches the campaign's end card exactly:
# the wordmark at +2%, the call to action at -2%, the URL in mono at +12%.
JOBS = [
    ("wordmark", GF / "unbounded" / "700Bold" / "Unbounded_700Bold.ttf", "duoqueue", 0.02),
    ("cta", GF / "manrope" / "800ExtraBold" / "Manrope_800ExtraBold.ttf", "join the waitlist", -0.02),
    ("url", GF / "ibm-plex-mono" / "600SemiBold" / "IBMPlexMono_600SemiBold.ttf", "duoqueue.io", 0.12),
]


def run_string(ttf_path: Path, text: str, tracking: float) -> dict:
    font = TTFont(str(ttf_path))
    upem = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    glyph_set = font.getGlyphSet()
    hmtx = font["hmtx"]

    # Everything is emitted in a 1000-unit em regardless of the source font's own upem,
    # so make-og.mjs can place all three strings with one scale rule.
    scale = 1000.0 / upem
    parts = []
    x = 0.0
    for char in text:
        name = cmap.get(ord(char))
        if name is None:
            raise SystemExit(f"{ttf_path.name} has no glyph for {char!r}")
        pen = SVGPathPen(glyph_set)
        glyph_set[name].draw(pen)
        d = pen.getCommands()
        if d:
            parts.append(f'<path transform="translate({x:.2f} 0) scale({scale:.6f} {-scale:.6f})" d="{d}"/>')
        x += hmtx[name][0] * scale + tracking * 1000.0
    # The trailing string carries one tracking step after its last glyph; take it back so
    # the reported width is the ink's advance and centring is symmetric.
    width = x - tracking * 1000.0
    ascent = font["hhea"].ascent * scale
    descent = font["hhea"].descent * scale
    return {
        "text": text,
        "svg": "".join(parts),
        "advance": round(width, 2),
        "ascent": round(ascent, 2),
        "descent": round(descent, 2),
        "em": 1000,
    }


def main() -> int:
    out = {}
    for key, ttf, text, tracking in JOBS:
        if not ttf.exists():
            print(f"MISSING SOURCE: {ttf}")
            return 1
        out[key] = run_string(ttf, text, tracking)
        print(f"{key:<9} {text!r:<22} advance {out[key]['advance']:>8.1f}/1000em")
    OUT.write_text(json.dumps(out, indent=1), encoding="utf8")
    print(f"\nWrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
