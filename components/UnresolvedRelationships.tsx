"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "./api";
import { Badge } from "./Workspace";
import type { AnatomyEdge } from "./anatomy-types";
export default function UnresolvedRelationships() {
  const [edges, setEdges] = useState<AnatomyEdge[]>([]),
    [error, setError] = useState(""),
    [total, setTotal] = useState(0);
  useEffect(() => {
    api<{ items: AnatomyEdge[]; total: number }>("unresolved_graph")
      .then((d) => {
        setEdges(d.items);
        setTotal(d.total);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Relationships needing investigation</h2>
          <p>Unconfirmed or potential connections in your stored research.</p>
        </div>
        <span className="count-pill">
          {edges.length} of {total} shown
        </span>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {edges.length ? (
        <div className="unresolved-edge-list">
          {edges.map((e) => (
            <article key={e.id}>
              <div>
                <strong>
                  {e.source_name} → {e.target_name}
                </strong>
                <Badge status={e.status} />
              </div>
              <p>
                {e.evidence_gaps ||
                  "Review the economic interpretation and supporting sources."}
              </p>
              <Link
                className="text-button"
                href={`/network?node=${e.source_id}&edge=${e.id}`}
              >
                Investigate connection
              </Link>
            </article>
          ))}
        </div>
      ) : (
        !error && (
          <p className="small muted">
            No unconfirmed stored graph connections to review. This does not
            mean all businesses or relationships have been discovered.
          </p>
        )
      )}
    </section>
  );
}
