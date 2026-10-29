import { Graph, validateGraph } from "../network/model";
import { Registry, currentDirectory } from "./model";
export function eligibleBusinessIds(registry: Registry) {
  return new Set(
    currentDirectory(registry).flatMap((row) => [
      `cg:${row.id}`,
      ...row.assets.flatMap((a) => a.businessIds),
    ]),
  );
}
export function scopeGraph(g: Graph, registry: Registry): Graph {
  const ids = eligibleBusinessIds(registry);
  return {
    ...g,
    analyses: g.analyses?.filter((a) => ids.has(a.businessId)),
    analysisCache: g.analysisCache?.filter((a) => ids.has(a.businessId)),
    businesses: g.businesses.filter((b) => ids.has(b.id)),
    relationships: g.relationships.filter((r) => ids.has(r.a) && ids.has(r.b)),
  };
}
export function prepareProjects(g: Graph, registry: Registry): Graph {
  const businesses = [...g.businesses],
    sources = [...g.sources];
  for (const row of currentDirectory(registry)) {
    const m = row.metadata;
    if (!m) continue;
    const sourceId = `cg-source:${row.id}:${m.profileObservedAt?.replace(/[^a-zA-Z0-9]/g, "") || "identity"}`;
    if (!sources.some((s) => s.id === sourceId))
      sources.push({
        id: sourceId,
        title: `CoinGecko metadata: ${m.name}`,
        url: `https://www.coingecko.com/en/coins/${encodeURIComponent(row.id)}`,
        observedAt: m.profileObservedAt || m.observedAt,
        excerpt:
          m.description.slice(0, 4000) ||
          JSON.stringify({ id: m.id, name: m.name, symbol: m.symbol }),
        interpretation:
          "Provider asset/project metadata. It does not establish an operating organisation or verify its economics.",
        status: "unknown",
      });
    const index = businesses.findIndex((b) => b.id === `cg:${row.id}`);
    if (index >= 0) {
      const b = businesses[index];
      businesses[index] = {
        ...b,
        sourceIds: [
          ...b.sourceIds.filter((s) => !s.startsWith(`cg-source:${row.id}:`)),
          sourceId,
        ],
        sectors: b.sectors.length ? b.sectors : m.categories.slice(0, 10),
      };
      continue;
    }
    businesses.push({
      id: `cg:${row.id}`,
      name: m.name,
      kind: "product",
      summary:
        "Business model not yet researched. Review the provider description and official documentation before drawing conclusions.",
      sectors: m.categories.slice(0, 10),
      chains: [],
      products: [],
      needs: [],
      capabilities: [],
      sourceIds: [sourceId],
    });
  }
  return validateGraph({ ...g, businesses, sources });
}

export function withAnalysisFacts(g: Graph): Graph {
  return {
    ...g,
    businesses: g.businesses.map((b) => {
      const a = g.analyses?.filter((a) => a.businessId === b.id).at(-1);
      if (!a) return b;
      return {
        ...b,
        needs: [
          ...b.needs,
          ...a.needs.filter((f) => !b.needs.some((n) => n.code === f.code)),
        ],
        capabilities: [
          ...b.capabilities,
          ...a.capabilities.filter(
            (f) => !b.capabilities.some((n) => n.code === f.code),
          ),
        ],
      };
    }),
  };
}
