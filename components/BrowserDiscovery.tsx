"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, RefreshCw, Upload, Database } from "lucide-react";
import {
  BINANCE_URL,
  downloadFile,
  emptyWorkspace,
  importWorkspace,
  mergeWorkspace,
  parsePairs,
  readWorkspace,
  writeWorkspace,
  type Pair,
  type Workspace,
} from "@/lib/browser-discovery";
import styles from "./BrowserDiscovery.module.css";

export default function BrowserDiscovery() {
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null),
    [draft, setDraft] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    let active = true;
    readWorkspace()
      .then((value) => {
        if (active) setWorkspace(value);
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
  const noteFor = (code: string) =>
    Object.hasOwn(workspace.notes, code) ? workspace.notes[code] : "";
  const dirty = selected !== null && draft !== noteFor(selected);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (selected && window.matchMedia("(max-width: 700px)").matches)
      detailRef.current?.scrollIntoView({ block: "start" });
  }, [selected]);
  const latest = workspace.snapshots.at(-1);
  const pairs = useMemo(() => {
    const all = new Map<string, Pair>();
    workspace.snapshots.forEach((snapshot, index) =>
      parsePairs(snapshot.raw).forEach((p) =>
        all.set(p.symbol, {
          ...p,
          available: index === workspace.snapshots.length - 1,
        }),
      ),
    );
    return [...all.values()];
  }, [workspace.snapshots]);
  const groups = useMemo(() => {
    const result = new Map<string, Pair[]>();
    for (const p of pairs)
      result.set(p.baseAsset, [...(result.get(p.baseAsset) || []), p]);
    return [...result.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [pairs]);
  const visible = groups.filter(
    ([asset, items]) =>
      (asset.toLowerCase().includes(search.toLowerCase()) ||
        items.some((p) =>
          p.symbol.toLowerCase().includes(search.toLowerCase()),
        )) &&
      (filter === "all" ||
        items.some((p) =>
          filter === "active"
            ? p.available && p.spot && p.status === "TRADING"
            : !p.available || !p.spot || p.status !== "TRADING",
        )),
  );
  const currentPairs = pairs.filter((p) => p.available);
  const currentBases = new Set(currentPairs.map((p) => p.baseAsset)).size;
  const selectedPairs = groups.find(([code]) => code === selected)?.[1] || [];
  async function persist(next: Workspace, message: string) {
    setWorkspace(next);
    try {
      await writeWorkspace(next);
      setNotice(message + " Saved in this browser.");
    } catch (e) {
      setError((e as Error).message);
      setNotice("Data is available in this tab. Download a backup now.");
    }
  }
  async function addRaw(raw: string, method: "fetch" | "file") {
    parsePairs(raw);
    await persist(
      {
        ...workspace,
        snapshots: [
          ...workspace.snapshots,
          {
            id: crypto.randomUUID(),
            obtainedAt: new Date().toISOString(),
            method,
            raw,
          },
        ],
      },
      method === "fetch"
        ? "Binance refresh complete."
        : "Snapshot imported. Its original extraction time is unknown.",
    );
    setPage(0);
  }
  async function refresh() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      let response: Response;
      try {
        response = await fetch(BINANCE_URL, {
          cache: "no-store",
          credentials: "omit",
          signal: AbortSignal.timeout(25000),
        });
      } catch {
        throw new Error(
          "Your browser could not reach Binance. This may be CORS, a network restriction or a timeout. Open the Binance JSON link below, save the response as a .json file, then import it here. Your existing data is kept.",
        );
      }
      if (!response.ok)
        throw new Error(
          `Binance returned HTTP ${response.status}. Try again later or import a downloaded JSON snapshot. Your existing data is kept.`,
        );
      const raw = await response.text();
      if (raw.length > 25_000_000)
        throw new Error("Response exceeds the 25 MB snapshot limit.");
      await addRaw(raw, "fetch");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importFile(f: File) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (f.size > 100_000_000)
        throw new Error("Choose a JSON file smaller than 100 MB.");
      const text = await f.text();
      const backup = importWorkspace(text);
      if (backup) {
        await persist(
          mergeWorkspace(workspace, backup),
          "Backup merged; existing snapshots and notes retained.",
        );
        setPage(0);
      } else await addRaw(text, "file");
    } catch (e) {
      setError("Import failed: " + (e as Error).message);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }
  function openAsset(code: string) {
    if (
      selected &&
      draft !== noteFor(selected) &&
      !window.confirm(
        "Leave this unsaved note? Choose Cancel to save it first.",
      )
    )
      return;
    setSelected(code);
    setDraft(noteFor(code));
  }
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/">
          <ArrowLeft size={17} /> Opportunity atlas
        </Link>
        <span>
          <Database size={15} /> BROWSER WORKSPACE
        </span>
      </header>
      <span className="eyebrow">BINANCE SPOT · PUBLIC DATA</span>
      <h1>
        Your asset universe.
        <br />
        <span>Collected in your browser.</span>
      </h1>
      <p className={styles.lead}>
        Fetch the public Binance listings, explore each asset and keep your own
        notes. No account, API key or backend needed.
      </p>
      <div className={styles.actions}>
        <button
          className="button primary"
          disabled={!ready || busy || dirty}
          onClick={refresh}
        >
          <RefreshCw size={16} />
          {busy ? "Working…" : "Fetch Binance Spot"}
        </button>
        <button
          className="button secondary"
          disabled={!ready || busy || dirty}
          onClick={() => file.current?.click()}
        >
          <Upload size={16} />
          Import JSON
        </button>
        <button
          className="button secondary"
          disabled={!ready || busy || dirty || !workspace.snapshots.length}
          onClick={() =>
            downloadFile("bd-oracle-backup.json", JSON.stringify(workspace))
          }
        >
          <Download size={16} />
          Download backup
        </button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          aria-label="Import Binance JSON or workspace backup"
          hidden
          onChange={(e) => {
            if (e.target.files?.[0]) void importFile(e.target.files[0]);
          }}
        />
      </div>
      {dirty && (
        <p role="status" className={styles.notice}>
          Save your edited note before fetching, importing or downloading a
          backup.
        </p>
      )}
      <p className={styles.storage}>
        Saved on this device and browser. Download a backup to keep a file or
        move it to another device. Clearing browser storage can remove local
        copies. Refresh runs while this page is open.
      </p>
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      <section className={styles.stats} aria-label="Snapshot data quality">
        <div>
          <strong>{latest ? currentPairs.length.toLocaleString() : "—"}</strong>
          <span>Pairs in latest snapshot</span>
        </div>
        <div>
          <strong>{latest ? currentBases.toLocaleString() : "—"}</strong>
          <span>Unique base assets</span>
        </div>
        <div>
          <strong>
            {latest
              ? currentPairs
                  .filter((p) => p.spot && p.status === "TRADING")
                  .length.toLocaleString()
              : "—"}
          </strong>
          <span>Active Spot pairs</span>
        </div>
        <div>
          <strong>{workspace.snapshots.length}</strong>
          <span>Retained snapshots</span>
        </div>
      </section>
      <details className={styles.help}>
        <summary>How to load data and keep your files</summary>
        <ol>
          <li>
            Press Fetch Binance Spot. A successful response is saved
            automatically in this browser.
          </li>
          <li>
            If blocked,{" "}
            <a href={BINANCE_URL} target="_blank" rel="noreferrer">
              open Binance’s exchangeInfo JSON ↗
            </a>
            . Save the complete response as a .json file, then select Import
            JSON. A page opening in a tab does not guarantee that Binance
            permits cross-origin fetches.
          </li>
          <li>
            Download backup includes raw responses, snapshot history and saved
            notes. Import that backup on another device to continue there.
          </li>
        </ol>
        <p>
          Imported snapshots carry an import time; their original extraction
          time is unknown. A backup’s dates are supplied by the file. Assets are
          Binance identifiers, not verified business identities. CoinGecko
          enrichment and the local SQLite research graph remain separate.
        </p>
      </details>
      {latest && (
        <div className={styles.snapshot}>
          <span>
            {latest.method === "fetch"
              ? "Latest snapshot fetched"
              : "Latest snapshot imported"}
            : {new Date(latest.obtainedAt).toLocaleString()} · Binance
          </span>
          <button
            className="text-button"
            onClick={() =>
              downloadFile("binance-exchangeInfo.json", latest.raw)
            }
          >
            Download original JSON <Download size={14} />
          </button>
        </div>
      )}
      {!latest ? (
        <section className={styles.empty}>
          <Database size={36} />
          <h2>
            {ready
              ? "Your first snapshot starts here."
              : "Opening browser storage…"}
          </h2>
          <p>
            Fetch Binance Spot or import an exchangeInfo JSON file. Counts will
            appear only after valid data is loaded.
          </p>
        </section>
      ) : (
        <>
          <div className={styles.filters}>
            <label>
              Search assets or pairs
              <input
                value={search}
                placeholder="BTC, ETH, BTCUSDT…"
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label>
              Pair availability
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">All observed assets</option>
                <option value="active">With active Spot pairs</option>
                <option value="inactive">
                  With inactive or unavailable pairs
                </option>
              </select>
            </label>
          </div>
          <div className={styles.columns}>
            <section className={styles.list} aria-label="Discovered assets">
              <p>{visible.length} assets · select one to investigate</p>
              {visible.slice(page * 40, page * 40 + 40).map(([code, items]) => (
                <button
                  key={code}
                  className={selected === code ? styles.selected : ""}
                  onClick={() => openAsset(code)}
                >
                  <strong>{code}</strong>
                  <span>
                    {items.filter((p) => p.available).length} current pairs ·
                    Identity unresolved
                  </span>
                </button>
              ))}
              {!visible.length && <p>No matching assets.</p>}
              <div className={styles.pagination}>
                <button
                  className="button secondary"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page + 1} of{" "}
                  {Math.max(1, Math.ceil(visible.length / 40))}
                </span>
                <button
                  className="button secondary"
                  disabled={(page + 1) * 40 >= visible.length}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </section>
            <section
              ref={detailRef}
              className={styles.detail}
              aria-label="Asset research"
            >
              {selected ? (
                <>
                  <span className="eyebrow">
                    BINANCE ASSET · UNRESOLVED IDENTITY
                  </span>
                  <h2>{selected}</h2>
                  <p>
                    A token does not automatically identify an organisation.
                    Record what you find and the sources you want to check.
                  </p>
                  <div className={styles.pairs}>
                    {selectedPairs.map((p) => (
                      <article key={p.symbol}>
                        <strong>{p.symbol}</strong>
                        <span>
                          {p.baseAsset} / {p.quoteAsset}
                        </span>
                        <span>
                          {!p.available
                            ? "Unavailable in latest snapshot"
                            : p.spot && p.status === "TRADING"
                              ? "Active Spot"
                              : `${p.status} · ${p.spot ? "Spot enabled" : "Spot unavailable"}`}
                        </span>
                      </article>
                    ))}
                  </div>
                  <label>
                    Research note · unverified
                    <textarea
                      rows={8}
                      value={draft}
                      maxLength={20000}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="What business might this represent? What does it provide? Add source URLs, observations and questions."
                    />
                  </label>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        await persist(
                          {
                            ...workspace,
                            notes: { ...workspace.notes, [selected]: draft },
                          },
                          "Research note saved.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Save note
                  </button>
                  <small>
                    Save before downloading a backup. These notes do not verify
                    a project identity.
                  </small>
                </>
              ) : (
                <>
                  <h2>Select an asset</h2>
                  <p>See all its observed pairs and start a research note.</p>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
