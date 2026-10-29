import { test, expect, type APIRequestContext } from "@playwright/test";

// These are fictional research fixtures inside Playwright's temporary database.
// No statements in this suite represent an actual company's dependencies.
const suffix = Date.now().toString(36);
const fixture = {
  business: `Test Fixture Anatomy Business ${suffix}`,
  provider: `Test Fixture Anatomy Provider ${suffix}`,
  need: `Test Fixture Liquidity Need ${suffix}`,
  capital: `Test Fixture Capital Resource ${suffix}`,
  possibility: `Test Fixture Growth Capability ${suffix}`,
  evidence: `Test Fixture Anatomy Source ${suffix}`,
};
const observed = "2026-03-04T05:06:07+00:00";

type Node = {
  id: number;
  name: string;
  kind: string;
  entity_id: number | null;
};
type Edge = {
  id: number | string;
  relation: string;
  status: string;
  actuality: string;
};
type Graph = {
  center_id: number | null;
  catalog: Node[];
  nodes: Node[];
  edges: Edge[];
  history: Edge[];
};

async function call<T>(
  request: APIRequestContext,
  action: string,
  data: unknown = {},
): Promise<T> {
  const response = await request.post("/api/" + action, { data });
  const result = await response.json();
  expect(
    response.ok(),
    `${action}: ${result.error || response.status()}`,
  ).toBeTruthy();
  return result.data;
}

function edgeData(
  source: number,
  target: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    source_id: source,
    target_id: target,
    relation: "needs_to_operate",
    essentiality: "essential",
    actuality: "existing",
    lens: "blood",
    status: "hypothesis",
    explanation: "Test fixture dependency rationale, unverified.",
    source_value: "Test fixture actor receives an input.",
    target_value: "Test fixture provider gains possible demand.",
    money: "unknown",
    observed_at: observed,
    evidence_gaps:
      "Test fixture gap: verify demand, alternatives and actual providers.",
    ...overrides,
  };
}

test("Business Anatomy records evidence-aware connections and traverses business to need to provider", async ({
  page,
  request,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const business = await call<{ id: number }>(request, "save_entity", {
    name: fixture.business,
    kind: "organisation",
  });
  const provider = await call<{ id: number }>(request, "save_entity", {
    name: fixture.provider,
    kind: "organisation",
  });
  const evidence = await call<{ id: number }>(request, "save_evidence", {
    title: fixture.evidence,
    url: "https://example.test/anatomy-fixture",
    source_type: "Official documentation",
    original_text:
      "TEST FIXTURE: A fictional business requires a fictional input. This is not real research.",
    interpretation:
      "Test fixture interpretation: supports only this fictional operating dependency.",
    verification: "confirmed",
    observed_at: observed,
  });
  await call(request, "save_claim", {
    entity_id: business.id,
    field: "suppliers",
    statement: "Test fixture unconfirmed supplier must not appear established.",
    status: "hypothesis",
    observed_at: observed,
  });
  await call(request, "save_claim", {
    entity_id: business.id,
    field: "what_it_does",
    statement: "Test fixture anatomy business description.",
    status: "hypothesis",
    observed_at: observed,
  });
  const initial = await call<Graph>(request, "anatomy", {
    entity_id: business.id,
  });
  const businessNode = initial.catalog.find(
    (n) => n.entity_id === business.id,
  )!;
  const providerNode = initial.catalog.find(
    (n) => n.entity_id === provider.id,
  )!;
  expect(businessNode).toBeTruthy();
  expect(initial.edges).toEqual([]); // A business record does not generate dependencies.

  await page.goto("/research");
  await page
    .getByRole("button", { name: "Business Anatomy", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Centre node", exact: true })
    .selectOption(String(businessNode.id));
  await expect(page.locator(".anatomy-summary")).toContainText(
    "Test fixture anatomy business description.",
  );
  const establishedSuppliers = page
    .locator(".anatomy-questions .panel")
    .filter({
      has: page.getByRole("heading", {
        name: "Who already supplies it?",
        exact: true,
      }),
    });
  await expect(establishedSuppliers).not.toContainText(
    "Test fixture unconfirmed supplier",
  );
  await expect(establishedSuppliers).toContainText(
    "Not established in this view.",
  );
  await page
    .getByRole("button", { name: "Record nodes & connections", exact: true })
    .click();
  await page.getByRole("tab", { name: "Nodes", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Node type", exact: true })
    .selectOption("need");
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill(fixture.need);
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill(
      "TEST FIXTURE: a fictional recurring need, not a universal business requirement.",
    );
  await page.getByRole("button", { name: "Save node", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Research node saved locally",
  );

  const afterNode = await call<Graph>(request, "anatomy", {
    entity_id: business.id,
  });
  const needNode = afterNode.catalog.find((n) => n.name === fixture.need)!;
  expect(needNode).toBeTruthy();
  expect(afterNode.edges).toEqual([]);
  await page.getByRole("tab", { name: "Connections", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Source node", exact: true })
    .selectOption(String(businessNode.id));
  await page
    .getByRole("combobox", { name: "Connection type", exact: true })
    .selectOption("needs_to_operate");
  await page
    .getByRole("combobox", { name: "Target node", exact: true })
    .selectOption(String(needNode.id));
  await expect(
    page.getByRole("textbox", {
      name: "Derived dependency importance",
      exact: true,
    }),
  ).toHaveValue("Essential for this dependency");
  await page
    .getByRole("combobox", { name: "Relationship state", exact: true })
    .selectOption("existing");
  await page
    .getByRole("combobox", { name: "Anatomy lens", exact: true })
    .selectOption("blood");
  await page
    .getByRole("textbox", { name: "Why this connection exists", exact: true })
    .fill(
      "Test fixture confirmed operating dependency: the fictional business needs the fictional input.",
    );
  await page
    .getByRole("textbox", { name: "Value received by source", exact: true })
    .fill("Test fixture business receives the input needed to operate.");
  await page
    .getByRole("textbox", { name: "Value received by target", exact: true })
    .fill("Test fixture suppliers receive demand; payment is unknown.");
  await page
    .getByRole("combobox", { name: "Does money change hands?", exact: true })
    .selectOption("unknown");
  await page
    .getByRole("combobox", { name: "Evidence status", exact: true })
    .selectOption("confirmed");
  await page
    .getByRole("textbox", { name: "What remains unverified?", exact: true })
    .fill(
      "Who supplies the need and whether money changes hands remain unknown.",
    );
  // A visually confirmed map connection cannot be persisted without evidence.
  await page
    .getByRole("button", { name: "Save connection", exact: true })
    .click();
  await expect(page.locator('.notice.error[role="alert"]')).toContainText(
    "require evidence",
  );
  await page
    .getByRole("combobox", { name: "Supporting evidence", exact: true })
    .selectOption(String(evidence.id));
  await page
    .getByRole("button", { name: "Save connection", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Connection saved locally",
  );

  const capital = await call<{ id: number }>(request, "save_graph_node", {
    name: fixture.capital,
    kind: "resource",
    description: "Test fixture capital input. Not real research.",
  });
  const possibility = await call<{ id: number }>(request, "save_graph_node", {
    name: fixture.possibility,
    kind: "capability",
    description: "Test fixture possible future capability.",
  });
  await call(request, "save_graph_edge", edgeData(needNode.id, capital.id));
  await call(
    request,
    "save_graph_edge",
    edgeData(providerNode.id, needNode.id, {
      relation: "provides_to",
      essentiality: "unknown",
      status: "confirmed",
      evidence_id: evidence.id,
      explanation:
        "Test fixture provider supplies a fictional input; no payment is established.",
      evidence_gaps: "",
    }),
  );
  const potential = await call<{ id: number }>(
    request,
    "save_graph_edge",
    edgeData(businessNode.id, possibility.id, {
      relation: "could_benefit_from",
      essentiality: "optional",
      actuality: "potential",
      lens: "oxygen",
    }),
  );

  await page.reload();
  await page
    .getByRole("combobox", { name: "Centre node", exact: true })
    .selectOption(String(businessNode.id));
  await page
    .getByRole("button", { name: "Centre on " + fixture.need, exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("combobox", { name: "Centre node", exact: true }),
  ).toHaveValue(String(needNode.id));
  await expect(
    page
      .getByRole("button", {
        name: "Centre on " + fixture.capital,
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByRole("button", {
        name: "Centre on " + fixture.provider,
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Centre on " + fixture.provider, exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("combobox", { name: "Centre node", exact: true }),
  ).toHaveValue(String(providerNode.id));

  await page
    .getByRole("combobox", { name: "Centre node", exact: true })
    .selectOption(String(businessNode.id));
  await page
    .getByRole("combobox", { name: "Connection filter", exact: true })
    .selectOption("potential");
  await expect(
    page
      .getByRole("button", {
        name: "Centre on " + fixture.possibility,
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Centre on " + fixture.need,
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Connection filter", exact: true })
    .selectOption("all");
  await page
    .getByRole("combobox", { name: "Evidence filter", exact: true })
    .selectOption("confirmed");
  await expect(
    page
      .getByRole("button", { name: "Centre on " + fixture.need, exact: true })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Centre on " + fixture.possibility,
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .locator(".anatomy-edge-list")
    .getByRole("button", {
      name: `Inspect connection ${fixture.business} to ${fixture.need}`,
      exact: true,
    })
    .click();
  await page
    .locator(".anatomy-inspector .relationship-evidence summary")
    .click();
  await expect(
    page
      .getByText(
        "TEST FIXTURE: A fictional business requires a fictional input. This is not real research.",
        { exact: true },
      )
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(
        "Test fixture interpretation: supports only this fictional operating dependency.",
        { exact: false },
      )
      .first(),
  ).toBeVisible();

  const persisted = await call<Graph>(request, "anatomy", {
    entity_id: business.id,
  });
  expect(persisted.edges.find((e) => e.id === potential.id)).toMatchObject({
    relation: "could_benefit_from",
    status: "hypothesis",
    actuality: "potential",
  });
  expect(persisted.edges.filter((e) => e.status === "confirmed")).toHaveLength(
    1,
  );
  await page
    .getByRole("textbox", { name: "Reason for retraction", exact: true })
    .fill(
      "TEST FIXTURE: later investigation contradicted the original dependency.",
    );
  await page
    .getByRole("button", { name: "Retract connection", exact: true })
    .click();
  await expect(page.locator(".anatomy-inspector")).toHaveCount(0);
  await page.locator(".anatomy-history summary").click();
  await expect(page.locator(".anatomy-history")).toContainText(
    "later investigation contradicted",
  );
  const retracted = await call<Graph>(request, "anatomy", {
    entity_id: business.id,
  });
  expect(retracted.edges.filter((e) => e.status === "confirmed")).toHaveLength(
    0,
  );
  expect(retracted.history).toHaveLength(1);
  expect(JSON.stringify(retracted.history)).toContain(
    "TEST FIXTURE: A fictional business requires",
  );
  expect(pageErrors).toEqual([]);
});

test("Business Anatomy remains usable at mobile width without turning the analogy into facts", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const before = await call<Graph>(request, "anatomy");
  await page.goto("/?view=anatomy");
  await expect(
    page.getByRole("combobox", { name: "Centre node", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page
    .getByRole("button", { name: "Illustrative example", exact: true })
    .click();
  await expect(page.locator(".notice.illustrative")).toContainText(
    "not verified business research",
  );
  await page
    .getByRole("button", { name: "Centre on Liquidity", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Centre node", exact: true }),
  ).toHaveValue("-2");
  await page
    .locator(".anatomy-lenses")
    .getByRole("button", { name: /^Oxygen/ })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Lens filter", exact: true }),
  ).toHaveValue("oxygen");
  await expect(
    page.getByRole("button", {
      name: "Record nodes & connections",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page
    .locator(".anatomy-lenses")
    .getByRole("button", { name: /^Whole business/ })
    .click();
  await page
    .getByRole("combobox", { name: "Centre node", exact: true })
    .selectOption("-1");
  await expect(
    page.getByRole("button", { name: "Centre on Liquidity", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/crypto-business-anatomy-mobile.png",
    fullPage: true,
    animations: "disabled",
    style: "nextjs-portal { display:none !important; }",
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page
    .getByRole("combobox", { name: "Centre node", exact: true })
    .selectOption("-2");
  await expect(
    page.getByRole("combobox", { name: "Centre node", exact: true }),
  ).toHaveValue("-2");
  await page
    .getByRole("combobox", { name: "Centre node", exact: true })
    .selectOption("-1");
  await expect(
    page.getByRole("button", { name: "Centre on Liquidity", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/crypto-business-anatomy-desktop.png",
    fullPage: true,
    animations: "disabled",
    style: "nextjs-portal { display:none !important; }",
  });
  const after = await call<Graph>(request, "anatomy");

  expect(after.edges).toEqual(before.edges);
  expect(after.catalog).toEqual(before.catalog);
});
