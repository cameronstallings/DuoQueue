// Runs inside each slide page. render.mjs calls window.__prep() after load, takes the
// screenshot, then hides the text (body.probe), takes a second screenshot and hands it to
// window.__contrast() to measure what every line of text actually sits on.
(() => {
  const W = 1080;
  const H = 1920;

  async function ready() {
    const faces = [...document.fonts];
    await Promise.all(faces.map((f) => f.load().catch(() => null)));
    await document.fonts.ready;
    const notLoaded = faces.filter((f) => f.status !== "loaded").map((f) => `${f.family} ${f.weight}`);
    const badImages = [];
    for (const img of document.images) {
      try {
        await img.decode();
      } catch {
        badImages.push(img.getAttribute("src"));
      }
      if (!img.naturalWidth) badImages.push(img.getAttribute("src"));
    }
    return { notLoaded, badImages };
  }

  // Lower --k on each .fit box until its content fits (no overflow either way).
  function fit() {
    const out = [];
    for (const z of document.querySelectorAll(".fit")) {
      let k = parseFloat(z.dataset.k0 || "1");
      // the box overflows, or any text block is wider than its own column (unbreakable runs)
      const blocks = [...z.querySelectorAll("[data-block]")];
      const over = () =>
        z.scrollHeight > z.clientHeight + 1 ||
        z.scrollWidth > z.clientWidth + 1 ||
        blocks.some((b) => b.scrollWidth > b.clientWidth + 1);
      z.style.setProperty("--k", String(k));
      while (over() && k > 0.6) {
        k = Math.round((k - 0.02) * 100) / 100;
        z.style.setProperty("--k", String(k));
      }
      out.push({ name: z.dataset.name, k, overflow: over() });
    }
    return out;
  }

  // Where a ghost number's digits actually are (font metrics from the loaded Manrope).
  const metricsCtx = document.createElement("canvas").getContext("2d");
  function digitBox(g) {
    const range = document.createRange();
    range.selectNodeContents(g);
    const cs = getComputedStyle(g);
    metricsCtx.font = `${cs.fontWeight} ${cs.fontSize} Manrope`;
    const m = metricsCtx.measureText(g.textContent);
    const baseline = range.getBoundingClientRect().top + m.fontBoundingBoxAscent;
    return { top: baseline - m.actualBoundingBoxAscent, bottom: baseline + m.actualBoundingBoxDescent };
  }

  // Card ghost numerals sit in the free space between the body and the source line, 40 px clear
  // of both: lifted off the source line first, then shrunk (the baseline stays put) until they
  // clear the text above, or dropped when that leaves them under 220 px.
  const CARD_GAP = 40;
  function ghosts() {
    for (const g of document.querySelectorAll(".ghost.in-card")) {
      const card = g.parentElement;
      const content = [...card.children].filter((c) => !c.matches(".ghost,.spacer,.src"));
      const textBottom = Math.max(...content.map((c) => c.getBoundingClientRect().bottom));
      const src = card.querySelector(".src");
      const floor = src ? src.getBoundingClientRect().top - CARD_GAP : card.getBoundingClientRect().bottom - 60;
      let d = digitBox(g);
      if (d.bottom > floor) {
        g.style.bottom = `${parseFloat(getComputedStyle(g).bottom) + (d.bottom - floor)}px`;
        d = digitBox(g);
      }
      let fs = parseFloat(getComputedStyle(g).fontSize);
      while (d.top < textBottom + CARD_GAP && fs >= 220) {
        fs -= 10;
        g.style.fontSize = `${fs}px`;
        d = digitBox(g);
      }
      if (fs < 220) g.style.display = "none";
    }
  }

  // The big ghost number on a slab (cover) slide sits BELOW the text, never behind it: the
  // number's font box ends at y 1490 (inside TikTok's safe box), and it shrinks until the top of
  // its digits clears the lowest text line by 90 px. Under 240 px it is dropped.
  const SLAB_GAP = 90;
  function slabGhosts() {
    for (const g of document.querySelectorAll(".ghost.in-slab")) {
      const text = [...document.querySelectorAll(".fit [data-block]")];
      if (!text.length) continue;
      const textBottom = Math.max(...text.map((t) => t.getBoundingClientRect().bottom));
      const range = document.createRange();
      range.selectNodeContents(g);
      let placed = false;
      g.style.bottom = "auto";
      for (let fs = parseFloat(getComputedStyle(g).fontSize); fs >= 240; fs -= 10) {
        g.style.fontSize = `${fs}px`;
        g.style.top = "0px";
        g.style.top = `${1490 - range.getBoundingClientRect().bottom}px`;
        if (digitBox(g).top >= textBottom + SLAB_GAP) {
          placed = true;
          break;
        }
      }
      if (!placed) g.style.display = "none";
    }
  }

  // Cards with no ghost number shrink to their text and sit centred where the card was.
  function compactCards() {
    for (const card of document.querySelectorAll(".cardbox.noghost")) {
      const r = card.getBoundingClientRect();
      const sp = card.querySelector(".spacer");
      if (sp) sp.style.display = "none";
      card.style.bottom = "auto";
      const h = card.getBoundingClientRect().height;
      card.style.top = `${Math.round(r.top + (r.height - h) / 2)}px`;
    }
  }

  // Photo hooks: a dark gradient that starts 340 px above the text and holds behind it.
  function scrims() {
    for (const s of document.querySelectorAll("[data-scrim]")) {
      const target = document.querySelector(s.dataset.scrim);
      const r = target.getBoundingClientRect();
      const top = Math.max(0, Math.round(r.top - 340));
      const band = s.dataset.band === "1";
      const bottom = band ? Math.min(H, Math.round(r.bottom + 230)) : H;
      const h = bottom - top;
      s.style.top = `${top}px`;
      s.style.height = `${h}px`;
      s.style.background = band
        ? `linear-gradient(to bottom, rgba(6,8,4,0) 0px, rgba(6,8,4,.82) 300px, rgba(6,8,4,.82) ${h - 210}px, rgba(6,8,4,0) ${h}px)`
        : `linear-gradient(to bottom, rgba(6,8,4,0) 0px, rgba(6,8,4,.76) 300px, rgba(6,8,4,.9) ${h}px)`;
    }
  }

  // One box per rendered line of every text node (Range client rects = the font's full
  // ascent-to-descent box, so the bounds check is on the cautious side).
  function measure() {
    let bid = 0;
    for (const el of document.querySelectorAll("[data-block],[data-decor]")) el.dataset.bid = String(++bid);
    const boxes = [];
    const ctx = document.createElement("canvas").getContext("2d");
    // Decor (ghost numbers): the box of the digits' actual ink, for the overlap check.
    const inkBox = (rc, cs, s) => {
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = ctx.measureText(s);
      const baseline = rc.top + m.fontBoundingBoxAscent;
      return { x0: rc.left, x1: rc.right, y0: baseline - m.actualBoundingBoxAscent, y1: baseline + m.actualBoundingBoxDescent };
    };
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      if (!n.data.trim()) continue;
      const el = n.parentElement;
      if (el.closest("script,style,head")) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const owner = el.closest("[data-block],[data-decor]");
      const range = document.createRange();
      range.selectNodeContents(n);
      const decor = !!el.closest("[data-decor]");
      for (const rc of range.getClientRects()) {
        if (rc.width < 1 || rc.height < 1) continue;
        boxes.push({
          ink: decor ? inkBox(rc, cs, n.data.trim()) : null,
          text: n.data.trim().slice(0, 60),
          x0: rc.left, y0: rc.top, x1: rc.right, y1: rc.bottom,
          fs: parseFloat(cs.fontSize),
          color: cs.color,
          block: owner ? owner.dataset.block || "decor" : "untagged",
          bid: owner ? owner.dataset.bid : "0",
          decor,
        });
      }
    }
    return boxes;
  }

  window.__prep = async () => {
    const r = await ready();
    const fits = fit();
    ghosts();
    slabGhosts();
    compactCards();
    scrims();
    return { ...r, fits, boxes: measure() };
  };

  // Worst-case contrast per text block: for each line, sample the pixels the glyphs sit on
  // (text hidden) and compare with the text colour. Reports the 5th percentile.
  window.__contrast = async (dataUrl, boxes) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, W, H).data;
    const lin = (v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const lum = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
    const blocks = new Map();
    for (const b of boxes) {
      if (b.decor) continue;
      const [tr, tg, tb] = b.color.match(/[\d.]+/g).map(Number);
      const lt = lum(tr, tg, tb);
      const yc = b.y0 + (b.y1 - b.y0) * 0.58;
      const half = b.fs * 0.42;
      const y0 = Math.max(0, Math.round(yc - half));
      const y1 = Math.min(H - 1, Math.round(yc + half));
      const x0 = Math.max(0, Math.round(b.x0));
      const x1 = Math.min(W - 1, Math.round(b.x1));
      const e = blocks.get(b.bid) || { block: b.block, text: b.text, fs: b.fs, cs: [] };
      for (let y = y0; y <= y1; y += 2) {
        for (let x = x0; x <= x1; x += 2) {
          const i = (y * W + x) * 4;
          const lb = lum(px[i], px[i + 1], px[i + 2]);
          e.cs.push((Math.max(lb, lt) + 0.05) / (Math.min(lb, lt) + 0.05));
        }
      }
      blocks.set(b.bid, e);
    }
    return [...blocks.values()].map((e) => {
      e.cs.sort((a, b) => a - b);
      return { block: e.block, text: e.text, fs: e.fs, p05: e.cs[Math.floor(e.cs.length * 0.05)] };
    });
  };
})();
