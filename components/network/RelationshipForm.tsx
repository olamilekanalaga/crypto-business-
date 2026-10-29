"use client";
import { useState } from "react";
import { Graph, Relationship, validateGraph } from "@/lib/network/model";
export default function RelationshipForm({
  graph,
  onSave,
}: {
  graph: Graph;
  onSave: (g: Graph) => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const form = e.currentTarget,
          d = new FormData(form),
          get = (key: string) => String(d.get(key) || "").trim();
        try {
          const relationship: Relationship = {
            id: `manual:${crypto.randomUUID()}`,
            a: get("a"),
            b: get("b"),
            type: get("type") as Relationship["type"],
            reason: get("reason"),
            aProvides: get("aProvides"),
            bProvides: get("bProvides"),
            aValue: get("aValue"),
            bValue: get("bValue"),
            moneyFlow:
              get("moneyFlow") || "Unknown; no payment evidence recorded.",
            status: get("status") as Relationship["status"],
            provenance: "manual",
            sourceIds: d.getAll("sources").map(String),
            gaps: get("gaps") ? [get("gaps")] : [],
            observedAt: new Date().toISOString(),
            confidence: null,
            review: "accepted",
            note: "Manually recorded research. Check source scope before treating this as a commercial relationship.",
            saved: true,
          };
          await onSave(
            validateGraph({
              ...graph,
              relationships: [...graph.relationships, relationship],
            }),
          );
          form.reset();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        Document what connects two businesses. An integration does not establish
        payment or a formal partnership. Confirmed claims require confirmed
        supporting sources.
      </p>
      <label>
        Business A
        <select name="a" required>
          <option value="">Select business</option>
          {graph.businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Business B
        <select name="b" required>
          <option value="">Select business</option>
          {graph.businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Connection type
        <select name="type">
          <option value="could_benefit_from">Could benefit from</option>
          <option value="integration">Integration</option>
          <option value="dependency">Dependency</option>
          <option value="partnership">Partnership</option>
          <option value="competition">Competition</option>
        </select>
      </label>
      <label>
        Evidence status
        <select name="status">
          <option value="hypothesis">Hypothesis</option>
          <option value="inference">Inference</option>
          <option value="unknown">Unknown</option>
          <option value="confirmed">Confirmed by my source review</option>
        </select>
      </label>
      {(
        [
          ["aProvides", "What A provides or needs"],
          ["bProvides", "What B provides or needs"],
          ["reason", "Why does this connection exist?"],
          ["aValue", "What A gains"],
          ["bValue", "What B gains"],
        ] as const
      ).map(([name, label]) => (
        <label key={name}>
          {label}
          <textarea name={name} required maxLength={3000} />
        </label>
      ))}
      <label>
        Who pays whom, if known?
        <textarea
          name="moneyFlow"
          maxLength={3000}
          placeholder="Leave blank if unknown"
        />
      </label>
      <label>
        Supporting sources
        <select name="sources" multiple size={4}>
          {graph.sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} · {s.status}
            </option>
          ))}
        </select>
      </label>
      <label>
        Missing evidence and research questions
        <textarea name="gaps" maxLength={3000} />
      </label>
      {error && <p role="alert">{error}</p>}
      <button className="button primary" disabled={busy}>
        {busy ? "Saving…" : "Save manual relationship"}
      </button>
    </form>
  );
}
