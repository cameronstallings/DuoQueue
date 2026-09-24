// scripts/deploy-site.mjs — builds site/ and publishes it to the gh-pages branch.
//
//   node scripts/deploy-site.mjs --dry-run   build, assert everything, touch nothing
//   node scripts/deploy-site.mjs             build, commit, push, verify the live site
//
// Zero dependencies: node:child_process, node:fs, and global fetch, matching the rest of
// scripts/.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A SCRIPT AND NOT A README SECTION
//
// duoqueue.io is the App Store's registered Privacy Policy URL and Support URL for an app
// that is already approved. A deploy that takes it down is a Guideline 5.1.1 problem on a
// live listing, not a website outage. This branch's own gh-pages history reads
// `c3e8f2f Delete CNAME` then `13d3a79 Create CNAME`, which is what that failure looks
// like from the inside: someone mirrored a directory over the worktree, the custom domain
// file was not in the directory, and the domain went away.
//
// So every step that has actually gone wrong here before is now an assertion:
//
//   1  the build must exit 0
//   2  every expected output must exist and be non-empty, CNAME and .nojekyll included
//   3  the worktree must exist, outside the repo tree so no glob or build ever sees it
//   4  the worktree's HEAD must be ATTACHED to refs/heads/gh-pages. A detached HEAD
//      commits into the void and pushes nothing, silently
//   5  pull --ff-only first, so a manual edit made in the GitHub UI is never clobbered
//   6  copy, never `rm -rf`. Anything in the worktree that site/ does not produce is
//      REPORTED, not deleted, because that is how CNAME disappeared
//   7  commit, and treat "nothing to commit" as success rather than as an error
//   8  the remote's SHA must equal the local worktree's HEAD. A push that silently did
//      nothing fails here
//   9  fetch the live site and assert a per-page sentinel string, retrying for 90s while
//      Pages rebuilds. /privacy/ and /terms/ are checked on EVERY deploy, not because
//      this change touches them but because this branch serves them
// ---------------------------------------------------------------------------

import { spawnSync } from "node:child_process";
import { existsSync, statSync, cpSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SITE_DIR = path.join(ROOT, "site");
const WORKTREE = path.resolve(ROOT, "..", "duoqueue-gh-pages");
const BRANCH = "gh-pages";
const ORIGIN = "https://duoqueue.io";

const DRY_RUN = process.argv.includes("--dry-run");

// The launch film and its poster (FILM in build-site.mjs). Committed under site/assets/ rather
// than generated, and build-site.mjs quietly leaves the film section out when either is
// missing, so the build alone would publish a landing page without them and still exit 0.
// Listing them here makes that a failed deploy instead, and the live checks below make a
// deploy that serves the wrong bytes, or serves them as the wrong type, a failed deploy too.
const FILM_FILES = [
  { rel: "assets/duoqueue-launch.mp4", contentType: "video/mp4" },
  { rel: "assets/duoqueue-launch-poster.jpg", contentType: "image/jpeg" },
];

// Every file the build must have produced. A missing one is a failed deploy, not a
// warning: three of these five are the difference between a working custom domain and a
// dead one.
const REQUIRED = [
  "index.html",
  "waitlist/index.html",
  "waitlist/thanks/index.html",
  "waitlist/try-again/index.html",
  "tt/index.html",
  "ig/index.html",
  "yt/index.html",
  "privacy/index.html",
  "terms/index.html",
  "CNAME",
  "og.png",
  "favicon.png",
  "fonts/unbounded-700.woff2",
  "fonts/manrope-800.woff2",
  "fonts/manrope-700.woff2",
  "fonts/manrope-500.woff2",
  "fonts/plex-mono-600.woff2",
  ...FILM_FILES.map((f) => f.rel),
];
// .nojekyll is required to exist but is legitimately zero bytes, so it is checked apart
// from the non-empty rule rather than exempted from a shared one by a special case.
const REQUIRED_MAY_BE_EMPTY = [".nojekyll"];

// Per-page proof that the thing now being served is the thing that was just built. A 200
// is not enough: GitHub Pages serves the PREVIOUS build with a 200 for a minute or so
// after a push.
//
// A binary has no sentinel string, so the film's two files are checked by what they CAN
// prove: `contentType` must match (a video served as text/html is a 404 page in disguise),
// and `sizeOf` names the built file whose byte count the served Content-Length must equal,
// which is what tells a new encode from the previous one still being served.
const LIVE_CHECKS = [
  { url: `${ORIGIN}/`, sentinel: 'id="waitlist-form"' },
  { url: `${ORIGIN}/`, sentinel: 'src="/assets/duoqueue-launch.mp4"' },
  { url: `${ORIGIN}/waitlist/`, sentinel: 'id="waitlist-form"' },
  { url: `${ORIGIN}/tt/`, sentinel: 'name="source" value="tt"' },
  { url: `${ORIGIN}/waitlist/thanks/`, sentinel: "on the list" },
  { url: `${ORIGIN}/waitlist/try-again/`, sentinel: "18 or older box" },
  { url: `${ORIGIN}/privacy/`, sentinel: "Privacy Policy" },
  { url: `${ORIGIN}/terms/`, sentinel: "Terms of Service" },
  { url: `${ORIGIN}/CNAME`, sentinel: "duoqueue.io" },
  { url: `${ORIGIN}/fonts/manrope-800.woff2`, sentinel: null },
  ...FILM_FILES.map((f) => ({ url: `${ORIGIN}/${f.rel}`, sentinel: null, contentType: f.contentType, sizeOf: f.rel })),
];

function die(message) {
  console.error(`\nDEPLOY ABORTED: ${message}`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  if (res.error) die(`could not run ${cmd}: ${res.error.message}`);
  return { code: res.status, out: (res.stdout ?? "").trim(), err: (res.stderr ?? "").trim() };
}

function git(args, cwd = ROOT) {
  return run("git", args, { cwd });
}

// ---------------------------------------------------------------------------
// 1. Build
// ---------------------------------------------------------------------------
console.log("1. building site/");
const build = run(process.execPath, [path.join(__dirname, "build-site.mjs")], { cwd: ROOT });
if (build.code !== 0) {
  console.error(build.out);
  console.error(build.err);
  die("scripts/build-site.mjs exited non-zero. Nothing was copied or pushed.");
}
console.log(
  build.out
    .split("\n")
    .filter((l) => l.startsWith("wrote") || l.startsWith("Built"))
    .map((l) => `   ${l}`)
    .join("\n")
);

// ---------------------------------------------------------------------------
// 2. Assert the outputs
// ---------------------------------------------------------------------------
console.log("2. asserting build outputs");
const missing = [];
for (const rel of REQUIRED) {
  const p = path.join(SITE_DIR, rel);
  if (!existsSync(p)) missing.push(`${rel} (missing)`);
  else if (statSync(p).size === 0) missing.push(`${rel} (empty)`);
}
for (const rel of REQUIRED_MAY_BE_EMPTY) {
  if (!existsSync(path.join(SITE_DIR, rel))) missing.push(`${rel} (missing)`);
}
if (missing.length) die(`build outputs are incomplete:\n  ${missing.join("\n  ")}`);
console.log(`   ${REQUIRED.length + REQUIRED_MAY_BE_EMPTY.length} files present and non-empty`);

// ---------------------------------------------------------------------------
// 3-4. The worktree, and the assertion that it is attached to the branch
// ---------------------------------------------------------------------------
console.log(`3. worktree at ${WORKTREE}`);
if (!existsSync(WORKTREE)) {
  const fetched = git(["fetch", "origin", `${BRANCH}:${BRANCH}`]);
  if (fetched.code !== 0 && !/up to date|\[new branch\]|rejected/i.test(fetched.err)) {
    console.log(`   (fetch note: ${fetched.err.split("\n")[0]})`);
  }
  const add = git(["worktree", "add", WORKTREE, BRANCH]);
  if (add.code !== 0) die(`git worktree add failed:\n${add.err}`);
  console.log(`   created`);
} else {
  console.log(`   exists`);
}

console.log("4. asserting the worktree is attached to the branch");
const head = git(["symbolic-ref", "-q", "HEAD"], WORKTREE);
if (head.code !== 0 || head.out !== `refs/heads/${BRANCH}`) {
  die(
    `the worktree's HEAD is ${head.out || "DETACHED"}, not refs/heads/${BRANCH}.\n` +
      `  A detached HEAD accepts a commit and pushes nothing, silently. Fix it with:\n` +
      `    git -C "${WORKTREE}" checkout ${BRANCH}`
  );
}
console.log(`   HEAD -> ${head.out}`);

// ---------------------------------------------------------------------------
// 5. Fast-forward only
// ---------------------------------------------------------------------------
console.log("5. pull --ff-only");
const pull = git(["pull", "--ff-only"], WORKTREE);
if (pull.code !== 0) {
  die(
    `pull --ff-only failed. The remote branch has commits this worktree does not.\n` +
      `  Resolve by hand rather than forcing, because a manual edit in the GitHub UI\n` +
      `  looks exactly like this:\n${pull.err}`
  );
}
console.log(`   ${pull.out.split("\n")[0] || "up to date"}`);

// ---------------------------------------------------------------------------
// 6. Copy, and report anything the build does not produce
// ---------------------------------------------------------------------------
console.log("6. copying site/ over the worktree");

function walk(dir, base = dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, acc);
    else acc.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return acc;
}

const built = new Set(walk(SITE_DIR));
const inWorktree = walk(WORKTREE);
const orphans = inWorktree.filter((f) => !built.has(f));
if (orphans.length) {
  console.log(
    `   NOTE: ${orphans.length} file(s) live on ${BRANCH} that site/ does not produce.\n` +
      orphans.map((f) => `     ${f}`).join("\n") +
      `\n   They are left alone on purpose. Deleting a file this build does not know about\n` +
      `   is how CNAME was lost once already. Remove any that are genuinely stale by hand.`
  );
}

if (DRY_RUN) {
  console.log("\n--dry-run: stopping before the copy. Nothing was written, committed or pushed.");
  console.log(`Would copy ${built.size} file(s) into ${WORKTREE}, then commit and push.`);
  console.log("\nRe-run without --dry-run to publish.");
  process.exit(0);
}

cpSync(SITE_DIR, WORKTREE, { recursive: true });
console.log(`   copied ${built.size} file(s)`);

// ---------------------------------------------------------------------------
// 7. Commit and push
// ---------------------------------------------------------------------------
console.log("7. commit and push");
git(["add", "-A"], WORKTREE);
const status = git(["status", "--porcelain"], WORKTREE);
if (status.out === "") {
  console.log("   nothing changed; the published site already matches site/");
} else {
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const commit = git(["commit", "-m", `Publish site ${stamp}`], WORKTREE);
  if (commit.code !== 0) die(`commit failed:\n${commit.err}\n${commit.out}`);
  console.log(`   ${commit.out.split("\n")[0]}`);
  const push = git(["push", "origin", BRANCH], WORKTREE);
  if (push.code !== 0) die(`push failed:\n${push.err}`);
  console.log("   pushed");
}

// ---------------------------------------------------------------------------
// 8. Did the push actually land
// ---------------------------------------------------------------------------
console.log("8. verifying the remote SHA");
const localSha = git(["rev-parse", "HEAD"], WORKTREE).out;
const remote = git(["ls-remote", "origin", `refs/heads/${BRANCH}`], WORKTREE);
const remoteSha = remote.out.split(/\s+/)[0] ?? "";
if (!remoteSha) die("git ls-remote returned nothing for the branch.");
if (remoteSha !== localSha) {
  die(`remote is ${remoteSha.slice(0, 12)} but local is ${localSha.slice(0, 12)}. The push did not land.`);
}
console.log(`   origin/${BRANCH} = ${remoteSha.slice(0, 12)} (matches)`);

// ---------------------------------------------------------------------------
// 9. Verify the LIVE site, not the push
// ---------------------------------------------------------------------------
console.log("9. verifying the live site (up to 90s while Pages rebuilds)");

async function check({ url, sentinel, contentType, sizeOf }) {
  const deadline = Date.now() + 90_000;
  // Read once, before the loop: the size of the file this deploy just built and pushed.
  const wantBytes = sizeOf ? statSync(path.join(SITE_DIR, sizeOf)).size : null;
  let last = "";
  for (;;) {
    try {
      const res = await fetch(url, { cache: "no-store", redirect: "follow" });
      if (res.ok) {
        const type = res.headers.get("content-type") ?? "";
        if (!sentinel) {
          const length = res.headers.get("content-length");
          const encoded = res.headers.get("content-encoding");
          // Headers are all this needs; do not download a whole film to throw it away.
          await res.body?.cancel();
          if (contentType && !type.toLowerCase().startsWith(contentType)) {
            last = `${res.status} but content-type is ${JSON.stringify(type)}, expected ${contentType}`;
          } else if (wantBytes !== null && !encoded && length !== null && Number(length) !== wantBytes) {
            last = `${res.status} but ${length} bytes served, ${wantBytes} built (still the previous build?)`;
          } else {
            const size = wantBytes === null ? "" : `, ${length ?? "no content-length"} of ${wantBytes} bytes`;
            return { ok: true, note: `${res.status} ${type}${size}` };
          }
        } else {
          const body = await res.text();
          if (body.includes(sentinel)) return { ok: true, note: `${res.status}, sentinel found` };
          last = `${res.status} but sentinel ${JSON.stringify(sentinel)} not found`;
        }
      } else {
        last = `HTTP ${res.status}`;
      }
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    if (Date.now() > deadline) return { ok: false, note: last };
    await new Promise((r) => setTimeout(r, 5000));
  }
}

let failed = 0;
for (const item of LIVE_CHECKS) {
  const result = await check(item);
  console.log(`   ${result.ok ? "OK  " : "FAIL"} ${item.url}  (${result.note})`);
  if (!result.ok) failed++;
}
if (failed) die(`${failed} live check(s) failed. The site is published but not serving what was built.`);

console.log("\nDeployed. duoqueue.io is serving the build in site/.");
