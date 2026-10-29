import { test, expect, type APIRequestContext } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

// Every actor and source below is synthetic, stored only in Playwright's
// disposable E2E_DATA_DIR. These are implementation checks, not market research.
const run = Date.now().toString(36);
const observed = "2026-04-05T06:07:08+00:00";
const checked = "2026-04-06T07:08:09+00:00";
async function call<T = Record<string, unknown>>(
  request: APIRequestContext,
  action: string,
  data: unknown = {},
): Promise<T> {
  const response = await request.post("/api/" + action, { data });
  const body = await response.json();
  expect(
    response.ok(),
    `${action}: ${body.error || response.status()}`,
  ).toBeTruthy();
  return body.data;
}
async function business(
  request: APIRequestContext,
  name: string,
  kind = "organisation",
) {
  return (await call<{ id: number }>(request, "save_entity", { name, kind }))
    .id;
}
async function source(request: APIRequestContext, title: string) {
  return (
    await call<{ id: number }>(request, "save_evidence", {
      title,
      url: "https://example.test/vision-source",
      source_type: "Official documentation",
      observed_at: observed,
      verification: "confirmed",
      original_text:
        "TEST FIXTURE ORIGINAL SOURCE: a fictional application uses fictional infrastructure. This is not factual research.",
      interpretation:
        "Test fixture interpretation; supports the synthetic relationship only.",
    })
  ).id;
}
type GraphNode = { id: number; name: string; entity_id: number | null };
type GraphEdge = {
  id: number | string;
  source_id: number;
  target_id: number;
  relation: string;
  status: string;
  actuality: string;
  money: string;
  provenance: string;
  explanation: string;
  evidence_checked_at?: string | null;
};
type Graph = {
  center_id: number | null;
  catalog: GraphNode[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  history: GraphEdge[];
};
async function graph(
  request: APIRequestContext,
  entityId: number,
  extra: Record<string, unknown> = {},
) {
  return call<Graph>(request, "anatomy", { entity_id: entityId, ...extra });
}
function edge(
  source_id: number,
  target_id: number,
  extra: Record<string, unknown> = {},
) {
  return {
    source_id,
    target_id,
    relation: "needs_to_operate",
    essentiality: "essential",
    actuality: "existing",
    lens: "legs",
    status: "hypothesis",
    explanation:
      "TEST FIXTURE: an explicitly researched synthetic economic dependency.",
    source_context: "Synthetic application needs execution services.",
    target_context:
      "Synthetic infrastructure supplier provides execution services.",
    source_value: "Synthetic application receives execution services.",
    target_value:
      "Synthetic supplier receives demand, with payment unverified.",
    money: "unknown",
    observed_at: observed,
    evidence_gaps:
      "Verify the real need, existing alternatives and commercial terms.",
    ...extra,
  };
}
async function fixtureAsset(evidence: number) {
  const directory = process.env.E2E_DATA_DIR;
  if (!directory || path.resolve(directory) === path.resolve("data"))
    throw Error("Asset fixtures require an isolated E2E_DATA_DIR");
  const script = `import json,sys\nfrom terminal.db import connect,now\ndb=connect()\nasset=db.execute("INSERT INTO entities(kind,name,created_at) VALUES('asset',?,?)",(sys.argv[1],now())).lastrowid\ndb.execute("INSERT INTO identities(id,name,ticker) VALUES(?,?,?)",(sys.argv[1].lower(),'TEST FIXTURE CoinGecko project',sys.argv[1]))\ndb.execute("INSERT INTO assets(id,exchange,code,identity_id,match_status,match_evidence_id,first_seen,last_seen) VALUES(?,'binance',?,?,'verified',?,?,?)",(asset,sys.argv[1],sys.argv[1].lower(),int(sys.argv[2]),now(),now()))\ndb.commit()\ndb.close()\nprint(json.dumps({'id':asset}))`;
  const { stdout } = await promisify(execFile)(
    process.env.PYTHON_BIN || "python3",
    ["-c", script, "VISIONFIXTURE" + run.toUpperCase(), String(evidence)],
    {
      cwd: process.cwd(),
      env: { ...process.env, TERMINAL_DATA_DIR: directory },
    },
  );
  return JSON.parse(stdout).id as number;
}

test("dedicated asset/business anatomy and network expand stored relationships while preserving meaning", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const evidence = await source(request, "Test Fixture Vision Source " + run);
  const asset = await fixtureAsset(evidence);
  await page.goto(`/assets/${asset}/anatomy`);
  await expect(
    page.getByRole("heading", {
      name: "No business association established.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Its CoinGecko identity does not establish a company, product or business dependency.",
      { exact: false },
    ),
  ).toBeVisible();
  const productName = "Test Fixture Vision Product " + run;
  const product = await business(request, productName, "product");
  const operator = await business(
    request,
    "Test Fixture Vision Operator " + run,
  );
  const alternativeName = "Test Fixture Unverified Product " + run;
  const alternative = await business(request, alternativeName, "product");
  const providerName = "Test Fixture Execution Provider " + run;
  const provider = await business(request, providerName);
  await call(request, "save_link", {
    from_id: product,
    to_id: asset,
    type: "associated_asset",
    status: "confirmed",
    evidence_id: evidence,
    observed_at: observed,
  });
  await call(request, "save_link", {
    from_id: operator,
    to_id: product,
    type: "operates",
    status: "confirmed",
    evidence_id: evidence,
    observed_at: observed,
  });
  await call(request, "save_link", {
    from_id: alternative,
    to_id: asset,
    type: "associated_asset",
    status: "hypothesis",
    observed_at: observed,
  });
  const map = await graph(request, product);
  const root = map.catalog.find((n) => n.entity_id === product)!.id;
  const providerNode = map.catalog.find((n) => n.entity_id === provider)!.id;
  const hosting = (
    await call<{ id: number }>(request, "save_graph_node", {
      kind: "resource",
      name: "Test Fixture Hosting Input " + run,
      description: "Synthetic recurring input; not real research.",
    })
  ).id;
  const demand = (
    await call<{ id: number }>(request, "save_graph_node", {
      kind: "need",
      name: "Test Fixture Third-hop Demand " + run,
      description: "Synthetic third-hop investigation subject.",
    })
  ).id;
  await call(
    request,
    "save_graph_edge",
    edge(root, providerNode, {
      relation: "pays_for",
      essentiality: "unknown",
      status: "confirmed",
      evidence_id: evidence,
      money: "yes",
      money_direction: "source_to_target",
      evidence_checked_at: checked,
      source_value: "Synthetic application receives execution services.",
      target_value:
        "Synthetic provider receives payment for the fictional service.",
    }),
  );
  await call(request, "save_graph_edge", edge(providerNode, hosting));
  await call(request, "save_graph_edge", edge(hosting, demand));
  await page.reload();
  const confirmedCard = page.locator(".business-card").filter({
    has: page.getByRole("heading", { name: productName, exact: true }),
  });
  await expect(confirmedCard).toContainText("Confirmed fact");
  await confirmedCard.locator(".relationship-evidence summary").click();
  await expect(confirmedCard.locator("blockquote")).toContainText(
    "TEST FIXTURE ORIGINAL SOURCE",
  );
  await expect(confirmedCard).toContainText("Test fixture interpretation");
  const unverifiedCard = page.locator(".business-card").filter({
    has: page.getByRole("heading", { name: alternativeName, exact: true }),
  });
  await expect(unverifiedCard).toContainText("hypothesis");
  await expect(unverifiedCard).toContainText("unverified association");
  await confirmedCard
    .getByRole("link", { name: "Open Business Anatomy", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/businesses/${product}/anatomy(?:\\?|$)`),
  );
  await expect(
    page
      .locator(".anatomy-graph-panel")
      .getByRole("heading", { name: productName, exact: true }),
  ).toBeVisible();
  await page
    .locator(".anatomy-edge-list")
    .getByRole("button", {
      name: `Inspect connection ${productName} to ${providerName}`,
      exact: true,
    })
    .click();
  await expect(page.locator(".anatomy-inspector")).toContainText(
    "Synthetic application needs execution services.",
  );
  await expect(page.locator(".anatomy-inspector")).toContainText(
    "Synthetic infrastructure supplier provides execution services.",
  );
  await expect(page.locator(".anatomy-inspector")).toContainText(
    `${productName} pays ${providerName}`,
  );
  await expect(page.locator(".anatomy-inspector")).toContainText(
    "Evidence last checked:",
  );
  await expect(page.locator(".anatomy-inspector")).not.toContainText(
    "Evidence last checked: Not recorded",
  );
  await page.goto(`/network?node=${root}`);
  await expect(
    page.getByRole("combobox", { name: "Network depth", exact: true }),
  ).toHaveValue("2");
  await expect(
    page.getByRole("button", {
      name: "Centre on Test Fixture Hosting Input " + run,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Centre on Test Fixture Third-hop Demand " + run,
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Network depth", exact: true })
    .selectOption("1");
  await expect(
    page.getByRole("button", {
      name: "Centre on Test Fixture Hosting Input " + run,
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Expand network", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Centre on Test Fixture Hosting Input " + run,
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Expand network", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Centre on Test Fixture Third-hop Demand " + run,
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Network depth", exact: true }),
  ).toHaveValue("3");
  await expect(
    page.getByRole("button", {
      name: "Centre on Test Fixture Third-hop Demand " + run,
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Centre on " + providerName, exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Centre node", exact: true }),
  ).toHaveValue(String(providerNode));
  await page
    .getByRole("button", { name: "Back one step", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Centre node", exact: true }),
  ).toHaveValue(String(root));
  const stored = await graph(request, product, { scope: "network", depth: 3 });
  expect(stored.edges).toHaveLength(3);
  expect(stored.edges.filter((e) => e.status === "confirmed")).toHaveLength(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});

test("reusable dependency frameworks are editable questions and create no business facts", async ({
  page,
  request,
}) => {
  const before = await call<{ entities: unknown[] }>(request, "overview");
  const beforeGraph = await call<Graph>(request, "anatomy");
  await page.goto("/?view=frameworks");
  await expect(
    page.getByRole("heading", { name: "Research frameworks", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Choose a research framework", exact: true })
    .selectOption({ label: "Lending protocol" });
  await expect(page.locator(".framework-questions")).toContainText(
    /liquidity/i,
  );
  await page
    .getByRole("button", { name: "New framework", exact: true })
    .click();
  const name = "Test Fixture Specialist Framework " + run;
  await page
    .getByRole("textbox", { name: "Framework name", exact: true })
    .fill(name);
  await page
    .getByRole("textbox", { name: "Framework description", exact: true })
    .fill("Test fixture questions, not assumptions about any business.");
  await page
    .getByRole("textbox", { name: "Topic 1", exact: true })
    .fill("Recurring inputs");
  await page
    .getByRole("textbox", { name: "Research question 1", exact: true })
    .fill(
      "Test fixture: which inputs are consumed repeatedly, and what evidence establishes this?",
    );
  await page
    .getByRole("button", { name: "Save framework", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "No business facts or connections were created",
  );
  await page
    .getByRole("button", { name: "Edit framework", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Research question 1", exact: true })
    .fill(
      "Test fixture refined question: who supplies each input, and are alternatives already used?",
    );
  await page
    .getByRole("button", { name: "Save framework", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("combobox", { name: "Choose a research framework", exact: true })
    .selectOption({ label: name });
  await expect(page.locator(".framework-questions")).toContainText(
    "refined question",
  );
  const after = await call<{ entities: unknown[] }>(request, "overview");
  const afterGraph = await call<Graph>(request, "anatomy");
  expect(after.entities).toHaveLength(before.entities.length);
  expect(afterGraph.edges).toEqual(beforeGraph.edges);
  expect(afterGraph.nodes).toEqual(beforeGraph.nodes);
});

test("structured proposals stay separate until human review and can only enter the graph as hypotheses", async ({
  page,
  request,
}) => {
  const businessName = "Test Fixture Proposal Subject " + run;
  const entity = await business(request, businessName);
  const peerName = "Test Fixture Proposal Complement " + run;
  const peer = await business(request, peerName);
  const sourceId = await source(request, "Test Fixture Proposal Source " + run);
  const base = await graph(request, entity);
  const a = base.catalog.find((n) => n.entity_id === entity)!.id;
  const b = base.catalog.find((n) => n.entity_id === peer)!.id;
  const explanation = "Test fixture source-linked proposal " + run;
  const proposal = {
    provider: "test-fixture-import",
    model: "synthetic-disabled-adapter",
    kind: "connection",
    confidence: 0.93,
    explanation,
    evidence_gaps:
      "Test fixture: validate actual demand, technical fit, current suppliers and commercial viability.",
    source_ids: [sourceId],
    payload: {
      source_id: a,
      target_id: b,
      relation: "could_benefit_from",
      essentiality: "optional",
      lens: "oxygen",
      source_value: "Synthetic actor might gain a capability.",
      target_value: "Synthetic peer might gain distribution.",
      source_context: "Synthetic actor has a possible unmet need.",
      target_context: "Synthetic peer may supply a complementary capability.",
    },
  };
  await page.goto("/?view=intelligence");
  await expect(
    page.getByText("External intelligence is disabled.", { exact: true }),
  ).toBeVisible();
  await page
    .getByText("Import a structured proposal for review", { exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Structured proposal JSON", exact: true })
    .fill(JSON.stringify(proposal));
  await page
    .getByRole("button", { name: "Stage proposal", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "No research fact or graph connection was created",
  );
  const staged = await call<{
    proposals: { id: number; explanation: string; status: string }[];
  }>(request, "list_proposals");
  const item = staged.proposals.find((p) => p.explanation === explanation)!;
  expect(item.status).toBe("proposed");
  expect((await graph(request, entity)).edges).toEqual([]);
  const card = page.locator(".proposal-card").filter({
    has: page.getByRole("heading", { name: explanation, exact: true }),
  });
  await expect(
    card.getByRole("button", {
      name: "Keep as research hypothesis",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(card.locator(".proposal-payload")).toContainText(businessName);
  await expect(card.locator(".proposal-payload")).toContainText(peerName);
  await card
    .getByText("Edit this hypothesis before keeping it", { exact: true })
    .click();
  const editedExplanation = "TEST FIXTURE researcher-edited possibility " + run;
  await page
    .getByRole("textbox", {
      name: `Edited explanation for proposal ${item.id}`,
      exact: true,
    })
    .fill(editedExplanation);
  await page
    .getByRole("textbox", {
      name: `Review note for proposal ${item.id}`,
      exact: true,
    })
    .fill(
      "TEST FIXTURE: keep this possibility for investigation; the source does not establish a partnership or customer.",
    );
  await card
    .getByRole("button", { name: "Keep as research hypothesis", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("not a verified fact");
  const accepted = await graph(request, entity);
  expect(accepted.edges).toHaveLength(1);
  expect(accepted.edges[0]).toMatchObject({
    relation: "could_benefit_from",
    status: "hypothesis",
    actuality: "potential",
    money: "unknown",
    provenance: "ai_reviewed",
  });
  expect(accepted.edges[0].evidence_checked_at).toBeNull();
  expect(accepted.edges[0].explanation).toBe(editedExplanation);
  const reviewed = await call<{
    proposals: {
      id: number;
      explanation: string;
      reviewed_explanation: string;
    }[];
  }>(request, "list_proposals");
  expect(reviewed.proposals.find((p) => p.id === item.id)).toMatchObject({
    explanation,
    reviewed_explanation: editedExplanation,
  });
  await page.goto(`/businesses/${entity}/anatomy`);
  await page
    .locator(".anatomy-edge-list")
    .getByRole("button", {
      name: `Inspect connection ${businessName} to ${peerName}`,
      exact: true,
    })
    .click();
  await expect(page.locator(".anatomy-inspector")).toContainText(
    "still a hypothesis",
  );
  await expect(page.locator(".anatomy-inspector")).toContainText(
    "does not verify the relationship",
  );
  await expect(page.locator(".anatomy-inspector")).toContainText(
    "technical fit",
  );
});
