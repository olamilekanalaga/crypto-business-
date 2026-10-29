"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FlaskConical,
  GitBranch,
  HelpCircle,
  Lightbulb,
  Loader2,
  Network,
  Search,
  ShieldCheck,
} from "lucide-react";
import { api, date } from "./api";
import { Badge } from "./Workspace";
import AnatomyForms from "./AnatomyForms";
import {
  anatomyLenses,
  relationLabels,
  type AnatomyData,
  type AnatomyEdge,
} from "./anatomy-types";
import { exampleMap } from "./anatomy-example";
import type { Claim, Detail, Overview } from "./types";
const Map = dynamic(() => import("./AnatomyMap"), {
  ssr: false,
  loading: () => (
    <div className="loading">
      <Loader2 className="spin" size={18} />
      Opening the map…
    </div>
  ),
});
const initialFilters = {
  status: "all",
  category: "all",
  lens: "all",
  direction: "both",
};
function label(edge: AnatomyEdge) {
  return edge.original_type || relationLabels[edge.relation] || edge.relation;
}
function EvidenceLink({
  url,
  children,
}: {
  url?: string | null;
  children: React.ReactNode;
}) {
  return url && /^https?:\/\//i.test(url) ? (
    <a className="source-link" href={url} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight size={13} />
    </a>
  ) : null;
}
export default function Anatomy({
  overview,
  initialEntityId,
  onSaved,
}: {
  overview: Overview;
  initialEntityId?: number;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"research" | "illustration">("research"),
    [center, setCenter] = useState<number | undefined>(),
    [filters, setFilters] = useState(initialFilters),
    [data, setData] = useState<AnatomyData | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [search, setSearch] = useState(""),
    [selection, setSelection] = useState<string | null>(null),
    [trail, setTrail] = useState<number[]>([]),
    [entry, setEntry] = useState(false),
    [claims, setClaims] = useState<Claim[]>([]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    if (mode === "illustration") {
      setData(exampleMap(center || -1, filters));
      setLoading(false);
      return;
    }
    api<AnatomyData>("anatomy", {
      ...(center
        ? { center_id: center }
        : initialEntityId
          ? { entity_id: initialEntityId }
          : {}),
      ...filters,
    })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setData(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, center, initialEntityId, filters, revision]);
  const central = data?.nodes.find((n) => n.id === data.center_id);
  useEffect(() => {
    let active = true;
    setClaims([]);
    if (mode === "research" && central?.entity_id)
      api<Detail>("detail", { id: central.entity_id })
        .then((d) => {
          if (active) setClaims(d.claims);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [mode, central?.entity_id, revision]);
  const recenter = useCallback(
    (id: number) => {
      if (data?.center_id === id) return;
      setTrail((t) => (data?.center_id ? [...t, data.center_id] : t));
      setCenter(id);
      setSelection(null);
    },
    [data?.center_id],
  );
  function changeMode(next: "research" | "illustration") {
    setMode(next);
    setCenter(next === "illustration" ? -1 : undefined);
    setTrail([]);
    setSelection(null);
    setFilters(initialFilters);
    setEntry(false);
  }
  function filter(key: string, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setSelection(null);
  }
  const selected = data?.edges.find((e) => String(e.id) === selection) || null;
  useEffect(() => {
    if (selected)
      document
        .getElementById("anatomy-connection-details")
        ?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
          block: "start",
        });
  }, [selected?.id]);
  const sourceNodes = data?.catalog || [];
  const visibleCatalog = sourceNodes.filter((n) =>
    (n.name + " " + n.kind).toLowerCase().includes(search.toLowerCase()),
  );
  const lens = anatomyLenses.find((l) => l.id === filters.lens);
  const supplierClaims = claims.filter(
    (c) => c.field !== "suppliers" || c.status === "confirmed",
  );
  const summary = claims.find((c) => c.field === "what_it_does");
  function saved(id: number, isNode: boolean) {
    setRevision((v) => v + 1);
    onSaved();
    if (isNode) {
      setCenter(id);
      setTrail([]);
    } else {
      setSelection(String(id));
    }
  }
  return (
    <div className="anatomy-explorer">
      <div className="anatomy-titlebar">
        <div className="anatomy-mode" role="group" aria-label="Map data source">
          <button
            className={mode === "research" ? "selected" : ""}
            onClick={() => changeMode("research")}
          >
            <BookOpen size={14} />
            My research
          </button>
          <button
            className={mode === "illustration" ? "selected" : ""}
            onClick={() => changeMode("illustration")}
          >
            <FlaskConical size={14} />
            Illustrative example
          </button>
        </div>
        {mode === "research" && (
          <button
            className="button primary"
            onClick={() => setEntry((v) => !v)}
          >
            {entry ? "Hide entry form" : "Record nodes & connections"}
            <ArrowRight size={15} />
          </button>
        )}
      </div>
      {mode === "illustration" ? (
        <div className="notice illustrative">
          <FlaskConical size={18} />
          <span>
            <strong>
              Concept illustration — not verified business research.
            </strong>{" "}
            Generic actors show how navigation works. Every connection is
            hypothetical; no contractual relationship or payment is established.
            This map is never saved to your database.
          </span>
        </div>
      ) : (
        <div className="notice subtle">
          <ShieldCheck size={17} />
          <span>
            Nodes organise your research. Connections carry the meaning,
            evidence and uncertainty. Nothing is inferred from a name, ticker or
            technical compatibility.
          </span>
        </div>
      )}
      <section className="panel anatomy-lens-panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">BUSINESS ANATOMY</span>
            <h2>A living system of needs and capabilities.</h2>
            <p>
              Choose a lens to organise questions. The analogy is not a
              universal business model.
            </p>
          </div>
          <Network size={24} />
        </div>
        <div className="anatomy-lenses">
          <button
            className={filters.lens === "all" ? "selected" : ""}
            onClick={() => filter("lens", "all")}
          >
            <span>Whole business</span>
            <small>All recorded connections</small>
          </button>
          {anatomyLenses.map((l) => (
            <button
              key={l.id}
              className={filters.lens === l.id ? "selected" : ""}
              onClick={() => filter("lens", l.id)}
            >
              <span>{l.name}</span>
              <small>{l.equivalent}</small>
            </button>
          ))}
        </div>
        <div className="lens-question">
          <span className="eyebrow">
            {lens
              ? "BUSINESS EQUIVALENT · " + lens.equivalent
              : "THE FOUR QUESTIONS"}
          </span>
          <p>
            {lens?.description ||
              "What keeps it alive? What helps it grow? Who already supplies it? Who else might help or benefit?"}
          </p>
        </div>
      </section>
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button onClick={() => setRevision((v) => v + 1)}>Retry</button>
        </div>
      )}
      <section className="panel anatomy-graph-panel" aria-busy={loading}>
        <div className="section-head">
          <div>
            <span className="eyebrow">BD ORACLE · DEPENDENCY MAP</span>
            <h2>{central?.name || "Choose a starting point."}</h2>
            <p>Click any node to make it the centre of another map.</p>
          </div>
          {trail.length > 0 && (
            <button
              className="button secondary"
              onClick={() => {
                const last = trail[trail.length - 1];
                setTrail((t) => t.slice(0, -1));
                setCenter(last);
                setSelection(null);
              }}
            >
              <ArrowLeft size={14} />
              Back one step
            </button>
          )}
        </div>
        <div className="anatomy-controls">
          <label className="field">
            Centre node
            <select
              aria-label="Centre node"
              value={data?.center_id || ""}
              onChange={(e) => recenter(Number(e.target.value))}
            >
              <option value="" disabled>
                Choose a recorded node
              </option>
              {sourceNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} · {n.kind}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Evidence filter
            <select
              value={filters.status}
              onChange={(e) => filter("status", e.target.value)}
            >
              <option value="all">All certainty levels</option>
              <option value="confirmed">Confirmed facts only</option>
              <option value="inference">Reasonable inferences</option>
              <option value="hypothesis">Hypotheses</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <label className="field">
            Connection filter
            <select
              value={filters.category}
              onChange={(e) => filter("category", e.target.value)}
            >
              <option value="all">All connections</option>
              <option value="essential">Essential dependencies</option>
              <option value="growth">Growth needs</option>
              <option value="existing">Existing relationships</option>
              <option value="potential">Potential connections</option>
            </select>
          </label>
          <label className="field">
            Direction filter
            <select
              value={filters.direction}
              onChange={(e) => filter("direction", e.target.value)}
            >
              <option value="both">Incoming & outgoing</option>
              <option value="incoming">Incoming only</option>
              <option value="outgoing">Outgoing only</option>
            </select>
          </label>
          <label className="field">
            Lens filter
            <select
              value={filters.lens}
              onChange={(e) => filter("lens", e.target.value)}
            >
              <option value="all">All lenses</option>
              {anatomyLenses.map((l) => (
                <option value={l.id} key={l.id}>
                  {l.name}
                </option>
              ))}
              <option value="other">Other / unassigned</option>
            </select>
          </label>
        </div>
        {loading ? (
          <div className="loading">
            <Loader2 size={18} className="spin" />
            Reading the dependency map…
          </div>
        ) : data?.nodes.length ? (
          <Map
            data={data}
            onCenter={recenter}
            onEdge={(id) => setSelection(String(id))}
          />
        ) : (
          <div className="empty">
            <span className="empty-icon">
              <GitBranch size={25} />
            </span>
            <h3>No dependency map has been researched yet.</h3>
            <p>
              Create an organisation or product in the research workspace, or
              add a concept here. Then record the connections you can explain.
            </p>
            <div className="anatomy-empty-actions">
              <button
                className="button secondary"
                onClick={() => changeMode("illustration")}
              >
                Try the illustration
                <ArrowRight size={14} />
              </button>
              <Link className="button primary" href="/?view=workspace">
                Open research workspace
              </Link>
            </div>
          </div>
        )}
        {data &&
          (data.limits.edges_truncated ||
            data.limits.nodes_truncated ||
            data.limits.catalog_truncated) && (
            <p className="notice subtle">
              This view is limited to {data.limits.max_nodes} nodes,{" "}
              {data.limits.max_edges} connections and{" "}
              {data.limits.catalog_limit} catalogue entries. There are{" "}
              {data.limits.nodes_total} neighbouring nodes and{" "}
              {data.limits.edges_total} matching connections. Refine the filters
              to explore more.
            </p>
          )}
      </section>
      {central && (
        <>
          <div className="anatomy-context">
            <span className="eyebrow">{central.kind} · CURRENT CENTRE</span>
            <p>
              {central.description ||
                "A researcher-created business record. A node alone does not verify an operating business."}
            </p>
            {central.entity_id && (
              <Link
                className="source-link"
                href={"/businesses/" + central.entity_id}
              >
                Open full business research
                <ArrowUpRight size={13} />
              </Link>
            )}
          </div>
          {summary && (
            <section className="panel anatomy-summary">
              <div className="section-head">
                <div>
                  <span className="eyebrow">IN PLAIN LANGUAGE</span>
                  <h2>What this business does</h2>
                </div>
                <Badge status={summary.status} />
              </div>
              <p>{summary.statement}</p>
              <EvidenceLink url={summary.evidence_url}>
                {summary.evidence_title || "Source"}
              </EvidenceLink>
            </section>
          )}
          {data && (
            <ResearchQuestions
              edges={data.edges}
              claims={supplierClaims}
              centerId={data.center_id!}
              inspect={(id) => setSelection(String(id))}
            />
          )}
        </>
      )}
      {data && data.edges.length > 0 && (
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Recorded connections</h2>
              <p>
                {mode === "illustration"
                  ? "All illustrative — nothing here is established."
                  : "Current filtered neighbourhood. Inspect a connection before relying on it."}
              </p>
            </div>
            <span className="count-pill">{data.edges.length} connections</span>
          </div>
          <div className="anatomy-edge-list">
            {data.edges.map((e) => (
              <button
                className={selection === String(e.id) ? "selected" : ""}
                key={e.id}
                aria-label={`Inspect connection ${e.source_name} to ${e.target_name}`}
                onClick={() => setSelection(String(e.id))}
              >
                <div>
                  <span>{e.source_name}</span>
                  <ArrowRight size={14} />
                  <span>{e.target_name}</span>
                </div>
                <div>
                  <span className="connection-kind">{label(e)}</span>
                  <span className="count-pill">{e.actuality}</span>
                  <Badge status={e.status} />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
      {selected && (
        <EdgeInspector
          key={selected.id}
          edge={selected}
          illustration={mode === "illustration"}
          onRetracted={() => {
            setRevision((v) => v + 1);
            setSelection(null);
          }}
        />
      )}
      {!!data?.history.length && (
        <details className="panel anatomy-history">
          <summary>
            Research history · {data.history.length} retracted or superseded
            connections
          </summary>
          {data.limits.history_truncated && (
            <p className="notice subtle">
              Showing the latest {data.limits.history_limit} of{" "}
              {data.limits.history_total} historical connections. All original
              records remain in SQLite.
            </p>
          )}
          {data.history.map((e) => (
            <div key={e.id}>
              <strong>
                {e.source_name} → {e.target_name}
              </strong>
              <p className="small muted">
                {label(e)} · original status: {e.status}
              </p>
              <p>{e.explanation}</p>
              {e.history?.map((h, i) => (
                <p className="small" key={i}>
                  {h.action} · {h.reason}
                </p>
              ))}
              <EvidenceLink url={e.evidence_url}>Retained source</EvidenceLink>
            </div>
          ))}
        </details>
      )}
      {sourceNodes.length > 0 && (
        <details className="panel node-directory">
          <summary>
            Explore another node · {sourceNodes.length} recorded nodes
          </summary>
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Find a graph node"
              placeholder="Find a need, capability, actor or business…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div>
            {visibleCatalog.map((n) => (
              <button
                key={n.id}
                onClick={() => recenter(n.id)}
                aria-label={"Explore node " + n.name}
              >
                <span>
                  {n.name}
                  <small>{n.kind}</small>
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
        </details>
      )}
      {entry && mode === "research" && (
        <AnatomyForms
          nodes={sourceNodes}
          overview={overview}
          centerId={data?.center_id || null}
          onSaved={saved}
        />
      )}
    </div>
  );
}
function ResearchQuestions({
  edges,
  claims,
  centerId,
  inspect,
}: {
  edges: AnatomyEdge[];
  claims: Claim[];
  centerId: number;
  inspect: (id: number | string) => void;
}) {
  const cards = [
    {
      title: "What keeps it alive?",
      note: "Recorded essential inputs, revenue and customers.",
      items: edges.filter(
        (e) =>
          (e.source_id === centerId && e.essentiality === "essential") ||
          (e.target_id === centerId &&
            e.relation === "provides_to" &&
            e.essentiality === "essential"),
      ),
      fields: [
        "revenue_model",
        "customers",
        "recurring_consumption",
        "depends_on",
      ],
    },
    {
      title: "What helps it grow?",
      note: "Optional capabilities and routes to market.",
      items: edges.filter(
        (e) => e.source_id === centerId && e.relation === "needs_to_grow",
      ),
      fields: ["distribution", "demand_behaviour"],
    },
    {
      title: "Who already supplies it?",
      note: "Explicit, confirmed incoming supply relationships.",
      items: edges.filter(
        (e) =>
          e.target_id === centerId &&
          e.relation === "provides_to" &&
          e.status === "confirmed" &&
          e.actuality === "existing",
      ),
      fields: ["suppliers"],
    },
    {
      title: "Who else might help or benefit?",
      note: "Proposed connections, with validation still needed.",
      items: edges.filter((e) => e.actuality === "potential"),
      fields: [],
    },
  ];
  return (
    <div className="anatomy-questions">
      {cards.map((card) => (
        <section className="panel" key={card.title}>
          <h3>{card.title}</h3>
          <p className="question-note">{card.note}</p>
          {card.items.length ||
          claims.some((c) => card.fields.includes(c.field)) ? (
            <>
              <ul>
                {card.items.slice(0, 5).map((e) => (
                  <li key={e.id}>
                    <button onClick={() => inspect(e.id)}>
                      <span>
                        {e.source_id === centerId
                          ? e.target_name
                          : e.source_name}
                      </span>
                      <Badge status={e.status} />
                    </button>
                  </li>
                ))}
              </ul>
              {card.fields
                .map((field) => claims.find((c) => c.field === field))
                .filter((c): c is Claim => !!c)
                .map((c) => (
                  <div className="anatomy-claim" key={c.id}>
                    <Badge status={c.status} />
                    <p>{c.statement}</p>
                    <EvidenceLink url={c.evidence_url}>Source</EvidenceLink>
                  </div>
                ))}
              {card.items.length > 5 && (
                <span className="small muted">
                  More in the connection list.
                </span>
              )}
            </>
          ) : (
            <div className="anatomy-unknown">
              <HelpCircle size={16} />
              <span>Not established in this view.</span>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
function EdgeInspector({
  edge: e,
  illustration,
  onRetracted,
}: {
  edge: AnatomyEdge;
  illustration: boolean;
  onRetracted: () => void;
}) {
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function retract(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("retract_graph_edge", { id: e.id, reason });
      onRetracted();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      id="anatomy-connection-details"
      className="panel anatomy-inspector"
      aria-label="Connection details"
    >
      <div className="section-head">
        <div>
          <span className="eyebrow">
            {illustration
              ? "ILLUSTRATIVE CONNECTION"
              : e.readonly
                ? "ORIGINAL RELATIONSHIP · READ ONLY"
                : "RESEARCHED CONNECTION"}
          </span>
          <h2>
            {e.source_name} → {e.target_name}
          </h2>
          <p>{label(e)}</p>
        </div>
        <Badge status={e.status} />
      </div>
      <div className="tags">
        <span>{e.essentiality} dependency</span>
        <span>{e.actuality} connection</span>
        <span>{e.lens} lens</span>
        <span>{e.provenance.replaceAll("_", " ")}</span>
      </div>
      <h3>Why this connection matters</h3>
      <p className="edge-explanation">{e.explanation}</p>
      <div className="exchange-grid">
        <div>
          <span className="eyebrow">VALUE {e.source_name} RECEIVES</span>
          <p>{e.source_value}</p>
        </div>
        <div>
          <span className="eyebrow">VALUE {e.target_name} RECEIVES</span>
          <p>{e.target_value}</p>
        </div>
      </div>
      <div className="relationship-meta">
        <span>
          Money changes hands: <strong>{e.money}</strong>
        </span>
        {e.observed_at && <span>Observed {date(e.observed_at)}</span>}
      </div>
      <div className="evidence-gap">
        <span className="eyebrow">WHAT REMAINS UNVERIFIED</span>
        <p>
          {e.evidence_gaps ||
            "No additional gap was recorded. This is not proof that all aspects are known."}
        </p>
      </div>
      {e.evidence?.length ? (
        e.evidence.map((source) => (
          <details className="relationship-evidence" key={source.id}>
            <summary>Evidence: {source.title}</summary>
            <EvidenceLink url={source.url}>Original source</EvidenceLink>
            <p className="small muted">
              Observed {date(source.observed_at)} · {source.verification}
            </p>
            <blockquote>{source.original_text}</blockquote>
            <p>
              Researcher interpretation:{" "}
              {source.interpretation || "Not recorded."}
            </p>
          </details>
        ))
      ) : (
        <p className="small muted">No supporting evidence attached.</p>
      )}
      {e.history?.length ? (
        <details className="anatomy-audit">
          <summary>Connection audit trail</summary>
          {e.history.map((event, index) => (
            <p key={index}>
              {event.action} · {event.reason}
            </p>
          ))}
        </details>
      ) : null}
      {!illustration && !e.readonly && (
        <form className="retraction-form" onSubmit={retract}>
          <label className="field">
            Reason for retraction
            <input
              required
              maxLength={20000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="What did you discover or correct?"
            />
          </label>
          <button className="button secondary" disabled={busy}>
            {busy ? "Saving…" : "Retract connection"}
          </button>
          <p className="small muted">
            Removes it from the active map; original evidence and history
            remain.
          </p>
        </form>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <Link className="text-button" href="/?view=opportunities">
        <Lightbulb size={15} />
        Open my opportunity notebook
        <ArrowUpRight size={14} />
      </Link>
    </section>
  );
}
