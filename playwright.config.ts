import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4174/kanji-maker/",
    browserName: "chromium",
    channel: process.env.CI ? undefined : "msedge",
    viewport: { width: 1440, height: 1150 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/helpers/serve-build.mjs",
    url: "http://127.0.0.1:4174/kanji-maker/",
    reuseExistingServer: false,
  },
});
