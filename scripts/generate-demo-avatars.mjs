// scripts/generate-demo-avatars.mjs — generates DuoQueue's demo-profile avatar set.
//
// These stand in for profile photos on the swipe deck for the handful of demo
// profiles shown ONLY to the flagged App Review account (see docs/APP-STORE-SUBMISSION.md
// and the demo-profile seed migration). No real user may ever see them, so they must
// never be mistakable for a photo of an actual person: abstract, geometric,
// gaming-adjacent art in the Volt palette only. Same house style as the app icon
// (scripts/generate-app-icons.mjs) — flat fields, hard-edged marks, no glow/glass,
// same grain composite — so they sit in the same visual world as the rest of the app.
//
// Each of the 14 avatars is a genuinely distinct composition (circuit traces,
// isometric blocks, hex field, waveform, target rings, dot matrix, radar sweep,
// scanline glitch, triangle mesh, pixel cluster, orbit rings, radial spectrum,
// crosshair/d-pad, node-graph blueprint) rather than one template recoloured 14
// times. Randomness within each composition is seeded from its index, so
// re-running this script byte-for-byte reproduces the same 14 PNGs.
//
// Run: node scripts/generate-demo-avatars.mjs
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOISE_PATH = path.join(__dirname, "..", "apps", "mobile", "assets", "noise.png");
const OUT_DIR = path.join(__dirname, "..", "assets", "demo");

// ---- Volt palette (dark family backgrounds + accent set) -------------------
const BG_DARK = "#0A0B09";
const BG_SURFACE = "#12140F";
const BG_RAISED = "#1A1D15";
const CHARTREUSE = "#CDFF3D";
const CHARTREUSE_DIM = "#94BC2C";
const AMBER = "#FFB627";
const INK = "#EDF1E6";
const MUTED = "#98A18A";

const CANVAS = 1024;
const CENTER = CANVAS / 2;

// ---- deterministic PRNG (mulberry32) ---------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = (rng, min, max) => min + rng() * (max - min);
const randInt = (rng, min, max) => Math.floor(rand(rng, min, max + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

function svgDoc(inner, background) {
  return `<svg width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${CANVAS}" height="${CANVAS}" fill="${background}" />
    ${inner}
  </svg>`;
}

// =============================================================================
// 1. CIRCUIT TRACES — orthogonal PCB-style traces with pads, lead: chartreuse
// =============================================================================
function circuitTraces(rng) {
  const cols = 6;
  const spacing = 136;
  const start = CENTER - ((cols - 1) * spacing) / 2;
  const nodeXY = (col, row) => [start + col * spacing, start + row * spacing];

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  let out = "";
  const traceCount = 10;
  for (let i = 0; i < traceCount; i++) {
    let col = randInt(rng, 0, cols - 1);
    let row = randInt(rng, 0, cols - 1);
    const steps = randInt(rng, 2, 4);
    const pts = [nodeXY(col, row)];
    let lastDir = null;
    for (let s = 0; s < steps; s++) {
      const candidates = dirs.filter(
        (d) => !lastDir || d[0] !== -lastDir[0] || d[1] !== -lastDir[1],
      );
      const d = pick(rng, candidates);
      col = Math.min(cols - 1, Math.max(0, col + d[0]));
      row = Math.min(cols - 1, Math.max(0, row + d[1]));
      lastDir = d;
      pts.push(nodeXY(col, row));
    }
    const lead = rng() < 0.35;
    const stroke = lead ? CHARTREUSE : CHARTREUSE_DIM;
    const width = lead ? 9 : 6;
    const opacity = lead ? 1 : 0.55;
    const path = pts.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
    out += `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" />`;
    const endPad = pts[pts.length - 1];
    const padR = lead ? 15 : 8;
    out += `<circle cx="${endPad[0]}" cy="${endPad[1]}" r="${padR}" fill="${stroke}" opacity="${opacity}" />`;
    if (lead) {
      out += `<circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="10" fill="${CHARTREUSE}" />`;
    }
  }
  // scattered unconnected via pads for texture
  for (let i = 0; i < 8; i++) {
    const [x, y] = nodeXY(randInt(rng, 0, cols - 1), randInt(rng, 0, cols - 1));
    out += `<circle cx="${x}" cy="${y}" r="5" fill="${MUTED}" opacity="0.4" />`;
  }
  return out;
}

// =============================================================================
// 2. ISOMETRIC BLOCKS — small stepped skyline of iso cubes, lead: amber
// =============================================================================
function isoCube(cx, cy, size, colors) {
  const { top, left, right, seam } = colors;
  const topPts = `${cx},${cy - size} ${cx + size},${cy - size * 0.5} ${cx},${cy} ${cx - size},${cy - size * 0.5}`;
  const leftPts = `${cx - size},${cy - size * 0.5} ${cx},${cy} ${cx},${cy + size} ${cx - size},${cy + size * 0.5}`;
  const rightPts = `${cx + size},${cy - size * 0.5} ${cx},${cy} ${cx},${cy + size} ${cx + size},${cy + size * 0.5}`;
  return `<polygon points="${leftPts}" fill="${left}" stroke="${seam}" stroke-width="3" />
    <polygon points="${rightPts}" fill="${right}" stroke="${seam}" stroke-width="3" />
    <polygon points="${topPts}" fill="${top}" stroke="${seam}" stroke-width="3" />`;
}

function isometricBlocks(rng) {
  const size = 112;
  // grid positions (i = column along right-down axis, j = column along left-down axis),
  // sorted back-to-front by depth (i+j) so painter's-algorithm draw order never lets a
  // farther cube's top face poke through a nearer cube's side.
  const cells = [
    [-1, -1],
    [0, -1],
    [-1, 0],
    [1, -1],
    [0, 0],
    [-1, 1],
    [1, 0],
    [0, 1],
    [1, 1],
  ].sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  let out = "";
  const originY = CENTER + 10;
  for (const [i, j] of cells) {
    if (rng() < 0.14) continue; // occasional gap for asymmetry
    const height = rng() < 0.4 ? 2 : 1;
    const baseX = CENTER + (i - j) * size;
    const baseY = originY + (i + j) * size * 0.5;
    const shade = pick(rng, [0, 1, 2]);
    const topColor = shade === 0 ? AMBER : shade === 1 ? CHARTREUSE : INK;
    const leftColor = shade === 0 ? "#B3831C" : shade === 1 ? "#6E8A20" : "#A6ABA0";
    const rightColor = shade === 0 ? "#8F6816" : shade === 1 ? "#526419" : "#7D8178";
    for (let h = 0; h < height; h++) {
      out += isoCube(baseX, baseY - h * size, size, {
        top: h === height - 1 ? topColor : leftColor,
        left: leftColor,
        right: rightColor,
        seam: BG_SURFACE,
      });
    }
  }
  return out;
}

// =============================================================================
// 3. HEX FIELD — tessellated hex mosaic, lead: dim chartreuse
// =============================================================================
function hexPoints(cx, cy, size) {
  const pts = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (60 * k - 30);
    pts.push([cx + size * Math.cos(a), cy + size * Math.sin(a)]);
  }
  return pts.map((p) => p.join(",")).join(" ");
}

function hexField(rng) {
  const size = 62;
  const w = Math.sqrt(3) * size;
  const vStep = size * 1.5;
  let out = "";
  for (let row = -1; row * vStep < CANVAS + size; row++) {
    const y = row * vStep;
    const xOffset = row % 2 === 0 ? 0 : w / 2;
    for (let col = -1; col * w < CANVAS + size; col++) {
      const x = col * w + xOffset;
      const dx = x - CENTER;
      const dy = y - CENTER;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 480) continue;
      const roll = rng();
      const pts = hexPoints(x, y, size - 4);
      if (roll < 0.12) {
        out += `<polygon points="${pts}" fill="${CHARTREUSE}" />`;
      } else if (roll < 0.3) {
        out += `<polygon points="${pts}" fill="${CHARTREUSE_DIM}" opacity="0.7" />`;
      } else if (roll < 0.42) {
        out += `<polygon points="${pts}" fill="${AMBER}" opacity="0.85" />`;
      } else if (roll < 0.85) {
        out += `<polygon points="${pts}" fill="none" stroke="${CHARTREUSE_DIM}" stroke-width="2" opacity="0.35" />`;
      }
      // remaining ~15% left empty for breathing texture
    }
  }
  return out;
}

// =============================================================================
// 4. WAVEFORM BARS — symmetric equalizer bars, lead: ink with amber accents
// =============================================================================
function waveformBars(rng) {
  const barCount = 17;
  const bandStart = 150;
  const bandEnd = 874;
  const barW = 22;
  const gap = (bandEnd - bandStart - barCount * barW) / (barCount - 1);
  let out = `<line x1="${bandStart - 20}" y1="${CENTER}" x2="${bandEnd + 20}" y2="${CENTER}" stroke="${MUTED}" stroke-width="2" opacity="0.3" />`;
  const accentIdx = new Set();
  while (accentIdx.size < 3) accentIdx.add(randInt(rng, 0, barCount - 1));
  for (let i = 0; i < barCount; i++) {
    const x = bandStart + i * (barW + gap);
    const t = i / (barCount - 1);
    const envelope = Math.sin(t * Math.PI);
    const half = 40 + envelope * rand(rng, 140, 260);
    const isAccent = accentIdx.has(i);
    const color = isAccent ? AMBER : INK;
    const opacity = isAccent ? 1 : 0.75;
    const rx = 6;
    out += `<rect x="${x}" y="${CENTER - half}" width="${barW}" height="${half * 2}" rx="${rx}" fill="${color}" opacity="${opacity}" />`;
  }
  return out;
}

// =============================================================================
// 5. CONCENTRIC TARGET — offset bullseye with reticle ticks, lead: chartreuse
// =============================================================================
function concentricTarget(rng) {
  const cx = CENTER + rand(rng, -70, 70);
  const cy = CENTER + rand(rng, -70, 70);
  let out = "";
  const rings = [420, 330, 245, 165, 95];
  rings.forEach((r, idx) => {
    const isLead = idx === 1 || idx === 3;
    out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${isLead ? CHARTREUSE : CHARTREUSE_DIM}" stroke-width="${isLead ? 6 : 3}" opacity="${isLead ? 0.9 : 0.4}" />`;
  });
  out += `<circle cx="${cx}" cy="${cy}" r="30" fill="${CHARTREUSE}" />`;
  // reticle ticks at 8 compass points, extending past the outer ring
  for (let k = 0; k < 8; k++) {
    const a = (Math.PI / 4) * k;
    const rInner = 440;
    const rOuter = k % 2 === 0 ? 500 : 470;
    const x1 = cx + rInner * Math.cos(a);
    const y1 = cy + rInner * Math.sin(a);
    const x2 = cx + rOuter * Math.cos(a);
    const y2 = cy + rOuter * Math.sin(a);
    out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${AMBER}" stroke-width="5" stroke-linecap="round" opacity="0.85" />`;
  }
  return out;
}

// =============================================================================
// 6. DOT MATRIX — radiating dot grid, lead: muted with amber ripple highlights
// =============================================================================
function dotMatrix(rng) {
  const cols = 15;
  const spacing = 64;
  const start = CENTER - ((cols - 1) * spacing) / 2;
  const rippleCx = CENTER + rand(rng, -100, 100);
  const rippleCy = CENTER + rand(rng, -100, 100);
  const freq = rand(rng, 0.018, 0.026);
  let out = "";
  for (let row = 0; row < cols; row++) {
    for (let col = 0; col < cols; col++) {
      const x = start + col * spacing;
      const y = start + row * spacing;
      const dist = Math.hypot(x - rippleCx, y - rippleCy);
      if (dist > 470) continue;
      const wave = (Math.cos(dist * freq) + 1) / 2; // 0..1 ripple
      const r = 4 + wave * 12;
      const isHighlight = wave > 0.82;
      out += `<circle cx="${x}" cy="${y}" r="${r}" fill="${isHighlight ? AMBER : MUTED}" opacity="${isHighlight ? 0.95 : 0.5}" />`;
    }
  }
  return out;
}

// =============================================================================
// 7. RADAR SWEEP — ring scope with trailing sweep wedge + blips, lead: amber
// =============================================================================
function radarSweep(rng) {
  let out = "";
  const rings = [140, 230, 320, 410];
  rings.forEach((r) => {
    out += `<circle cx="${CENTER}" cy="${CENTER}" r="${r}" fill="none" stroke="${CHARTREUSE_DIM}" stroke-width="2" opacity="0.35" />`;
  });
  out += `<line x1="${CENTER - 410}" y1="${CENTER}" x2="${CENTER + 410}" y2="${CENTER}" stroke="${CHARTREUSE_DIM}" stroke-width="2" opacity="0.25" />`;
  out += `<line x1="${CENTER}" y1="${CENTER - 410}" x2="${CENTER}" y2="${CENTER + 410}" stroke="${CHARTREUSE_DIM}" stroke-width="2" opacity="0.25" />`;

  const sweepAngle = rand(rng, 0, 360);
  const sweepWidth = 62;
  const outerR = 415;
  const wedge = (angleDeg, width, opacity) => {
    const a0 = ((angleDeg - width) * Math.PI) / 180;
    const a1 = (angleDeg * Math.PI) / 180;
    const x0 = CENTER + outerR * Math.cos(a0);
    const y0 = CENTER + outerR * Math.sin(a0);
    const x1 = CENTER + outerR * Math.cos(a1);
    const y1 = CENTER + outerR * Math.sin(a1);
    return `<path d="M ${CENTER} ${CENTER} L ${x0} ${y0} A ${outerR} ${outerR} 0 0 1 ${x1} ${y1} Z" fill="${AMBER}" opacity="${opacity}" />`;
  };
  out += wedge(sweepAngle, sweepWidth, 0.18);
  out += wedge(sweepAngle, sweepWidth * 0.6, 0.32);
  out += wedge(sweepAngle, sweepWidth * 0.25, 0.55);
  out += `<line x1="${CENTER}" y1="${CENTER}" x2="${CENTER + outerR * Math.cos((sweepAngle * Math.PI) / 180)}" y2="${CENTER + outerR * Math.sin((sweepAngle * Math.PI) / 180)}" stroke="${AMBER}" stroke-width="5" opacity="0.9" />`;

  for (let i = 0; i < 6; i++) {
    const a = rand(rng, 0, Math.PI * 2);
    const r = rand(rng, 90, 400);
    const x = CENTER + r * Math.cos(a);
    const y = CENTER + r * Math.sin(a);
    out += `<circle cx="${x}" cy="${y}" r="${rand(rng, 6, 11)}" fill="${CHARTREUSE}" opacity="0.85" />`;
  }
  out += `<circle cx="${CENTER}" cy="${CENTER}" r="10" fill="${CHARTREUSE}" />`;
  return out;
}

// =============================================================================
// 8. SCANLINE GLITCH — offset horizontal bands + glitch blocks, lead: dim chartreuse
// =============================================================================
function scanlineGlitch(rng) {
  let out = "";
  const bandCount = 22;
  for (let i = 0; i < bandCount; i++) {
    const y = 60 + i * ((CANVAS - 120) / bandCount) + rand(rng, -6, 6);
    const full = rng() < 0.55;
    const x1 = full ? 60 : rand(rng, 60, 500);
    const x2 = full ? 964 : x1 + rand(rng, 120, 420);
    const width = rng() < 0.15 ? 8 : 2.5;
    const color = rng() < 0.2 ? AMBER : CHARTREUSE_DIM;
    const opacity = rand(rng, 0.2, 0.55);
    out += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="${width}" opacity="${opacity}" />`;
  }
  // a few displaced glitch blocks
  for (let i = 0; i < 5; i++) {
    const y = rand(rng, 160, 864);
    const h = rand(rng, 14, 40);
    const x = rand(rng, 80, 600);
    const w = rand(rng, 140, 340);
    const dx = rand(rng, -30, 30);
    const color = pick(rng, [AMBER, INK, CHARTREUSE]);
    out += `<rect x="${x + dx}" y="${y}" width="${w}" height="${h}" fill="${color}" opacity="${rand(rng, 0.35, 0.6)}" />`;
  }
  return out;
}

// =============================================================================
// 9. TRIANGLE MESH — jittered faceted low-poly grid, lead: ink
// =============================================================================
function triangleMesh(rng) {
  const gridN = 6;
  const margin = 110;
  const span = CANVAS - margin * 2;
  const cell = span / gridN;
  const verts = [];
  for (let row = 0; row <= gridN; row++) {
    verts[row] = [];
    for (let col = 0; col <= gridN; col++) {
      const jx = rand(rng, -cell * 0.22, cell * 0.22);
      const jy = rand(rng, -cell * 0.22, cell * 0.22);
      verts[row][col] = [margin + col * cell + jx, margin + row * cell + jy];
    }
  }
  let out = "";
  for (let row = 0; row < gridN; row++) {
    for (let col = 0; col < gridN; col++) {
      const a = verts[row][col];
      const b = verts[row][col + 1];
      const c = verts[row + 1][col];
      const d = verts[row + 1][col + 1];
      const cxA = (a[0] + b[0] + c[0]) / 3;
      const cyA = (a[1] + b[1] + c[1]) / 3;
      const cxB = (b[0] + c[0] + d[0]) / 3;
      const cyB = (b[1] + c[1] + d[1]) / 3;
      const light = (cx, cy) => {
        const dx = cx - CENTER;
        const dy = cy - CENTER;
        const dist = Math.hypot(dx, dy) / 520;
        return Math.max(0.08, 0.55 - dist * 0.5);
      };
      const opA = light(cxA, cyA) + (rng() < 0.15 ? 0.35 : 0);
      const opB = light(cxB, cyB) + (rng() < 0.15 ? 0.35 : 0);
      out += `<polygon points="${a.join(",")} ${b.join(",")} ${c.join(",")}" fill="${INK}" opacity="${Math.min(0.95, opA).toFixed(2)}" stroke="${BG_RAISED}" stroke-width="2" />`;
      out += `<polygon points="${b.join(",")} ${c.join(",")} ${d.join(",")}" fill="${INK}" opacity="${Math.min(0.95, opB).toFixed(2)}" stroke="${BG_RAISED}" stroke-width="2" />`;
    }
  }
  return out;
}

// =============================================================================
// 10. PIXEL BLOCKS — polyomino-style growth cluster, lead: amber
// =============================================================================
function pixelBlocks(rng) {
  const unit = 78;
  const gap = 6;
  const occupied = new Set();
  const key = (x, y) => `${x},${y}`;
  const cells = [];
  let x = 0;
  let y = 0;
  occupied.add(key(x, y));
  cells.push([x, y]);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (cells.length < 15) {
    const [bx, by] = pick(rng, cells);
    const [dx, dy] = pick(rng, dirs);
    const nx = bx + dx;
    const ny = by + dy;
    if (occupied.has(key(nx, ny))) continue;
    if (Math.abs(nx) > 3 || Math.abs(ny) > 3) continue;
    occupied.add(key(nx, ny));
    cells.push([nx, ny]);
  }
  const xs = cells.map((c) => c[0]);
  const ys = cells.map((c) => c[1]);
  const offsetX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const offsetY = (Math.min(...ys) + Math.max(...ys)) / 2;

  let out = "";
  for (const [cx, cy] of cells) {
    const px = CENTER + (cx - offsetX) * unit - unit / 2 + gap / 2;
    const py = CENTER + (cy - offsetY) * unit - unit / 2 + gap / 2;
    const roll = rng();
    const color = roll < 0.32 ? AMBER : roll < 0.58 ? CHARTREUSE_DIM : roll < 0.8 ? INK : MUTED;
    const opacity = color === AMBER ? 0.95 : 0.75;
    out += `<rect x="${px}" y="${py}" width="${unit - gap}" height="${unit - gap}" rx="4" fill="${color}" opacity="${opacity}" />`;
  }
  return out;
}

// =============================================================================
// 11. ORBIT RINGS — rotated elliptical orbits with node planets, lead: chartreuse
// =============================================================================
function orbitRings(rng) {
  let out = `<circle cx="${CENTER}" cy="${CENTER}" r="34" fill="${CHARTREUSE}" />`;
  out += `<circle cx="${CENTER}" cy="${CENTER}" r="52" fill="none" stroke="${CHARTREUSE}" stroke-width="3" opacity="0.4" />`;
  const orbitCount = 3;
  for (let i = 0; i < orbitCount; i++) {
    const rx = 150 + i * 105;
    const ry = rx * rand(rng, 0.34, 0.5);
    const angle = rand(rng, 0, 180);
    out += `<g transform="translate(${CENTER} ${CENTER}) rotate(${angle.toFixed(1)})">`;
    out += `<ellipse cx="0" cy="0" rx="${rx}" ry="${ry}" fill="none" stroke="${CHARTREUSE_DIM}" stroke-width="2.5" opacity="0.5" />`;
    const nodeCount = i === 1 ? 2 : 1;
    for (let n = 0; n < nodeCount; n++) {
      const t = rand(rng, 0, Math.PI * 2);
      const nx = rx * Math.cos(t);
      const ny = ry * Math.sin(t);
      const isAmber = rng() < 0.4;
      out += `<circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="${rand(rng, 14, 22).toFixed(1)}" fill="${isAmber ? AMBER : CHARTREUSE}" />`;
    }
    out += `</g>`;
  }
  return out;
}

// =============================================================================
// 12. SPECTRUM RADIAL — sunburst of radial bars, lead: muted with amber accents
// =============================================================================
function spectrumRadial(rng) {
  const barCount = 28;
  const innerR = 110;
  let out = `<circle cx="${CENTER}" cy="${CENTER}" r="${innerR - 8}" fill="none" stroke="${MUTED}" stroke-width="2" opacity="0.4" />`;
  const phase = rand(rng, 0, Math.PI * 2);
  const accentEvery = 7;
  for (let i = 0; i < barCount; i++) {
    const a = (i / barCount) * Math.PI * 2;
    const wave = (Math.sin(a * 3 + phase) + 1) / 2;
    const len = 60 + wave * rand(rng, 150, 260);
    const isAccent = i % accentEvery === 0;
    const x1 = CENTER + innerR * Math.cos(a);
    const y1 = CENTER + innerR * Math.sin(a);
    const x2 = CENTER + (innerR + len) * Math.cos(a);
    const y2 = CENTER + (innerR + len) * Math.sin(a);
    out += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${isAccent ? AMBER : MUTED}" stroke-width="${isAccent ? 10 : 6}" stroke-linecap="round" opacity="${isAccent ? 0.95 : 0.55}" />`;
  }
  return out;
}

// =============================================================================
// 13. CROSSHAIR / D-PAD — plus-pentomino with diamond frame, lead: dim chartreuse
// =============================================================================
function crosshairDpad(rng) {
  const unit = 96;
  const cells = [
    [0, -1],
    [-1, 0],
    [0, 0],
    [1, 0],
    [0, 1],
  ];
  let out = "";
  for (const [cx, cy] of cells) {
    const px = CENTER + cx * unit - unit / 2;
    const py = CENTER + cy * unit - unit / 2;
    out += `<rect x="${px}" y="${py}" width="${unit}" height="${unit}" fill="${CHARTREUSE_DIM}" stroke="${BG_DARK}" stroke-width="4" opacity="0.92" />`;
  }
  out += `<circle cx="${CENTER}" cy="${CENTER}" r="20" fill="${CHARTREUSE}" />`;
  // rotated diamond frame
  const frameR = rand(rng, 330, 380);
  const pts = [
    [CENTER, CENTER - frameR],
    [CENTER + frameR, CENTER],
    [CENTER, CENTER + frameR],
    [CENTER - frameR, CENTER],
  ]
    .map((p) => p.join(","))
    .join(" ");
  out += `<polygon points="${pts}" fill="none" stroke="${CHARTREUSE}" stroke-width="4" opacity="0.55" />`;
  // corner ticks
  for (let k = 0; k < 4; k++) {
    const a = (Math.PI / 2) * k + Math.PI / 4;
    const r1 = frameR + 20;
    const r2 = frameR + 55;
    const x1 = CENTER + r1 * Math.cos(a);
    const y1 = CENTER + r1 * Math.sin(a);
    const x2 = CENTER + r2 * Math.cos(a);
    const y2 = CENTER + r2 * Math.sin(a);
    out += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${AMBER}" stroke-width="6" stroke-linecap="round" opacity="0.85" />`;
  }
  return out;
}

// =============================================================================
// 14. NODE GRAPH BLUEPRINT — grid backdrop + connected node network, lead: amber
// =============================================================================
function nodeGraphBlueprint(rng) {
  let out = "";
  const step = 64;
  for (let x = step; x < CANVAS; x += step) {
    out += `<line x1="${x}" y1="0" x2="${x}" y2="${CANVAS}" stroke="${MUTED}" stroke-width="1" opacity="0.12" />`;
  }
  for (let y = step; y < CANVAS; y += step) {
    out += `<line x1="0" y1="${y}" x2="${CANVAS}" y2="${y}" stroke="${MUTED}" stroke-width="1" opacity="0.12" />`;
  }

  const nodeCount = 9;
  const nodes = [];
  const cols = 3;
  const rows = 3;
  const cellW = 680 / (cols - 1);
  const cellH = 680 / (rows - 1);
  const originX = CENTER - 340;
  const originY = CENTER - 340;
  for (let i = 0; i < nodeCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const jx = rand(rng, -55, 55);
    const jy = rand(rng, -55, 55);
    nodes.push([originX + col * cellW + jx, originY + row * cellH + jy]);
  }

  const edges = [];
  const edgeCount = 11;
  let guard = 0;
  while (edges.length < edgeCount && guard < 200) {
    guard++;
    const a = randInt(rng, 0, nodeCount - 1);
    const b = randInt(rng, 0, nodeCount - 1);
    if (a === b) continue;
    const dup = edges.some((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a));
    if (dup) continue;
    edges.push([a, b]);
  }
  for (const [a, b] of edges) {
    const [x1, y1] = nodes[a];
    const [x2, y2] = nodes[b];
    out += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${CHARTREUSE_DIM}" stroke-width="2.5" opacity="0.55" />`;
  }
  for (const [x, y] of nodes) {
    const isLead = rng() < 0.45;
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="14" fill="none" stroke="${MUTED}" stroke-width="2" opacity="0.5" />`;
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${isLead ? 12 : 9}" fill="${isLead ? AMBER : CHARTREUSE_DIM}" />`;
  }
  return out;
}

// =============================================================================
const DESIGNS = [
  { slug: "circuit-traces", bg: BG_DARK, build: circuitTraces },
  { slug: "isometric-blocks", bg: BG_SURFACE, build: isometricBlocks },
  { slug: "hex-field", bg: BG_RAISED, build: hexField },
  { slug: "waveform-bars", bg: BG_DARK, build: waveformBars },
  { slug: "concentric-target", bg: BG_RAISED, build: concentricTarget },
  { slug: "dot-matrix", bg: BG_SURFACE, build: dotMatrix },
  { slug: "radar-sweep", bg: BG_DARK, build: radarSweep },
  { slug: "scanline-glitch", bg: BG_DARK, build: scanlineGlitch },
  { slug: "triangle-mesh", bg: BG_RAISED, build: triangleMesh },
  { slug: "pixel-blocks", bg: BG_SURFACE, build: pixelBlocks },
  { slug: "orbit-rings", bg: BG_SURFACE, build: orbitRings },
  { slug: "spectrum-radial", bg: BG_RAISED, build: spectrumRadial },
  { slug: "crosshair-dpad", bg: BG_DARK, build: crosshairDpad },
  { slug: "node-graph", bg: BG_RAISED, build: nodeGraphBlueprint },
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const noiseTile = readFileSync(NOISE_PATH);

  for (let i = 0; i < DESIGNS.length; i++) {
    const { slug, bg, build } = DESIGNS[i];
    const rng = mulberry32(1000 + i * 97);
    const inner = build(rng);
    const svg = svgDoc(inner, bg);
    const buffer = await sharp(Buffer.from(svg))
      .resize(CANVAS, CANVAS)
      .composite([{ input: noiseTile, tile: true, blend: "over" }])
      .png()
      .toBuffer();
    const filename = `avatar-${String(i + 1).padStart(2, "0")}-${slug}.png`;
    writeFileSync(path.join(OUT_DIR, filename), buffer);
    console.log(`wrote ${filename}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
