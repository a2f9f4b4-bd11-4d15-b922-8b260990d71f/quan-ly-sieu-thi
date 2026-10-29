import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // live-smoke needs the real API and live credentials. The default run serves the
  // mock, so including it would fail whenever the backend happens to be up — which
  // is exactly the state anyone doing integration work is in.
  //
  // testIgnore applies even when a file is named on the command line, so this has to
  // be conditional: `test:e2e:live` sets NEXT_PUBLIC_API_MODE=live and must still be
  // able to run the suite.
  testIgnore: process.env.NEXT_PUBLIC_API_MODE === "live" ? [] : /live-smoke/,
  fullyParallel: false,
  workers: 1,
  // Next compiles each route on its first visit in dev, which can exceed the
  // default 5s on a cold server. These timeouts cover compilation, not slow app code.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    actionTimeout: 15_000,
    baseURL: "http://localhost:3000",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  reporter: [["html", { outputFolder: "e2e-report", open: "never" }], ["list"]],
});
