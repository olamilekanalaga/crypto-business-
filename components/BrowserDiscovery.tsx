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
import TokenLogo from "./TokenLogo";
import tokenDisplay from "@/lib/token-display.json";
import ProductClassification from "./ProductClassification";
import {
  CATEGORIES,
  productFor,
  type Classification,
} from "@/lib/product-classification";

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
  const [quote, setQuote] = useState("USDC");
  const [category, setCategory] = useState("all");
  const [review, setReview] = useState("all");
  const [classificationDirty, setClassificationDirty] = useState(false);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const displayFor = (code: string) =>
    (tokenDisplay as Record<string, { name: string; logo: string }>)[code];
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
  const dirty =
    classificationDirty || (selected !== null && draft !== noteFor(selected));
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
  const eligibleGroups = groups
    .map(
      ([asset, items]) =>
        [
          asset,
          items.filter(
            (p) =>
              (quote === "all" || p.quoteAsset === quote) &&
              (filter === "all" ||
                (filter === "active"
                  ? p.available && p.spot && p.status === "TRADING"
                  : !p.available || !p.spot || p.status !== "TRADING")),
          ),
        ] as [string, Pair[]],
    )
    .filter(
      ([asset, items]) =>
        items.length &&
        (asset.toLowerCase().includes(search.toLowerCase()) ||
          (
            productFor(asset, workspace.classifications)?.project ||
            displayFor(asset)?.name ||
            ""
          )
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          items.some((p) =>
            p.symbol.toLowerCase().includes(search.toLowerCase()),
          )),
    );
  const visible = eligibleGroups.filter(([asset]) => {
    const c = productFor(asset, workspace.classifications);
    return (
      (category === "all" ||
        (category === "unclassified"
          ? !c?.categories.length
          : c?.categories.some((v) => v === category))) &&
      (review === "all" ||
        (review === "reviewed"
          ? c?.status === "reviewed"
          : c?.status !== "reviewed"))
    );
  });
  const matchingPairs = visible
    .flatMap(([, items]) => items)
    .filter((p) => p.available);
  const quoteOptions = [...new Set(pairs.map((p) => p.quoteAsset))].sort();
  function changeFilter(change: () => void) {
    change();
    setPage(0);
    setSelected(null);
  }
  const selectedClassification = selected
    ? productFor(selected, workspace.classifications)
    : undefined;
  async function saveClassification(record: Classification) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await persist(
        {
          ...workspace,
          classifications: { ...workspace.classifications, [selected]: record },
        },
        "Product classification saved.",
      );
      setPage(0);
    } finally {
      setBusy(false);
    }
  }
  const currentPairs = pairs.filter((p) => p.available);
  const currentBases = new Set(matchingPairs.map((p) => p.baseAsset)).size;
  const selectedPairs =
    eligibleGroups.find(([code]) => code === selected)?.[1] || [];
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
        const merged = mergeWorkspace(workspace, backup);
        await persist(
          merged,
          "Backup merged; existing snapshots and notes retained.",
        );
        if (selected)
          setDraft(
            Object.hasOwn(merged.notes, selected) ? merged.notes[selected] : "",
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
      dirty &&
      !window.confirm(
        "Leave unsaved research or classification edits? Choose Cancel to save first.",
      )
    )
      return;
    setSelected(code);
    setDraft(noteFor(code));
  }
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/network">
          <ArrowLeft size={17} /> BD Oracle · Business network
        </Link>
        <span>
          <Database size={15} /> BROWSER WORKSPACE
        </span>
      </header>
      <span className="eyebrow">BINANCE SPOT · PUBLIC DATA</span>
      <h1>
        Your crypto <span>data directory.</span>
      </h1>
      <p className={styles.lead}>
        Explore tokens, discover their products, and classify what they provide.
      </p>
      <section className={styles.stats} aria-label="Directory totals">
        <div>
          <strong>
            {latest
              ? new Set(
                  currentPairs.map((p) => p.baseAsset),
                ).size.toLocaleString()
              : "—"}
          </strong>
          <span>Tokens listed · latest snapshot</span>
        </div>
        <div>
          <strong>
            {latest
              ? new Set(
                  currentPairs
                    .filter((p) => p.quoteAsset === "USDC")
                    .map((p) => p.baseAsset),
                ).size.toLocaleString()
              : "—"}
          </strong>
          <span>Tokens paired with USDC</span>
        </div>
        <div>
          <strong>
            {latest
              ? currentPairs
                  .filter(
                    (p) =>
                      p.quoteAsset === "USDC" &&
                      p.spot &&
                      p.status === "TRADING",
                  )
                  .length.toLocaleString()
              : "—"}
          </strong>
          <span>Active USDC Spot pairs</span>
        </div>
      </section>
      <p className={styles.scopeNote}>
        Latest snapshot totals, independent of filters. Listed tokens include
        inactive pairs; a USDC pair does not mean USDC is the token’s only quote
        currency.
      </p>
      <button
        className="button primary"
        disabled={!latest || dirty || busy}
        onClick={() => {
          categoryRef.current?.scrollIntoView({ block: "center" });
          categoryRef.current?.focus();
        }}
      >
        Classification · explore product types
      </button>
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
              Quote currency
              <select
                aria-label="Quote currency"
                disabled={dirty || busy}
                value={quote}
                onChange={(e) => changeFilter(() => setQuote(e.target.value))}
              >
                <option value="USDC">USDC only</option>
                <option value="all">All quote currencies</option>
                {quoteOptions
                  .filter((v) => v !== "USDC")
                  .map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Product category
              <select
                ref={categoryRef}
                disabled={dirty || busy}
                value={category}
                onChange={(e) =>
                  changeFilter(() => setCategory(e.target.value))
                }
              >
                <option value="all">All product types</option>
                <option value="unclassified">Unclassified</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c} (
                    {
                      eligibleGroups.filter(([a]) =>
                        productFor(
                          a,
                          workspace.classifications,
                        )?.categories.includes(c),
                      ).length
                    }
                    )
                  </option>
                ))}
              </select>
            </label>
            <label>
              Review status
              <select
                disabled={dirty || busy}
                value={review}
                onChange={(e) => changeFilter(() => setReview(e.target.value))}
              >
                <option value="all">Suggestions + reviewed</option>
                <option value="reviewed">Reviewed by me only</option>
                <option value="needs_review">
                  Needs review / unclassified
                </option>
              </select>
            </label>
            <label>
              Search assets or pairs
              <input
                value={search}
                placeholder="BTC, ETH, BTCUSDC…"
                disabled={dirty || busy}
                onChange={(e) => {
                  changeFilter(() => setSearch(e.target.value));
                }}
              />
            </label>
            <label>
              Pair availability
              <select
                disabled={dirty || busy}
                value={filter}
                onChange={(e) => {
                  changeFilter(() => setFilter(e.target.value));
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
          <p className={styles.scopeNote}>
            Showing{" "}
            {quote === "all"
              ? "all quote currencies"
              : `${quote}-quoted pairs only`}
            . Product tags may overlap. Suggestions are ticker candidates, not
            verified identities. Names and logos are catalogue candidates, not
            identity verification; unknown projects stay Unclassified. Filters
            never delete your original snapshot.
          </p>
          <div
            className={`${styles.columns} ${selected ? styles.hasSelection : ""}`}
          >
            <section className={styles.list} aria-label="Discovered assets">
              <p>
                {visible.length} assets · {currentBases} in latest snapshot ·{" "}
                {matchingPairs.length} matching pairs
              </p>
              <div className={styles.cardGrid}>
                {visible
                  .slice(page * 40, page * 40 + 40)
                  .map(([code, items]) => (
                    <button
                      key={code}
                      className={selected === code ? styles.selected : ""}
                      onClick={() => openAsset(code)}
                    >
                      <div className={styles.cardIdentity}>
                        <TokenLogo code={code} src={displayFor(code)?.logo} />
                        <strong>{code}</strong>
                        <div className={styles.tokenName}>
                          {productFor(code, workspace.classifications)
                            ?.project ||
                            displayFor(code)?.name ||
                            "Name unresolved"}
                        </div>
                        <div className={styles.tags}>
                          {(productFor(code, workspace.classifications)
                            ?.categories.length
                            ? productFor(code, workspace.classifications)!
                                .categories
                            : ["Unclassified"]
                          ).map((c) => (
                            <small key={c}>{c}</small>
                          ))}
                        </div>
                        <small className={styles.reviewLabel}>
                          {productFor(code, workspace.classifications)
                            ?.status === "reviewed"
                            ? "Reviewed by you"
                            : "Needs review"}
                        </small>
                      </div>
                      <span>
                        {items.filter((p) => p.available).length} current pairs
                        · Identity unresolved
                      </span>
                    </button>
                  ))}
              </div>
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
            {selected && (
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
                    <p>
                      {selectedPairs.length} pairs in the selected
                      quote/availability scope.{" "}
                      {groups.find(([code]) => code === selected)?.[1].length ||
                        0}{" "}
                      total pairs retained.
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
                    <Link
                      className="button secondary"
                      href={`/network?search=${encodeURIComponent(selectedClassification?.project || selected)}`}
                    >
                      Search business network →
                    </Link>
                    <p>
                      Search uses the candidate project name; it does not verify
                      a token-to-business identity.
                    </p>
                    <ProductClassification
                      key={selected + JSON.stringify(selectedClassification)}
                      value={selectedClassification}
                      saved={Object.hasOwn(
                        workspace.classifications || {},
                        selected,
                      )}
                      busy={busy}
                      onSave={saveClassification}
                      onDirty={setClassificationDirty}
                    />
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
                      Save before downloading a backup. These notes do not
                      verify a project identity.
                    </small>
                  </>
                ) : (
                  <>
                    <h2>Select an asset</h2>
                    <p>See all its observed pairs and start a research note.</p>
                  </>
                )}
              </section>
            )}
          </div>
        </>
      )}
      <section className={styles.dataTools} aria-label="Data and backups">
        <h2>Data & backups</h2>
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
            Save your research and category edits before fetching, importing or
            downloading a backup.
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
            time is unknown. A backup’s dates are supplied by the file. Assets
            are Binance identifiers, not verified business identities. CoinGecko
            enrichment and the local SQLite research graph remain separate.
          </p>
        </details>
        {latest && (
          <div className={styles.snapshot}>
            <span>
              {latest.method === "fetch"
                ? "Latest snapshot fetched"
                : "Latest snapshot imported"}
              : {new Date(latest.obtainedAt).toLocaleString()} · Binance ·{" "}
              {currentPairs.length.toLocaleString()} full snapshot pairs
              retained
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
      </section>
    </main>
  );
}
