"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, GitBranch, Loader2, ShieldCheck } from "lucide-react";
import { api } from "./api";
import type { Evidence } from "./types";
import { date } from "./api";
import { Badge } from "./Workspace";
type AssetBusinesses = {
  asset: { id: number; code: string; match_status: string };
  businesses: {
    id: number;
    name: string;
    kind: string;
    link_status: string;
    status?: string;
    evidence_url?: string;
    evidence?: Evidence[];
    paths?: {
      id: number;
      type: string;
      status: string;
      evidence_id: number | null;
      observed_at: string;
    }[][];
  }[];
};
export default function AssetAnatomy({ assetId }: { assetId: number }) {
  const [data, setData] = useState<AssetBusinesses | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    api<AssetBusinesses>("asset_anatomy", { asset_id: assetId })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [assetId]);
  if (error)
    return (
      <p className="notice error" role="alert">
        {error}
      </p>
    );
  if (!data)
    return (
      <div className="loading">
        <Loader2 size={17} className="spin" />
        Checking researched asset associations…
      </div>
    );
  return (
    <>
      <div className="notice subtle">
        <ShieldCheck size={18} />
        <span>
          A token is a discovery entry point. Its CoinGecko identity does not
          establish a company, product or business dependency. The associations
          below come from your separately recorded research.
        </span>
      </div>
      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">
              {data.asset.code} · BUSINESS ANATOMY
            </span>
            <h2>Choose the business behind your research.</h2>
            <p>
              One asset can relate to several products or organisations. Each
              association has its own evidence status.
            </p>
          </div>
          <Badge status={data.asset.match_status} />
        </div>
        {data.businesses.length ? (
          <div className="business-grid">
            {data.businesses.map((b) => (
              <article className="business-card" key={b.id}>
                <span className="eyebrow">{b.kind}</span>
                <h3>{b.name}</h3>
                <Badge status={b.link_status || b.status || "unknown"} />
                <p className="small">
                  {(b.link_status || b.status) === "confirmed"
                    ? "An evidence-backed association recorded in your research."
                    : "An unverified association to investigate. Opening its map does not confirm it."}
                </p>
                <Link
                  className="text-button"
                  href={`/businesses/${b.id}/anatomy`}
                >
                  Open Business Anatomy
                  <ArrowUpRight size={15} />
                </Link>
                {b.evidence?.length ? (
                  b.evidence.map((source) => (
                    <details className="relationship-evidence" key={source.id}>
                      <summary>Association evidence: {source.title}</summary>
                      {/^https?:\/\//.test(source.url) && (
                        <a
                          className="source-link"
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open original source
                        </a>
                      )}
                      <blockquote>{source.original_text}</blockquote>
                      <p className="small muted">
                        Source status: {source.verification} · Observed{" "}
                        {date(source.observed_at)}
                      </p>
                      <p className="small">
                        Interpretation:{" "}
                        {source.interpretation || "Not recorded."}
                      </p>
                    </details>
                  ))
                ) : (
                  <p className="small muted">
                    No source attached to this association.
                  </p>
                )}
                {b.paths?.map((path, i) => (
                  <details className="small association-path" key={i}>
                    <summary>Association path {i + 1}</summary>
                    {path.map((link) => (
                      <p key={link.id}>
                        {link.type.replaceAll("_", " ")} · {link.status} ·{" "}
                        {link.observed_at
                          ? date(link.observed_at)
                          : "Observation date not recorded"}
                      </p>
                    ))}
                  </details>
                ))}
                {b.evidence_url && /^https?:\/\//.test(b.evidence_url) && (
                  <a
                    className="source-link"
                    href={b.evidence_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Association source
                    <ArrowUpRight size={12} />
                  </a>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <span className="empty-icon">
              <GitBranch size={24} />
            </span>
            <h3>No business association established.</h3>
            <p>
              Research the operator and product first. Add an organisation, a
              product and evidence-backed “Operates” / “Associated asset” links
              in the research workspace. The terminal will not invent an
              operator.
            </p>
            <Link className="button primary" href="/?view=workspace">
              Research this association
            </Link>
          </div>
        )}
      </section>
      <Link className="text-button" href={`/assets/${assetId}`}>
        Return to asset discovery and identity research
        <ArrowUpRight size={14} />
      </Link>
    </>
  );
}
