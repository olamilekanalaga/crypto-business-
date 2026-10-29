"use client";
import { useState } from "react";
import { Graph, Source, validateGraph } from "@/lib/network/model";
export default function SourceForm({
  graph,
  onSave,
}: {
  graph: Graph;
  onSave: (g: Graph) => Promise<void>;
}) {
  const [id, setId] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const source = graph.sources.find((s) => s.id === id);
  return (
    <>
      <label>
        Evidence record
        <select
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setError("");
          }}
        >
          <option value="">New source</option>
          {graph.sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </label>
      <form
        key={id}
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          const d = new FormData(e.currentTarget),
            get = (key: string) => String(d.get(key) || "").trim();
          try {
            const next: Source = {
              id: id || `source:${crypto.randomUUID()}`,
              title: get("title"),
              url: get("url"),
              excerpt: get("excerpt"),
              interpretation: get("interpretation"),
              status: get("status") as Source["status"],
              observedAt: new Date().toISOString(),
            };
            await onSave(
              validateGraph({
                ...graph,
                sources: [
                  ...graph.sources.filter((s) => s.id !== next.id),
                  next,
                ],
              }),
            );
            setId(next.id);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          Keep the original passage separate from your explanation. Mark
          confirmed only after checking that the source actually supports the
          recorded claim.
        </p>
        <label>
          Evidence title
          <input name="title" required defaultValue={source?.title} />
        </label>
        <label>
          Evidence URL
          <input name="url" type="url" required defaultValue={source?.url} />
        </label>
        <label>
          Original source passage
          <textarea
            name="excerpt"
            required
            defaultValue={source?.excerpt}
            maxLength={6000}
          />
        </label>
        <label>
          Research interpretation
          <textarea
            name="interpretation"
            required
            defaultValue={source?.interpretation}
            maxLength={6000}
          />
        </label>
        <label>
          Source review status
          <select name="status" defaultValue={source?.status || "unknown"}>
            <option value="unknown">Unreviewed</option>
            <option value="hypothesis">Hypothesis</option>
            <option value="inference">Inference</option>
            <option value="confirmed">Confirmed after checking source</option>
          </select>
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="button primary" disabled={busy}>
          {busy ? "Saving…" : "Save evidence review"}
        </button>
      </form>
    </>
  );
}
