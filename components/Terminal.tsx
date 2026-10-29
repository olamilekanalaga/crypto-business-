"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
const Anatomy = dynamic(() => import("./Anatomy"), {
  ssr: false,
  loading: () => <div className="loading">Opening Business Anatomy…</div>,
});
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Boxes,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Database,
  ExternalLink,
  FileText,
  GitBranch,
  Globe,
  HelpCircle,
  LayoutDashboard,
  Lightbulb,
  Loader2,
  LockKeyhole,
  Menu,
  Network,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal as TerminalIcon,
  X,
} from "lucide-react";
import ResearchFrameworks from "./ResearchFrameworks";
import IntelligenceReview from "./IntelligenceReview";
import UnresolvedRelationships from "./UnresolvedRelationships";
import AssetAnatomy from "./AssetAnatomy";
import Workspace, { Badge, researchFields } from "./Workspace";
import { api, date, number } from "./api";
import type {
  Asset,
  Claim,
  Detail,
  Opportunity,
  Overview,
  Quality,
  Relationship,
} from "./types";

type View =
  | "network"
  | "frameworks"
  | "intelligence"
  | "anatomy"
  | "overview"
  | "assets"
  | "businesses"
  | "flow"
  | "relationships"
  | "workspace"
  | "unresolved"
  | "opportunities"
  | "quality";
const nav: { view: View; name: string; icon: typeof Boxes }[] = [
  { view: "overview", name: "Research overview", icon: LayoutDashboard },
  { view: "assets", name: "Asset discovery", icon: Boxes },
  { view: "businesses", name: "Business explorer", icon: Globe },
  { view: "anatomy", name: "Business Anatomy", icon: Network },
  { view: "flow", name: "Economic flow", icon: GitBranch },
  { view: "network", name: "Economic Network", icon: Network },
  { view: "relationships", name: "Relationship records", icon: Network },
];
const personal: { view: View; name: string; icon: typeof Boxes }[] = [
  { view: "opportunities", name: "My opportunities", icon: Lightbulb },
  { view: "workspace", name: "Research workspace", icon: BookOpen },
  { view: "frameworks", name: "Research frameworks", icon: GitBranch },
  { view: "intelligence", name: "Intelligence review", icon: ShieldCheck },
  { view: "unresolved", name: "Unresolved queue", icon: HelpCircle },
];
const headings: Record<
  View,
  { label: string; title: string; description: string }
> = {
  network: {
    label: "ECONOMIC NETWORK",
    title: "Follow the connections across businesses.",
    description:
      "Expand recorded relationships beyond one business, while keeping each claim and its evidence visible.",
  },
  frameworks: {
    label: "REUSABLE RESEARCH QUESTIONS",
    title: "Different businesses. Different needs.",
    description:
      "Refine dependency frameworks without turning category assumptions into facts.",
  },
  intelligence: {
    label: "OPTIONAL INTELLIGENCE · HUMAN REVIEW",
    title: "Suggestions stay separate from facts.",
    description:
      "Inspect structured proposals and retain only editable research hypotheses. No external model is connected.",
  },
  anatomy: {
    label: "BD ORACLE · BUSINESS DEPENDENCY & OPPORTUNITY GRAPH",
    title: "What keeps this business alive?",
    description:
      "Explore its needs, suppliers, growth capabilities and potential connections — one economic relationship at a time.",
  },
  overview: {
    label: "YOUR PERSONAL RESEARCH TERMINAL",
    title: "See the business behind the asset.",
    description:
      "Understand what businesses need, how value moves, and where you could help.",
  },
  assets: {
    label: "BINANCE SPOT · DISCOVERY",
    title: "Assets are the starting point.",
    description:
      "Exchange observations, preserved trading pairs, and carefully resolved project identities.",
  },
  businesses: {
    label: "THE ECONOMIC MACHINE",
    title: "What do these businesses do?",
    description:
      "Explore products, customers, recurring needs, and the organisations behind them.",
  },
  flow: {
    label: "FOLLOW THE VALUE",
    title: "Every business starts with a want.",
    description:
      "Trace actors, behaviours, friction, and the exchange that creates value.",
  },
  relationships: {
    label: "BUSINESS TO BUSINESS",
    title: "Understand why they connect.",
    description:
      "What each side provides, what each side gains, and what the evidence actually supports.",
  },
  workspace: {
    label: "YOUR RESEARCH DESK",
    title: "Make the unknown researchable.",
    description:
      "Record what you found, what you think, and what you still need to establish.",
  },
  unresolved: {
    label: "IDENTITY RESEARCH",
    title: "A ticker is not an identity.",
    description:
      "Investigate candidates before linking an exchange asset to a project. Never guess.",
  },
  opportunities: {
    label: "YOUR OPPORTUNITY NOTEBOOK",
    title: "Where could you create value?",
    description:
      "Capture business needs, possible solutions, and the next question worth investigating.",
  },
  quality: {
    label: "DATA PROVENANCE & HEALTH",
    title: "Know what you can trust.",
    description:
      "Actual extraction results, unresolved identities, request failures, and refresh history.",
  },
};
function Empty({
  icon: Icon = BookOpen,
  title,
  children,
  action,
  onAction,
}: {
  icon?: typeof Boxes;
  title: string;
  children: React.ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={25} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action && (
        <button className="button secondary" onClick={onAction}>
          {action}
          <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
}
function SourceLink({
  url,
  children,
}: {
  url?: string;
  children: React.ReactNode;
}) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return (
    <a className="source-link" href={url} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight size={13} />
    </a>
  );
}
function EntityLink({
  id,
  name,
  kind,
}: {
  id: number;
  name: string;
  kind?: string;
}) {
  return (
    <Link href={(kind === "asset" ? "/assets/" : "/businesses/") + id}>
      {name}
      <ArrowUpRight size={14} />
    </Link>
  );
}

export default function Terminal({
  entityId,
  dedicatedAnatomy = false,
  initialView = "overview",
}: {
  entityId?: string;
  dedicatedAnatomy?: boolean;
  initialView?: View;
}) {
  const [view, setView] = useState<View>(initialView),
    [overview, setOverview] = useState<Overview | null>(null),
    [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [syncOpen, setSyncOpen] = useState(false),
    [mobile, setMobile] = useState(false);
  const [editing, setEditing] = useState<Opportunity | undefined>(),
    [workspaceMode, setWorkspaceMode] = useState<"finding" | "opportunity">(
      "finding",
    ),
    [revision, setRevision] = useState(0),
    [copied, setCopied] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const [o, d] = await Promise.all([
        api<Overview>("overview"),
        entityId
          ? api<Detail>("detail", { id: entityId })
          : Promise.resolve(null),
      ]);
      setOverview(o);
      if (d) setDetail(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [entityId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!entityId) {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("view") as View;
      if (Object.hasOwn(headings, requested)) setView(requested);
    }
  }, [entityId]);
  function navigate(next: View) {
    if (entityId) {
      window.location.href = "/?view=" + next;
      return;
    }
    setView(next);
    setEditing(undefined);
    setWorkspaceMode("finding");
    setMobile(false);
    window.history.replaceState(null, "", "/?view=" + next);
  }
  function saved() {
    void load();
    setRevision((v) => v + 1);
  }
  function startOpportunity(item?: Opportunity) {
    setEditing(item);
    setWorkspaceMode("opportunity");
    setView("workspace");
  }
  async function copy(command: string) {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(command);
    } catch {
      setCopied("Clipboard unavailable. Select and copy the command.");
    }
  }
  const modalRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!syncOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = modalRef.current;
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    function keyboard(e: KeyboardEvent) {
      if (e.key === "Escape") setSyncOpen(false);
      if (e.key === "Tab" && dialog) {
        const items = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button, a[href], input, select, textarea, [tabindex="0"]',
          ),
        ).filter((el) => !el.hasAttribute("disabled"));
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      previous?.focus();
    };
  }, [syncOpen]);
  const q = overview?.quality,
    h = headings[view];
  return (
    <div className="terminal-shell">
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <Link className="brand" href="/">
          <span className="brand-mark">
            c
            <span>
              <ArrowUpRight size={19} />
            </span>
          </span>
          <span>
            BD Oracle<span className="brand-sub">CŘYPTÔ BUSINESS</span>
          </span>
        </Link>
        <div className="private-label">
          <LockKeyhole size={12} /> PERSONAL INTELLIGENCE
        </div>
        <nav aria-label="Main navigation">
          <p className="nav-label">DISCOVER & EXPLORE</p>
          {nav.map((n) => (
            <button
              key={n.view}
              onClick={() => navigate(n.view)}
              className={!entityId && view === n.view ? "active" : ""}
            >
              <n.icon size={18} />
              {n.name}
              {!entityId && view === n.view && <span className="nav-dot" />}
            </button>
          ))}
          <p className="nav-label research-label">MY RESEARCH</p>
          {personal.map((n) => (
            <button
              key={n.view}
              onClick={() => navigate(n.view)}
              className={!entityId && view === n.view ? "active" : ""}
            >
              <n.icon size={18} />
              {n.name}
              {n.view === "unresolved" && !!q?.unresolved_assets && (
                <span className="nav-count">{number(q.unresolved_assets)}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="principle">
            <span className="eyebrow">THE LENS</span>
            <p>
              Find the need.
              <br />
              Follow the behaviour.
              <br />
              <strong>Understand the business.</strong>
            </p>
          </div>
          <button className="health-link" onClick={() => navigate("quality")}>
            <span
              className={
                "status-dot " + (q?.last_successful_refresh ? "good" : "")
              }
            />
            <span>
              Local research database
              <small>
                {q?.last_successful_refresh
                  ? "Snapshot available"
                  : "Awaiting first extraction"}
              </small>
            </span>
            <ChevronRight size={15} />
          </button>
          <div className="sidebar-footer">
            <LockKeyhole size={12} /> Private by design <span>PHASE 01</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span className="terminal-label">TERMINAL</span>
            <span className="slash">/</span>
            <span>
              {entityId
                ? "Research profile"
                : h.label
                    .split(" · ")[0]
                    .toLowerCase()
                    .replace(/^./, (c) => c.toUpperCase())}
            </span>
          </div>
          <div className="top-actions">
            <span className="local-badge">
              <span className="status-dot good" />
              Local workspace
            </span>
            <button
              className="button secondary compact"
              onClick={() => setSyncOpen(true)}
            >
              <RefreshCw size={14} />
              <span>Data refresh</span>
            </button>
            <span className="avatar" title="Your private workspace">
              ME
            </span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {entityId
                  ? `${detail?.kind || "RESEARCH"} · RESEARCH PROFILE`
                  : h.label}
              </div>
              <h1>
                {entityId
                  ? dedicatedAnatomy
                    ? "Business Anatomy"
                    : detail?.identity?.name ||
                      detail?.name ||
                      "Research profile"
                  : h.title}
              </h1>
              <p>
                {entityId
                  ? "Understand the activity. Establish the connections. Record what remains unknown."
                  : h.description}
              </p>
            </div>
            {!entityId && view !== "workspace" && (
              <button
                className="button primary"
                onClick={() => {
                  setEditing(undefined);
                  navigate("workspace");
                }}
              >
                <Plus size={16} />
                Add research
              </button>
            )}
          </div>
          {error && (
            <div className="notice error" role="alert">
              {error}
              <button onClick={() => void load()}>Try again</button>
            </div>
          )}
          {loading ? (
            <div className="loading">
              <Loader2 className="spin" />
              Opening your local research workspace…
            </div>
          ) : (
            overview && (
              <>
                {entityId && detail ? (
                  dedicatedAnatomy ? (
                    <>
                      <Link
                        className="text-button"
                        href={`${detail.kind === "asset" ? "/assets/" : "/businesses/"}${detail.id}`}
                      >
                        Return to {detail.name} research
                        <ArrowUpRight size={14} />
                      </Link>
                      {detail.kind === "asset" ? (
                        <AssetAnatomy assetId={detail.id} />
                      ) : (
                        <Anatomy
                          overview={overview}
                          initialEntityId={detail.id}
                          onSaved={saved}
                        />
                      )}
                    </>
                  ) : (
                    <DetailPage
                      detail={detail}
                      overview={overview}
                      onSaved={saved}
                    />
                  )
                ) : (
                  <>
                    {view === "frameworks" && <ResearchFrameworks />}
                    {view === "intelligence" && (
                      <IntelligenceReview overview={overview} />
                    )}
                    {view === "unresolved" && <UnresolvedRelationships />}
                    {view === "network" && (
                      <Anatomy
                        overview={overview}
                        onSaved={saved}
                        scope="network"
                      />
                    )}
                    {view === "anatomy" && (
                      <Anatomy overview={overview} onSaved={saved} />
                    )}
                    {view === "overview" && (
                      <OverviewPage
                        overview={overview}
                        navigate={navigate}
                        startOpportunity={() => startOpportunity()}
                        openSync={() => setSyncOpen(true)}
                      />
                    )}
                    {(view === "assets" || view === "unresolved") && (
                      <AssetDiscovery
                        unresolved={view === "unresolved"}
                        revision={revision}
                        openSync={() => setSyncOpen(true)}
                      />
                    )}
                    {view === "businesses" && (
                      <section className="panel">
                        <div className="section-head">
                          <div>
                            <h2>Organisations & products</h2>
                            <p>
                              Distinct records. Evidence-backed connections.
                            </p>
                          </div>
                          <span className="count-pill">
                            {overview.businesses.length} records
                          </span>
                        </div>
                        {overview.businesses.length ? (
                          <div className="business-grid">
                            {overview.businesses.map((b) => (
                              <Link
                                className="business-card"
                                key={b.id}
                                href={"/businesses/" + b.id + "/anatomy"}
                              >
                                <span className="entity-symbol">
                                  <Globe size={20} />
                                </span>
                                <span className="eyebrow">{b.kind}</span>
                                <h3>
                                  {b.name}
                                  <ArrowUpRight size={18} />
                                </h3>
                                <p>{b.findings} research findings</p>
                                <span className="small muted">
                                  Open needs, products & value flows
                                </span>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <Empty
                            icon={Globe}
                            title="Build a picture of the business"
                            action="Create a business record"
                            onAction={() => navigate("workspace")}
                          >
                            Organisations and products are researched separately
                            from assets. No business is inferred from a token
                            listing.
                          </Empty>
                        )}
                      </section>
                    )}
                    {view === "flow" && <FlowExplorer overview={overview} />}
                    {view === "relationships" && (
                      <>
                        <div className="notice subtle">
                          <ShieldCheck size={17} />
                          <span>
                            Integration ≠ paying customer. Compatibility ≠
                            formal partnership. Keep the evidence specific.
                          </span>
                        </div>
                        <Relationships
                          items={overview.relationships}
                          onAdd={() => navigate("workspace")}
                        />
                      </>
                    )}
                    {view === "workspace" && (
                      <Workspace
                        key={editing?.id || "new"}
                        overview={overview}
                        onSaved={saved}
                        initialMode={workspaceMode}
                        opportunity={editing}
                      />
                    )}
                    {view === "opportunities" && (
                      <>
                        <div className="section-head above">
                          <div>
                            <h2>Questions that could become opportunities</h2>
                            <p>Your observations and possible ways to help.</p>
                          </div>
                          <button
                            className="button primary"
                            onClick={() => startOpportunity()}
                          >
                            <Plus size={16} />
                            Capture an opportunity
                          </button>
                        </div>
                        <OpportunityList
                          items={overview.opportunities}
                          onEdit={startOpportunity}
                        />
                      </>
                    )}
                    {view === "quality" && (
                      <QualityPage
                        quality={overview.quality}
                        openSync={() => setSyncOpen(true)}
                      />
                    )}
                  </>
                )}
              </>
            )
          )}
          <footer className="page-footer">
            <span>
              Cřyptô Business <span className="footer-dot">·</span> Personal
              economic intelligence
            </span>
            <span>Evidence, not assumptions.</span>
          </footer>
        </main>
      </div>
      {syncOpen && (
        <div className="modal-backdrop" onClick={() => setSyncOpen(false)}>
          <section
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="refresh-title"
            className="refresh-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button close-button"
              aria-label="Close data refresh"
              onClick={() => setSyncOpen(false)}
              autoFocus
            >
              <X size={20} />
            </button>
            <span className="eyebrow">LOCAL DATA PIPELINE</span>
            <h2 id="refresh-title">Bring the outside world in.</h2>
            <p>
              Run these commands from the project folder. Refreshes are
              repeatable; your research stays in place.
            </p>
            {[
              ["1. Collect Binance Spot", "python -m terminal ingest"],
              [
                "2. Index CoinGecko candidates",
                "python -m terminal candidates",
              ],
              [
                "3. Enrich verified identities",
                "python -m terminal enrich --limit 20",
              ],
              ["4. Export the quality report", "python -m terminal report"],
            ].map(([label, command]) => (
              <div className="command-block" key={command}>
                <label>{label}</label>
                <div>
                  <code>{command}</code>
                  <button
                    aria-label={"Copy " + command}
                    onClick={() => void copy(command)}
                  >
                    <Clipboard size={15} />
                  </button>
                </div>
              </div>
            ))}
            {copied && (
              <p className="small" role="status">
                {copied.startsWith("Clipboard") ? copied : "Command copied."}
              </p>
            )}
            <div className="notice subtle">
              <LockKeyhole size={17} />
              <span>
                CoinGecko uses your optional environment API key. Candidate
                tickers remain unresolved until you verify the identity with
                evidence.
              </span>
            </div>
            <button
              className="button primary"
              onClick={() => {
                saved();
                setSyncOpen(false);
              }}
            >
              Reload local data
              <RefreshCw size={15} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function OverviewPage({
  overview: o,
  navigate,
  startOpportunity,
  openSync,
}: {
  overview: Overview;
  navigate: (v: View) => void;
  startOpportunity: () => void;
  openSync: () => void;
}) {
  const q = o.quality;
  return (
    <>
      <div className="hero-grid">
        <section className="research-hero">
          <span className="hero-label">
            <span className="status-dot" /> YOUR EDGE IS UNDERSTANDING
          </span>
          <h2>
            Look for a need.
            <br />
            Then follow the money.
          </h2>
          <p>
            A token points to a project. Your research reveals the customers,
            dependencies, and unmet needs behind it.
          </p>
          <button className="hero-link" onClick={() => navigate("businesses")}>
            Explore the businesses
            <ArrowUpRight size={18} />
          </button>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <span className="art-node n1">
              <Globe size={22} />
            </span>
            <span className="art-node n2">
              <Boxes size={20} />
            </span>
            <span className="art-node n3">
              <Network size={22} />
            </span>
            <span className="art-center">
              <GitBranch size={35} />
            </span>
            <span className="art-plus">+</span>
          </div>
        </section>
        <section className="opportunity-prompt">
          <div className="prompt-icon">
            <Lightbulb size={23} />
          </div>
          <span className="eyebrow">A QUESTION WORTH ASKING</span>
          <h2>
            What does this business <br />
            need that I could provide?
          </h2>
          <p>
            Notice a friction. Capture a possibility. <br />
            Find evidence before calling it an opportunity.
          </p>
          <button className="button dark" onClick={startOpportunity}>
            Open my opportunity notebook
            <ArrowRight size={16} />
          </button>
        </section>
      </div>
      <div className="stats-grid">
        {[
          {
            label: "Discovered base assets",
            value: q.unique_base_assets,
            sub: "Unique within Binance",
            icon: Boxes,
            view: "assets" as View,
          },
          {
            label: "Researched businesses",
            value: o.businesses.filter((b) => b.kind === "organisation").length,
            sub: "Organisations you have recorded",
            icon: Globe,
            view: "businesses" as View,
          },
          {
            label: "Documented relationships",
            value: o.relationships.length,
            sub: "Evidence & hypotheses separated",
            icon: Network,
            view: "relationships" as View,
          },
          {
            label: "Open opportunity notes",
            value: o.opportunities.filter((x) => x.stage !== "dismissed")
              .length,
            sub: "Your possibilities to investigate",
            icon: Lightbulb,
            view: "opportunities" as View,
          },
        ].map((s) => (
          <button
            key={s.label}
            className="stat-card"
            onClick={() => navigate(s.view)}
          >
            <div>
              <span>{s.label}</span>
              <s.icon size={17} />
            </div>
            <strong>{number(s.value)}</strong>
            <small>{s.sub}</small>
          </button>
        ))}
      </div>
      {!q.last_successful_refresh && (
        <div className="first-extraction">
          <span className="extraction-icon">
            <Database size={20} />
          </span>
          <div>
            <strong>
              {q.latest_attempt?.status === "failed"
                ? "First extraction needs network access"
                : "Start with the real asset universe"}
            </strong>
            <p>
              {q.latest_attempt?.status === "failed"
                ? "The last Binance request failed. No market data has been substituted or invented."
                : "Run the Binance collector to populate your local asset database."}
            </p>
          </div>
          <button onClick={openSync}>
            View pipeline
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      <div className="overview-bottom">
        <section className="panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">THE RESEARCH PATH</span>
              <h2>From an asset to an economic story.</h2>
            </div>
          </div>
          <div className="research-path">
            {[
              {
                n: "01",
                title: "Discover",
                desc: "An exchange asset. A starting point.",
                action: "Browse assets",
                view: "assets" as View,
              },
              {
                n: "02",
                title: "Understand",
                desc: "The product, customer, and problem.",
                action: "Explore businesses",
                view: "businesses" as View,
              },
              {
                n: "03",
                title: "Connect",
                desc: "Who provides what, and why.",
                action: "Trace relationships",
                view: "relationships" as View,
              },
              {
                n: "04",
                title: "Investigate",
                desc: "An unmet need you could help solve.",
                action: "My opportunities",
                view: "opportunities" as View,
              },
            ].map((p) => (
              <button
                className="path-step"
                key={p.n}
                onClick={() => navigate(p.view)}
              >
                <span className="step-number">{p.n}</span>
                <div>
                  <h3>{p.title}</h3>
                  <p>{p.desc}</p>
                  <span>
                    {p.action}
                    <ArrowRight size={13} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
        <section className="panel recent-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">YOUR WORK IN PROGRESS</span>
              <h2>Recent research</h2>
            </div>
            <button
              className="text-button"
              onClick={() => navigate("workspace")}
            >
              Open desk
              <ArrowUpRight size={14} />
            </button>
          </div>
          {o.recent_claims.length ? (
            <div className="recent-list">
              {o.recent_claims.slice(0, 4).map((c) => (
                <div key={c.id}>
                  <Badge status={c.status} />
                  {c.proposal_origin && (
                    <span className="small muted">
                      {" "}
                      · Reviewed imported hypothesis
                    </span>
                  )}
                  <p>{c.statement}</p>
                  <span className="small muted">
                    {c.name} · {date(c.observed_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={FileText} title="Your next insight starts here">
              Save a source, describe a business need, or record a question you
              want to answer.
            </Empty>
          )}
        </section>
      </div>
      <div className="principle-strip">
        <span>THE ECONOMIC LOOP</span>
        <p>
          Desire <ArrowRight /> Behaviour <ArrowRight /> Friction <ArrowRight />{" "}
          Solution <ArrowRight /> Business <ArrowRight /> New behaviour{" "}
          <ArrowRight /> New problem
        </p>
      </div>
    </>
  );
}

function AssetDiscovery({
  unresolved,
  revision,
  openSync,
}: {
  unresolved: boolean;
  revision: number;
  openSync: () => void;
}) {
  const [search, setSearch] = useState(""),
    [scope, setScope] = useState(unresolved ? "unresolved" : "all"),
    [page, setPage] = useState(1),
    [data, setData] = useState<{
      items: Asset[];
      total: number;
      page: number;
    } | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const timer = setTimeout(() => {
      api<{ items: Asset[]; total: number; page: number }>("assets", {
        search,
        scope: unresolved ? "unresolved" : scope,
        page,
      })
        .then((r) => {
          if (alive) {
            setData(r);
            setError("");
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [search, scope, page, unresolved, revision]);
  return (
    <section className="panel discovery-panel">
      <div className="section-head">
        <div>
          <h2>
            {unresolved
              ? "Identity research queue"
              : "Binance Spot asset universe"}
          </h2>
          <p>
            {unresolved
              ? "Ticker-only candidates are not confirmed project identities."
              : "Every base asset, with all of its observed exchange listings."}
          </p>
        </div>
        <span className="exchange-label">
          <span className="binance-mark">◆</span> BINANCE SPOT
        </span>
      </div>
      <div className="table-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search assets"
            placeholder="Search asset or verified project…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        {!unresolved && (
          <div className="filter-tabs">
            {[
              ["all", "All assets"],
              ["active", "Active listings"],
              ["verified", "Verified identity"],
              ["unresolved", "Unresolved"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={scope === key ? "selected" : ""}
                onClick={() => {
                  setScope(key);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="loading">
          <Loader2 className="spin" size={18} />
          Reading local assets…
        </div>
      ) : data?.items.length ? (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ASSET / PROJECT</th>
                  <th>IDENTITY</th>
                  <th>OBSERVED PAIRS</th>
                  <th>ACTIVE PAIRS</th>
                  <th>LAST OBSERVED</th>
                  <th>
                    <span className="sr-only">Research page</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link className="asset-cell" href={"/assets/" + a.id}>
                        <span className="asset-monogram">
                          {a.code.slice(0, 2)}
                        </span>
                        <span>
                          <strong>{a.code}</strong>
                          <small>
                            {a.project_name || "Project not yet verified"}
                          </small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Badge status={a.match_status} />
                      {a.match_status === "unresolved" && (
                        <small className="candidate-count">
                          {a.candidates.length
                            ? `${a.candidates.length} candidate${a.candidates.length === 1 ? "" : "s"}`
                            : "No candidates indexed"}
                        </small>
                      )}
                    </td>
                    <td>{number(a.pair_count)}</td>
                    <td>
                      <span
                        className={a.active_pairs ? "active-text" : "muted"}
                      >
                        {number(a.active_pairs)}
                      </span>
                    </td>
                    <td className="small muted">{date(a.last_seen)}</td>
                    <td>
                      <Link
                        href={"/assets/" + a.id}
                        className="icon-link"
                        aria-label={"Research " + a.code}
                      >
                        <ArrowUpRight size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>
              {number(data.total)} assets · Page {page} of{" "}
              {Math.ceil(data.total / 50)}
            </span>
            <div>
              <button
                className="icon-button"
                aria-label="Previous page"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Next page"
                disabled={page * 50 >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <Empty
          icon={unresolved ? ShieldCheck : Database}
          title={
            search
              ? "No matching assets"
              : unresolved
                ? "No unresolved assets in this view"
                : "Your asset universe is waiting"
          }
          action="View data pipeline"
          onAction={openSync}
        >
          {search
            ? "Try a different ticker or project name."
            : "The collector uses actual Binance responses. Empty data is shown honestly until a successful extraction."}
        </Empty>
      )}
      <div className="panel-footnote">
        <ShieldCheck size={14} />
        Assets are exchange observations, not automatically unique projects or
        independent businesses.
      </div>
    </section>
  );
}

function OpportunityList({
  items,
  onEdit,
}: {
  items: Opportunity[];
  onEdit: (item: Opportunity) => void;
}) {
  return items.length ? (
    <div className="opportunity-grid">
      {items.map((o) => (
        <article className="panel opportunity-card" key={o.id}>
          <div className="section-head">
            <Badge status={o.stage} />
            <Lightbulb size={19} />
          </div>
          <h2>{o.title}</h2>
          {o.entity_name && (
            <p className="small muted">Research subject: {o.entity_name}</p>
          )}
          <dl>
            <dt>THE FRICTION</dt>
            <dd>{o.friction}</dd>
            <dt>HOW I MIGHT HELP</dt>
            <dd>{o.proposed_solution}</dd>
            <dt>WHO NEEDS IT</dt>
            <dd>{o.buyer}</dd>
          </dl>
          <div className="next-step">
            <span className="eyebrow">NEXT RESEARCH STEP</span>
            <p>{o.next_step}</p>
          </div>
          <button className="text-button" onClick={() => onEdit(o)}>
            Continue investigating
            <ArrowUpRight size={15} />
          </button>
        </article>
      ))}
    </div>
  ) : (
    <section className="panel">
      <Empty icon={Lightbulb} title="Keep a notebook of possibilities">
        Look for repeated consumption, expensive workarounds, missing
        distribution, or a dependency you could supply. Record your idea with a
        next research step.
      </Empty>
    </section>
  );
}
function Relationships({
  items,
  onAdd,
}: {
  items: Relationship[];
  onAdd?: () => void;
}) {
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Economic relationships</h2>
          <p>Mutual value, explicit uncertainty.</p>
        </div>
        <span className="count-pill">{items.length} connections</span>
      </div>
      {items.length ? (
        <div className="relationships-list">
          {items.map((r) => (
            <article className="relationship-card" key={r.id}>
              <div className="relationship-top">
                <span className="eyebrow">{r.type}</span>
                <Badge status={r.status} />
              </div>
              <div className="relationship-actors">
                <EntityLink id={r.a_id} name={r.a_name} />
                <ArrowRight size={22} />
                <EntityLink id={r.b_id} name={r.b_name} />
              </div>
              <p className="relationship-reason">{r.reason}</p>
              <div className="exchange-grid">
                <div>
                  <span className="eyebrow">{r.a_name} PROVIDES</span>
                  <p>{r.a_provides}</p>
                  <small>Receives: {r.a_value}</small>
                </div>
                <div>
                  <span className="eyebrow">{r.b_name} PROVIDES</span>
                  <p>{r.b_provides}</p>
                  <small>Receives: {r.b_value}</small>
                </div>
              </div>
              <div className="relationship-meta">
                <span>
                  Money changes hands: <strong>{r.money}</strong>
                </span>
                <span>Observed {date(r.observed_at)}</span>
                {r.announcement_date && (
                  <span>Announced {date(r.announcement_date)}</span>
                )}
              </div>
              {r.evidence.length ? (
                r.evidence.map((e) => (
                  <details className="relationship-evidence" key={e.id}>
                    <summary>Evidence: {e.title}</summary>
                    <SourceLink url={e.url}>Original source</SourceLink>
                    <blockquote>{e.original_text}</blockquote>
                    <p>{e.interpretation}</p>
                  </details>
                ))
              ) : (
                <p className="small muted">
                  No evidence attached · remains unverified
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={Network}
          title="Understand the connection before naming it"
          action={onAdd ? "Record a relationship" : undefined}
          onAction={onAdd}
        >
          Document what each business gives and receives. Leave payment unknown
          until you have specific evidence.
        </Empty>
      )}
    </section>
  );
}

const flowKeys = [
  "actor",
  "want",
  "behaviour",
  "problem",
  "provider",
  "transaction",
  "value",
  "next_actor",
];
const flowLabels = [
  "Actor",
  "Want",
  "Behaviour",
  "Problem",
  "Provider",
  "Transaction",
  "Value",
  "Next actor",
];
function EconomicFlow({ detail }: { detail: Detail }) {
  return (
    <div className="flow-track">
      {flowKeys.map((key, index) => {
        const claim = detail.claims.find((c) => c.field === key);
        return (
          <div className="flow-unit" key={key}>
            <div className={"flow-node " + (claim ? "has-finding" : "")}>
              <span className="flow-index">0{index + 1}</span>
              <h3>{flowLabels[index]}</h3>
              {claim ? (
                <>
                  {claim.proposal_origin && (
                    <p className="notice illustrative">
                      Human-reviewed imported suggestion · declared provider{" "}
                      {claim.proposal_origin.provider} /{" "}
                      {claim.proposal_origin.model}. Reported confidence{" "}
                      {claim.proposal_origin.confidence}; still a research
                      hypothesis.
                    </p>
                  )}
                  <p>{claim.statement}</p>
                  <Badge status={claim.status} />
                  <SourceLink url={claim.evidence_url}>Evidence</SourceLink>
                </>
              ) : (
                <p className="unknown-label">Not researched yet</p>
              )}
            </div>
            {index < 7 && <ArrowRight className="flow-arrow" size={19} />}
          </div>
        );
      })}
    </div>
  );
}
function FlowExplorer({ overview }: { overview: Overview }) {
  const [id, setId] = useState(""),
    [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    setDetail(null);
    setError("");
    if (id)
      api<Detail>("detail", { id })
        .then((d) => {
          if (alive) setDetail(d);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    return () => {
      alive = false;
    };
  }, [id]);
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Trace the economic flow</h2>
          <p>
            Each step is a separate research finding, with its own certainty and
            evidence.
          </p>
        </div>
        <select
          aria-label="Select flow subject"
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          <option value="">Choose a research subject</option>
          {overview.entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} · {e.kind}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="notice error">{error}</p>}
      {detail ? (
        <>
          <EconomicFlow detail={detail} />
          <div className="panel-footnote">
            Add Actor, Want, Behaviour, Problem, Provider, Transaction, Value
            and Next actor findings on the research desk.
          </div>
        </>
      ) : (
        <Empty icon={GitBranch} title="Start with an actor and a want">
          Choose a researched asset, product, or organisation. Unresearched
          steps stay empty, rather than being filled with generic explanations.
        </Empty>
      )}
    </section>
  );
}
function ClaimCard({ claim }: { claim: Claim }) {
  return (
    <article className="claim-card">
      <div>
        <Badge status={claim.status} />
        <span className="small muted">{date(claim.observed_at)}</span>
      </div>
      {claim.proposal_origin && (
        <p className="notice illustrative">
          Human-reviewed imported suggestion · declared provider{" "}
          {claim.proposal_origin.provider} / {claim.proposal_origin.model}.
          Reported confidence {claim.proposal_origin.confidence}; still a
          research hypothesis.
        </p>
      )}
      <p>{claim.statement}</p>
      {claim.evidence_url ? (
        <details>
          <summary>{claim.evidence_title || "View evidence"}</summary>
          <SourceLink url={claim.evidence_url}>Original source</SourceLink>
          <blockquote>{claim.original_text}</blockquote>
          {claim.interpretation && (
            <p className="interpretation">
              Interpretation: {claim.interpretation}
            </p>
          )}
        </details>
      ) : (
        <span className="small muted">No source attached</span>
      )}
    </article>
  );
}
function DetailPage({
  detail: d,
  overview,
  onSaved,
}: {
  detail: Detail;
  overview: Overview;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState(
      typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("tab") === "research"
        ? "research"
        : d.kind === "asset"
          ? "research"
          : "business anatomy",
    ),
    [resolveError, setResolveError] = useState("");
  const tabs = [
    "research",
    "business anatomy",
    "economic flow",
    "connections",
    ...(d.asset ? ["listings", "identity"] : []),
    "workspace",
  ];
  const profile = d.identity?.profile;
  const links = (profile?.links || {}) as {
    homepage?: string[];
    twitter_screen_name?: string;
    subreddit_url?: string;
    repos_url?: Record<string, string[]>;
    telegram_channel_identifier?: string;
    chat_url?: string[];
    official_forum_url?: string[];
    facebook_username?: string;
  };
  const desc = (profile?.description || {}) as { en?: string };
  async function unresolve() {
    try {
      await api("unresolve", { asset_id: d.id });
      onSaved();
    } catch (e) {
      setResolveError((e as Error).message);
    }
  }
  return (
    <>
      <div className="detail-summary panel">
        <span className="detail-monogram">
          {d.asset?.code.slice(0, 3) || <Globe size={27} />}
        </span>
        <div>
          <div className="detail-title">
            <h2>{d.name}</h2>
            <span className="count-pill">{d.kind}</span>
            <Link
              className="text-button"
              href={`${d.kind === "asset" ? "/assets/" : "/businesses/"}${d.id}/anatomy`}
            >
              Open Business Anatomy
              <ArrowUpRight size={14} />
            </Link>
            {d.asset && <Badge status={d.asset.match_status} />}
          </div>
          <p>
            {d.asset
              ? `${d.asset.exchange.toUpperCase()} · ${d.listings?.length || 0} observed trading pairs`
              : "A researcher-created record. Claims and connections carry their own evidence."}
          </p>
        </div>
        <div className="detail-summary-right">
          <span className="eyebrow">RESEARCH COVERAGE</span>
          <strong>
            {
              Object.keys(researchFields).filter((f) =>
                d.claims.some((c) => c.field === f),
              ).length
            }
            <small> / {Object.keys(researchFields).length} questions</small>
          </strong>
        </div>
      </div>
      <div className="detail-tabs">
        {tabs.map((t) => (
          <button
            key={t}
            className={tab === t ? "selected" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "business anatomy" &&
        (d.kind === "asset" ? (
          <AssetAnatomy assetId={d.id} />
        ) : (
          <Anatomy
            overview={overview}
            initialEntityId={d.id}
            onSaved={onSaved}
          />
        ))}
      {tab === "research" && (
        <>
          {d.kind === "product" && (
            <section className="panel">
              <div className="section-head">
                <div>
                  <span className="eyebrow">BUSINESS ACTIVITIES</span>
                  <h2>What this product enables</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => setTab("workspace")}
                >
                  Record an activity
                  <Plus size={15} />
                </button>
              </div>
              {d.activities.length ? (
                d.activities.map((a) => (
                  <article className="claim-card" key={a.id}>
                    <div>
                      <h3>{a.name}</h3>
                      <Badge status={a.status} />
                    </div>
                    <p>{a.enables}</p>
                    <p className="small">Actor: {a.actor}</p>
                    <SourceLink url={a.evidence_url}>
                      {a.evidence_title || "Evidence"}
                    </SourceLink>
                    <p className="small muted">
                      Observed {date(a.observed_at)}
                    </p>
                  </article>
                ))
              ) : (
                <p className="muted small">
                  No activities recorded. Describe what an actor can do because
                  this product exists.
                </p>
              )}
            </section>
          )}
          <section className="panel plain-language">
            <div className="section-head">
              <div>
                <span className="eyebrow">START WITH THE BUSINESS</span>
                <h2>What does it actually do?</h2>
              </div>
              <button
                className="text-button"
                onClick={() => setTab("workspace")}
              >
                Add a finding
                <Plus size={15} />
              </button>
            </div>
            {d.claims.some((c) => c.field === "what_it_does") ? (
              d.claims
                .filter((c) => c.field === "what_it_does")
                .map((c) => <ClaimCard key={c.id} claim={c} />)
            ) : (
              <div className="unknown-block">
                <HelpCircle size={20} />
                <div>
                  <strong>Not established yet.</strong>
                  <p>
                    Research the actual product, who needs it, and how it
                    creates value. A listing or token description is not
                    business verification.
                  </p>
                </div>
              </div>
            )}
          </section>
          <section className="panel research-questions">
            <div className="section-head">
              <div>
                <h2>The economic research questions</h2>
                <p>Needs, behaviour, transactions, and dependencies.</p>
              </div>
              <span className="small muted">
                Newest findings first within each question
              </span>
            </div>
            {Object.entries(researchFields)
              .filter(([key]) => key !== "what_it_does")
              .map(([key, label], index) => {
                const claims = d.claims.filter((c) => c.field === key);
                return (
                  <details className="question" key={key}>
                    <summary>
                      <span className="question-number">
                        {String(index + 2).padStart(2, "0")}
                      </span>
                      <span>{label}</span>
                      {claims.length ? (
                        <span className="count-pill">
                          {claims.length} finding{claims.length > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="unresearched">Unknown</span>
                      )}
                    </summary>
                    {claims.length ? (
                      claims.map((c) => <ClaimCard key={c.id} claim={c} />)
                    ) : (
                      <p className="question-empty">
                        No finding recorded.{" "}
                        <button onClick={() => setTab("workspace")}>
                          Investigate this question
                          <ArrowRight size={13} />
                        </button>
                      </p>
                    )}
                  </details>
                );
              })}
          </section>
        </>
      )}
      {tab === "economic flow" && (
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>From desire to value</h2>
              <p>The economic story, one evidence-backed step at a time.</p>
            </div>
            <button className="text-button" onClick={() => setTab("workspace")}>
              Add flow findings
              <Plus size={15} />
            </button>
          </div>
          <EconomicFlow detail={d} />
        </section>
      )}
      {tab === "connections" && (
        <>
          <section className="panel">
            <div className="section-head">
              <div>
                <h2>Organisations, products & assets</h2>
                <p>
                  Associations are researched, never inferred from a ticker.
                </p>
              </div>
              <button
                className="text-button"
                onClick={() => setTab("workspace")}
              >
                Connect records
                <Plus size={15} />
              </button>
            </div>
            {d.links.length ? (
              <div className="entity-links">
                {d.links.map((l) => (
                  <div key={l.id}>
                    <EntityLink
                      id={l.from_id}
                      name={l.from_name}
                      kind={l.from_kind}
                    />
                    <span>
                      {l.type.replace("_", " ")}
                      <ArrowRight size={15} />
                    </span>
                    <EntityLink
                      id={l.to_id}
                      name={l.to_name}
                      kind={l.to_kind}
                    />
                    <Badge status={l.status} />
                    <SourceLink url={l.evidence_url}>Source</SourceLink>
                    <span className="small muted">
                      Observed{" "}
                      {l.observed_at
                        ? date(l.observed_at)
                        : "not recorded (legacy)"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon={Globe} title="No business connection established">
                Create distinct organisation and product records, then document
                the association and its evidence.
              </Empty>
            )}
          </section>
          <Relationships
            items={d.relationships}
            onAdd={() => setTab("workspace")}
          />
        </>
      )}
      {tab === "listings" && (
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Exchange observations</h2>
              <p>Inactive and unavailable pairs remain in the audit history.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>SYMBOL</th>
                  <th>QUOTE ASSET</th>
                  <th>EXCHANGE STATUS</th>
                  <th>SPOT ALLOWED</th>
                  <th>AVAILABILITY</th>
                  <th>LAST OBSERVED</th>
                </tr>
              </thead>
              <tbody>
                {d.listings?.map((l) => (
                  <tr key={l.exchange + l.symbol}>
                    <td>
                      <strong>{l.symbol}</strong>
                      <small className="candidate-count">{l.exchange}</small>
                    </td>
                    <td>{l.quote_asset}</td>
                    <td>{l.status}</td>
                    <td>{l.spot_allowed ? "Yes" : "No"}</td>
                    <td>
                      <span className={l.available ? "active-text" : "muted"}>
                        {l.available ? "Present" : "Unavailable"}
                      </span>
                    </td>
                    <td className="small muted">{date(l.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === "identity" && (
        <>
          <section className="panel">
            <div className="section-head">
              <div>
                <h2>Project identity</h2>
                <p>
                  CoinGecko is a metadata source. It does not establish the
                  operating business.
                </p>
              </div>
              {d.asset && <Badge status={d.asset.match_status} />}
            </div>
            {d.identity ? (
              <div className="identity-profile">
                <dl className="metadata-grid">
                  <div>
                    <dt>COINGECKO ID</dt>
                    <dd>{d.identity.id}</dd>
                  </div>
                  <div>
                    <dt>PROJECT NAME</dt>
                    <dd>{d.identity.name}</dd>
                  </div>
                  <div>
                    <dt>TICKER</dt>
                    <dd>{d.identity.ticker}</dd>
                  </div>
                  <div>
                    <dt>ENRICHED AT</dt>
                    <dd>{date(d.identity.enriched_at)}</dd>
                  </div>
                </dl>
                {d.identity_evidence && (
                  <details className="source-description">
                    <summary>
                      Identity approval evidence · {d.identity_evidence.title}
                    </summary>
                    <SourceLink url={d.identity_evidence.url}>
                      Original identity source
                    </SourceLink>
                    <blockquote>{d.identity_evidence.original_text}</blockquote>
                    <p>{d.identity_evidence.interpretation}</p>
                    <span className="small muted">
                      Source observed {date(d.identity_evidence.observed_at)}
                    </span>
                  </details>
                )}
                {!!d.identity_reviews?.length && (
                  <details className="source-description">
                    <summary>Identity review history</summary>
                    {d.identity_reviews.map((r) => (
                      <p key={r.id}>
                        {r.action.replaceAll("_", " ")} ·{" "}
                        {r.identity_id || "unknown identity"} ·{" "}
                        {date(r.reviewed_at)}
                      </p>
                    ))}
                  </details>
                )}
                <SourceLink url={d.identity.source_url}>
                  Metadata source
                </SourceLink>
                {desc.en && (
                  <div className="source-description">
                    <h3>Source-provided description</h3>
                    <p>{desc.en.replace(/<[^>]+>/g, "")}</p>
                    <span className="small muted">
                      Imported text, not verified economic research.
                    </span>
                  </div>
                )}
                {!profile && (
                  <p className="notice subtle">
                    Identity verified. Profile not collected yet. Run: python -m
                    terminal enrich
                  </p>
                )}
                <h3>Websites & developer links</h3>
                <div className="profile-links">
                  {links.homepage?.filter(Boolean).map((url) => (
                    <SourceLink key={url} url={url}>
                      {url}
                    </SourceLink>
                  ))}
                  {links.twitter_screen_name && (
                    <SourceLink
                      url={
                        "https://x.com/" +
                        encodeURIComponent(links.twitter_screen_name)
                      }
                    >
                      X / Twitter · {links.twitter_screen_name}
                    </SourceLink>
                  )}
                  {links.subreddit_url && (
                    <SourceLink url={links.subreddit_url}>Reddit</SourceLink>
                  )}
                  {links.telegram_channel_identifier && (
                    <SourceLink
                      url={
                        "https://t.me/" +
                        encodeURIComponent(links.telegram_channel_identifier)
                      }
                    >
                      Telegram
                    </SourceLink>
                  )}
                  {Object.values(links.repos_url || {})
                    .flat()
                    .filter(Boolean)
                    .map((url) => (
                      <SourceLink key={url} url={url}>
                        {url}
                      </SourceLink>
                    ))}
                  {[
                    ...(links.chat_url || []),
                    ...(links.official_forum_url || []),
                  ]
                    .filter(Boolean)
                    .map((url) => (
                      <SourceLink key={url} url={url}>
                        {url}
                      </SourceLink>
                    ))}
                </div>
                <h3>Researcher-verified contract addresses</h3>
                {d.verified_contracts?.length ? (
                  <div className="contracts">
                    {d.verified_contracts.map((c) => (
                      <details key={c.id}>
                        <summary>
                          {c.network} · {c.address}
                        </summary>
                        <Badge status="confirmed" />
                        <SourceLink url={c.evidence_url}>
                          {c.evidence_title}
                        </SourceLink>
                        <blockquote>{c.original_text}</blockquote>
                        <p className="small muted">
                          Observed {date(c.observed_at)}
                        </p>
                      </details>
                    ))}
                  </div>
                ) : (
                  <p className="small muted">
                    No contract addresses independently verified in your
                    research. Use “Verify contract” on the research desk.
                  </p>
                )}
                <h3>Source-reported networks & addresses</h3>
                <p className="small muted">
                  CoinGecko-reported identifiers. Verify against official
                  documentation and chain data before treating them as
                  confirmed.
                </p>
                <div className="contracts">
                  {Object.entries(d.identity.platforms)
                    .filter(([, address]) => address)
                    .map(([network, address]) => (
                      <div key={network}>
                        <strong>{network}</strong>
                        <code>{address}</code>
                      </div>
                    ))}
                  {!Object.values(d.identity.platforms).some(Boolean) && (
                    <p className="small muted">
                      No contract addresses supplied. This can be a native asset
                      or missing metadata.
                    </p>
                  )}
                </div>
                {Array.isArray(profile?.categories) && (
                  <>
                    <h3>Source categories</h3>
                    <div className="tags">
                      {profile.categories.map((c, i) => (
                        <span key={i}>{String(c)}</span>
                      ))}
                    </div>
                  </>
                )}
                {Array.isArray(profile?.tickers) && (
                  <details className="source-description">
                    <summary>
                      Available exchange metadata · {profile.tickers.length}{" "}
                      source tickers
                    </summary>
                    <p className="small muted">
                      CoinGecko’s detail endpoint provides a paginated subset.
                      This is not an exhaustive exchange-listing dataset.
                    </p>
                    <pre>{JSON.stringify(profile.tickers, null, 2)}</pre>
                  </details>
                )}
                <button
                  className="button secondary"
                  onClick={() => void unresolve()}
                >
                  Return identity to unresolved
                </button>
                {resolveError && (
                  <p role="alert" className="notice error">
                    {resolveError}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="notice subtle">
                  <ShieldCheck size={18} />
                  <span>
                    No confident identity match recorded. Even a single ticker
                    candidate needs independent verification.
                  </span>
                </div>
                {d.asset?.candidates.length ? (
                  <div className="candidate-list">
                    {d.asset.candidates.map((c) => (
                      <div key={c.id}>
                        <div>
                          <strong>{c.name}</strong>
                          <code>{c.id}</code>
                        </div>
                        <SourceLink
                          url={
                            "https://www.coingecko.com/en/coins/" +
                            encodeURIComponent(c.id)
                          }
                        >
                          Investigate candidate
                        </SourceLink>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    No candidates available. Run the CoinGecko candidate index
                    or investigate official identifiers manually.
                  </p>
                )}
                <button
                  className="button primary"
                  onClick={() => setTab("workspace")}
                >
                  Record identity evidence
                  <ArrowRight size={15} />
                </button>
              </>
            )}
          </section>
        </>
      )}
      {tab === "workspace" && (
        <Workspace overview={overview} subject={d.id} onSaved={onSaved} />
      )}
    </>
  );
}
function QualityPage({
  quality: q,
  openSync,
}: {
  quality: Quality;
  openSync: () => void;
}) {
  function download() {
    const blob = new Blob([JSON.stringify(q, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "crypto-business-quality-report.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="quality-banner">
        <div className="quality-icon">
          <ShieldCheck size={25} />
        </div>
        <div>
          <span className="eyebrow">
            {q.last_successful_refresh
              ? "LAST SUCCESSFUL SNAPSHOT"
              : "NO SUCCESSFUL EXTRACTION YET"}
          </span>
          <h2>
            {q.last_successful_refresh
              ? date(q.last_successful_refresh)
              : "Extraction counts are unavailable."}
          </h2>
          <p>
            {q.last_successful_refresh
              ? "A failed refresh never replaces the last good snapshot."
              : "Database counts can be zero; extraction counts stay unknown until the API returns a valid snapshot."}
          </p>
        </div>
        <button className="button secondary" onClick={openSync}>
          View pipeline
          <ArrowRight size={16} />
        </button>
      </div>
      <div className="stats-grid quality-stats">
        {[
          ["Trading pairs retrieved", q.total_trading_pairs_retrieved],
          ["Unique base assets", q.unique_base_assets],
          ["Verified CoinGecko matches", q.matched_coingecko_assets],
          ["Unresolved identities", q.unresolved_assets],
          ["Ambiguous identifiers", q.ambiguous_identifiers],
          ["Duplicate symbols in snapshot", q.duplicate_symbols],
          ["Failed API requests", q.failed_api_requests],
          ["Enriched assets", q.enriched_assets],
          ["Active trading pairs", q.active_pairs],
          ["Inactive observed pairs", q.inactive_pairs],
          ["Unavailable historical pairs", q.unavailable_pairs],
          ["Ticker candidates only", q.candidate_only_assets],
        ].map(([label, value]) => (
          <div className="stat-card" key={String(label)}>
            <div>
              <span>{label}</span>
            </div>
            <strong>{number(value as number | null)}</strong>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Latest extraction attempt</h2>
            <p>API failures remain visible in the audit trail.</p>
          </div>
          <button className="button secondary" onClick={download}>
            <ArrowDown size={15} />
            Download report
          </button>
        </div>
        {q.latest_attempt ? (
          <div className="attempt">
            <Badge status={q.latest_attempt.status} />
            <span className="small muted">
              {date(q.latest_attempt.started_at)}
            </span>
            {q.latest_attempt.error && (
              <p className="notice error">{q.latest_attempt.error}</p>
            )}
            {q.latest_attempt.sha256 && (
              <p className="hash">
                Response SHA-256: {q.latest_attempt.sha256}
              </p>
            )}
          </div>
        ) : (
          <p className="muted">No collector run recorded yet.</p>
        )}
        {q.recent_failures.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>REQUEST</th>
                  <th>STATUS</th>
                  <th>OBSERVED</th>
                  <th>FAILURE</th>
                </tr>
              </thead>
              <tbody>
                {q.recent_failures.map((r, i) => (
                  <tr key={i}>
                    <td className="small wrap">{r.url}</td>
                    <td>{r.status || "Transport"}</td>
                    <td className="small">{date(r.observed_at)}</td>
                    <td className="small wrap">{r.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Identifier collisions</h2>
            <p>
              Shared tickers do not collapse identities. Verified CoinGecko IDs
              can link exchange observations.
            </p>
          </div>
        </div>
        <p>
          {q.duplicate_coingecko_tickers.length} duplicated CoinGecko tickers ·{" "}
          {q.shared_verified_identities.length} shared verified identities
        </p>
        {q.duplicate_coingecko_tickers.length > 0 && (
          <details>
            <summary>Inspect duplicated tickers</summary>
            <pre>{JSON.stringify(q.duplicate_coingecko_tickers, null, 2)}</pre>
          </details>
        )}
        <dl className="definitions">
          {Object.entries(q.definitions).map(([key, value]) => (
            <div key={key}>
              <dt>{key.replaceAll("_", " ")}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
