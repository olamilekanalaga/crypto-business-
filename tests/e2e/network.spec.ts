import {
  networkRegistry,
  putBrowser,
  seedServerRegistry,
} from "./usdc-fixtures";
import { test, expect } from "@playwright/test";
import seed from "../../data-library/network-research.json";
import { validateGraph, mergeGraph } from "../../lib/network/model";
import {
  matchBusinesses,
  reviewRelationship,
} from "../../lib/network/matching";

test("matching is evidence-bound, rejects incompatible chains and cannot verify suggestions", () => {
  const g = validateGraph(seed),
    matches = matchBusinesses(g);
  expect(matches.some((r) => r.a === "morpho" && r.b === "chainlink")).toBe(
    true,
  );
  expect(matches.some((r) => r.a === "huma" && r.b === "kamino")).toBe(false);
  expect(
    matches.every((r) => r.status === "hypothesis" && r.sourceIds.length > 0),
  ).toBe(true);
  const changed = structuredClone(g);
  changed.businesses.find((b) => b.id === "morpho")!.chains = ["Ethereum"];
  changed.businesses.find((b) => b.id === "chainlink")!.chains = ["Solana"];
  expect(
    matchBusinesses(changed).some(
      (r) => r.a === "morpho" && r.b === "chainlink",
    ),
  ).toBe(false);
  const r = matches.find((r) => r.a === "morpho")!;
  const reviewed = validateGraph(
    reviewRelationship(
      g,
      r.id,
      "accepted",
      "Check existing integrations first.",
      true,
    ),
  );
  expect(reviewed.relationships.find((x) => x.id === r.id)?.status).toBe(
    "hypothesis",
  );
  expect(() =>
    validateGraph({
      ...reviewed,
      relationships: reviewed.relationships.map((x) =>
        x.id === r.id ? { ...x, status: "confirmed" } : x,
      ),
    }),
  ).toThrow();
  expect(() => validateGraph({ ...g, sources: [] })).toThrow();
  expect(() =>
    mergeGraph(g, {
      ...g,
      businesses: g.businesses.map((b) => ({ ...b, name: "Changed" })),
    }),
  ).toThrow(/Conflicting/);
});

test("Huma → Kamino → Why, automatic Morpho hypothesis, saved review and mobile navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await putBrowser(page, await networkRegistry());
  await page.goto("/network");
  await page.getByLabel("Search businesses").fill("Huma");
  await page
    .getByRole("button", {
      name: "Huma Finance Payments · RWA · Yield",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: /Huma Finance → Kamino Finance/ })
    .click();
  const why = page.getByRole("region", { name: "Relationship explanation" });
  await expect(
    why.getByRole("heading", { name: "Why are they connected?" }),
  ).toBeVisible();
  await expect(
    why.getByRole("link", { name: "Huma: integrations ↗" }),
  ).toHaveAttribute(
    "href",
    "https://docs.huma.finance/products/huma-2.0/integrations",
  );
  await expect(
    why.getByText(
      /Direct payment between the businesses and introducer compensation are unknown/,
    ),
  ).toBeVisible();
  await page
    .getByLabel("Business network graph")
    .screenshot({ path: "/tmp/bd-network-desktop.png" });
  await page
    .getByLabel("Business network graph")
    .getByLabel("Explore Kamino Finance", { exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Kamino Finance", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Huma Finance", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search businesses").fill("Morpho");
  await page
    .getByRole("button", {
      name: "Morpho Lending · Infrastructure",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: /Morpho → Chainlink/ }).click();
  await expect(why.getByText(/HYPOTHESIS · RULE/)).toBeVisible();
  await why
    .getByLabel("Review note")
    .fill("Investigate market-specific oracle coverage.");
  await why.getByRole("button", { name: "Save for investigation" }).click();
  await expect(page.getByRole("status")).toContainText("Research saved");
  await page.reload();
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  await page.getByRole("button", { name: /Morpho → Chainlink/ }).click();
  await expect(why.getByLabel("Review note")).toHaveValue(
    "Investigate market-specific oracle coverage.",
  );
  await expect(why.getByText(/HYPOTHESIS · RULE/)).toBeVisible();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({ path: "/tmp/bd-network-mobile.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("private REST endpoints persist local research, protect stale writes and keep AI optional", async ({
  request,
}) => {
  await seedServerRegistry(request);
  const initial = await request.get("/api/network/workspace");
  expect(initial.status()).toBe(200);
  const current = await initial.json();
  const g = { ...seed, revision: current.revision };
  const saved = await request.post("/api/network/workspace", { data: g });
  expect(saved.status()).toBe(200);
  const data = await saved.json();
  expect(
    (await request.post("/api/network/workspace", { data: g })).status(),
  ).toBe(409);
  const list = await request.get("/api/businesses?q=Huma");
  expect((await list.json())[0].name).toBe("Huma Finance");
  const network = await request.get("/api/businesses/morpho/network");
  const candidate = (await network.json()).relationships.find(
    (r: { b: string }) => r.b === "chainlink",
  );
  expect(candidate.status).toBe("hypothesis");
  const review = await request.post(
    `/api/relationships/${candidate.id}/review`,
    {
      data: {
        revision: data.revision,
        review: "accepted",
        saved: true,
        note: "Needs verification",
      },
    },
  );
  expect(review.status()).toBe(200);
  const reviewed = await review.json();
  expect(
    reviewed.relationships.find((r: { id: string }) => r.id === candidate.id)
      .status,
  ).toBe("hypothesis");
  const ai = await request.post("/api/research/analyze", {
    data: { businessId: "huma", revision: reviewed.revision },
  });
  expect(ai.status()).toBe(503);
  const crossSite = await request.get("/api/businesses", {
    headers: { origin: "https://example.com" },
  });
  expect(crossSite.status()).toBe(403);
  const why = await request.get("/api/relationships/huma-kamino-pst");
  expect((await why.json()).evidence[0].id).toBe("huma-integrations");
});

test("hosted private access fails closed and OpenAI output remains an unverified proposal", async () => {
  const { authorize } = await import("../../lib/network/server");
  const { analyze } = await import("../../lib/network/ai");
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const previous = {
    VERCEL: process.env.VERCEL,
    BDO_OWNER_TOKEN: process.env.BDO_OWNER_TOKEN,
    BDO_AI_ENABLED: process.env.BDO_AI_ENABLED,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    TERMINAL_DATA_DIR: process.env.TERMINAL_DATA_DIR,
    DATABASE_URL: process.env.DATABASE_URL,
  };
  const dir = mkdtempSync(path.join(tmpdir(), "network-ai-fixture-")),
    originalFetch = global.fetch;
  try {
    process.env.VERCEL = "1";
    delete process.env.BDO_OWNER_TOKEN;
    expect(() =>
      authorize(new Request("https://example.com/api/businesses")),
    ).toThrow(/not configured/);
    process.env.BDO_OWNER_TOKEN =
      "test-owner-token-that-is-at-least-32-characters";
    expect(() =>
      authorize(new Request("https://example.com/api/businesses")),
    ).toThrow(/Unlock/);
    expect(() =>
      authorize(
        new Request("https://example.com/api/businesses", {
          headers: { Authorization: `Bearer ${process.env.BDO_OWNER_TOKEN}` },
        }),
      ),
    ).not.toThrow();
    delete process.env.VERCEL;
    delete process.env.DATABASE_URL;
    process.env.TERMINAL_DATA_DIR = dir;
    process.env.BDO_AI_ENABLED = "1";
    process.env.OPENAI_API_KEY = "mock-not-a-real-key";
    process.env.OPENAI_MODEL = "fixture-model";
    global.fetch = async () =>
      Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                businessAnalysis: null,
                suggestions: [
                  {
                    targetId: "chainlink",
                    reason: "Test hypothesis",
                    aValue: "Potential pricing",
                    bValue: "Potential usage",
                    sourceIds: ["morpho-markets", "chainlink-feeds"],
                    gaps: ["Check market-specific integration"],
                    confidence: 0.6,
                  },
                ],
              }),
            },
          },
        ],
      });
    const result = await analyze(validateGraph(seed), "morpho");
    expect(result.relationships.at(-1)?.status).toBe("hypothesis");
    expect(result.relationships.at(-1)?.provenance).toBe("ai");
    global.fetch = async () =>
      Response.json({
        choices: [{ finish_reason: "length", message: { content: "{}" } }],
      });
    expect(await analyze(result, "morpho")).toEqual(result); // Cached output must bypass the failing provider.
    await expect(analyze(validateGraph(seed), "morpho")).rejects.toThrow(
      /incomplete/,
    );
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

test("network backups transfer researched businesses and reject conflicting records", async ({
  page,
  browser,
}) => {
  await putBrowser(page, await networkRegistry());
  await page.goto("/network/research");
  await page
    .getByText("Add a business and evidence", { exact: true })
    .first()
    .click();
  await page.getByLabel("Business or product name").fill("Fixture lender");
  await page
    .getByLabel("What does it provide?", { exact: true })
    .fill("Synthetic test lending service.");
  await page.getByLabel("Needs to investigate").selectOption(["price_oracle"]);
  await page.getByLabel("Source title", { exact: true }).fill("Test evidence");
  await page
    .getByLabel("Source URL", { exact: true })
    .fill("https://example.com/evidence");
  await page
    .getByLabel("Original evidence excerpt")
    .fill("Synthetic evidence fixture.");
  await page
    .getByLabel("Your interpretation")
    .fill("Test classification; not a real company.");
  await page
    .getByRole("button", { name: "Add business and evidence", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Research saved");
  await page
    .getByText("Data sources, backups & private server connection", {
      exact: true,
    })
    .click();
  await page.getByText("Add an economic relationship", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Business A", exact: true })
    .selectOption("morpho");
  await page
    .getByRole("combobox", { name: "Business B", exact: true })
    .selectOption("chainlink");
  for (const label of [
    "What A provides or needs",
    "What B provides or needs",
    "Why does this connection exist?",
    "What A gains",
    "What B gains",
  ])
    await page
      .getByLabel(label, { exact: true })
      .fill("Synthetic manual research fixture.");
  await page
    .getByLabel("Missing evidence and research questions")
    .fill("Verify demand and existing market integrations.");
  await page
    .getByRole("button", { name: "Save manual relationship", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Research saved");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export network backup" }).click();
  const download = await downloadPromise;
  const { readFileSync } = await import("node:fs");
  const raw = readFileSync((await download.path())!);
  const graph = JSON.parse(raw.toString());
  const context = await browser.newContext();
  const other = await context.newPage();
  await putBrowser(other, await networkRegistry());
  await other.goto("/network");
  await expect(
    other.getByRole("button", {
      name: "Huma Finance Payments · RWA · Yield",
      exact: true,
    }),
  ).toBeVisible();
  await other.getByLabel("Import network JSON").setInputFiles({
    name: "network.json",
    mimeType: "application/json",
    buffer: raw,
  });
  await expect(
    other.getByRole("button", { name: /Fixture lender/ }),
  ).toHaveCount(0);
  graph.businesses[0].name = "Conflicting name";
  await other.getByLabel("Import network JSON").setInputFiles({
    name: "conflict.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(graph)),
  });
  await expect(other.locator("main").getByRole("alert")).toContainText(
    "Conflicting record",
  );
  await expect(
    other.getByRole("button", {
      name: "Huma Finance Payments · RWA · Yield",
      exact: true,
    }),
  ).toBeVisible();
  await context.close();
});
