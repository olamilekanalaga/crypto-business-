"use client";
import { useState } from "react";
import {
  Business,
  FUNCTIONS,
  Graph,
  Source,
  validateGraph,
} from "@/lib/network/model";
export default function NetworkResearchForm({
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
        setError("");
        setBusy(true);
        const form = e.currentTarget,
          d = new FormData(form);
        try {
          const get = (k: string) => String(d.get(k) || "").trim(),
            at = new Date().toISOString(),
            id = `manual:${crypto.randomUUID()}`,
            sourceId = `source:${crypto.randomUUID()}`;
          const source: Source = {
            id: sourceId,
            title: get("title"),
            url: get("url"),
            observedAt: at,
            excerpt: get("excerpt"),
            interpretation: get("interpretation"),
            status: "unknown",
          };
          const fact = (code: string) => ({
            code: code as (typeof FUNCTIONS)[number],
            text: get("summary"),
            status: "hypothesis" as const,
            sourceIds: [sourceId],
          });
          const b: Business = {
            id,
            name: get("name"),
            kind: "product",
            summary: get("summary"),
            sectors: get("sectors")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            chains: get("chains")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            products: [get("name")],
            sourceIds: [sourceId],
            needs: d.getAll("needs").map(String).map(fact),
            capabilities: d.getAll("capabilities").map(String).map(fact),
          };
          await onSave(
            validateGraph({
              ...graph,
              businesses: [...graph.businesses, b],
              sources: [...graph.sources, source],
            }),
          );
          form.reset();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Save failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        Add a real business and evidence. New findings remain unverified; use
        the structured editor to refine or verify individual claims after
        checking their sources.
      </p>
      <label>
        Business or product name
        <input name="name" required maxLength={200} />
      </label>
      <label>
        What does it provide?
        <textarea name="summary" required maxLength={2000} />
      </label>
      <label>
        Industries, separated by commas
        <input name="sectors" placeholder="Payments, RWA" />
      </label>
      <label>
        Known blockchain networks, separated by commas
        <input name="chains" placeholder="Leave empty if unknown" />
      </label>
      <label>
        Capabilities supplied
        <select name="capabilities" multiple size={4}>
          {FUNCTIONS.map((f) => (
            <option key={f} value={f}>
              {f.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label>
        Needs to investigate
        <select name="needs" multiple size={4}>
          {FUNCTIONS.map((f) => (
            <option key={f} value={f}>
              {f.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label>
        Source title
        <input name="title" required />
      </label>
      <label>
        Source URL
        <input name="url" type="url" required />
      </label>
      <label>
        Original evidence excerpt
        <textarea name="excerpt" required maxLength={2000} />
      </label>
      <label>
        Your interpretation
        <textarea name="interpretation" required maxLength={2000} />
      </label>
      {error && <p role="alert">{error}</p>}
      <button className="button primary" disabled={busy}>
        {busy ? "Saving…" : "Add business and evidence"}
      </button>
    </form>
  );
}
