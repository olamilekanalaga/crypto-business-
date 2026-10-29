"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { readRegistry, writeRegistry } from "@/lib/usdc/browser";
import { Registry, emptyRegistry } from "@/lib/usdc/model";
import { publicCG, refreshProfile } from "@/lib/usdc/coingecko";
import { prepareProjects, eligibleBusinessIds } from "@/lib/usdc/scope";
import { Graph, emptyGraph, validateGraph } from "@/lib/network/model";
import { readNetwork, writeNetwork } from "@/lib/network/browser";
import { getConnection } from "@/lib/usdc/connection";
import { readWorkspace, writeWorkspace } from "@/lib/browser-discovery";
import styles from "./Directory.module.css";
export default function AssetIntelligence({ coinId }: { coinId: string }) {
  const [registry, setRegistry] = useState<Registry>(emptyRegistry),
    [graph, setGraph] = useState<Graph>(emptyGraph),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [correction, setCorrection] = useState(""),
    [note, setNote] = useState(""),
    [linked, setLinked] = useState("");
  const connection = getConnection(),
    id = `cg:${coinId}`;
  const assets = registry.assets.filter(
      (a) => a.identity?.coinGeckoId === coinId,
    ),
    metadata = registry.metadata.find((m) => m.id === coinId),
    business = graph.businesses.find((b) => b.id === id),
    analysis = graph.analyses?.filter((a) => a.businessId === id).at(-1),
    active = assets.some((a) => a.listingStatus === "active");
  async function api(path: string, body?: unknown) {
    const r = await fetch(`/api/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${connection.token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const v = await r.json();
    if (!r.ok) throw new Error(v.error || "Request failed");
    return v;
  }
  async function saveGraph(g: Graph) {
    const next =
      connection.mode === "server"
        ? validateGraph(await api("network/workspace", g))
        : await writeNetwork(g);
    setGraph(next);
    return next;
  }
  async function saveRegistry(g: Registry) {
    const next =
      connection.mode === "server"
        ? await api("usdc/workspace", g)
        : await writeRegistry(g);
    setRegistry(next);
    return next;
  }
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [r, g] =
          connection.mode === "server"
            ? await Promise.all([
                api("usdc/workspace"),
                api("network/workspace"),
              ])
            : await Promise.all([readRegistry(), readNetwork()]);
        if (!live) return;
        setRegistry(r);
        const prepared = prepareProjects(validateGraph(g), r);
        const next =
          JSON.stringify(prepared) !== JSON.stringify(g)
            ? await saveGraph(prepared)
            : g;
        if (live) {
          setGraph(next);
          setCorrection(
            next.businesses.find(
              (b: Graph["businesses"][number]) => b.id === id,
            )?.summary || "",
          );
          if (connection.mode === "browser") {
            const legacy = await readWorkspace();
            setNote(
              r.assets
                .filter(
                  (a: Registry["assets"][number]) =>
                    a.identity?.coinGeckoId === coinId,
                )
                .map(
                  (a: Registry["assets"][number]) => legacy.notes[a.code] || "",
                )
                .filter(Boolean)
                .join("\n\n"),
            );
          }
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        if (live) setReady(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [coinId]);
  if (!ready)
    return (
      <main className={styles.page}>
        <p>Opening asset research…</p>
      </main>
    );
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/">← USDC directory</Link>
        <span>BD ORACLE · BUSINESS INTELLIGENCE</span>
      </header>
      <h1>{metadata?.name || coinId}</h1>
      <p>
        {metadata?.symbol.toUpperCase() || assets.map((a) => a.code).join(", ")}{" "}
        ·{" "}
        {active
          ? "Active Binance Spot USDC"
          : "Not in the current verified active USDC universe"}
      </p>
      {error && (
        <p role="alert" className={styles.message}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className={styles.message}>
          {notice}
        </p>
      )}
      {!assets.length ? (
        <p>
          No verified Binance asset is connected to this identity. Return to the
          directory’s identity review.
        </p>
      ) : (
        <>
          <section className={styles.panel}>
            <h2>What does this business do?</h2>
            {analysis ? (
              <>
                <p>
                  <strong>
                    AI hypothesis · {analysis.observedAt.slice(0, 10)}
                  </strong>
                </p>
                <p>{analysis.description}</p>
                <h2>Products</h2>
                <p>{analysis.products.join(", ") || "Unknown"}</p>
                <h2>Customers</h2>
                <p>{analysis.customers}</p>
                <h2>Economic model</h2>
                <p>{analysis.economicModel}</p>
                <h2>What does it need?</h2>
                {analysis.needs.map((f, i) => (
                  <p key={i}>{f.text}</p>
                ))}
                <h2>Capabilities</h2>
                {analysis.capabilities.map((f, i) => (
                  <p key={i}>{f.text}</p>
                ))}
                <h2>Missing evidence</h2>
                {analysis.gaps.map((gap, i) => (
                  <p key={i}>{gap}</p>
                ))}
                <h2>Sources</h2>
                {graph.sources
                  .filter((s) => analysis.sourceIds.includes(s.id))
                  .map((s) => (
                    <p key={s.id}>
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.title} ↗
                      </a>
                    </p>
                  ))}
              </>
            ) : (
              <p>
                No AI economic explanation is stored yet. Provider metadata and
                your research remain available below; unknowns are not filled
                with generic business claims.
              </p>
            )}
            <h2>Your research / corrections</h2>
            <label>
              Editable business explanation
              <textarea
                value={correction}
                onChange={(e) => setCorrection(e.target.value)}
                maxLength={6000}
              />
            </label>
            <button
              className="button secondary"
              disabled={busy || !business || !correction.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await saveGraph({
                    ...graph,
                    businesses: graph.businesses.map((b) =>
                      b.id === id ? { ...b, summary: correction } : b,
                    ),
                  });
                  setNotice(
                    "Correction saved. Previous versions remain in research history.",
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save correction
            </button>
            <div className={styles.actions}>
              <button
                className="button primary"
                disabled={
                  busy || !active || !business || connection.mode !== "server"
                }
                onClick={async () => {
                  setBusy(true);
                  try {
                    setGraph(
                      validateGraph(
                        await api("research/analyze", {
                          businessId: id,
                          revision: graph.revision,
                        }),
                      ),
                    );
                    setNotice(
                      "Analysis complete. An unchanged evidence/universe request uses its cached result.",
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Analyze business on demand
              </button>
              {active && (
                <Link
                  className="button secondary"
                  href={`/network?business=${encodeURIComponent(id)}`}
                >
                  Explore matching businesses →
                </Link>
              )}
            </div>
            <p>
              AI requires private server storage and a configured OpenAI key. It
              searches only stored verified active USDC projects; partner IDs
              are validated. Repeated unchanged requests use the saved cache. No
              analysis runs just because you opened this page.
            </p>
          </section>
          <details className={styles.panel}>
            <summary>Provider metadata & evidence</summary>
            <p>
              {metadata?.description ||
                "No provider description collected yet."}
            </p>
            {metadata?.website && (
              <p>
                <a href={metadata.website} target="_blank" rel="noreferrer">
                  Project website ↗
                </a>
              </p>
            )}
            <p>
              CoinGecko ID: {coinId}. This establishes the asset identity, not a
              verified operating company or economic model.
            </p>
            <button
              className="button secondary"
              disabled={busy || !metadata}
              onClick={async () => {
                setBusy(true);
                try {
                  const next = await refreshProfile(
                    registry,
                    coinId,
                    connection.mode === "server"
                      ? (path) => api("usdc/coingecko", { path })
                      : publicCG,
                  );
                  await saveRegistry(next);
                  const prepared = prepareProjects(graph, next);
                  await saveGraph(prepared);
                  setNotice(
                    "Profile loaded or seven-day cached profile retained. Review this evidence before analysis.",
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Load official profile metadata
            </button>
            <p>
              Market cap observed: {metadata?.observedAt || "—"} · provider
              updated: {metadata?.providerUpdatedAt || "—"}. Profile observed:{" "}
              {metadata?.profileObservedAt || "—"}.
            </p>
            {assets.map((a) => (
              <p key={a.id}>
                {a.code}: first seen {a.firstSeenAt}, last seen {a.lastSeenAt},
                status {a.listingStatus}. Identity source:{" "}
                <a
                  href={a.identity!.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Review evidence ↗
                </a>
              </p>
            ))}
          </details>
          <details className={styles.panel}>
            <summary>Connect existing research and preserve notes</summary>
            <p>
              Link an existing researched business only after checking that it
              is associated with this asset. This explicit association makes
              that stored business eligible within the USDC network while the
              asset remains active.
            </p>
            <label>
              Existing researched business
              <select
                value={linked}
                onChange={(e) => setLinked(e.target.value)}
              >
                <option value="">Select</option>
                {graph.businesses
                  .filter((b) => b.id !== id)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="button secondary"
              disabled={!linked || busy}
              onClick={async () => {
                try {
                  await saveRegistry({
                    ...registry,
                    assets: registry.assets.map((a) =>
                      a.identity?.coinGeckoId === coinId
                        ? {
                            ...a,
                            businessIds: [
                              ...new Set([...a.businessIds, linked]),
                            ],
                          }
                        : a,
                    ),
                  });
                  setNotice("Explicit research association saved.");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Link reviewed business
            </button>
            {connection.mode === "browser" && (
              <>
                <label>
                  Preserved discovery notes
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={20000}
                  />
                </label>
                <button
                  className="button secondary"
                  onClick={async () => {
                    try {
                      const legacy = await readWorkspace();
                      await writeWorkspace({
                        ...legacy,
                        notes: { ...legacy.notes, [assets[0].code]: note },
                      });
                      setNotice(
                        "Discovery note saved in the original workspace.",
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Save discovery note
                </button>
              </>
            )}
            <h2>Research history</h2>
            <div className={styles.history}>
              {graph.history
                ?.filter((h) => h.id === id)
                .map((h, i) => (
                  <details key={i}>
                    <summary>
                      {h.at} · previous {h.kind} record
                    </summary>
                    <pre style={{ whiteSpace: "pre-wrap" }}>{h.before}</pre>
                  </details>
                ))}
              {!graph.history?.some((h) => h.id === id) && (
                <p>No earlier correction versions recorded.</p>
              )}
            </div>
          </details>
        </>
      )}
    </main>
  );
}
