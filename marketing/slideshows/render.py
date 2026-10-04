"""
Render the DuoQueue TikTok slideshows (photo-mode carousels) from slides.py.

    python render.py                      # all ten, into the Ready to post folder
    python render.py 01 07                # only these
    python render.py --review DIR         # also write contact sheets with a mock TikTok UI on top
    python render.py --out DIR            # somewhere else (a test run)

Needs Pillow, fontTools and an ffmpeg build with libplacebo (Vulkan): the same plain BT.2390
tone map the UGC pipeline uses (Videos/UGC/tools/render_cut.py, Cameron's pick on 30 Sept).

It fails loudly: any text box outside the TikTok-safe area, a dash, a banned word, an app
mention in 07 to 10, a tip without a source or MY TAKE tag, or a missing glyph stops the run.

SUPERSEDED (3 Oct 2026): the slideshows are now made by render.mjs from slideshows.json.
This file and slides.py hold an older draft of the copy; delete both. The guard below stops
this script from overwriting the current HOW TO POST.txt and slides with the old draft.
"""
import sys

sys.exit("render.py is superseded: run `node render.mjs` (see README.md). Delete render.py and slides.py.")

import argparse
import csv
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps
from fontTools.ttLib import TTFont

import slides as S

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
FONT_DIR = REPO / "marketing" / "video" / "public" / "fonts"
UGC = Path("C:/Users/stall/Videos/UGC")
PHOTOS = Path("C:/Users/stall/Pictures/duoqueue-filming")
DEFAULT_OUT = UGC / "Ready to post" / "Slideshows"
CACHE = HERE / "cache"

W, H = 1080, 1920
# Text stays inside this box. Hard limits from the brief: above y 1500, left of x 940.
# Top: TikTok's status bar and Following / For You tabs take roughly the first 200-250 px.
SAFE_L, SAFE_R, SAFE_T, SAFE_B = 96, 930, 250, 1480
HARD_R, HARD_B, HARD_T, HARD_L = 940, 1500, 200, 60

# Volt, from apps/mobile/src/theme/tokens.ts (ink is the brief's warm #F5F3EE).
BG = (10, 11, 9)          # background #0A0B09
SURFACE = (18, 20, 15)    # surface #12140F
EDGE = (48, 54, 42)       # cardEdge #30362A
SEAM = (35, 39, 32)       # border #232720
MARK = (21, 24, 17)       # a step under cardMark #262B1E: decoration only, never text
INK = (245, 243, 238)     # warm ink #F5F3EE
BODY = (214, 218, 204)    # body copy, between ink and textMuted
MUTED = (180, 189, 166)   # textMuted #B4BDA6
FAINT = (150, 158, 138)   # source lines: a touch above overlap.none #8A927E so they stay legible
VOLT = (205, 255, 61)     # #CDFF3D
VOLT_DIM = (148, 188, 44) # voltDim #94BC2C

# Type scale (px on the 1080 canvas)
HEAD_MAX, HEAD_MIN = 124, 80
BODY_MAX, BODY_MIN = 56, 44
KICKER = 36
SOURCE = 28

FONTS = {
    "head": FONT_DIR / "Manrope_800ExtraBold.ttf",
    "body": FONT_DIR / "Manrope_700Bold.ttf",
    "mono": FONT_DIR / "IBMPlexMono_600SemiBold.ttf",
    "mono_r": FONT_DIR / "IBMPlexMono_500Medium.ttf",
}
_font_cache = {}
_cmaps = {}


def font(kind, size):
    key = (kind, size)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(str(FONTS[kind]), size)
    return _font_cache[key]


def check_glyphs(kind, text):
    if kind not in _cmaps:
        _cmaps[kind] = TTFont(str(FONTS[kind])).getBestCmap()
    missing = {c for c in text if c.strip() and ord(c) not in _cmaps[kind]}
    if missing:
        raise SystemExit(f"FAIL: font {kind} has no glyph for {sorted(missing)} in {text!r}")


# ---------------------------------------------------------------- text helpers
def smart_quotes(text):
    out, open_dq = [], True
    for c in text:
        if c == "'":
            out.append("\u2019")
        elif c == '"':
            out.append("\u201c" if open_dq else "\u201d")
            open_dq = not open_dq
        else:
            out.append(c)
    return "".join(out)


def tokens(text):
    """'6 habits keeping you *hardstuck*' -> [(word, accent), ...]"""
    out, accent = [], False
    for raw in smart_quotes(text).split():
        start = raw.startswith("*")
        end = len(raw) > 1 and raw.endswith("*")
        if start:
            accent = True
        out.append((raw.strip("*"), accent))
        if end:
            accent = False
    return out


def wrap(toks, f, max_w):
    space = f.getlength(" ")
    lines, cur, cur_w = [], [], 0.0
    for word, acc in toks:
        ww = f.getlength(word)
        add = ww if not cur else space + ww
        if cur and cur_w + add > max_w:
            lines.append(cur)
            cur, cur_w = [(word, acc)], ww
        else:
            cur.append((word, acc))
            cur_w += add
    if cur:
        lines.append(cur)
    return lines


def line_w(line, f):
    return sum(f.getlength(w) for w, _ in line) + f.getlength(" ") * (len(line) - 1)


def balanced(toks, f, max_w):
    """Same line count as greedy wrapping, with lines as even as possible (no lonely last word)."""
    lines = wrap(toks, f, max_w)
    if len(lines) < 2:
        return lines
    n, lo, hi = len(lines), max_w * 0.4, max_w
    for _ in range(18):
        mid = (lo + hi) / 2
        if len(wrap(toks, f, mid)) <= n:
            hi = mid
        else:
            lo = mid
    return wrap(toks, f, hi)


class Text:
    """A fitted, wrapped block of rich text."""

    def __init__(self, text, kind, max_size, min_size, max_w, max_lines, lh, color):
        paras = [tokens(p) for p in text.split("\n")]  # a newline in the copy forces a line break
        check_glyphs(kind, " ".join(w for toks in paras for w, _ in toks))
        for size in range(max_size, min_size - 1, -2):
            f = font(kind, size)
            lines = [l for toks in paras for l in balanced(toks, f, max_w)]
            if len(lines) <= max_lines and all(line_w(l, f) <= max_w for l in lines):
                break
        else:
            raise SystemExit(f"FAIL: cannot fit {text!r} in {max_lines} lines at {min_size}px")
        self.f, self.size, self.lines, self.lh, self.color = f, size, lines, lh, color
        asc, desc = f.getmetrics()
        self.asc, self.desc = asc, desc
        self.height = asc + int(size * lh) * (len(lines) - 1) + desc


class Canvas:
    def __init__(self, img):
        self.img = img
        self.d = ImageDraw.Draw(img)
        self.boxes = []  # (label, bbox) of every glyph run, for the safe-area check

    def text(self, x, top, block, label="text", accent=VOLT):
        """Draw a Text block with its top at `top`; returns its bottom."""
        y = top + block.asc
        space = block.f.getlength(" ")
        step = int(block.size * block.lh)
        for line in block.lines:
            cx = x
            for word, acc in line:
                self.d.text((cx, y), word, font=block.f, fill=accent if acc else block.color, anchor="ls")
                self.boxes.append((label, self.d.textbbox((cx, y), word, font=block.f, anchor="ls")))
                cx += block.f.getlength(word) + space
            y += step
        return top + block.height

    def mono(self, x, baseline, text, size, color, tracking=4, kind="mono", label="mono"):
        text = smart_quotes(text)
        check_glyphs(kind, text)
        f = font(kind, size)
        cx = x
        for ch in text:
            self.d.text((cx, baseline), ch, font=f, fill=color, anchor="ls")
            if ch.strip():
                self.boxes.append((label, self.d.textbbox((cx, baseline), ch, font=f, anchor="ls")))
            cx += f.getlength(ch) + tracking
        return cx

    @staticmethod
    def mono_width(text, size, tracking=4, kind="mono"):
        f = font(kind, size)
        return sum(f.getlength(c) + tracking for c in smart_quotes(text)) - tracking


# ---------------------------------------------------------------- backgrounds
def frame_image(take, t):
    src = UGC / S.TAKES[take]
    out = CACHE / "frames" / f"{take}_{t:.2f}.png"
    if not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
        vf = ("libplacebo=w=1080:h=1920:tonemapping=bt.2390:colorspace=bt709:color_primaries=bt709:"
              "color_trc=bt709:range=pc:format=yuv420p")
        cmd = ["ffmpeg", "-v", "error", "-y", "-ss", f"{t}", "-i", str(src), "-frames:v", "1", "-vf", vf, str(out)]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode or not out.exists():
            raise SystemExit(f"FAIL: frame grab {src} @ {t}: {r.stderr[-400:]}")
    img = Image.open(out).convert("RGB")
    if img.size != (W, H):
        raise SystemExit(f"FAIL: frame {out} is {img.size}, expected portrait {W}x{H}")
    return img


def crop_photo(spec, out_w, out_h):
    """Crop one of his photos to out_w:out_h inside `region`, around `focus`, then scale."""
    img = ImageOps.exif_transpose(Image.open(PHOTOS / spec["file"])).convert("RGB")
    iw, ih = img.size
    rx0, ry0, rx1, ry1 = spec.get("region", (0, 0, 1, 1))
    rx0, ry0, rx1, ry1 = rx0 * iw, ry0 * ih, rx1 * iw, ry1 * ih
    rw, rh = rx1 - rx0, ry1 - ry0
    ar = out_w / out_h
    if rw / rh > ar:
        ch = rh
        cw = ch * ar
    else:
        cw = rw
        ch = cw / ar
    z = spec.get("zoom", 1.0)
    cw, ch = cw / z, ch / z
    fx, fy = spec.get("focus", (0.5, 0.5))
    cx = min(max(fx * iw, rx0 + cw / 2), rx1 - cw / 2)
    cy = min(max(fy * ih, ry0 + ch / 2), ry1 - ch / 2)
    box = (int(cx - cw / 2), int(cy - ch / 2), int(cx + cw / 2), int(cy + ch / 2))
    if cw < out_w * 0.9:
        raise SystemExit(f"FAIL: {spec['file']} crop is only {cw:.0f}px wide; would upscale badly")
    return img.crop(box).resize((out_w, out_h), Image.LANCZOS)


def smooth(p):
    return p * p * (3 - 2 * p)


def treat_photo(img, text_top, text_bottom, where="bottom", ramp=520):
    """Darken the photo where the type sits; keep the subject (his face, the cats) bright."""
    img = ImageEnhance.Color(img).enhance(0.88)
    img = ImageEnhance.Brightness(img).enhance(0.90)
    lo, hi = 0.08, 0.90
    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)
    for y in range(H):
        if where == "bottom":
            g0, g1 = max(0, text_top - ramp), max(1, text_top - 30)
            a = lo if y < g0 else hi if y >= g1 else lo + (hi - lo) * smooth((y - g0) / (g1 - g0))
        else:
            g0, g1 = text_bottom + 30, text_bottom + ramp
            a = hi if y <= g0 else lo if y >= g1 else hi - (hi - lo) * smooth((y - g0) / (g1 - g0))
        md.line([(0, y), (W, y)], fill=int(a * 255))
    return Image.composite(Image.new("RGB", (W, H), BG), img, mask)


def background(bg, text_top, text_bottom, where="bottom", ramp=520):
    if bg["kind"] == "frame":
        return treat_photo(frame_image(bg["take"], bg["t"]), text_top, text_bottom, where, ramp)
    if bg["kind"] == "photo":
        return treat_photo(crop_photo(bg, W, H), text_top, text_bottom, where, ramp)
    return Image.new("RGB", (W, H), BG)


def draw_plate(cv, spec, y0, y1):
    """One of his photos in a framed panel above the type (Volt: a picture panel with a 1px seam)."""
    if y1 - y0 < 420:
        raise SystemExit(f"FAIL: plate for {spec['file']} would be only {y1 - y0}px tall")
    pw, ph = SAFE_R - SAFE_L, y1 - y0
    pic = crop_photo(spec, pw, ph)
    mask = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, pw - 1, ph - 1], radius=10, fill=255)
    cv.img.paste(pic, (SAFE_L, y0), mask)
    cv.d.rounded_rectangle([SAFE_L, y0, SAFE_R, y1], radius=10, outline=EDGE, width=3)


def draw_motif(cv, motif, n=None, anchor=None):
    d = cv.d
    if motif == "numeral" and n is not None:
        d.text((W + 60, 1830), str(n), font=font("head", 1180), fill=MARK, anchor="rs")
    elif motif == "clock":
        d.text((SAFE_L - 14, anchor - 80), "10:00", font=font("mono", 300), fill=BG, anchor="ls",
               stroke_width=5, stroke_fill=VOLT_DIM)
    elif motif == "lanes":
        # two players on the same plan: one volt line, one ink line, running side by side
        y_l, y_r = anchor - 150, anchor - 520
        for col, off in ((VOLT, 0), (INK, 64)):
            d.line([(-40, y_l + off), (W + 40, y_r + off)], fill=col, width=14)
            for px in (0.30, 0.70):
                x = -40 + px * (W + 80)
                y = y_l + off + px * (y_r - y_l)
                d.ellipse([x - 22, y - 22, x + 22, y + 22], fill=BG, outline=col, width=8)
    elif motif == "bookmark":
        x0, y0, w, h = SAFE_L, anchor - 330, 170, 230
        d.polygon([(x0, y0), (x0 + w, y0), (x0 + w, y0 + h), (x0 + w / 2, y0 + h - 64), (x0, y0 + h)],
                  outline=VOLT, width=10)
    elif motif == "send":
        x0, y0 = SAFE_L, anchor - 330
        d.polygon([(x0, y0 + 110), (x0 + 260, y0), (x0 + 170, y0 + 240), (x0 + 120, y0 + 140)],
                  outline=VOLT, width=10)
        d.line([(x0 + 120, y0 + 140), (x0 + 260, y0)], fill=VOLT, width=8)


def edge_bar(cv, x, y0, y1):
    cv.d.rectangle([x, y0, x + 9, y1], fill=VOLT)


def tab(cv, y):
    """The short volt bar that opens a hook, a CTA or a close."""
    cv.d.rectangle([SAFE_L, y, SAFE_L + 84, y + 12], fill=VOLT)


# ---------------------------------------------------------------- footer (source / MY TAKE)
def footer_height(slide):
    if not slide.get("src") and not slide.get("take"):
        return 0
    return 22 + (46 if slide.get("src") else 0) + (78 if slide.get("take") else 0)


def footer(cv, slide, bottom=SAFE_B - 12, on_photo=False):
    """Source tag and/or MY TAKE chip on a seam line at the bottom of the safe area. Returns the seam y."""
    src, take = slide.get("src"), slide.get("take")
    if not src and not take:
        return None
    y = bottom
    if src:
        cv.mono(SAFE_L, y, "SOURCE: " + src, SOURCE, MUTED if on_photo else FAINT, tracking=2,
                kind="mono_r", label="source")
        y -= 46
    if take:
        chip = "MY TAKE ON THE RANKING" if src else "MY TAKE"
        tw = cv.mono_width(chip, SOURCE, tracking=3)
        base = y
        cv.d.rounded_rectangle([SAFE_L, base - 34, SAFE_L + tw + 36, base + 12], radius=6, outline=VOLT, width=3)
        cv.mono(SAFE_L + 18, base, chip, SOURCE, VOLT, tracking=3, label="take")
        y = base - 34 - 22
    else:
        y -= 10
    cv.d.line([(SAFE_L, y), (SAFE_R, y)], fill=EDGE if on_photo else SEAM, width=2)
    return y


def kicker_text(slide):
    k = slide.get("kicker", "")
    if slide.get("rank"):
        return f"{k} {slide['rank']}"
    if slide.get("n") and slide.get("of"):
        return f"{k} {slide['n']} OF {slide['of']}"
    return k


# ---------------------------------------------------------------- slide templates
def render_hook(slide, show):
    bg = slide["bg"]
    max_w = SAFE_R - SAFE_L
    head = Text(slide["head"], "head", 132, 84, max_w, 4, 1.04, INK)
    sub = Text(slide["sub"], "body", 48, 40, max_w, 2, 1.25, BODY) if slide.get("sub") else None
    total = 12 + 30 + 44 + 34 + head.height + (34 + sub.height if sub else 0)
    where = slide.get("text_pos") or bg.get("text_pos", "bottom")

    if bg["kind"] == "volt":
        if bg.get("motif") in ("clock", "lanes"):
            top = min(860, SAFE_B - total)
        else:
            top = (SAFE_T + SAFE_B - total) // 2
        cv = Canvas(background(bg, top, top + total))
        draw_motif(cv, bg.get("motif"), anchor=top)
    elif bg["kind"] == "plate":
        top = SAFE_B - total
        cv = Canvas(background(bg, top, top + total))
        draw_plate(cv, bg, 236, top - 60)
    else:
        top = SAFE_B - total if where == "bottom" else SAFE_T + 40
        cv = Canvas(background(bg, top, top + total, where, slide.get("ramp", 380)))

    tab(cv, top)
    y = top + 12 + 30
    cv.mono(SAFE_L, y + 32, slide["label"], 34, VOLT, tracking=4, label="label")
    y += 44 + 34
    y = cv.text(SAFE_L, y, head, "head")
    if sub:
        cv.text(SAFE_L, y + 34, sub, "sub")
    return cv


def render_tip(slide, show):
    bg = slide["bg"]
    x = SAFE_L + 36
    max_w = SAFE_R - x
    if bg["kind"] == "volt":
        head = Text(slide["head"], "head", HEAD_MAX - 10, HEAD_MIN - 8, max_w, 3, 1.05, INK)
        body = Text(slide["body"], "body", BODY_MAX, BODY_MIN, max_w, 5, 1.32, BODY)
        k_h, gap_k, gap_b = 44, 46, 44
    else:  # over a photo: a shorter block so his face (or the cats) keeps the top of the frame
        head = Text(slide["head"], "head", 96, 72, max_w, 3, 1.04, INK)
        body = Text(slide["body"], "body", 48, 42, max_w, 4, 1.3, BODY)
        k_h, gap_k, gap_b = 44, 34, 34
    block = k_h + gap_k + head.height + gap_b + body.height

    if bg["kind"] == "volt":
        cv = Canvas(background(bg, 0, 0))
        draw_motif(cv, bg.get("motif"), slide.get("n") if not slide.get("rank") else None)
        seam = footer(cv, slide) or SAFE_B
        top = max(330, (300 + seam - 60 - block) // 2)
    else:
        where = bg.get("text_pos", "bottom")
        foot = footer_height(slide)
        if where == "top":
            top = SAFE_T + 50
            text_bottom = top + block + 40 + foot
        else:
            top = SAFE_B - foot - 40 - block
            text_bottom = SAFE_B
        if bg["kind"] == "plate":
            cv = Canvas(background(bg, top, text_bottom))
            draw_plate(cv, bg, 236, top - 60)
        else:
            cv = Canvas(background(bg, top, text_bottom, where, ramp=380))
        seam = footer(cv, slide, bottom=(text_bottom - 12) if where == "top" else SAFE_B - 12, on_photo=True)

    cv.mono(SAFE_L, top + 34, kicker_text(slide), KICKER, VOLT, tracking=4, label="kicker")
    y = top + k_h + gap_k
    y_end = cv.text(x, y, head, "head")
    edge_bar(cv, SAFE_L, y + 12, y_end - 10)
    y_end = cv.text(x, y_end + gap_b, body, "body")
    if seam is not None and y_end > seam - 30:
        raise SystemExit(f"FAIL: body runs into the source line on {slide['head']!r}")
    return cv


def render_cta(slide, show):
    cv = Canvas(Image.new("RGB", (W, H), BG))
    max_w = SAFE_R - SAFE_L
    q = Text(slide["q"], "head", 100, 72, max_w, 4, 1.06, INK)
    line = Text(S.CTA_LINE, "body", 54, 42, max_w, 2, 1.3, BODY)
    pill_h = 140
    total = 12 + 60 + q.height + 90 + pill_h + 64 + line.height + 40 + 40
    top = max(SAFE_T + 60, (SAFE_T + SAFE_B - total) // 2 - 40)
    tab(cv, top)
    y = cv.text(SAFE_L, top + 12 + 60, q, "q")
    # A plain search field, not a screenshot of any app: "type this word".
    y += 90
    cv.d.rounded_rectangle([SAFE_L, y, SAFE_R, y + pill_h], radius=24, fill=SURFACE, outline=EDGE, width=3)
    mx, my = SAFE_L + 70, y + pill_h // 2 - 6
    cv.d.ellipse([mx - 26, my - 26, mx + 26, my + 26], outline=MUTED, width=7)
    cv.d.line([(mx + 18, my + 18), (mx + 42, my + 42)], fill=MUTED, width=8)
    f_w = font("head", 66)
    check_glyphs("head", "DuoQueue")
    pos = (SAFE_L + 140, y + pill_h // 2 + 2)
    cv.d.text(pos, "DuoQueue", font=f_w, fill=INK, anchor="lm")
    cv.boxes.append(("pill", cv.d.textbbox(pos, "DuoQueue", font=f_w, anchor="lm")))
    y += pill_h + 64
    y = cv.text(SAFE_L, y, line, "cta")
    cv.mono(SAFE_L, y + 72, S.CTA_SMALL, 34, VOLT, tracking=5, label="cta-small")
    return cv


def render_close(slide, show):
    bg = slide["bg"]
    max_w = SAFE_R - SAFE_L
    head = Text(slide["head"], "head", 116, 76, max_w, 4, 1.05, INK)
    sub_h = 80 if slide.get("sub") else 0
    total = 12 + 54 + head.height + sub_h
    if bg["kind"] == "volt":
        top = 780
        cv = Canvas(background(bg, top, top + total))
        draw_motif(cv, bg.get("motif"), anchor=top)
    elif bg["kind"] == "plate":
        top = SAFE_B - total - 10
        cv = Canvas(background(bg, top, SAFE_B))
        draw_plate(cv, bg, 236, top - 60)
    else:
        top = SAFE_B - total - 10
        cv = Canvas(background(bg, top, SAFE_B))
    tab(cv, top)
    y = cv.text(SAFE_L, top + 12 + 54, head, "head")
    if slide.get("sub"):
        cv.mono(SAFE_L, y + 66, slide["sub"], 32, VOLT, tracking=4, label="sub")
    return cv


RENDER = {"hook": render_hook, "tip": render_tip, "cta": render_cta, "close": render_close}


# ---------------------------------------------------------------- checks
DASHES = re.compile("[\u2012\u2013\u2014\u2015\u2212]")
BANNED = re.compile(r"\b(beats?|match(es|ed|ing)?|swip(e|es|ed|ing)|dat(e|es|ing)|meet(ing)?|romance|romantic|"
                    r"partner|single|guarantee(d)?)\b", re.I)
BANNED_TAGS = re.compile(r"#(leagueoflegends|lol|riot\w*)\b", re.I)
APP_WORDS = re.compile(r"(duo ?q(ueue)?\b|duoqueue|app store|\bapp\b|iphone)", re.I)
DUOQUEUE_SPELLING = re.compile(r"duo\s*q\w*", re.I)


def all_text(show, slides=None):
    parts = [show["title"], show["caption"], " ".join(show["tags"])]
    for sl in show["slides"] if slides is None else slides:
        for k in ("label", "head", "sub", "body", "q", "kicker", "rank", "src", "why"):
            if sl.get(k):
                parts.append(str(sl[k]))
        if sl["type"] == "cta":
            parts += [S.CTA_LINE, S.CTA_SMALL]
    return "\n".join(parts)


def check_show(show):
    errs = []
    n = len(show["slides"])
    if not 5 <= n <= 8:
        errs.append(f"{n} slides (need 5 to 8)")
    if len(show["title"]) > 90:  # TikTok photo-post title limit (Content Posting API: 90 runes)
        errs.append(f"title is {len(show['title'])} characters (max 90)")
    text = all_text(show)
    if DASHES.search(text):
        errs.append(f"dash: {DASHES.findall(text)}")
    errs += [f"banned word {m.group(0)!r}" for m in BANNED.finditer(text)]
    errs += [f"banned hashtag {m.group(0)!r}" for m in BANNED_TAGS.finditer(text)]
    errs += [f"misspelled DuoQueue: {m.group(0)!r}" for m in DUOQUEUE_SPELLING.finditer(text)
             if m.group(0) not in ("DuoQueue", "duoqueue")]
    types = [s["type"] for s in show["slides"]]
    if show["app"]:
        if types[-1] != "cta" or types.count("cta") != 1:
            errs.append("01 to 06 must end with exactly one CTA slide")
        body = "\n".join(all_text({**show, "tags": [], "title": "", "caption": ""},
                                  [s for s in show["slides"] if s["type"] != "cta"]).split("\n"))
        if re.search(r"duoqueue|app store|iphone|\bapp\b", body, re.I):
            errs.append("app named outside the CTA slide")
    else:
        if "cta" in types:
            errs.append("07 to 10 must not have a CTA")
        errs += [f"app mention in a no-app slideshow: {m.group(0)!r}" for m in APP_WORDS.finditer(text)]
    for sl in show["slides"]:
        if sl["type"] == "tip" and not (sl.get("src") or sl.get("take")):
            errs.append(f"tip without source or MY TAKE: {sl['head']!r}")
        if sl.get("src") and sl["src"] not in S.SOURCES:
            errs.append(f"unknown source tag {sl['src']!r}")
        if sl["bg"]["kind"] != "volt" and not sl.get("why"):
            errs.append(f"photo background without a reason: {sl.get('head') or sl.get('q')!r}")
    if errs:
        raise SystemExit(f"FAIL {show['id']}:\n  " + "\n  ".join(errs))


def check_boxes(show_id, idx, cv):
    bad = []
    for label, (x0, y0, x1, y1) in cv.boxes:
        if x1 > HARD_R or y1 > HARD_B or y0 < HARD_T or x0 < HARD_L:
            bad.append(f"{label} {x0},{y0},{x1},{y1} breaks the hard limit")
        elif x1 > SAFE_R + 2 or y1 > SAFE_B + 2 or y0 < SAFE_T - 2:
            bad.append(f"{label} {x0},{y0},{x1},{y1} outside the inner safe box")
    if bad:
        raise SystemExit(f"FAIL {show_id} slide {idx}: text outside the TikTok-safe area:\n  " + "\n  ".join(bad))


# ---------------------------------------------------------------- review sheet (not for posting)
def tiktok_mock(img):
    """Tinted blocks where TikTok's own UI sits, plus the safe box, to eyeball collisions."""
    im = img.copy().convert("RGBA")
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.rectangle([0, 0, W, 200], fill=(255, 0, 255, 60))           # status bar + tabs
    d.rectangle([950, 760, W, 1720], fill=(255, 0, 255, 60))      # right rail
    d.rectangle([0, 1500, W, H], fill=(255, 0, 255, 60))          # title, caption, sound, nav
    d.rectangle([SAFE_L, SAFE_T, SAFE_R, SAFE_B], outline=(0, 255, 255, 160), width=3)
    return Image.alpha_composite(im, ov).convert("RGB")


def review_sheet(images, path, mock=True):
    th_w = 360
    th_h = int(th_w * H / W)
    sheet = Image.new("RGB", (len(images) * (th_w + 12) + 12, th_h + 24), (60, 60, 60))
    for i, im in enumerate(images):
        src = tiktok_mock(im) if mock else im
        sheet.paste(src.resize((th_w, th_h), Image.LANCZOS), (12 + i * (th_w + 12), 12))
    sheet.save(path, quality=88)


# ---------------------------------------------------------------- output text files
def caption_txt(show):
    n = len(show["slides"])
    desc = f"{show['caption']} {' '.join(show['tags'])}"
    lines = [
        f"SLIDESHOW {show['id']}: {show['title']}",
        f"TikTok only. Photo post, {n} photos, add them in order 01 to {n:02d}.",
        "",
        "TITLE (paste into the title field):",
        show["title"],
        "",
        "DESCRIPTION (paste into the description):",
        desc,
        "",
        "BEFORE YOU POST:",
    ]
    if show["app"]:
        lines += [
            "- The last slide names DuoQueue, so turn on disclosure before posting: More options, then",
            "  Content disclosure and ads, turn on Disclose commercial content, pick Your brand.",
            "- Sound: TikTok puts a song on photo posts by itself. Swap it for one from Commercial Sounds",
            "  (Add sound, Sounds, then the Commercial Sounds dropdown), or turn the volume to zero.",
            "  Never a chart hit or someone's original sound on a disclosed post.",
        ]
    else:
        lines += [
            "- No disclosure: this one never mentions DuoQueue. Keep it that way: no DuoQueue in the",
            "  description, hashtags, comments or replies. It is the clean test of your account.",
            "- Sound: pick one from Commercial Sounds (Add sound, Sounds, Commercial Sounds dropdown) so",
            "  nothing gets muted, or turn TikTok's auto-added song to zero.",
        ]
    lines += [
        "- Cover: slide 01 (the default).",
        "- No #leagueoflegends, #lol or #riot, and no screenshots of the app or the game.",
        "",
        f"HOOK TYPE: {show['hook_type']}. OPENER: \"{show['opener']}\". FORMAT: {show['format']}.",
        "",
        "WHAT IS ON EACH SLIDE:",
    ]
    for i, sl in enumerate(show["slides"], 1):
        text = (sl.get("head") or sl.get("q")).replace("*", "")
        bg = sl["bg"]
        if bg["kind"] == "volt":
            bgd = f"Volt type background ({bg.get('motif', 'plain')})"
        elif bg["kind"] == "frame":
            bgd = f"a frame of your raw take '{S.TAKES[bg['take']]}' at {bg['t']} s"
        else:
            bgd = f"your photo {bg['file']}"
        tag = sl.get("src") or ("MY TAKE" if sl.get("take") else ("the one DuoQueue slide" if sl["type"] == "cta" else ""))
        lines.append(f"{i:02d}  {text}")
        lines.append(f"    background: {bgd}" + (f". {sl['why']}" if sl.get("why") else ""))
        if tag:
            lines.append(f"    backed by: {tag}" + (" (+ MY TAKE)" if sl.get("src") and sl.get("take") else ""))
    return "\n".join(lines) + "\n"


POST_ORDER = ["07", "01", "09", "02", "08", "04", "10", "03", "05", "06"]


def how_to_post_txt():
    by_id = {s["id"]: s for s in S.SLIDESHOWS}
    order = "\n".join(
        f"  Day {i:2d}: {sid}  {by_id[sid]['title']}" + ("   (names DuoQueue: disclosure ON)" if by_id[sid]["app"]
                                                         else "   (no app: no disclosure)")
        for i, sid in enumerate(POST_ORDER, 1))
    return f"""DUOQUEUE TIKTOK SLIDESHOWS, BATCH 1 (made 3 Oct 2026)

WHAT THIS IS
Ten photo posts for TikTok ONLY (TikTok calls them photo mode or carousels). Each folder holds the
slides in order (01.jpg, 02.jpg, ...) and caption.txt with the title, the description, and what to
switch on before posting. There are no app screens anywhere. Gaming tips first:
- 01 to 06 end with ONE text slide that says "Search DuoQueue on the App Store. Free on iPhone."
- 07 to 10 never mention DuoQueue at all. They are pure tips, and they also test whether your
  account itself is being held back.
Every fact has its source printed on the slide (full list in sources.txt). Opinions carry a MY TAKE tag.

HOW TO POST ONE (iPhone)
1. Put that folder's photos on your phone (AirDrop or iCloud Photos).
2. In TikTok: + (Add Post), then Photo, then Upload, and pick the photos in order: 01 first.
   Make sure it posts as a PHOTO post people flip through, not turned into a video.
3. Paste the TITLE and DESCRIPTION from caption.txt.
4. Sound: TikTok adds a song by itself. Change it to one from Commercial Sounds (Add sound, Sounds,
   Commercial Sounds dropdown), or turn the volume to zero.
5. 01 to 06 only: More options, then Content disclosure and ads, turn on Disclose commercial
   content, pick Your brand.
6. Post. Then fill in a row of posting-log.csv.

SUGGESTED ORDER (one a day; 07 goes first because it is the clean test)
{order}

WHAT TO CHECK
- 24 hours after 07: if it has 0 views, the problem is the account, not these posts. Check
  Account status and don't post the DuoQueue ones yet.
- If 07 to 10 get views but 01 to 06 sit at 0, the DuoQueue slide is the likely trigger. Post the
  ones you have left WITHOUT their last slide and without #duoqueue (then no disclosure is needed),
  and keep DuoQueue for your face-to-camera videos.
- Saves and shares are what slideshows are good at. Write them down with views.
- Be realistic: Metricool (May 2026, 2.3 million posts) found TikTok videos got about 5 times the
  reach of photo posts, while Fanpage Karma (Jan to May 2025, about 700,000 posts) found photo posts
  got about 81% more engagement. Treat this batch as a test of hooks and formats, not a sure thing.

THE TEST INSIDE THE BATCH
Each slideshow uses a different opener and hook type, and three formats are mixed: a photo of you
or your cats on slide 1 then type slides, all-type slides (02, 04), and photos on every slide (08).
The log lets you see which opener and which format pulled views.

DO NOT
- Add app screenshots, gameplay, champion art or Riot logos.
- Use #leagueoflegends, #lol or #riot.
- Add DuoQueue to the description, hashtags or comments of 07 to 10.
- Post the same slideshow twice. Re-cut it with a new first slide instead.
"""


def posting_log_rows():
    rows = [["day", "date posted", "slideshow", "title", "names DuoQueue", "hook type", "opener", "format",
             "slide 1 background", "disclosure on", "sound", "views 24h", "views 72h", "For You %",
             "likes", "comments", "shares", "saves", "notes"]]
    by_id = {s["id"]: s for s in S.SLIDESHOWS}
    for i, sid in enumerate(POST_ORDER, 1):
        s = by_id[sid]
        bg = s["slides"][0]["bg"]
        first = ("Volt type" if bg["kind"] == "volt" else
                 f"frame of {S.TAKES[bg['take']]}" if bg["kind"] == "frame" else f"photo {bg['file']}")
        rows.append([i, "", sid, s["title"], "yes" if s["app"] else "no", s["hook_type"], s["opener"],
                     s["format"], first, "", "", "", "", "", "", "", "", "", ""])
    return rows


def sources_txt():
    out = ["Every fact on the slides and where it comes from. Checked 3 Oct 2026.",
           "MY TAKE on a slide means opinion, labelled as opinion.", ""]
    for tag, full in S.SOURCES.items():
        out += [tag, "  " + full, ""]
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--review")
    args = ap.parse_args()
    out = Path(args.out)
    if len(S.SLIDESHOWS) != 10:
        raise SystemExit("FAIL: expected 10 slideshows")
    for show in S.SLIDESHOWS:
        check_show(show)
    shows = [s for s in S.SLIDESHOWS if not args.ids or s["id"] in args.ids]
    for show in shows:
        folder = out / show["folder"]
        folder.mkdir(parents=True, exist_ok=True)
        for old in folder.glob("[0-9][0-9].jpg"):
            old.unlink()  # this script's own earlier render of the same slideshow
        images = []
        for i, sl in enumerate(show["slides"], 1):
            cv = RENDER[sl["type"]](sl, show)
            check_boxes(show["id"], i, cv)
            if cv.img.size != (W, H):
                raise SystemExit("FAIL: wrong canvas size")
            cv.img.save(folder / f"{i:02d}.jpg", quality=95, subsampling=0, optimize=True)
            images.append(cv.img)
        (folder / "caption.txt").write_text(caption_txt(show), encoding="utf-8")
        if args.review:
            rd = Path(args.review)
            rd.mkdir(parents=True, exist_ok=True)
            review_sheet(images, rd / f"{show['id']}-ui.jpg", mock=True)
            review_sheet(images, rd / f"{show['id']}.jpg", mock=False)
        print(f"ok {show['id']} {show['folder']}: {len(images)} slides")
    (out / "sources.txt").write_text(sources_txt(), encoding="utf-8")
    (out / "HOW TO POST.txt").write_text(how_to_post_txt(), encoding="utf-8")
    log = out / "posting-log.csv"
    if not log.exists():  # never overwrite rows Cameron has filled in
        with open(log, "w", newline="", encoding="utf-8") as fh:
            csv.writer(fh).writerows(posting_log_rows())
    # the text files go through the same dash and banned-word checks as the slides
    for f in [out / "HOW TO POST.txt", out / "sources.txt"] + [out / s["folder"] / "caption.txt" for s in shows]:
        t = f.read_text(encoding="utf-8")
        if DASHES.search(t):
            raise SystemExit(f"FAIL: dash in {f}")
        if f.name != "sources.txt":
            hits = [m.group(0) for m in BANNED.finditer(t)]
            if hits:
                raise SystemExit(f"FAIL: banned word(s) {hits} in {f}")


if __name__ == "__main__":
    main()
