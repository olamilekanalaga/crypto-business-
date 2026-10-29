"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { readRegistry } from "@/lib/usdc/browser";
import { emptyRegistry, Registry } from "@/lib/usdc/model";
import {
  scopeGraph,
  prepareProjects,
  withAnalysisFacts,
} from "@/lib/usdc/scope";
import { getConnection } from "@/lib/usdc/connection";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Graph,
  emptyGraph,
  mergeGraph,
  validateGraph,
  Relationship,
} from "@/lib/network/model";
import {
  allRelationships,
  businessNetwork,
  reviewRelationship,
} from "@/lib/network/matching";
import { readNetwork, writeNetwork } from "@/lib/network/browser";
import { downloadFile } from "@/lib/browser-discovery";
import researchLibrary from "@/data-library/network-research.json";
import RelationshipForm from "./RelationshipForm";
import SourceForm from "./SourceForm";
import NetworkResearchForm from "./NetworkResearchForm";
import styles from "./NetworkExplorer.module.css";
const NetworkGraph = dynamic(() => import("./NetworkGraph"), {
  ssr: false,
  loading: () => <p>Opening network…</p>,
});
export default function NetworkExplorer({
  initialView = "network",
  initialFocus,
}: {
  initialView?: string;
  initialFocus?: string;
}) {
  const [registry, setRegistry] = useState<Registry>(emptyRegistry);
  const [g, setGraph] = useState<Graph>(emptyGraph),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [view, setView] = useState(initialView),
    [focus, setFocus] = useState(initialFocus || "huma"),
    [history, setHistory] = useState<string[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [sector, setSector] = useState("all"),
    [filter, setFilter] = useState("all");
  const [mode, setMode] = useState<"browser" | "server">("browser"),
    [token, setToken] = useState(""),
    [note, setNote] = useState(""),
    [jsonDraft, setJsonDraft] = useState(""),
    [editorOpen, setEditorOpen] = useState(false),
    [sourceStatus, setSourceStatus] = useState("");
  const whyRef = useRef<HTMLElement>(null),
    importRef = useRef<HTMLInputElement>(null);
  const eligibleGraph = useMemo(
    () => withAnalysisFacts(scopeGraph(g, registry)),
    [g, registry],
  );
  const relationships = useMemo(
      () => allRelationships(eligibleGraph),
      [eligibleGraph],
    ),
    relationship = relationships.find((r) => r.id === selected),
    business = eligibleGraph.businesses.find((b) => b.id === focus);
  const noteDirty = !!relationship && note !== relationship.note;
  const editorDirty = editorOpen && jsonDraft !== JSON.stringify(g, null, 2);
  const dirty = noteDirty || editorDirty;
  useEffect(() => {
    let active = true;
    readNetwork()
      .then(async (graph) => {
        if (!active) return;
        const connection = getConnection();
        let universe = await readRegistry();
        if (connection.mode === "server") {
          const headers = { Authorization: `Bearer ${connection.token}` };
          const [networkResponse, registryResponse] = await Promise.all([
            fetch("/api/network/workspace", { headers, cache: "no-store" }),
            fetch("/api/usdc/workspace", { headers, cache: "no-store" }),
          ]);
          if (!networkResponse.ok || !registryResponse.ok)
            throw new Error(
              "Server workspace could not be opened. Return to the directory to unlock it.",
            );
          graph = validateGraph(await networkResponse.json());
          universe = await registryResponse.json();
          setMode("server");
          setToken(connection.token);
        }
        const prepared = prepareProjects(graph, universe);
        if (JSON.stringify(prepared) !== JSON.stringify(graph)) {
          if (connection.mode === "browser")
            graph = await writeNetwork(prepared);
          else {
            const response = await fetch("/api/network/workspace", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${connection.token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(prepared),
            });
            if (!response.ok)
              throw new Error(
                "Could not save identified project research subjects",
              );
            graph = validateGraph(await response.json());
          }
        }
        if (active) setRegistry(universe);
        if (active) {
          setGraph(graph);
          const query = new URLSearchParams(window.location.search);
          if (query.get("search")) setSearch(query.get("search")!);
          if (query.get("business")) setFocus(query.get("business")!);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function request(path: string, body?: unknown) {
    const response = await fetch(`/api/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || "Server request failed");
    return value;
  }
  async function persist(next: Graph) {
    setBusy(true);
    setError("");
    try {
      const saved =
        mode === "browser"
          ? await writeNetwork(validateGraph(next))
          : validateGraph(
              await request("network/workspace", validateGraph(next)),
            );
      setGraph(saved);
      setNotice(
        `Research saved ${mode === "browser" ? "in this browser" : "to private server storage"}.`,
      );
      return saved;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  function navigate(id: string) {
    if (dirty && !confirm("Discard unsaved edits before changing business?"))
      return;
    setEditorOpen(false);
    setHistory((h) => [...h, focus]);
    setFocus(id);
    setSelected(null);
    setView("network");
  }
  function choose(r: Relationship) {
    if (
      dirty &&
      !confirm("Discard unsaved edits before changing relationship?")
    )
      return;
    setEditorOpen(false);
    setSelected(r.id);
    setNote(r.note);
    setTimeout(
      () =>
        whyRef.current?.scrollIntoView({ block: "start", behavior: "auto" }),
      0,
    );
  }
  async function review(review: Relationship["review"], saved: boolean) {
    if (!relationship) return;
    try {
      await persist({
        ...g,
        relationships: [
          ...g.relationships.filter((r) => r.id !== relationship.id),
          ...reviewRelationship(
            eligibleGraph,
            relationship.id,
            review,
            note,
            saved,
          ).relationships.filter((r) => r.id === relationship.id),
        ],
      });
    } catch {}
  }
  const scoped = (
    view === "saved"
      ? relationships.filter((r) => r.saved)
      : relationships.filter(
          (r) => (r.a === focus || r.b === focus) && r.review !== "rejected",
        )
  ).filter((r) => filter === "all" || r.status === filter);
  const businesses = eligibleGraph.businesses.filter(
    (b) =>
      (!search ||
        `${b.name} ${b.summary}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (sector === "all" || b.sectors.includes(sector)),
  );
  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="BD Oracle navigation">
        <Link href="/">BD ORACLE · Discover</Link>
        <div className={styles.actions}>
          <button className="text-button" onClick={() => setView("network")}>
            Network
          </button>
          <button className="text-button" onClick={() => setView("research")}>
            Research
          </button>
          <button className="text-button" onClick={() => setView("saved")}>
            Saved
          </button>
          <Link href="/walkthrough">Walkthrough</Link>
        </div>
      </nav>
      <span className="eyebrow">
        PRIVATE ECONOMIC INTELLIGENCE ·{" "}
        {mode === "browser" ? "ON THIS DEVICE" : "SERVER WORKSPACE"}
      </span>
      <h1>Discover how businesses connect.</h1>
      <p>
        Explore what they provide, what they need, and why value could move
        between them.
      </p>
      <div className={styles.stats}>
        <div>
          <strong>{ready ? eligibleGraph.businesses.length : "—"}</strong>
          <span>Researched businesses / products</span>
        </div>
        <div>
          <strong>
            {
              relationships.filter(
                (r) => r.status === "confirmed" && r.review !== "rejected",
              ).length
            }
          </strong>
          <span>Documented links</span>
        </div>
        <div>
          <strong>
            {
              relationships.filter(
                (r) => r.status === "hypothesis" && r.review !== "rejected",
              ).length
            }
          </strong>
          <span>Research hypotheses · rules + AI</span>
        </div>
      </div>
      <p className={styles.legend}>
        Solid lines: documented relationships. Dashed lines: research
        hypotheses. Matching is rule-based unless a result is explicitly marked
        AI. Partner nodes are restricted to verified assets in your current
        active Binance Spot USDC registry. Archived research remains stored.
        Rule matching displays up to 500 candidates per workspace; missing
        results do not prove that no relationship exists.
      </p>
      {error && (
        <p className={styles.message} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className={styles.message} role="status">
          {notice}
        </p>
      )}
      {!ready ? (
        <p>Opening saved network…</p>
      ) : (
        <>
          <div className={styles.layout}>
            <aside className={styles.panel}>
              <h2>Businesses</h2>
              <label>
                Search businesses
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Huma, Morpho…"
                />
              </label>
              <label>
                Industry
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                >
                  <option value="all">All industries</option>
                  {[
                    ...new Set(
                      eligibleGraph.businesses.flatMap((b) => b.sectors),
                    ),
                  ]
                    .sort()
                    .map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                </select>
              </label>
              <div className={styles.businesses}>
                {businesses.map((b) => (
                  <button
                    key={b.id}
                    aria-pressed={focus === b.id}
                    onClick={() => navigate(b.id)}
                  >
                    <strong>{b.name}</strong>
                    <small>{b.sectors.join(" · ") || "Unclassified"}</small>
                  </button>
                ))}
                {!businesses.length && (
                  <p>
                    No researched businesses match. A token listing alone does
                    not create a business identity.
                  </p>
                )}
              </div>
            </aside>
            <section className={styles.panel}>
              {view === "research" ? (
                <>
                  <h2>Research workspace</h2>
                  <p>
                    Your corrections and evidence feed the network.
                    Machine-generated links remain hypotheses even after
                    acceptance.
                  </p>
                  <details>
                    <summary>Add a business and evidence</summary>
                    <NetworkResearchForm
                      graph={g}
                      onSave={async (next) => {
                        await persist(next);
                      }}
                    />
                  </details>
                  <details>
                    <summary>Add an economic relationship</summary>
                    <RelationshipForm
                      graph={g}
                      onSave={async (next) => {
                        await persist(next);
                      }}
                    />
                  </details>
                  <details>
                    <summary>Add or review evidence</summary>
                    <SourceForm
                      graph={g}
                      onSave={async (next) => {
                        await persist(next);
                      }}
                    />
                  </details>
                  <details
                    open={editorOpen}
                    onToggle={(e) => {
                      if (e.currentTarget.open && !editorOpen) {
                        setJsonDraft(JSON.stringify(g, null, 2));
                        setEditorOpen(true);
                      } else if (!e.currentTarget.open && editorOpen) {
                        if (
                          editorDirty &&
                          !confirm("Discard structured research edits?")
                        ) {
                          e.currentTarget.open = true;
                          return;
                        }
                        setEditorOpen(false);
                      }
                    }}
                  >
                    <summary>
                      Edit structured research, sources and relationships
                    </summary>
                    <p>
                      Update needs, capabilities, source excerpts or manual
                      relationship records. Confirmed claims require confirmed
                      sources. This editor validates references and cannot
                      promote machine suggestions into facts.
                    </p>
                    <label>
                      Network research JSON
                      <textarea
                        rows={20}
                        value={jsonDraft}
                        onChange={(e) => setJsonDraft(e.target.value)}
                      />
                    </label>
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={async () => {
                        try {
                          const saved = await persist(
                            validateGraph(JSON.parse(jsonDraft)),
                          );
                          setJsonDraft(JSON.stringify(saved, null, 2));
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Validate and save research
                    </button>
                  </details>
                  <h3>Review queue</h3>
                  {relationships
                    .filter((r) => r.review === "pending")
                    .map((r) => (
                      <button
                        key={r.id}
                        className="button secondary"
                        onClick={() => choose(r)}
                      >
                        Review {g.businesses.find((b) => b.id === r.a)?.name} →{" "}
                        {g.businesses.find((b) => b.id === r.b)?.name}
                      </button>
                    ))}
                </>
              ) : (
                <>
                  <div className={styles.actions}>
                    <button
                      className="button secondary"
                      disabled={!history.length || dirty}
                      onClick={() => {
                        setFocus(history.at(-1)!);
                        setHistory((h) => h.slice(0, -1));
                        setSelected(null);
                      }}
                    >
                      Back
                    </button>
                    <span className={styles.badge}>
                      {view === "saved"
                        ? "SAVED RESEARCH"
                        : business?.kind.toUpperCase()}
                    </span>
                  </div>
                  <h2>
                    {view === "saved"
                      ? "Saved connections"
                      : business?.name || "Select a business"}
                  </h2>
                  {business && view !== "saved" && (
                    <>
                      <p>{business.summary}</p>
                      <p>
                        <strong>Products:</strong>{" "}
                        {business.products.join(", ") || "Not researched"}
                      </p>
                      <details>
                        <summary>
                          Business anatomy · needs & capabilities
                        </summary>
                        <h3>Provides</h3>
                        {business.capabilities.length ? (
                          business.capabilities.map((f, i) => (
                            <p key={i}>
                              {f.code.replaceAll("_", " ")}: {f.text} ·{" "}
                              {f.status}
                            </p>
                          ))
                        ) : (
                          <p>Unknown — add sourced research.</p>
                        )}
                        <h3>Needs</h3>
                        {business.needs.length ? (
                          business.needs.map((f, i) => (
                            <p key={i}>
                              {f.code.replaceAll("_", " ")}: {f.text} ·{" "}
                              {f.status}
                            </p>
                          ))
                        ) : (
                          <p>
                            Unknown — do not infer that this business has no
                            dependencies.
                          </p>
                        )}
                        <h3>Business sources</h3>
                        {g.sources
                          .filter((s) => business.sourceIds.includes(s.id))
                          .map((s) => (
                            <p key={s.id}>
                              <a href={s.url} target="_blank" rel="noreferrer">
                                {s.title} ↗
                              </a>{" "}
                              · {s.observedAt.slice(0, 10)}
                            </p>
                          ))}
                      </details>
                    </>
                  )}
                  <label>
                    Relationship status
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">Documented + hypotheses</option>
                      <option value="confirmed">Documented only</option>
                      <option value="hypothesis">Hypotheses only</option>
                      <option value="inference">Inferences only</option>
                      <option value="unknown">Unresolved only</option>
                    </select>
                  </label>
                  {business && view !== "saved" && (
                    <div
                      className={styles.graph}
                      aria-label="Business network graph"
                    >
                      <NetworkGraph
                        businesses={eligibleGraph.businesses}
                        relationships={scoped}
                        focus={focus}
                        onFocus={navigate}
                        onRelationship={(id) => {
                          const r = relationships.find((x) => x.id === id);
                          if (r) choose(r);
                        }}
                      />
                    </div>
                  )}
                  {scoped.length > 16 && (
                    <p>
                      Showing the first 16 graph connections. Every result is
                      available below.
                    </p>
                  )}
                  <div className={styles.links}>
                    {scoped.map((r) => (
                      <button key={r.id} onClick={() => choose(r)}>
                        <strong>
                          {g.businesses.find((b) => b.id === r.a)?.name} →{" "}
                          {g.businesses.find((b) => b.id === r.b)?.name}
                        </strong>
                        <span>
                          {r.status === "confirmed"
                            ? "Documented integration / relationship"
                            : `${r.status} · ${r.provenance}`}{" "}
                          · Why?
                        </span>
                      </button>
                    ))}
                  </div>
                  {!scoped.length && (
                    <p>
                      No connections in this view. Add sourced needs and
                      capabilities to investigate possible matches.
                    </p>
                  )}
                  {business && view !== "saved" && (
                    <details>
                      <summary>Optional AI analysis</summary>
                      <p>
                        Sends up to 20 stored business profiles and 40 evidence
                        excerpts to OpenAI. Requires private server storage,
                        explicit AI configuration and your owner token. Limited
                        to 10 attempts per day; provider charges may apply.
                      </p>
                      <button
                        className="button secondary"
                        disabled={busy || dirty || mode !== "server"}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            setGraph(
                              validateGraph(
                                await request("research/analyze", {
                                  businessId: focus,
                                  revision: g.revision,
                                }),
                              ),
                            );
                            setNotice(
                              "Analysis complete; any returned hypotheses are ready for review.",
                            );
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Analyze this business with AI
                      </button>
                    </details>
                  )}
                </>
              )}
              {relationship && (
                <section
                  ref={whyRef}
                  className={styles.why}
                  aria-label="Relationship explanation"
                >
                  <span className={styles.badge}>
                    {relationship.status.toUpperCase()} ·{" "}
                    {relationship.provenance.toUpperCase()} ·{" "}
                    {relationship.review}
                  </span>
                  <h2>Why are they connected?</h2>
                  <p>{relationship.reason}</p>
                  <dl>
                    <dt>
                      Business A ·{" "}
                      {g.businesses.find((b) => b.id === relationship.a)?.name}
                    </dt>
                    <dd>{relationship.aProvides}</dd>
                    <dt>
                      Business B ·{" "}
                      {g.businesses.find((b) => b.id === relationship.b)?.name}
                    </dt>
                    <dd>{relationship.bProvides}</dd>
                    <dt>Value to A · interpretation</dt>
                    <dd>{relationship.aValue}</dd>
                    <dt>Value to B · interpretation</dt>
                    <dd>{relationship.bValue}</dd>
                    <dt>Money flow</dt>
                    <dd>{relationship.moneyFlow}</dd>
                    <dt>Evidence observed</dt>
                    <dd>
                      {relationship.observedAt.slice(0, 10)} · not a live market
                      check
                    </dd>
                    {relationship.confidence !== null && (
                      <>
                        <dt>Model confidence · uncalibrated</dt>
                        <dd>
                          {relationship.confidence}; not commercial viability.
                        </dd>
                      </>
                    )}
                  </dl>
                  <h3>What remains unknown?</h3>
                  <ul>
                    {relationship.gaps.map((gap, i) => (
                      <li key={i}>{gap}</li>
                    ))}
                  </ul>
                  <h3>Evidence</h3>
                  {g.sources
                    .filter((s) => relationship.sourceIds.includes(s.id))
                    .map((s) => (
                      <article className={styles.source} key={s.id}>
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.title} ↗
                        </a>
                        <blockquote>{s.excerpt}</blockquote>
                        <p>Research interpretation: {s.interpretation}</p>
                        <small>
                          {s.status} · observed {s.observedAt.slice(0, 10)}
                        </small>
                      </article>
                    ))}
                  <label>
                    Review note
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={6000}
                    />
                  </label>
                  <div className={styles.actions}>
                    <button
                      className="button primary"
                      disabled={busy || editorDirty}
                      onClick={() => void review("accepted", true)}
                    >
                      Save for investigation
                    </button>
                    <button
                      className="button secondary"
                      disabled={busy || editorDirty}
                      onClick={() => void review("rejected", false)}
                    >
                      Reject connection
                    </button>
                    <button
                      className="button secondary"
                      disabled={dirty}
                      onClick={() => navigate(relationship.b)}
                    >
                      Explore{" "}
                      {g.businesses.find((b) => b.id === relationship.b)?.name}
                    </button>
                  </div>
                  <p>
                    Accepting a suggestion never verifies it. No compensation
                    agreement is implied.
                  </p>
                </section>
              )}
            </section>
          </div>
          <details className={`${styles.panel} ${styles.toolbar}`}>
            <summary>Data sources, backups & private server connection</summary>
            <p>
              Browser network research is stored separately from Binance
              snapshots. Export both backups to move all your work. Nothing here
              runs a background collection job while the page is closed.
            </p>
            <div className={styles.actions}>
              <button
                className="button secondary"
                disabled={dirty || busy}
                onClick={() =>
                  downloadFile(
                    "bd-oracle-network.json",
                    JSON.stringify(g, null, 2),
                  )
                }
              >
                Export network backup
              </button>
              <button
                className="button secondary"
                disabled={dirty || busy}
                onClick={() => importRef.current?.click()}
              >
                Import network backup
              </button>
              <button
                className="button secondary"
                disabled={dirty || busy}
                onClick={async () => {
                  try {
                    await persist(
                      mergeGraph(g, validateGraph(researchLibrary)),
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Merge sourced research library
              </button>
            </div>
            <input
              ref={importRef}
              type="file"
              hidden
              accept=".json"
              aria-label="Import network JSON"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  if (f.size > 5_000_000)
                    throw new Error("Network backup exceeds 5 MB");
                  await persist(
                    mergeGraph(g, validateGraph(JSON.parse(await f.text()))),
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  if (importRef.current) importRef.current.value = "";
                }
              }}
            />
            <h3>Private server storage</h3>
            <p>
              Requires persistent Postgres on Vercel. Your owner token stays in
              this tab’s memory and is sent only to this site. Browser data is
              never silently uploaded or replaced.
            </p>
            <label>
              Owner access token
              <input
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </label>
            <div className={styles.actions}>
              <button
                className="button secondary"
                disabled={dirty || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const next = validateGraph(
                      await request("network/workspace"),
                    );
                    setGraph(next);
                    setMode("server");
                    setRegistry(await request("usdc/workspace"));
                    setSelected(null);
                    setNotice(
                      "Private server workspace opened. Browser research remains on this device.",
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Open server workspace
              </button>
              <button
                className="button secondary"
                disabled={dirty || busy}
                onClick={async () => {
                  try {
                    setGraph(await readNetwork());
                    setMode("browser");
                    setRegistry(await readRegistry());
                    setToken("");
                    setSelected(null);
                    setNotice("Browser workspace opened.");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Return to browser workspace
              </button>
              <button
                className="button secondary"
                onClick={async () => {
                  try {
                    setSourceStatus(
                      JSON.stringify(await request("sources/status"), null, 2),
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Check server source status
              </button>
            </div>
            {sourceStatus && (
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {sourceStatus}
              </pre>
            )}
            <Link href="/discover">
              Open Binance discovery and extraction status →
            </Link>
          </details>
        </>
      )}
    </main>
  );
}
