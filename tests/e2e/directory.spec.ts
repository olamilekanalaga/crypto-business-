import { test, expect } from "@playwright/test";
test("home directory counts distinct tokens, preserves totals across filters and renders local logos", async ({
  page,
}) => {
  await page.goto("/discovery-history");
  await expect(
    page.getByRole("heading", { name: "Your crypto data directory." }),
  ).toBeVisible();
  const symbols = [
    ["BTC", "USDC", "TRADING"],
    ["BTC", "USDT", "TRADING"],
    ["ETH", "USDC", "BREAK"],
    ["FOO", "USDT", "TRADING"],
  ].map(([baseAsset, quoteAsset, status]) => ({
    symbol: baseAsset + quoteAsset,
    baseAsset,
    quoteAsset,
    status,
    isSpotTradingAllowed: true,
  }));
  await page
    .getByLabel("Import Binance JSON or workspace backup")
    .setInputFiles({
      name: "fixture.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ symbols })),
    });
  const totals = page.getByRole("region", { name: "Directory totals" });
  await expect(totals.locator("strong")).toHaveText(["3", "2", "1"]);
  await page
    .getByRole("button", { name: "Classification · explore product types" })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Product category", exact: true }),
  ).toBeFocused();
  const cards = page.getByRole("region", { name: "Discovered assets" });
  await expect(cards.getByText("Bitcoin", { exact: true })).toBeVisible();
  const logo = cards.getByRole("img", { name: "BTC catalogue logo" });
  await expect(logo).toBeVisible();
  await expect
    .poll(() => logo.evaluate((e: HTMLImageElement) => e.naturalWidth))
    .toBeGreaterThan(0);
  await page.getByLabel("Pair availability").selectOption("active");
  await expect(cards.getByRole("button", { name: /ETH/ })).toHaveCount(0);
  await expect(totals.locator("strong")).toHaveText(["3", "2", "1"]);
  await page.getByLabel("Quote currency", { exact: true }).selectOption("all");
  await expect(cards.getByLabel("FOO logo unavailable")).toBeVisible();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "/tmp/bd-directory-mobile.png",
    fullPage: true,
  });
  await page.goto("/discovery-history");
  await expect(
    page.getByRole("region", { name: "Directory totals" }).locator("strong"),
  ).toHaveText(["3", "2", "1"]);
});
