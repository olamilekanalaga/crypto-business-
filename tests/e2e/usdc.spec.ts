import { test, expect } from "@playwright/test";
import {
  addSnapshot,
  emptyRegistry,
  verifyIdentity,
  currentDirectory,
  recordError,
  validateBackup,
  metadataSchema,
} from "../../lib/usdc/model";
import { scanIdentityPage, refreshMarketBatch } from "../../lib/usdc/coingecko";
import { eligibleBusinessIds, scopeGraph } from "../../lib/usdc/scope";
import { validateGraph } from "../../lib/network/model";
import seed from "../../data-library/network-research.json";
import {
  putBrowser,
  seedServerRegistry,
  networkRegistry,
} from "./usdc-fixtures";
const pair = (
  baseAsset: string,
  quoteAsset = "USDC",
  status = "TRADING",
  spot = true,
) => ({
  symbol: baseAsset + quoteAsset,
  baseAsset,
  quoteAsset,
  status,
  isSpotTradingAllowed: spot,
});
const raw = (symbols: unknown[]) => JSON.stringify({ symbols });
const verification = (coinGeckoId: string) => ({
  coinGeckoId,
  sourceUrl: "https://example.com/verified",
  basis: "manual_evidence" as const,
  verifiedAt: new Date().toISOString(),
  evidence: "Synthetic identity evidence, never production counts.",
});

test("USDC snapshots preserve permanent registry, separate suspended/absent and reject bad refreshes", async () => {
  let g = await addSnapshot(
    emptyRegistry(),
    raw([
      pair("BTC"),
      pair("ETH", "USDC", "BREAK"),
      pair("OLD"),
      pair("BTC", "USDT"),
      pair("NO", "USDC", "TRADING", false),
    ]),
    "2026-10-28T00:00:00Z",
  );
  g = verifyIdentity(g, "binance:BTC", verification("bitcoin"));
  g.assets.find((a) => a.code === "BTC")!.businessIds = ["huma"];
  const next = await addSnapshot(
    g,
    raw([pair("BTC"), pair("ETH"), pair("NEW"), pair("BTC", "USDT")]),
    "2026-10-29T00:00:00Z",
  );
  expect(next.assets.length).toBe(5);
  expect(next.assets.find((a) => a.code === "OLD")?.listingStatus).toBe(
    "absent",
  );
  expect(next.assets.find((a) => a.code === "OLD")?.lastSeenAt).toBe(
    "2026-10-28T00:00:00Z",
  );
  expect(next.assets.find((a) => a.code === "BTC")?.firstSeenAt).toBe(
    "2026-10-28T00:00:00Z",
  );
  expect(next.assets.find((a) => a.code === "BTC")?.businessIds).toEqual([
    "huma",
  ]);
  expect(g.assets.find((a) => a.code === "ETH")?.listingStatus).toBe(
    "suspended",
  );
  expect(recordError(next, "binance", "HTTP 451").snapshots).toEqual(
    next.snapshots,
  );
  await expect(
    addSnapshot(next, raw([pair("BTC"), pair("BTC")])),
  ).rejects.toThrow(/Duplicate/);
  await expect(addSnapshot(next, raw([pair("BTC", "USDT")]))).rejects.toThrow(
    /empty USDC/,
  );
  await expect(
    validateBackup({
      ...next,
      assets: next.assets.map((a) => ({ ...a, listingStatus: "active" })),
    }),
  ).rejects.toThrow(/history mismatch/);
  expect((await validateBackup(next)).snapshots.length).toBe(2);
});

test("identity verification uses complete exchange cross-references and market caps stay independent", async () => {
  let g = await addSnapshot(
    emptyRegistry(),
    raw([pair("BTC"), pair("XBT"), pair("FOO")]),
  );
  const t = (base: string, coin_id: string) => ({
    base,
    target: "USDC",
    coin_id,
    target_coin_id: "usd-coin",
    market: { identifier: "binance" },
    is_stale: false,
    is_anomaly: false,
  });
  g = await scanIdentityPage(g, async () => ({
    tickers: [
      t("BTC", "bitcoin"),
      ...Array.from({ length: 99 }, () => t("IGNORED", "irrelevant")),
    ],
  }));
  expect(g.assets[0].identity).toBeNull();
  g = await scanIdentityPage(g, async () => ({
    tickers: [t("XBT", "bitcoin"), t("FOO", "one"), t("FOO", "two")],
  }));
  expect(g.assets.find((a) => a.code === "FOO")?.identity).toBeNull();
  expect(currentDirectory(g)).toHaveLength(1);
  const observed = g.snapshots[0].observedAt;
  g = await refreshMarketBatch(g, async () => [
    {
      id: "bitcoin",
      name: "Bitcoin",
      symbol: "btc",
      image: null,
      market_cap: 0,
      last_updated: new Date().toISOString(),
    },
  ]);
  expect(g.metadata[0].marketCap).toBe(0);
  expect(g.snapshots[0].observedAt).toBe(observed);
  let calls = 0;
  await refreshMarketBatch(g, async () => {
    calls++;
    return [];
  });
  expect(calls).toBe(0);
  expect(scopeGraph(validateGraph(seed), g).businesses).toHaveLength(0);
});

test("minimal verified directory excludes other markets, opens intelligence and preserves corrections", async ({
  page,
}) => {
  let g = await addSnapshot(
    emptyRegistry(),
    raw([
      pair("BTC"),
      pair("DOGE"),
      pair("ETH", "USDC", "BREAK"),
      pair("OTHER", "USDT"),
      pair("UNKNOWN"),
    ]),
  );
  g = verifyIdentity(g, "binance:BTC", verification("bitcoin"));
  g = verifyIdentity(g, "binance:DOGE", verification("dogecoin"));
  g.metadata = ["bitcoin", "dogecoin"].map((id, i) =>
    metadataSchema.parse({
      id,
      name: i ? "Dogecoin" : "Bitcoin",
      symbol: i ? "doge" : "btc",
      image: null,
      marketCap: i ? null : 100,
      currency: "usd",
      observedAt: new Date().toISOString(),
      providerUpdatedAt: null,
      categories: [i ? "Meme" : "Blockchain"],
      description: "",
      website: "",
      profileObservedAt: null,
      raw: JSON.stringify({ id, name: i ? "Dogecoin" : "Bitcoin" }),
    }),
  );
  await putBrowser(page, g);
  await page.goto("/");
  const table = page.getByRole("table", {
    name: "Active verified Binance USDC assets",
  });
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table.getByText("Ethereum")).toHaveCount(0);
  await expect(table.getByText("UNKNOWN")).toHaveCount(0);
  await expect(table.getByText("$100", { exact: true })).toBeVisible();
  await expect(
    table.getByRole("row").filter({ hasText: "Dogecoin" }),
  ).toContainText("—");
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("Meme");
  await expect(table.getByRole("row")).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("all");
  await table.getByRole("link", { name: /Bitcoin BTC/ }).click();
  await expect(
    page.getByRole("heading", { name: "Bitcoin", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Analyze business on demand" }),
  ).toBeDisabled();
  await page
    .getByLabel("Editable business explanation")
    .fill("My researched explanation; verify supporting sources.");
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByRole("status")).toContainText("Correction saved");
  await page.reload();
  await expect(page.getByLabel("Editable business explanation")).toHaveValue(
    "My researched explanation; verify supporting sources.",
  );
  await page
    .getByRole("link", { name: "Explore matching businesses →" })
    .click();
  await expect(page.getByRole("button", { name: /Huma Finance/ })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: /Bitcoin Blockchain/ }),
  ).toBeVisible();
  await page.goto("/");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "/tmp/bd-usdc-directory-mobile.png",
    fullPage: true,
  });
});

test("server scope rejects external partner targets and daily refresh fails closed without its secret", async ({
  request,
}) => {
  const registry = await networkRegistry();
  registry.assets = registry.assets.map((a) => ({
    ...a,
    identity: a.code === "HUMA" ? a.identity : null,
    businessIds: a.code === "HUMA" ? ["huma"] : [],
  }));
  await seedServerRegistry(request, registry);
  const current = await (await request.get("/api/network/workspace")).json();
  await request.post("/api/network/workspace", {
    data: { ...seed, revision: current.revision },
  });
  const list = await (await request.get("/api/businesses")).json();
  expect(list.map((b: { id: string }) => b.id)).toEqual(["huma"]);
  expect((await request.get("/api/businesses/kamino/network")).status()).toBe(
    404,
  );
  expect(
    (await request.get("/api/relationships/huma-kamino-pst")).status(),
  ).toBe(404);
  const g = await (await request.get("/api/network/workspace")).json();
  expect(
    (
      await request.post("/api/research/analyze", {
        data: { businessId: "kamino", revision: g.revision },
      })
    ).status(),
  ).toBe(403);
  expect((await request.get("/api/usdc/daily")).status()).toBe(401);
  expect(eligibleBusinessIds(registry).has("kamino")).toBe(false);
});
