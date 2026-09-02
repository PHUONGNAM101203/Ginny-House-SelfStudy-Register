import { defineConfig } from "vitest/config"
import { config } from "dotenv"
import path from "path"

// Load .env.local (git-ignored) so `npm run test:integration` can pick up
// NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY without requiring
// the caller to export them manually. Not specified in the Task 3 brief,
// but required to make the brief's exact `test:integration` script work
// standalone, given `dotenv` was installed as part of this task.
config({ path: ".env.local", quiet: true })

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
    },
  },
  test: {
    // Feature work happens in git worktrees under .claude/worktrees/, each a
    // full checkout — without this the default glob collects every suite
    // twice (once per tree). Both copies then hammer the same local database
    // concurrently, so the integration suites knock each other over with
    // exclusion violations on top of just being reported twice.
    // node_modules/dist are vitest's own defaults, repeated here because
    // setting `exclude` replaces them rather than adding to them.
    // tests/e2e is Playwright's (playwright.config.ts) — vitest picking it up
    // only ever produced "Playwright Test did not expect test() to be called
    // here", a permanent red file that hid real failures.
    exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/worktrees/**", "tests/e2e/**"],
  },
})
