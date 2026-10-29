import { Graph, Relationship, Business } from "./model";
// Deliberately transparent: a sourced need, matching sourced capability and shared chain.
// A match is a research question, not evidence that a relationship is new or viable.
export const MAX_RULE_MATCHES = 500;
export function matchBusinesses(g: Graph): Relationship[] {
  const result: Relationship[] = [];
  const known = new Set(
    g.relationships
      .filter((r) => r.provenance === "manual" && r.status === "confirmed")
      .flatMap((r) => [`${r.a}|${r.b}`, `${r.b}|${r.a}`]),
  );
  const recorded = new Set(g.relationships.map((r) => r.id));
  const sources = new Map(g.sources.map((s) => [s.id, s]));
  const suppliers = new Map<string, Business[]>();
  for (const b of g.businesses)
    for (const cap of b.capabilities)
      if (cap.sourceIds.length && cap.status !== "unknown")
        suppliers.set(cap.code, [...(suppliers.get(cap.code) || []), b]);
  matching: for (const a of g.businesses)
    for (const need of a.needs) {
      if (!need.sourceIds.length || need.status === "unknown") continue;
      for (const b of suppliers.get(need.code) || []) {
        if (a.id === b.id || known.has(`${a.id}|${b.id}`)) continue;
        const capability = b.capabilities.find((c) => c.code === need.code)!;
        const shared = a.chains.filter((c) =>
          b.chains.some((x) => x.toLowerCase() === c.toLowerCase()),
        );
        if (a.chains.length && b.chains.length && !shared.length) continue;
        const id = `rule:${a.id}:${b.id}:${need.code}`;
        if (recorded.has(id)) continue;
        recorded.add(id);
        const sourceIds = [
          ...new Set([...need.sourceIds, ...capability.sourceIds]),
        ];
        const observedAt = sourceIds
          .map((id) => sources.get(id)!.observedAt)
          .sort()
          .at(-1)!;
        result.push({
          id,
          a: a.id,
          b: b.id,
          type: "could_benefit_from",
          reason: `${a.name} needs ${need.text} ${b.name} supplies ${capability.text} Matching these functions suggests a research lead, not a verified integration.`,
          aProvides: `Potential demand for ${need.code.replaceAll("_", " ")}; budget unknown.`,
          bProvides: capability.text,
          aValue: `Potential help with: ${need.text}`,
          bValue:
            "Possible product adoption; additional users, revenue and willingness to pay are unverified.",
          moneyFlow:
            "Unknown. No payment or introducer compensation agreement is established.",
          status: "hypothesis",
          provenance: "rule",
          sourceIds,
          gaps: [
            "Check whether this relationship or an equivalent supplier already exists.",
            "Validate user demand, asset eligibility, pricing, technical compatibility and risk.",
            "Identify the decision maker, measurable incremental value, costs and any commercial agreement.",
            shared.length
              ? `Shared chain context: ${shared.join(", ")}; this does not prove deployment compatibility.`
              : "Chain compatibility is unknown and needs investigation.",
          ],
          observedAt,
          confidence: null,
          review: "pending",
          note: "",
          saved: false,
        });
        if (result.length >= MAX_RULE_MATCHES) break matching;
      }
    }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}
export function allRelationships(g: Graph) {
  return [...g.relationships, ...matchBusinesses(g)];
}
export function businessNetwork(g: Graph, id: string) {
  return allRelationships(g).filter(
    (r) => (r.a === id || r.b === id) && r.review !== "rejected",
  );
}
export function reviewRelationship(
  g: Graph,
  id: string,
  review: Relationship["review"],
  note: string,
  saved: boolean,
): Graph {
  const r = allRelationships(g).find((r) => r.id === id);
  if (!r) throw new Error("Relationship not found");
  return {
    ...g,
    relationships: [
      ...g.relationships.filter((x) => x.id !== id),
      { ...r, review, note, saved },
    ],
  };
}
