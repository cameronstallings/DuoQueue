import { defineConfig } from "vitest/config";

/**
 * `pnpm test` runs from here, and until now the default include (everything under this
 * package) was exactly right. The new-player ping added one more place where a decision that
 * can be WRONG lives outside this app: `supabase/functions/_shared/new-player-alert.ts`, the
 * push copy and the claim-before-send rule for `send-new-player-alerts`.
 *
 * That module is deliberately pure — no `Deno`, no `npm:` specifiers — precisely so it can be
 * tested by this runner instead of needing a second one nobody remembers to run. The Edge
 * Function imports it with a `.ts` extension the way Deno requires; the test imports it
 * without, so Vite resolves it normally.
 *
 * The third entry is there for the same reason and pays the same price: the 18+ age gate is
 * decided in two places, and one of them is `packages/shared-types/src/profile.ts` (`dobSchema`,
 * the email path) rather than in this app at all. Its twin, `checkDob`, is already covered by
 * `src/features/auth/completeSignup.test.ts`, and the two are written to be identical, so
 * testing one and not the other is exactly how they would drift. `shared-types` has no runner of
 * its own; this one already resolves the package, so it borrows it.
 *
 * The trade, stated because it is not free: files under `supabase/functions/` are not covered
 * by `pnpm typecheck` or `pnpm lint` (nothing in this repo type-checks Deno functions — they
 * use globals and `npm:` imports the mobile tsconfig has never seen). So this config buys
 * those two files test coverage, not type coverage.
 */
export default defineConfig({
  test: {
    include: [
      "src/**/*.test.ts",
      "../../supabase/functions/**/*.test.ts",
      "../../packages/shared-types/src/**/*.test.ts",
    ],
  },
});
