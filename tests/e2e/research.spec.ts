import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { execFileSync } from "node:child_process";

// These are synthetic UI fixtures, not factual business research. They live only
// in the isolated E2E database configured in playwright.config.ts.
const run = Date.now().toString(36);
const names = {
  organisation: `Test Fixture Research Co ${run}`,
  product: `Test Fixture Infrastructure Product ${run}`,
  other: `Test Fixture Integrator ${run}`,
  evidence: `Test Fixture Official Source ${run}`,
  opportunity: `Test Fixture Opportunity ${run}`,
};
const fixtureFinding =
  "Test fixture only: this synthetic business provides infrastructure to synthetic operators.";

async function overview(request: APIRequestContext) {
  const response = await request.post("/api/overview", { data: {} });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data;
}
async function save(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.getByRole("status")).toContainText("stored locally");
}
async function workspaceTab(page: Page, name: string) {
  await page.getByRole("tab", { name, exact: true }).click();
}
async function createBusiness(page: Page, name: string, kind: string) {
  await workspaceTab(page, "Business / product");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  await page
    .getByRole("combobox", { name: "Record type", exact: true })
    .selectOption(kind);
  await save(page, "Save record");
}

// One connected browser journey verifies the actual UI → Next API → Python RPC
// → SQLite → refreshed UI flow, including persistence after a full page reload.
test("personal research workflow persists evidence, business links, relationships, and opportunity edits", async ({
  page,
  request,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto("/?view=workspace");
  await expect(
    page.getByRole("heading", { name: "Make the unknown researchable." }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Business / product" }),
  ).toBeVisible();

  await createBusiness(page, names.organisation, "organisation");
  await createBusiness(page, names.other, "organisation");
  await createBusiness(page, names.product, "product");

  await workspaceTab(page, "Source & evidence");
  await page
    .getByRole("textbox", { name: "Source title", exact: true })
    .fill(names.evidence);
  await page
    .getByRole("textbox", { name: "Source URL", exact: true })
    .fill("https://example.test/test-fixture-official-source");
  await page
    .getByRole("combobox", { name: "Source type", exact: true })
    .selectOption("Official documentation");
  await page
    .getByRole("combobox", { name: "Verification status", exact: true })
    .selectOption("confirmed");
  await page
    .getByRole("textbox", { name: "Original evidence", exact: true })
    .fill(
      "TEST FIXTURE — Synthetic Research Co operates Synthetic Infrastructure Product. Synthetic Integrator integrates it. This synthetic passage does not assert payment.",
    );
  await page
    .getByRole("textbox", { name: "Your interpretation", exact: true })
    .fill(
      "Test fixture interpretation: supports the synthetic product operation and integration, while payment remains unknown.",
    );
  await save(page, "Save evidence");
  await expect(
    page.getByText(names.evidence, { exact: false }).last(),
  ).toBeVisible();

  const data = await overview(request);
  const organisation = data.entities.find(
    (e: { name: string }) => e.name === names.organisation,
  );
  const other = data.entities.find(
    (e: { name: string }) => e.name === names.other,
  );
  const product = data.entities.find(
    (e: { name: string }) => e.name === names.product,
  );
  const evidence = data.evidence.find(
    (e: { title: string }) => e.title === names.evidence,
  );
  expect(organisation).toBeTruthy();
  expect(product).toBeTruthy();
  expect(evidence).toBeTruthy();

  await workspaceTab(page, "Research finding");
  await page
    .getByRole("combobox", { name: "Research subject", exact: true })
    .selectOption(String(organisation.id));
  await page
    .getByRole("combobox", { name: "Research question", exact: true })
    .selectOption("what_it_does");
  await page
    .getByRole("textbox", { name: "Your finding", exact: true })
    .fill(fixtureFinding);
  await page
    .getByRole("combobox", { name: "How certain is this?", exact: true })
    .selectOption("confirmed");
  // The UI must expose the evidence requirement, not silently accept a fact.
  await page.getByRole("button", { name: "Save finding", exact: true }).click();
  await expect(page.locator('.notice.error[role="alert"]')).toContainText(
    "require evidence",
  );
  await page
    .getByRole("combobox", { name: "Supporting evidence", exact: true })
    .selectOption(String(evidence.id));
  await save(page, "Save finding");

  await workspaceTab(page, "Business activity");
  await page
    .getByRole("combobox", { name: "Product", exact: true })
    .selectOption(String(product.id));
  await page
    .getByRole("textbox", { name: "Activity name", exact: true })
    .fill("Test Fixture Activity");
  await page
    .getByRole("textbox", {
      name: "What does this product enable?",
      exact: true,
    })
    .fill(
      "Test fixture product lets synthetic operators connect their systems.",
    );
  await page
    .getByRole("textbox", { name: "Who performs this activity?", exact: true })
    .fill("Test fixture operator");
  await page
    .getByRole("combobox", { name: "How certain is this?", exact: true })
    .selectOption("confirmed");
  await page
    .getByRole("combobox", { name: "Supporting evidence", exact: true })
    .selectOption(String(evidence.id));
  await save(page, "Save activity");

  await workspaceTab(page, "Connect records");
  await page
    .getByRole("combobox", { name: "From", exact: true })
    .selectOption(String(organisation.id));
  await page
    .getByRole("combobox", { name: "Connection type", exact: true })
    .selectOption("operates");
  await page
    .getByRole("combobox", { name: "To", exact: true })
    .selectOption(String(product.id));
  await page
    .getByRole("combobox", { name: "How certain is this?", exact: true })
    .selectOption("confirmed");
  await page
    .getByRole("combobox", { name: "Supporting evidence", exact: true })
    .selectOption(String(evidence.id));
  await save(page, "Save link");

  await workspaceTab(page, "Relationship");
  await page
    .getByRole("combobox", { name: "Business A", exact: true })
    .selectOption(String(organisation.id));
  await page
    .getByRole("combobox", { name: "Business B", exact: true })
    .selectOption(String(other.id));
  await page
    .getByRole("combobox", { name: "Relationship type", exact: true })
    .selectOption("integration");
  await page
    .getByRole("combobox", { name: "Does money change hands?", exact: true })
    .selectOption("unknown");
  await page
    .getByRole("textbox", { name: "What A provides", exact: true })
    .fill("Test fixture infrastructure API");
  await page
    .getByRole("textbox", { name: "What B provides", exact: true })
    .fill("Test fixture integration and distribution");
  await page
    .getByRole("textbox", { name: "Why the relationship exists", exact: true })
    .fill("Test fixture operators want to reduce repeated integration work.");
  await page
    .getByRole("textbox", { name: "Economic value A receives", exact: true })
    .fill("Test fixture distribution reach");
  await page
    .getByRole("textbox", { name: "Economic value B receives", exact: true })
    .fill("Test fixture infrastructure access");
  await page
    .getByRole("combobox", { name: "How certain is this?", exact: true })
    .selectOption("confirmed");
  await page
    .getByRole("combobox", { name: "Supporting evidence", exact: true })
    .selectOption(String(evidence.id));
  await save(page, "Save relationship");

  await workspaceTab(page, "Opportunity");
  await page
    .getByRole("textbox", { name: "Opportunity", exact: true })
    .fill(names.opportunity);
  await page
    .getByRole("combobox", { name: "Relevant business / asset", exact: true })
    .selectOption(String(organisation.id));
  await page
    .getByRole("textbox", {
      name: "What friction have you noticed?",
      exact: true,
    })
    .fill(
      "Test fixture operators repeatedly perform a synthetic manual integration.",
    );
  await page
    .getByRole("textbox", { name: "How might you help?", exact: true })
    .fill(
      "Test fixture possibility: investigate a synthetic onboarding service.",
    );
  await page
    .getByRole("textbox", {
      name: "Who would need it, and why pay?",
      exact: true,
    })
    .fill(
      "Test fixture integrators might value time saved; willingness to pay is unverified.",
    );
  await page
    .getByRole("textbox", { name: "Next research step", exact: true })
    .fill("Test fixture next step: verify the repeated manual work.");
  await page
    .getByRole("combobox", { name: "Research stage", exact: true })
    .selectOption("hypothesis");
  await save(page, "Save opportunity");

  await page.goto("/?view=opportunities");
  const opportunityCard = page
    .locator(".opportunity-card")
    .filter({
      has: page.getByRole("heading", { name: names.opportunity, exact: true }),
    });
  await expect(opportunityCard).toContainText("hypothesis");
  await opportunityCard
    .getByRole("button", { name: "Continue investigating" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Opportunity", exact: true }),
  ).toHaveValue(names.opportunity);
  await page
    .getByRole("combobox", { name: "Research stage", exact: true })
    .selectOption("investigating");
  await page
    .getByRole("textbox", { name: "Next research step", exact: true })
    .fill(
      "Test fixture updated next step: verify frequency before assessing a paid service.",
    );
  await save(page, "Update opportunity");

  await page.goto("/?view=opportunities");
  await page.reload();
  const savedOpportunity = page
    .locator(".opportunity-card")
    .filter({
      has: page.getByRole("heading", { name: names.opportunity, exact: true }),
    });
  await expect(savedOpportunity).toContainText("investigating");
  await expect(savedOpportunity).toContainText(
    "Test fixture updated next step: verify frequency",
  );

  await page.goto(`/businesses/${organisation.id}`);
  await expect(page.getByText(fixtureFinding, { exact: true })).toBeVisible();
  await expect(
    page
      .locator(".plain-language")
      .getByText("Confirmed fact", { exact: true }),
  ).toBeVisible();
  await page.locator(".claim-card summary").first().click();
  await expect(page.locator(".claim-card blockquote")).toContainText(
    "TEST FIXTURE",
  );
  await page.getByRole("button", { name: "connections", exact: true }).click();
  await expect(page.locator(".entity-links")).toContainText(names.product);
  await expect(page.locator(".relationship-card")).toContainText(names.other);
  await expect(page.locator(".relationship-meta")).toContainText(
    "Money changes hands: unknown",
  );
  await expect(page.locator(".exchange-grid")).toContainText(
    "Test fixture distribution reach",
  );
  await expect(page.locator(".exchange-grid")).toContainText(
    "Test fixture infrastructure access",
  );

  const persisted = await overview(request);
  const saved = persisted.opportunities.filter(
    (o: { title: string }) => o.title === names.opportunity,
  );
  expect(saved).toHaveLength(1);
  expect(saved[0].stage).toBe("investigating");
  expect(
    persisted.relationships.find(
      (r: { a_id: number; b_id: number }) =>
        r.a_id === organisation.id && r.b_id === other.id,
    ).money,
  ).toBe("unknown");
  expect(browserErrors).toEqual([]);
});

test("local API rejects cross-origin, remote-host, and cross-site write requests without changing records", async ({
  request,
}) => {
  const before = await overview(request);
  const fixture = {
    name: `Test Fixture Forbidden Write ${run}`,
    kind: "organisation",
  };
  const rejectedHeaders: Record<string, string>[] = [
    { Origin: "https://example.test" },
    { Host: "remote.example.test:3100" },
    { "Sec-Fetch-Site": "cross-site" },
  ];
  for (const headers of rejectedHeaders) {
    const response = await request.post("/api/save_entity", {
      data: fixture,
      headers,
    });
    expect(response.status()).toBe(403);
  }
  const after = await overview(request);
  expect(after.entities).toHaveLength(before.entities.length);
  expect(
    after.entities.some((e: { name: string }) => e.name === fixture.name),
  ).toBe(false);
});

test("synthetic asset discovery opens listings, resolves identity with evidence, and preserves source metadata distinctions", async ({
  page,
  request,
}) => {
  const environment = {
    ...process.env,
    TERMINAL_DATA_DIR:
      process.env.E2E_DATA_DIR || "/tmp/crypto-business-browser",
  };
  const seeded = JSON.parse(
    execFileSync(
      process.env.PYTHON_BIN || "python3",
      ["tests/e2e/seed_fixture.py"],
      { env: environment, encoding: "utf8" },
    ),
  );
  await page.goto("/?view=assets");
  await page
    .getByRole("textbox", { name: "Search assets" })
    .fill("TESTFIXTURE");
  const assetRow = page
    .getByRole("row")
    .filter({
      has: page.getByRole("link", {
        name: /TESTFIXTURE Project not yet verified/,
      }),
    });
  await expect(assetRow).toContainText("2 candidates");
  await assetRow.getByRole("link", { name: "Research TESTFIXTURE" }).click();
  await expect(
    page.getByRole("heading", { name: "TESTFIXTURE", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("Not established yet.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "listings", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "TESTFIXTUREUSD" }),
  ).toContainText("TRADING");
  await expect(
    page.getByRole("row").filter({ hasText: "TESTFIXTUREEUR" }),
  ).toContainText("BREAK");
  await page.getByRole("button", { name: "identity", exact: true }).click();
  await expect(
    page.getByText("No confident identity match recorded.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".candidate-list")).toContainText(
    "Test Fixture Project",
  );
  await expect(page.locator(".candidate-list")).toContainText(
    "Test Fixture Unrelated Project",
  );

  const evidenceResponse = await request.post("/api/save_evidence", {
    data: {
      title: `Test Fixture Identity Evidence ${run}`,
      url: "https://example.test/test-fixture-identity",
      source_type: "Official documentation",
      observed_at: new Date().toISOString(),
      original_text:
        "TEST FIXTURE: the synthetic exchange observation identifies synthetic CoinGecko project test-fixture-project.",
      interpretation:
        "Synthetic identity evidence only. It does not identify any operating business.",
      verification: "confirmed",
    },
  });
  expect(evidenceResponse.ok()).toBeTruthy();
  const identityEvidence = (await evidenceResponse.json()).data.id;
  // Reload so the new source appears in the UI evidence selector.
  await page.reload();
  await page.getByRole("button", { name: "workspace", exact: true }).click();
  await workspaceTab(page, "Verify asset identity");
  await page
    .getByRole("combobox", { name: "Exchange asset", exact: true })
    .selectOption(String(seeded.asset_id));
  await page
    .getByRole("textbox", { name: "CoinGecko ID", exact: true })
    .fill("test-fixture-project");
  await page
    .getByRole("combobox", { name: "Confirmed identity evidence", exact: true })
    .selectOption(String(identityEvidence));
  await save(page, "Save verified identity");
  execFileSync(
    process.env.PYTHON_BIN || "python3",
    ["tests/e2e/seed_fixture.py", "enrich"],
    { env: environment, encoding: "utf8" },
  );
  await page.reload();
  await page.getByRole("button", { name: "identity", exact: true }).click();
  await expect(
    page.getByText("Identity verified", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator(".identity-profile")).toContainText(
    "test-fixture-project",
  );
  await expect(
    page
      .locator(".source-description")
      .filter({
        has: page.getByRole("heading", {
          name: "Source-provided description",
          exact: true,
        }),
      }),
  ).toContainText("TEST FIXTURE: source-provided metadata");
  await expect(
    page.getByRole("link", {
      name: "https://example.test/test-fixture-project",
    }),
  ).toHaveAttribute("href", "https://example.test/test-fixture-project");
  await expect(
    page.getByRole("link", {
      name: "https://example.test/test-fixture-repository",
    }),
  ).toHaveAttribute("href", "https://example.test/test-fixture-repository");
  await expect(page.locator(".contracts")).toContainText(
    "0xTESTFIXTUREUNVERIFIED",
  );
  await expect(
    page.getByText("CoinGecko-reported identifiers.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "connections", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No business connection established" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "research", exact: true }).click();
  await expect(
    page.getByText("Not established yet.", { exact: true }),
  ).toBeVisible();
});

test("desktop and mobile layouts remain usable without horizontal page overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "See the business behind the asset." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "From an asset to an economic story." }),
  ).toBeVisible();
  await expect(
    page.getByText("Opening your local research workspace…"),
  ).toHaveCount(0);
  await page.screenshot({
    path: "/tmp/crypto-business-desktop.png",
    fullPage: true,
    animations: "disabled",
    style: "nextjs-portal { display: none !important; }",
  });

  await page.setViewportSize({ width: 390, height: 844 });
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
  await page.screenshot({
    path: "/tmp/crypto-business-mobile.png",
    fullPage: true,
    animations: "disabled",
    style: "nextjs-portal { display: none !important; }",
  });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "My opportunities", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Where could you create value?" }),
  ).toBeVisible();
  await expect(page.locator(".mobile-scrim")).toHaveCount(0);
  await page.getByRole("button", { name: "Capture an opportunity" }).click();
  await expect(
    page.getByRole("textbox", { name: "Opportunity", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
});
