import type {
  AnatomyData,
  AnatomyEdge,
  AnatomyKind,
  AnatomyNode,
} from "./anatomy-types";
// Deliberately generic and client-only. These conceptual examples never enter SQLite.
const labels: [string, AnatomyKind][] = [
  ["Illustrative infrastructure business", "organisation"],
  ["Liquidity", "need"],
  ["Developers", "actor"],
  ["Distribution", "capability"],
  ["Liquidity providers", "actor"],
  ["Capital", "resource"],
  ["Trading venues", "actor"],
  ["Traders", "actor"],
  ["Transaction fees", "resource"],
  ["Liquidity demand", "need"],
  ["SDKs", "capability"],
  ["Documentation", "resource"],
  ["Hosting", "resource"],
  ["Infrastructure", "capability"],
  ["Applications", "product"],
  ["Users", "actor"],
];
export const exampleNodes: AnatomyNode[] = labels.map(
  ([name, kind], index) => ({
    id: -(index + 1),
    entity_id: null,
    name,
    kind,
    description:
      "Illustrative concept. Not a researched business fact or contractual relationship.",
    created_at: "",
  }),
);
const specifications: [number, number, string, string][] = [
  [1, 2, "needs_to_operate", "blood"],
  [1, 3, "needs_to_grow", "brain"],
  [1, 4, "needs_to_grow", "oxygen"],
  [5, 2, "provides_to", "blood"],
  [5, 6, "needs_to_operate", "blood"],
  [6, 7, "provides_to", "blood"],
  [7, 8, "provides_to", "blood"],
  [8, 9, "pays_for", "blood"],
  [9, 10, "could_benefit_from", "blood"],
  [10, 2, "could_benefit_from", "blood"],
  [3, 11, "needs_to_operate", "brain"],
  [3, 12, "needs_to_operate", "brain"],
  [3, 13, "needs_to_operate", "food"],
  [13, 14, "provides_to", "legs"],
  [14, 15, "provides_to", "legs"],
  [15, 16, "provides_to", "oxygen"],
];
export const exampleEdges: AnatomyEdge[] = specifications.map(
  ([a, b, relation, lens], index) => ({
    id: "illustration:" + index,
    source_id: -a,
    target_id: -b,
    relation,
    readonly: true,
    essentiality:
      relation === "needs_to_operate"
        ? "essential"
        : relation === "needs_to_grow"
          ? "optional"
          : "unknown",
    actuality: "potential",
    lens,
    status: "hypothesis",
    explanation:
      "A conceptual research path showing how a need can lead to another economic map. No claim about a real business or a verified relationship is made.",
    source_value: "Possible value to investigate, not established.",
    target_value: "Possible value to investigate, not established.",
    money: "unknown",
    evidence_id: null,
    observed_at: "",
    evidence_gaps:
      "Identify real actors, validate the need, inspect alternatives and find evidence of the actual exchange.",
    provenance: "illustrative",
    supersedes_id: null,
    active: 1,
    source_name: exampleNodes[a - 1].name,
    target_name: exampleNodes[b - 1].name,
    source_kind: exampleNodes[a - 1].kind,
    target_kind: exampleNodes[b - 1].kind,
    source_entity_id: null,
    target_entity_id: null,
    created_at: "",
  }),
);
export function exampleMap(
  center: number,
  filters: Record<string, string>,
): AnatomyData {
  const edges = exampleEdges.filter(
    (e) =>
      (e.source_id === center || e.target_id === center) &&
      (filters.lens === "all" || e.lens === filters.lens) &&
      (filters.status === "all" || e.status === filters.status) &&
      (filters.direction === "both" ||
        (filters.direction === "incoming"
          ? e.target_id === center
          : e.source_id === center)) &&
      (filters.category === "all" ||
        (filters.category === "essential"
          ? e.essentiality === "essential"
          : filters.category === "growth"
            ? e.relation === "needs_to_grow"
            : e.actuality === filters.category)),
  );
  const ids = new Set([
    center,
    ...edges.flatMap((e) => [e.source_id, e.target_id]),
  ]);
  return {
    center_id: center,
    catalog: exampleNodes,
    nodes: exampleNodes.filter((n) => ids.has(n.id)),
    edges,
    history: [],
    filters,
    limits: {
      max_nodes: 500,
      max_edges: 500,
      catalog_limit: 5000,
      nodes_total: ids.size,
      edges_total: edges.length,
      catalog_total: exampleNodes.length,
      nodes_truncated: false,
      edges_truncated: false,
      catalog_truncated: false,
    },
  };
}
