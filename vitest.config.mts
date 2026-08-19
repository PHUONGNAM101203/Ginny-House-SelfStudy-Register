import { defineConfig } from "vitest/config"
import { config } from "dotenv"

// Load .env.local (git-ignored) so `npm run test:integration` can pick up
// NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY without requiring
// the caller to export them manually. Not specified in the Task 3 brief,
// but required to make the brief's exact `test:integration` script work
// standalone, given `dotenv` was installed as part of this task.
config({ path: ".env.local", quiet: true })

export default defineConfig({
  test: {},
})
