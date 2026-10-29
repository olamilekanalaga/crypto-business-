import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const endpoint = "https://data-api.binance.vision/api/v3/exchangeInfo";
const raw = (symbols: string[]) =>
  JSON.stringify({
    symbols: symbols.map((symbol) => ({
      symbol,
      baseAsset: symbol.startsWith("BTC") ? "BTC" : "ETH",
      quoteAsset: symbol.endsWith("USDT") ? "USDT" : "USDC",
      status: symbol === "ETHUSDT" ? "BREAK" : "TRADING",
      isSpotTradingAllowed: true,
    })),
  });

test("browser collection keeps snapshots, deduplicates assets and exports portable notes", async ({
  page,
  browser,
}) => {
  let response = raw(["BTCUSDT", "BTCUSDC", "ETHUSDT"]);
  await page.route(endpoint, (r) =>
    r.fulfill({ contentType: "application/json", body: response }),
  );
  await page.goto("/discover");
  await page
    .getByRole("button", { name: "Fetch Binance Spot", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Binance refresh complete",
  );
  await page.getByLabel("Quote currency", { exact: true }).selectOption("all");
  const assets = page.getByRole("region", { name: "Discovered assets" });
  await expect(
    assets.getByRole("button", { name: /BTC[\s\S]*2 current pairs/ }),
  ).toBeVisible();
  await assets
    .getByRole("button", { name: /BTC[\s\S]*2 current pairs/ })
    .click();
  await page
    .getByRole("textbox", { name: "Research note · unverified" })
    .fill("Investigate payment demand. Source: https://example.com/research");
  await expect(
    page.getByRole("button", { name: "Fetch Binance Spot", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Research note saved");
  response = raw(["BTCUSDT"]);
  await page
    .getByRole("button", { name: "Fetch Binance Spot", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Binance refresh complete",
  );
  await expect(
    page.getByText("Unavailable in latest snapshot", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByLabel("Quote currency", { exact: true }).selectOption("all");
  await assets
    .getByRole("button", { name: /BTC[\s\S]*1 current pairs/ })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Research note · unverified" }),
  ).toHaveValue(/Investigate payment demand/);
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download backup", exact: true })
    .click();
  const backup = await downloadPromise;
  const file = await backup.path();
  expect(file).toBeTruthy();
  const other = await browser.newContext();
  const phone = await other.newPage();
  await phone.setViewportSize({ width: 320, height: 844 });
  await phone.goto("http://127.0.0.1:3100/discover");
  await phone
    .getByLabel("Import Binance JSON or workspace backup")
    .setInputFiles(file!);
  await expect(phone.getByRole("status")).toContainText("Backup merged");
  await phone.getByLabel("Quote currency", { exact: true }).selectOption("all");
  await phone
    .getByRole("button", { name: /BTC[\s\S]*1 current pairs/ })
    .click();
  await expect(
    phone.getByRole("textbox", { name: "Research note · unverified" }),
  ).toHaveValue(/Investigate payment demand/);
  const incoming = JSON.parse(readFileSync(file!, "utf8"));
  incoming.notes.BTC = "Additional imported evidence";
  await phone
    .getByLabel("Import Binance JSON or workspace backup")
    .setInputFiles({
      name: "merged.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(incoming)),
    });
  await expect(
    phone.getByRole("textbox", { name: "Research note · unverified" }),
  ).toHaveValue(
    /Investigate payment demand[\s\S]*Additional imported evidence/,
  );
  await expect(
    phone.getByRole("button", { name: "Download backup", exact: true }),
  ).toBeEnabled();
  expect(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await other.close();
});

test("blocked fetch and malformed imports preserve browser data with raw-file fallback", async ({
  page,
}) => {
  await page.goto("/discover");
  await page
    .getByLabel("Import Binance JSON or workspace backup")
    .setInputFiles({
      name: "binance.json",
      mimeType: "application/json",
      buffer: Buffer.from(raw(["ETHUSDT"])),
    });
  await expect(page.getByRole("status")).toContainText(
    "original extraction time is unknown",
  );
  await page.getByLabel("Quote currency", { exact: true }).selectOption("all");
  await page.route(endpoint, (r) => r.abort("failed"));
  await page
    .getByRole("button", { name: "Fetch Binance Spot", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "may be CORS",
  );
  await expect(
    page.getByRole("button", { name: /ETH[\s\S]*1 current pairs/ }),
  ).toBeVisible();
  await page
    .getByLabel("Import Binance JSON or workspace backup")
    .setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"symbols":[]}'),
    });
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Import failed",
  );
  await expect(
    page.getByRole("button", { name: /ETH[\s\S]*1 current pairs/ }),
  ).toBeVisible();
  await page.reload();
  await page.getByLabel("Quote currency", { exact: true }).selectOption("all");
  await expect(
    page.getByRole("button", { name: /ETH[\s\S]*1 current pairs/ }),
  ).toBeVisible();
});
