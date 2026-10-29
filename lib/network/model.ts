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
export const graphSchema = z
  .object({
    format: z.literal("bd-oracle-network-v1"),
    revision: z.number().int().nonnegative(),
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
  });
}
