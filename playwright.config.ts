import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    // Deliberately NOT the server's Asia/Ho_Chi_Minh. Calendar days travel
    // between server and client as "yyyy-MM-dd" strings precisely so the two
    // sides cannot disagree (see lib/vn-date.ts); running the browser in a
    // different zone from the dev server is what makes the day-navigation test
    // able to catch a regression back to passing Date instants across the RSC
    // boundary — under that bug, "Ngày sau" is a no-op for a UTC browser.
    timezoneId: "UTC",
  },
})
