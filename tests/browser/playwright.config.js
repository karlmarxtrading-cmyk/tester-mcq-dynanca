// Playwright config for the reproducible browser suite.
// No webServer is configured here: every spec starts the project's own
// preview server (tools/dev-server/serve.js) on a free port and stops it
// afterwards. That server sends the response headers from `_headers`, so
// the whole suite runs under the real Content-Security-Policy.
"use strict";
const path = require("path");

module.exports = {
  testDir: __dirname,
  testMatch: /.*\.spec\.js$/,
  timeout: 60_000,
  retries: 0,
  workers: 4,
  outputDir: process.env.DYNANCA_BROWSER_OUTPUT || "../../reports/browser-artifacts",
  reporter: [["list"], ["json", {outputFile:process.env.DYNANCA_BROWSER_RESULTS || path.resolve(__dirname,"../../reports/browser-results.json")}]],
  use: {
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 900 },
    // The practice engine gates its question-entry animation behind
    // `@media (prefers-reduced-motion: no-preference)` and the landing page
    // does the same for smooth scrolling. Tests run on the reduced-motion
    // path so interactions are not racing a live animation; the
    // motion-enabled path is checked explicitly where it matters.
    // (`reducedMotion` is a browser-context option, so it has to be passed
    // through `contextOptions`; as a bare `use` key it is silently ignored.)
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
};
