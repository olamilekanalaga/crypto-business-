"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BINANCE_URL,
  downloadFile,
  readWorkspace,
} from "@/lib/browser-discovery";
import {
  Registry,
  emptyRegistry,
  adoptLegacy,
  addSnapshot,
  currentDirectory,
  recordError,
  verifyIdentity,
  validateBackup,
  mergeRegistry,
  ungzip,
} from "@/lib/usdc/model";
import { readRegistry, writeRegistry } from "@/lib/usdc/browser";
import {
  publicCG,
  scanIdentityPage,
  refreshMarketBatch,
} from "@/lib/usdc/coingecko";
import { setConnection } from "@/lib/usdc/connection";
import styles from "./Directory.module.css";
export default function Directory() {
  const [g, setRegistry] = useState<Registry>(emptyRegistry),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("all"),
    [sort, setSort] = useState("desc"),
    [automatic, setAutomatic] = useState(true),
    [owner, setOwner] = useState(""),
    [mode, setMode] = useState<"browser" | "server">("browser");
  const file = useRef<HTMLInputElement>(null),
    latest = g.snapshots.at(-1);
  const [reviewAsset, setReviewAsset] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let value = await readRegistry();
        const legacy = await readWorkspace();
        if (!active) return;
        const next = await adoptLegacy(value, legacy.snapshots);
        if (next !== value) value = await writeRegistry(next);
        if (active) setRegistry(value);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  async function api(action: string, body?: unknown) {
    const r = await fetch(`/api/usdc/${action}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(owner ? { Authorization: `Bearer ${owner}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Server request failed");
    return data;
  }
  async function save(value: Registry) {
    const saved =
      mode === "browser"
        ? await writeRegistry(value)
        : await api("workspace", value);
    setRegistry(saved);
    return saved;
  }
  async function failure(source: "binance" | "coingecko", e: unknown) {
    const message = (e as Error).message || String(e);
    setError(message);
    if (mode === "server" && source === "binance") {
      try {
        setRegistry(await api("workspace"));
      } catch {}
      return;
    }
    try {
      await save(recordError(g, source, message));
    } catch {
      setError(
        message +
          " Error log could not be saved; previous stored data is unchanged.",
      );
    }
  }
  async function refresh() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "server") {
        setRegistry(await api("refresh", {}));
      } else {
        const r = await fetch(BINANCE_URL, {
          cache: "no-store",
          credentials: "omit",
          signal: AbortSignal.timeout(25000),
        });
        if (!r.ok)
          throw new Error(`Binance HTTP ${r.status}; prior snapshot retained.`);
        await save(await addSnapshot(g, await r.text()));
      }
      setNotice(
        "Binance snapshot saved. Research and earlier listings preserved.",
      );
    } catch (e) {
      await failure("binance", e);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!ready || !automatic || busy || mode !== "browser") return;
    const check = () => {
      const last = latest?.observedAt;
      const attempt = g.errors.filter((e) => e.source === "binance").at(-1)?.at;
      if (
        (!last || Date.now() - Date.parse(last) >= 86400000) &&
        (!attempt || Date.now() - Date.parse(attempt) >= 3600000)
      )
        void refresh();
    };
    check();
    const timer = setInterval(check, 60000);
    return () => clearInterval(timer);
  }, [ready, automatic, busy, latest?.observedAt, g.errors.length, mode]);
  const fetchCG = (path: string) =>
    mode === "server" ? api("coingecko", { path }) : publicCG(path);
  async function enrich(kind: "identity" | "markets") {
    setBusy(true);
    setError("");
    try {
      const next =
        kind === "identity"
          ? await scanIdentityPage(g, fetchCG)
          : await refreshMarketBatch(g, fetchCG);
      await save(next);
      setNotice(
        kind === "identity"
          ? next.identityScan?.complete
            ? "CoinGecko exchange scan complete. Unambiguous Binance USDC identities matched."
            : `Saved identity page ${next.identityScan!.nextPage - 1}. Continue the scan; no partial scan is treated as verified.`
          : "Market-cap batch refreshed or cached observations retained. Timestamps are independent of Binance sync.",
      );
    } catch (e) {
      await failure("coingecko", e);
    } finally {
      setBusy(false);
    }
  }
  const rows = currentDirectory(g),
    categories = [
      ...new Set(rows.flatMap((r) => r.metadata?.categories || [])),
    ].sort();
  const visible = rows
    .filter(
      (r) =>
        (category === "all" || r.metadata?.categories.includes(category)) &&
        `${r.metadata?.name || ""} ${r.metadata?.symbol || ""} ${r.assets.map((a) => a.code).join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      if (sort === "name")
        return (a.metadata?.name || a.id).localeCompare(
          b.metadata?.name || b.id,
        );
      const x = a.metadata?.marketCap,
        y = b.metadata?.marketCap;
      if (x == null) return y == null ? 0 : 1;
      if (y == null) return -1;
      return sort === "desc" ? y - x : x - y;
    });
  const active = g.assets.filter((a) => a.listingStatus === "active"),
    unresolved = active.filter((a) => !a.identity);
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <strong>BD ORACLE</strong>
        <Link href="/network/research">Research workspace</Link>
      </header>
      <span className="eyebrow">BINANCE SPOT · USDC MARKETS</span>
      <h1>Token directory</h1>
      <p>
        Last synced:{" "}
        {latest ? new Date(latest.observedAt).toLocaleString() : "—"} ·{" "}
        {rows.length} verified assets · {unresolved.length} awaiting identity
        review
      </p>
      <div className={styles.actions}>
        <button
          className="button primary"
          disabled={!ready || busy}
          onClick={() => void refresh()}
        >
          {busy ? "Working…" : "Refresh Binance"}
        </button>
        <button
          className="button secondary"
          disabled={!ready || busy || !rows.length}
          onClick={() => void enrich("markets")}
        >
          Refresh market caps
        </button>
      </div>
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
      <div className={styles.filters}>
        <label>
          Search tokens
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or ticker"
          />
        </label>
        <label>
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="desc">Market cap: high to low</option>
            <option value="asc">Market cap: low to high</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>
      <table
        className={styles.table}
        aria-label="Active verified Binance USDC assets"
      >
        <thead>
          <tr>
            <th>Asset / Project</th>
            <th>Market cap · USD</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.id}>
              <td>
                <Link
                  className={styles.asset}
                  href={`/asset-research/${encodeURIComponent(row.id)}`}
                >
                  <Logo
                    url={row.metadata?.image || undefined}
                    name={row.metadata?.name || row.assets[0].code}
                  />
                  <span>
                    <strong>{row.metadata?.name || "—"}</strong>
                    <small>
                      {row.metadata?.symbol.toUpperCase() || row.assets[0].code}
                    </small>
                  </span>
                </Link>
              </td>
              <td
                title={
                  row.metadata
                    ? `Observed ${row.metadata.observedAt}; provider updated ${row.metadata.providerUpdatedAt || "unknown"}`
                    : "Market cap unavailable"
                }
              >
                {row.metadata?.marketCap == null
                  ? "—"
                  : new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    }).format(row.metadata.marketCap)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!visible.length && (
        <p>
          {!ready
            ? "Opening saved snapshots…"
            : unresolved.length
              ? "Active USDC assets are stored. Complete identity review below before they enter this verified directory."
              : "No verified active USDC assets match this view."}
        </p>
      )}
      <p>
        Only USDC-quoted, TRADING, Spot-enabled markets. Market caps are cached
        provider observations, not live quotes; unavailable values stay —.
        Categories come from CoinGecko profiles.
      </p>
      <details className={styles.panel}>
        <summary>
          Identity review · {unresolved.length} unresolved active assets
        </summary>
        <p>
          CoinGecko’s Binance ticker pages cross-reference the exchange, base,
          USDC quote and unique coin ID. A complete unambiguous scan can verify
          an identity; a ticker-only name match cannot.
        </p>
        <button
          className="button secondary"
          disabled={busy || !active.length}
          onClick={() => void enrich("identity")}
        >
          {g.identityScan && !g.identityScan.complete
            ? `Continue CoinGecko scan · page ${g.identityScan.nextPage}`
            : "Start CoinGecko identity scan"}
        </button>
        <p>
          One page per request to respect API allowances. Complete all pages,
          then refresh market caps in batches of 50. Existing verified
          assignments are never silently replaced.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const d = new FormData(e.currentTarget);
            try {
              await save(
                verifyIdentity(g, String(d.get("asset")), {
                  coinGeckoId: String(d.get("coinId")).trim(),
                  sourceUrl: String(d.get("source")).trim(),
                  basis: "manual_evidence",
                  verifiedAt: new Date().toISOString(),
                  evidence: String(d.get("evidence")).trim(),
                }),
              );
              setNotice(
                "Identity review recorded. Refresh metadata to obtain the verified project name, logo and market cap.",
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Binance asset
            <select
              name="asset"
              value={reviewAsset}
              onChange={(e) => setReviewAsset(e.target.value)}
              required
            >
              <option value="">Choose an asset</option>
              {g.assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.listingStatus} ·{" "}
                  {a.identity?.coinGeckoId || "unresolved"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Verified CoinGecko ID
            <input
              name="coinId"
              placeholder="Exact provider ID, not ticker"
              required
            />
          </label>
          <label>
            Identity evidence URL
            <input name="source" type="url" placeholder="https://…" required />
          </label>
          <label>
            How does the evidence establish identity?
            <textarea
              name="evidence"
              placeholder="Exchange cross-reference or matching verified network/contract identifiers"
              required
            />
          </label>
          <label>
            <span>
              <input type="checkbox" required style={{ width: "auto" }} /> I
              checked the identity evidence, not only the ticker.
            </span>
          </label>
          <button className="button primary" disabled={busy}>
            Record verified identity
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={busy || !reviewAsset}
            onClick={async () => {
              try {
                await save(verifyIdentity(g, reviewAsset, null));
                setNotice(
                  "Identity returned to unresolved. Research remains stored.",
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Return to unresolved
          </button>
        </form>
      </details>
      <details className={styles.panel}>
        <summary>Snapshots, history & data access</summary>
        <p>
          {active.length} active exchange base identifiers · {g.assets.length}{" "}
          historical identifiers · {g.snapshots.length} snapshots. Absent does
          not mean verified delisting. History begins with your first collected
          snapshot.
        </p>
        <label>
          <span>
            <input
              type="checkbox"
              checked={automatic}
              onChange={(e) => setAutomatic(e.target.checked)}
              style={{ width: "auto" }}
            />{" "}
            Refresh stale Binance data daily while this page is open
          </span>
        </label>
        <p>
          Daily server refresh while the browser is closed requires persistent
          storage and the configured scheduler. Market caps refresh separately,
          with a one-hour cache.
        </p>
        <div className={styles.actions}>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              downloadFile("bd-oracle-usdc.json", JSON.stringify(g))
            }
          >
            Export registry backup
          </button>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => file.current?.click()}
          >
            Import JSON
          </button>
          {latest && (
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  downloadFile(
                    "binance-exchangeInfo.json",
                    await ungzip(latest.rawGzip),
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Download original Binance JSON
            </button>
          )}
        </div>
        <input
          ref={file}
          hidden
          type="file"
          accept=".json"
          aria-label="Import USDC registry or Binance JSON"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            try {
              if (f.size > 25_000_000) throw new Error("Import exceeds 25 MB");
              const raw = await f.text(),
                v = JSON.parse(raw);
              await save(
                v.format === "bd-oracle-usdc-v1"
                  ? mergeRegistry(g, await validateBackup(v))
                  : await addSnapshot(g, raw, new Date().toISOString(), "file"),
              );
              setNotice(
                "Import saved without deleting research. Raw-file import time is not the original extraction time.",
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
              if (file.current) file.current.value = "";
            }
          }}
        />
        <div className={styles.history}>
          {g.assets.map((a) => (
            <p key={a.id}>
              {a.code} · {a.listingStatus} · first seen{" "}
              {a.firstSeenAt.slice(0, 10)} · last seen{" "}
              {a.lastSeenAt.slice(0, 10)}
            </p>
          ))}
        </div>
        <h2>Sync errors</h2>
        <div className={styles.history}>
          {g.errors.map((e, i) => (
            <p key={i}>
              {e.at} · {e.source}: {e.message}
            </p>
          ))}
          {!g.errors.length && <p>No recorded errors.</p>}
        </div>
        <Link href="/discovery-history">
          Open original discovery workspace, notes and classifications →
        </Link>
        <p>
          <a href={BINANCE_URL} target="_blank" rel="noreferrer">
            Open Binance raw API response ↗
          </a>{" "}
          ·{" "}
          <a
            href="https://www.coingecko.com/en/api"
            target="_blank"
            rel="noreferrer"
          >
            CoinGecko API plans ↗
          </a>
        </p>
        <h2>Private server storage</h2>
        <p>
          Current mode: {mode}. Opening the server does not upload or erase this
          browser’s registry. Export/import explicitly to transfer it.
        </p>
        <label>
          Owner access token
          <input
            type="password"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            autoComplete="off"
          />
        </label>
        <div className={styles.actions}>
          <button
            className="button secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setRegistry(await api("workspace"));
                setMode("server");
                setConnection({ mode: "server", token: owner });
                setNotice("Server registry opened.");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Open server registry
          </button>
          <button
            className="button secondary"
            disabled={busy}
            onClick={async () => {
              setRegistry(await readRegistry());
              setMode("browser");
              setOwner("");
              setConnection({ mode: "browser", token: "" });
            }}
          >
            Return to browser registry
          </button>
        </div>
      </details>
    </main>
  );
}
function Logo({ url, name }: { url?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? (
    <img
      src={url}
      alt={`${name} logo`}
      width={40}
      height={40}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className={styles.logo} aria-label="Logo unavailable">
      ◇
    </span>
  );
}
