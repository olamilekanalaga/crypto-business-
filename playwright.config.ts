import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// A fresh disposable database is the default. Explicit reuse is for a server
// already started with this same isolated TERMINAL_DATA_DIR; never production.
const testData =
  process.env.E2E_DATA_DIR ||
  mkdtempSync(path.join(tmpdir(), "crypto-business-e2e-"));
if (path.resolve(testData) === path.resolve("data"))
  throw new Error(
    "E2E_DATA_DIR must not point at the production data/ directory",
  );
process.env.E2E_DATA_DIR = testData; // inherited by workers and the fixture script
const port = 3100;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 1100 },
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 120_000,
    env: { TERMINAL_DATA_DIR: testData },
  },
});
