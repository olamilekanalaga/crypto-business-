import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const payload = JSON.stringify({
  symbols: [
    {
      symbol: "ETHUSDC",
      baseAsset: "ETH",
      quoteAsset: "USDC",
      status: "BREAK",
      isSpotTradingAllowed: true,
    },
    {
      symbol: "ETHUSDT",
      baseAsset: "ETH",
      quoteAsset: "USDT",
      status: "TRADING",
      isSpotTradingAllowed: true,
    },
    {
      symbol: "BTCUSDC",
      baseAsset: "BTC",
      quoteAsset: "USDC",
      status: "TRADING",
      isSpotTradingAllowed: true,
    },
    {
      symbol: "FOOUSDC",
      baseAsset: "FOO",
      quoteAsset: "USDC",
      status: "TRADING",
      isSpotTradingAllowed: true,
    },
    {
      symbol: "BARUSDT",
      baseAsset: "BAR",
      quoteAsset: "USDT",
      status: "TRADING",
      isSpotTradingAllowed: true,
    },
  ],
});
test("USDC scope intersects availability; sourced product categories survive old backups, refresh and transfer", async ({
  page,
  browser,
}) => {
  await page.goto("/discover");
  await page
    .getByLabel("Import Binance JSON or workspace backup")
    .setInputFiles({
      name: "exchange.json",
      mimeType: "application/json",
      buffer: Buffer.from(payload),
    });
  await expect(page.getByRole("status")).toContainText("Snapshot imported");
  await expect(page.getByLabel("Quote currency", { exact: true })).toHaveValue(
    "USDC",
  );
  const assets = page.getByRole("region", { name: "Discovered assets" });
  await expect(assets.getByRole("button", { name: /BAR/ })).toHaveCount(0);
  await page.getByLabel("Pair availability").selectOption("active");
  // ETH has an active USDT pair but inactive USDC pair: it must not leak through.
  await expect(assets.getByRole("button", { name: /ETH/ })).toHaveCount(0);
  await page.getByLabel("Pair availability").selectOption("all");
  await page
    .getByRole("combobox", { name: "Product category", exact: true })
    .selectOption("Staking");
  await expect(assets.getByRole("button", { name: /ETH/ })).toBeVisible();
  await expect(assets.getByRole("button", { name: /BTC/ })).toHaveCount(0);
  await assets.getByRole("button", { name: /ETH/ }).click();
  await expect(
    page
      .getByRole("region", { name: "Asset research" })
      .getByText("ETHUSDT", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Suggested project · ticker candidate only", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Product category", exact: true })
    .selectOption("unclassified");
  await assets.getByRole("button", { name: /FOO/ }).click();
  const editor = page.getByRole("region", { name: "Product classification" });
  await editor.getByRole("checkbox", { name: "Yield", exact: true }).check();
  await editor.getByRole("checkbox", { name: "RWA", exact: true }).check();
  await editor
    .getByRole("combobox", { name: "Classification review", exact: true })
    .selectOption("reviewed");
  await editor
    .getByRole("button", { name: "Save classification", exact: true })
    .click();
  await expect(editor.getByRole("alert")).toContainText("add a project");
  await editor.getByLabel("Project or product name").fill("Fixture product");
  await editor
    .getByLabel("What it provides", { exact: true })
    .fill("Synthetic test: financing payment obligations.");
  await editor
    .getByLabel("Classification source URL")
    .fill("https://example.com/fixture");
  await editor
    .getByRole("button", { name: "Save classification", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Product classification saved",
  );
  await page
    .getByRole("combobox", { name: "Product category", exact: true })
    .selectOption("RWA");
  await page
    .getByRole("combobox", { name: "Review status", exact: true })
    .selectOption("reviewed");
  await expect(assets.getByRole("button", { name: /FOO/ })).toBeVisible();
  await page.route(
    "https://data-api.binance.vision/api/v3/exchangeInfo",
    (route) =>
      route.fulfill({ contentType: "application/json", body: payload }),
  );
  await page
    .getByRole("button", { name: "Fetch Binance Spot", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Binance refresh complete",
  );
  await page.reload();
  await page
    .getByRole("combobox", { name: "Product category", exact: true })
    .selectOption("Yield");
  await assets.getByRole("button", { name: /FOO/ }).click();
  await expect(editor.getByLabel("Project or product name")).toHaveValue(
    "Fixture product",
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download backup", exact: true })
    .click();
  const saved = JSON.parse(
    readFileSync((await (await download).path())!, "utf8"),
  );
  expect(saved.snapshots[0].raw).toBe(payload);
  expect(saved.classifications.FOO.categories).toEqual(["Yield", "RWA"]);
  const other = await browser.newContext({
    viewport: { width: 320, height: 844 },
  });
  const phone = await other.newPage();
  await phone.goto("http://127.0.0.1:3100/discover");
  const legacy = { ...saved };
  delete legacy.classifications;
  await phone
    .getByLabel("Import Binance JSON or workspace backup")
    .setInputFiles({
      name: "legacy.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(legacy)),
    });
  await expect(phone.getByRole("status")).toContainText("Backup merged");
  await phone
    .getByLabel("Import Binance JSON or workspace backup")
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(saved)),
    });
  await expect(phone.getByRole("status")).toContainText("Backup merged");
  await phone
    .getByRole("region", { name: "Discovered assets" })
    .getByRole("button", { name: /FOO/ })
    .click();
  await expect(phone.getByLabel("Project or product name")).toHaveValue(
    "Fixture product",
  );
  expect(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // A conflicting backup must never overwrite an existing classification.
  saved.classifications.FOO.project = "Conflicting product";
  await phone
    .getByLabel("Import Binance JSON or workspace backup")
    .setInputFiles({
      name: "conflict.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(saved)),
    });
  await expect(phone.getByRole("main").getByRole("alert")).toContainText(
    "Classification conflict",
  );
  await expect(phone.getByLabel("Project or product name")).toHaveValue(
    "Fixture product",
  );
  await other.close();
});
