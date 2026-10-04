// Minimal headless Chrome driver over the DevTools protocol. No npm packages: it spawns
// Chrome with its own throwaway profile and talks to it with Node's built-in WebSocket.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  path.join(os.homedir(), "AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"),
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

export function findChrome() {
  const hit = CANDIDATES.find((p) => fs.existsSync(p));
  if (!hit) throw new Error("Chrome not found. Set CHROME_PATH to chrome.exe.");
  return hit;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ profileDir, timeoutMs = 30000 } = {}) {
  fs.rmSync(path.join(profileDir, "DevToolsActivePort"), { force: true });
  fs.mkdirSync(profileDir, { recursive: true });
  const proc = spawn(
    findChrome(),
    [
      "--headless",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--mute-audio",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      "--font-render-hinting=none",
      "--allow-file-access-from-files",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  const portFile = path.join(profileDir, "DevToolsActivePort");
  const start = Date.now();
  while (!fs.existsSync(portFile) || fs.readFileSync(portFile, "utf8").split("\n").length < 2) {
    if (Date.now() - start > timeoutMs) {
      proc.kill();
      throw new Error("Chrome did not start (no DevToolsActivePort)");
    }
    await sleep(100);
  }
  const [port, wsPath] = fs.readFileSync(portFile, "utf8").trim().split("\n");
  const browser = await Connection.open(`ws://127.0.0.1:${port}${wsPath}`);
  browser.proc = proc;
  return browser;
}

class Connection {
  static open(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.addEventListener("open", () => resolve(new Connection(ws)));
      ws.addEventListener("error", (e) => reject(new Error(`DevTools socket error: ${e.message || e.type}`)));
    });
  }
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject, method } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const l of this.listeners) l(msg);
      }
    });
  }
  send(method, params = {}, sessionId, timeoutMs = 60000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, {
        method,
        resolve: (v) => (clearTimeout(timer), resolve(v)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  waitFor(method, sessionId, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners = this.listeners.filter((l) => l !== fn);
        reject(new Error(`waiting for ${method} timed out`));
      }, timeoutMs);
      const fn = (msg) => {
        if (msg.method === method && (!sessionId || msg.sessionId === sessionId)) {
          clearTimeout(timer);
          this.listeners = this.listeners.filter((l) => l !== fn);
          resolve(msg.params);
        }
      };
      this.listeners.push(fn);
    });
  }
  async newPage({ width, height }) {
    const { targetId } = await this.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await this.send("Target.attachToTarget", { targetId, flatten: true });
    const page = new Page(this, sessionId, targetId);
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("DOM.enable");
    await page.send("CSS.enable");
    await page.setSize(width, height);
    return page;
  }
  async close() {
    try {
      await this.send("Browser.close", {}, undefined, 5000);
    } catch {
      /* already gone */
    }
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
    await sleep(300);
    if (this.proc && this.proc.exitCode === null) this.proc.kill();
  }
}

class Page {
  constructor(conn, sessionId, targetId) {
    Object.assign(this, { conn, sessionId, targetId });
  }
  send(method, params, timeoutMs) {
    return this.conn.send(method, params, this.sessionId, timeoutMs);
  }
  setSize(width, height) {
    return this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  }
  async goto(url) {
    const loaded = this.conn.waitFor("Page.loadEventFired", this.sessionId);
    const r = await this.send("Page.navigate", { url });
    if (r.errorText) throw new Error(`navigate ${url}: ${r.errorText}`);
    await loaded;
  }
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, 120000);
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error(`page error: ${d.exception?.description || d.text}`);
    }
    return r.result.value;
  }
  async screenshot({ width, height, format = "png", quality }) {
    const r = await this.send("Page.captureScreenshot", {
      format,
      ...(quality ? { quality } : {}),
      clip: { x: 0, y: 0, width, height, scale: 1 },
      captureBeyondViewport: false,
      fromSurface: true,
    });
    return Buffer.from(r.data, "base64");
  }
  // Every font Chrome actually used to draw each element's own text. A system font in this
  // list means a glyph fell back (the real font lacks it).
  async fontsUsed(selector) {
    const { root } = await this.send("DOM.getDocument", { depth: -1 });
    const { nodeIds } = await this.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector });
    const out = [];
    for (const nodeId of nodeIds) {
      const { fonts } = await this.send("CSS.getPlatformFontsForNode", { nodeId });
      if (fonts.length) out.push({ nodeId, fonts });
    }
    return out;
  }
}
