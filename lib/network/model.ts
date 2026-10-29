import { z } from "zod";
const id = z.string().regex(/^[a-zA-Z0-9:_-]{1,160}$/);
const text = z.string().trim().min(1).max(6000);
const refs = z.array(id).max(30);
export const status = z.enum([
  "confirmed",
  "inference",
  "hypothesis",
  "unknown",
]);
export const FUNCTIONS = [
  "collateral_lending",
  "yield_asset",
  "price_oracle",
  "liquidity",
  "distribution",
  "payments",
  "risk_management",
  "wallet",
  "data",
  "compute",
  "security",
] as const;
export const factSchema = z
  .object({
    code: z.enum(FUNCTIONS),
    text: z.string().trim().min(1).max(2000),
    status,
    sourceIds: refs,
  })
  .strict();
export const sourceSchema = z
  .object({
    id,
    title: text,
    url: z.url().refine((s) => /^https?:\/\//.test(s)),
    observedAt: z.iso.datetime({ offset: true }),
    excerpt: text,
    interpretation: text,
    status,
  })
  .strict();
export const businessSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(200),
    kind: z.enum(["organisation", "product"]),
    summary: text,
    sectors: z.array(text).max(10),
    chains: z.array(text).max(10),
    products: z.array(text).max(20),
    needs: z.array(factSchema).max(30),
    capabilities: z.array(factSchema).max(30),
    sourceIds: refs,
  })
  .strict();
export const relationshipSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9:_-]{1,500}$/),
    a: id,
    b: id,
    type: z.enum([
      "integration",
      "dependency",
      "partnership",
      "competition",
      "could_benefit_from",
    ]),
    reason: text,
    aProvides: text,
    bProvides: text,
    aValue: text,
    bValue: text,
    moneyFlow: text,
    status,
    provenance: z.enum(["manual", "rule", "ai"]),
    sourceIds: z.array(id).max(60),
    gaps: z.array(text).max(20),
    observedAt: z.iso.datetime({ offset: true }),
    confidence: z.number().min(0).max(1).nullable(),
    review: z.enum(["pending", "accepted", "rejected"]),
    note: z.string().max(6000),
    saved: z.boolean(),
  })
  .strict();
export const analysisSchema = z
  .object({
    businessId: id,
    observedAt: z.iso.datetime({ offset: true }),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    model: z.string().max(200),
    description: text,
    customers: text,
    economicModel: text,
    products: z.array(text).max(15),
    needs: z.array(factSchema).max(15),
    capabilities: z.array(factSchema).max(15),
    sourceIds: refs,
    gaps: z.array(text).min(1).max(15),
  })
  .strict();
export const historySchema = z
  .object({
    at: z.iso.datetime({ offset: true }),
    kind: z.enum(["business", "source", "relationship"]),
    id: z.string(),
    before: z.string().max(100000),
    after: z.string().max(100000),
  })
  .strict();
export const graphSchema = z
  .object({
    format: z.literal("bd-oracle-network-v1"),
    revision: z.number().int().nonnegative(),
    analyses: z.array(analysisSchema).max(10000).optional(),
    analysisCache: z
      .array(
        z.object({
          businessId: id,
          fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
          observedAt: z.iso.datetime({ offset: true }),
        }),
      )
      .max(10000)
      .optional(),
    history: z.array(historySchema).max(20000).optional(),
    businesses: z.array(businessSchema).max(2000),
    sources: z.array(sourceSchema).max(10000),
    relationships: z.array(relationshipSchema).max(10000),
  })
  .strict()
  .superRefine((g, ctx) => {
    const error = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    for (const records of [g.businesses, g.sources, g.relationships])
      if (new Set(records.map((r) => r.id)).size !== records.length)
        error("Duplicate record identifiers");
    const businesses = new Set(g.businesses.map((b) => b.id)),
      sources = new Map(g.sources.map((s) => [s.id, s]));
    const check = (ids: string[], confirmed = false) => {
      if (ids.some((i) => !sources.has(i))) error("Missing evidence reference");
      if (
        confirmed &&
        (!ids.length || ids.some((i) => sources.get(i)?.status !== "confirmed"))
      )
        error("Confirmed findings require confirmed evidence");
    };
    for (const a of g.analyses || []) {
      if (!businesses.has(a.businessId))
        error("Analysis references missing business");
      check(a.sourceIds);
      for (const f of [...a.needs, ...a.capabilities]) {
        check(f.sourceIds);
        if (f.status !== "hypothesis") error("AI findings remain hypotheses");
      }
    }
    for (const b of g.businesses) {
      for (const facts of [b.needs, b.capabilities])
        if (new Set(facts.map((f) => f.code)).size !== facts.length)
          error(
            "Each business function code must be unique within needs/capabilities",
          );
      check(b.sourceIds);
      for (const f of [...b.needs, ...b.capabilities])
        check(f.sourceIds, f.status === "confirmed");
    }
    for (const r of g.relationships) {
      if (r.a === r.b || !businesses.has(r.a) || !businesses.has(r.b))
        error("Relationship endpoints must be distinct existing businesses");
      check(r.sourceIds, r.status === "confirmed");
      if (
        r.provenance !== "manual" &&
        (r.status !== "hypothesis" || r.type !== "could_benefit_from")
      )
        error("Machine suggestions must remain hypotheses");
      if (r.status !== "confirmed" && !r.gaps.length)
        error("Unverified relationships need evidence gaps");
      if (r.status === "confirmed" && r.type === "could_benefit_from")
        error("Potential connections cannot be confirmed");
    }
  });
export type Graph = z.infer<typeof graphSchema>;
export type Business = z.infer<typeof businessSchema>;
export type Relationship = z.infer<typeof relationshipSchema>;
export type Source = z.infer<typeof sourceSchema>;
export function validateGraph(value: unknown): Graph {
  return graphSchema.parse(value);
}
export function emptyGraph(): Graph {
  return {
    format: "bd-oracle-network-v1",
    revision: 0,
    businesses: [],
    sources: [],
    relationships: [],
  };
}
export function mergeGraph(current: Graph, incoming: Graph): Graph {
  const merge = <T extends { id: string }>(a: T[], b: T[]) => {
    const map = new Map(a.map((r) => [r.id, r]));
    for (const row of b) {
      const old = map.get(row.id);
      if (old && JSON.stringify(old) !== JSON.stringify(row))
        throw new Error(
          `Conflicting record ${row.id}. Export both workspaces and reconcile before importing.`,
        );
      map.set(row.id, row);
    }
    return [...map.values()];
  };
  return validateGraph({
    ...current,
    businesses: merge(current.businesses, incoming.businesses),
    sources: merge(current.sources, incoming.sources),
    relationships: merge(current.relationships, incoming.relationships),
    analyses: [
      ...new Map(
        [...(current.analyses || []), ...(incoming.analyses || [])].map((a) => [
          JSON.stringify(a),
          a,
        ]),
      ).values(),
    ],
    analysisCache: [
      ...new Map(
        [
          ...(current.analysisCache || []),
          ...(incoming.analysisCache || []),
        ].map((a) => [JSON.stringify(a), a]),
      ).values(),
    ],
    history: [
      ...new Map(
        [...(current.history || []), ...(incoming.history || [])].map((a) => [
          JSON.stringify(a),
          a,
        ]),
      ).values(),
    ],
  });
}

export function recordResearchHistory(previous: Graph, next: Graph): Graph {
  const history = [
    ...new Map(
      [...(previous.history || []), ...(next.history || [])].map((h) => [
        JSON.stringify(h),
        h,
      ]),
    ).values(),
  ];
  for (const [kind, before, after] of [
    ["business", previous.businesses, next.businesses],
    ["source", previous.sources, next.sources],
    ["relationship", previous.relationships, next.relationships],
  ] as const) {
    const old = new Map(before.map((r) => [r.id, JSON.stringify(r)]));
    for (const row of after) {
      const a = JSON.stringify(row),
        b = old.get(row.id);
      if (b && a !== b)
        history.push({
          at: new Date().toISOString(),
          kind,
          id: row.id,
          before: b,
          after: a,
        });
    }
    for (const row of before)
      if (!after.some((r) => r.id === row.id))
        history.push({
          at: new Date().toISOString(),
          kind,
          id: row.id,
          before: JSON.stringify(row),
          after: "null",
        });
  }
  return validateGraph({ ...next, history });
}
