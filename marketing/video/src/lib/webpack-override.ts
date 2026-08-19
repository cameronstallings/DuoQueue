import fs from "node:fs";
import path from "node:path";
import type { WebpackOverrideFn } from "@remotion/bundler";

/** The repo root, found by walking up from cwd until the file the `@app` alias has to reach
 * is actually there, so a bad anchor fails loudly here instead of as a webpack resolve error.
 *
 * This module's own location is deliberately not used. The Remotion CLI bundles
 * remotion.config.ts (and everything it imports) to CJS in memory and eval()s it, so
 * `import.meta.url` is empty and `__dirname` points inside @remotion/cli. cwd is the one
 * anchor both consumers agree on: the CLI chdirs to the Remotion root before evaluating the
 * config, and the batch render runs through `pnpm --dir marketing/video`, which does the
 * same. Walking up also makes a call from the repo root itself resolve correctly. */
const findRepoRoot = (): string => {
  let dir = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(dir, "apps", "mobile", "src", "theme", "tokens.ts"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not find the DuoQueue repo root above ${process.cwd()}. Run video commands through the root scripts (pnpm video:studio, pnpm video:day) or from inside marketing/video.`,
      );
    }
    dir = parent;
  }
};

const repoRoot = findRepoRoot();

/** Mirrors the `paths` entries in tsconfig.json. tsconfig paths are a typecheck-time
 * concept; webpack needs to be told separately or the alias resolves at compile time and
 * fails at bundle time.
 *
 * This lives in its own module, not in remotion.config.ts, because the config file is read
 * only by the CLI and Studio. The batch render (Task 10) calls bundle() programmatically and
 * has to pass the same function, or you get the classic "works in Studio, fails in render". */
export const webpackOverride: WebpackOverrideFn = (config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...config.resolve?.alias,
      "@app": path.join(repoRoot, "apps", "mobile", "src"),
      "@": path.join(repoRoot, "marketing", "video", "src"),
    },
  },
});
