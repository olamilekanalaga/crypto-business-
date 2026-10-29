"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  Database,
  ExternalLink,
  GitBranch,
  Layers3,
  Lightbulb,
  Menu,
  Network,
  Pause,
  Play,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Wallet,
  Waypoints,
  X,
} from "lucide-react";
import styles from "./OpportunityAtlas.module.css";

type Tab = "flow" | "needs" | "opportunity";
const tabs: { id: Tab; label: string; icon: typeof Network }[] = [
  { id: "flow", label: "Value flow", icon: Waypoints },
  { id: "needs", label: "Business needs", icon: Layers3 },
  { id: "opportunity", label: "Your opportunity", icon: Lightbulb },
];
const stages = [
  {
    short: "Existing product",
    title: "A position already has value.",
    label: "01 / THE STARTING POINT",
    icon: Layers3,
    description:
      "In this research case, a depositor receives PST for a position in Huma’s financing pool. The starting point is an asset people already hold.",
    actor: "PST holder",
    want: "Keep the financing position and access liquidity.",
    question: "Who holds PST, and how many holders actually want to borrow?",
  },
  {
    short: "Complementary capability",
    title: "Another business supplies a missing use.",
    label: "02 / THE CONNECTION",
    icon: GitBranch,
    description:
      "Kamino supplies lending infrastructure. Accepting an eligible asset as collateral could let its holder borrow against the position.",
    actor: "Lending venue",
    want: "Serve borrowing demand with suitable collateral and lender liquidity.",
    question:
      "Are collateral eligibility, reliable pricing and liquidation arrangements in place?",
  },
  {
    short: "New behaviour",
    title: "The holder gets another choice.",
    label: "03 / THE CHANGE IN BEHAVIOUR",
    icon: Wallet,
    description:
      "A holder may supply PST as collateral and borrow stablecoins while retaining the underlying position. Borrowing adds interest costs and liquidation risk.",
    actor: "Borrower",
    want: "Access funds without first exiting the entire position.",
    question:
      "Does this solve a meaningful problem after borrowing costs and risk?",
  },
  {
    short: "Economic activity",
    title: "A new use can create new transactions.",
    label: "04 / THE VALUE CREATED",
    icon: Waypoints,
    description:
      "The connection could create collateral usage, borrowing demand, lending interest and additional asset utility. Each benefit needs measurement and attribution.",
    actor: "Both businesses",
    want: "Useful adoption and sustainable economic activity.",
    question:
      "How much activity is new, and what revenue remains after incentives and costs?",
  },
  {
    short: "Your participation",
    title: "Your role needs an agreement.",
    label: "05 / YOUR COMMERCIAL HYPOTHESIS",
    icon: BadgeDollarSign,
    description:
      "You could research the fit, introduce the teams and help define an integration. Compensation depends on a negotiated scope, attribution and payment agreement.",
    actor: "You, as facilitator",
    want: "A contractual share of the value you help create.",
    question:
      "Who would pay, for which deliverables, over what period and against which results?",
  },
];
const dependencies = [
  {
    title: "An asset people hold",
    subtitle: "A useful starting point",
    icon: Layers3,
    description:
      "Establish holder demand, transferability, redemption terms and the asset’s underlying economics.",
    owner: "Asset provider",
  },
  {
    title: "A borrowing venue",
    subtitle: "A complementary capability",
    icon: GitBranch,
    description:
      "Confirm collateral eligibility, market configuration, integration work and commercial interest.",
    owner: "Lending provider",
  },
  {
    title: "Liquidity & pricing",
    subtitle: "Essential operating needs",
    icon: Wallet,
    description:
      "Investigate lender supply, reliable oracle prices, risk limits and a viable liquidation path.",
    owner: "Supporting businesses",
  },
  {
    title: "A reason to return",
    subtitle: "Sustainable demand",
    icon: Network,
    description:
      "Check whether the use remains attractive after rates, incentives, withdrawal limits and risk.",
    owner: "Customers",
  },
];

export default function OpportunityAtlas({
  hosted = false,
}: {
  hosted?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("flow");
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [netRevenue, setNetRevenue] = useState("100000");
  const [share, setShare] = useState("10");
  const [checked, setChecked] = useState<string[]>([]);
  const panelId = useId();
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
      }
      if (event.key !== "Tab") return;
      const items = sidebarRef.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not(:disabled)",
      );
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      menuButtonRef.current?.focus();
    };
  }, [menuOpen]);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(query.matches);
      if (query.matches) setPlaying(false);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!playing || reducedMotion || tab !== "flow") return;
    const timer = window.setInterval(
      () => setStage((current) => (current + 1) % stages.length),
      6500,
    );
    return () => window.clearInterval(timer);
  }, [playing, reducedMotion, tab]);
  function selectTab(value: Tab) {
    setTab(value);
    setMenuOpen(false);
    setPlaying(false);
  }
  function selectStage(value: number) {
    setStage(value);
    setPlaying(false);
  }
  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    selectTab(tabs[next].id);
    document.getElementById(`${panelId}-${tabs[next].id}`)?.focus();
  }
  const current = stages[stage];
  const CurrentIcon = current.icon;
  const annualRevenue = Number(netRevenue);
  const percent = Number(share);
  const validCalculation =
    netRevenue !== "" &&
    share !== "" &&
    Number.isFinite(annualRevenue) &&
    annualRevenue >= 0 &&
    Number.isFinite(percent) &&
    percent >= 0 &&
    percent <= 100;
  const rawCompensation = validCalculation
    ? annualRevenue * (percent / 100)
    : NaN;
  const compensation = Number.isFinite(rawCompensation)
    ? rawCompensation
    : null;
  const money = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <div className={styles.shell}>
      {menuOpen && (
        <button
          className={styles.overlay}
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}
        aria-label="Primary navigation"
      >
        <Link className={styles.brand} href="/" aria-label="BD Oracle home">
          <span className={styles.brandMark}>
            <Waypoints size={25} strokeWidth={1.6} />
          </span>
          <span>
            BD <strong>Oracle</strong>
            <small>CŘYPTÔ BUSINESS</small>
          </span>
        </Link>
        <button
          ref={closeButtonRef}
          className={styles.closeMenu}
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        >
          <X size={21} />
        </button>
        <div className={styles.railLabel}>YOUR ECONOMIC LENS</div>
        <nav className={styles.nav}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? styles.navActive : ""}
              onClick={() => selectTab(id)}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
              {tab === id && <span className={styles.activeDot} />}
            </button>
          ))}
        </nav>
        <div className={styles.railRule} />
        <div className={styles.railLabel}>THE RESEARCH FOUNDATION</div>
        <div className={styles.foundation}>
          <span>
            <Link href="/discover">
              <ScanLine size={16} /> Discover Binance assets ↗
            </Link>
          </span>
          <ChevronRight size={13} />
          <span>
            <Network size={16} /> Understand businesses
          </span>
          <ChevronRight size={13} />
          <span>
            <Lightbulb size={16} /> Investigate connections
          </span>
        </div>
        {!hosted && (
          <Link href="/research" className={styles.workspaceLink}>
            <BookOpen size={17} /> Open research terminal{" "}
            <ArrowUpRight size={15} />
          </Link>
        )}
        {hosted && (
          <Link href="/discover" className={styles.workspaceLink}>
            <Database size={17} /> Open browser workspace{" "}
            <ArrowUpRight size={15} />
          </Link>
        )}
        <div className={styles.railBottom}>
          <span className={styles.smallOrb} />
          <div>
            <strong>A personal research instrument</strong>
            <p>
              Follow the need.
              <br />
              Understand the exchange.
            </p>
          </div>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div>
            <button
              ref={menuButtonRef}
              className={styles.menuToggle}
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <Compass size={16} />
            <span>Opportunity atlas</span>
            <ChevronRight size={13} />
            <strong>Asset utility expansion</strong>
          </div>
          <span className={styles.previewBadge}>
            <span /> Concept preview
          </span>
        </header>
        <main className={styles.content}>
          <section className={styles.intro}>
            <div>
              <span className={styles.eyebrow}>
                <span /> FOLLOW THE ECONOMIC POSSIBILITY
              </span>
              <h1>
                See what a connection
                <br />
                makes <em>possible.</em>
              </h1>
              <p>
                Two existing products. A useful new behaviour.
                <br className={styles.desktopBreak} /> A business opportunity
                worth investigating.
              </p>
            </div>
            <div className={styles.introNote}>
              <span className={styles.noteIcon}>
                <Sparkles size={19} />
              </span>
              <p>
                Your edge is understanding
                <br />
                <strong>
                  what becomes possible
                  <br />
                  when businesses connect.
                </strong>
              </p>
            </div>
          </section>

          <div className={styles.caseBar}>
            <div>
              <span className={styles.caseIndex}>CASE 001</span>
              <strong>
                Huma <span>×</span> Kamino
              </strong>
              <span className={styles.casePattern}>
                Asset utility expansion
              </span>
            </div>
            <span className={styles.evidenceBadge}>
              <CircleHelp size={13} /> Economic outcomes unverified
            </span>
          </div>
          <p className={styles.caseDisclosure}>
            Illustrative research case. Huma’s official documentation describes
            the PST–Kamino integration. The economic benefits and compensation
            model below remain research hypotheses.
          </p>

          <div
            className={styles.tabs}
            role="tablist"
            aria-label="Explore the opportunity"
          >
            {tabs.map(({ id, label, icon: Icon }, index) => (
              <button
                key={id}
                id={`${panelId}-${id}`}
                role="tab"
                tabIndex={tab === id ? 0 : -1}
                onKeyDown={(event) => moveTab(event, index)}
                aria-selected={tab === id}
                aria-controls={`${panelId}-panel`}
                className={tab === id ? styles.tabActive : ""}
                onClick={() => selectTab(id)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          <div
            id={`${panelId}-panel`}
            role="tabpanel"
            aria-labelledby={`${panelId}-${tab}`}
          >
            {tab === "flow" && (
              <>
                <section
                  className={styles.mapPanel}
                  aria-label="Illustrative integration value flow"
                >
                  <div className={styles.panelHeading}>
                    <div>
                      <span className={styles.eyebrow}>THE CONNECTION</span>
                      <h2>One asset. Another possibility.</h2>
                    </div>
                    <span className={styles.mapHint}>
                      <span className={styles.activeDot} /> Select a step to
                      explore
                    </span>
                  </div>
                  <div className={styles.connectionMap}>
                    <button
                      className={`${styles.businessNode} ${stage === 0 ? styles.selectedNode : ""}`}
                      onClick={() => selectStage(0)}
                      aria-label="Explore Huma's existing product"
                    >
                      <span className={`${styles.logoTile} ${styles.humaLogo}`}>
                        h<span>·</span>
                      </span>
                      <span className={styles.nodeCategory}>
                        EXISTING PRODUCT
                      </span>
                      <strong>Huma Finance</strong>
                      <p>A yield-bearing position</p>
                      <span className={styles.nodePill}>PST</span>
                      <span className={styles.nodeFoot}>
                        What people already hold <ArrowUpRight size={13} />
                      </span>
                    </button>
                    <div className={styles.bridge} aria-hidden="true">
                      <span />
                      <span className={styles.movingDot} />
                      <ArrowRight size={17} />
                    </div>
                    <button
                      className={`${styles.connectionNode} ${stage === 2 ? styles.selectedNode : ""}`}
                      onClick={() => selectStage(2)}
                      aria-label="Explore the new borrowing utility"
                    >
                      <span className={styles.connectionIcon}>
                        <GitBranch size={23} />
                      </span>
                      <small>NEW USE</small>
                      <strong>
                        Borrow against <br />
                        the position
                      </strong>
                      <p>Existing asset → borrowing utility</p>
                      <span className={styles.connectionTag}>
                        The opportunity mechanism
                      </span>
                    </button>
                    <div
                      className={`${styles.bridge} ${styles.bridgeReverse}`}
                      aria-hidden="true"
                    >
                      <span />
                      <span className={styles.movingDot} />
                      <ArrowRight size={17} />
                    </div>
                    <button
                      className={`${styles.businessNode} ${stage === 1 ? styles.selectedNode : ""}`}
                      onClick={() => selectStage(1)}
                      aria-label="Explore Kamino's complementary capability"
                    >
                      <span
                        className={`${styles.logoTile} ${styles.kaminoLogo}`}
                      >
                        K<ArrowUpRight size={17} aria-hidden="true" />
                      </span>
                      <span className={styles.nodeCategory}>
                        COMPLEMENTARY CAPABILITY
                      </span>
                      <strong>Kamino Finance</strong>
                      <p>Collateralised lending</p>
                      <span className={styles.nodePill}>
                        Borrowing infrastructure
                      </span>
                      <span className={styles.nodeFoot}>
                        What another business enables <ArrowUpRight size={13} />
                      </span>
                    </button>
                  </div>
                  <div className={styles.valueSplit}>
                    <div>
                      <span>VALUE TO THE ASSET PROVIDER</span>
                      <p>More ways for holders to use their position.</p>
                    </div>
                    <div className={styles.valueSplitIcon}>
                      <Waypoints size={22} />
                    </div>
                    <div>
                      <span>VALUE TO THE LENDING VENUE</span>
                      <p>Potential demand for a new borrowing market.</p>
                    </div>
                  </div>
                </section>

                <section
                  className={styles.storySection}
                  aria-label="Step through the economic mechanism"
                >
                  <div className={styles.storyHeading}>
                    <h2>Follow the chain of value</h2>
                    <button
                      className={styles.playButton}
                      onClick={() => setPlaying((value) => !value)}
                      disabled={reducedMotion}
                      aria-label={
                        playing ? "Pause walkthrough" : "Play walkthrough"
                      }
                    >
                      {playing ? <Pause size={14} /> : <Play size={14} />}
                      {playing ? "Pause walkthrough" : "Play walkthrough"}
                    </button>
                  </div>
                  {reducedMotion && (
                    <p className={styles.motionNote}>
                      Reduced motion is on. Select each step to explore at your
                      pace.
                    </p>
                  )}
                  <div className={styles.steps}>
                    {stages.map((item, index) => (
                      <button
                        key={item.short}
                        className={`${styles.step} ${stage === index ? styles.stepActive : ""}`}
                        onClick={() => selectStage(index)}
                        aria-pressed={stage === index}
                      >
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <strong>{item.short}</strong>
                        {index !== stages.length - 1 && (
                          <ArrowRight size={14} />
                        )}
                      </button>
                    ))}
                  </div>
                  <div
                    key={stage}
                    className={styles.explanation}
                    aria-live={playing ? "off" : "polite"}
                  >
                    <div className={styles.explanationIcon}>
                      <CurrentIcon size={24} />
                    </div>
                    <div className={styles.explanationBody}>
                      <span className={styles.eyebrow}>{current.label}</span>
                      <h3>{current.title}</h3>
                      <p>{current.description}</p>
                      <div className={styles.actorWant}>
                        <span>
                          <strong>Actor</strong> {current.actor}
                        </span>
                        <span>
                          <strong>Want</strong> {current.want}
                        </span>
                      </div>
                    </div>
                    <div className={styles.researchQuestion}>
                      <CircleHelp size={17} />
                      <span>THE NEXT QUESTION</span>
                      <p>{current.question}</p>
                    </div>
                  </div>
                </section>

                <section
                  className={styles.beforeAfter}
                  aria-label="How the behaviour changes"
                >
                  <div>
                    <span className={styles.eyebrow}>
                      BEFORE THE CONNECTION
                    </span>
                    <h3>
                      “I have a position.
                      <br />I also need liquidity.”
                    </h3>
                    <p>
                      The holder may need to exit or sell part of the position
                      to access funds.
                    </p>
                  </div>
                  <span className={styles.beforeArrow}>
                    <ArrowRight size={22} />
                  </span>
                  <div>
                    <span className={styles.eyebrow}>
                      WITH A SUITABLE INTEGRATION
                    </span>
                    <h3>
                      “Could I borrow against
                      <br />
                      what I already hold?”
                    </h3>
                    <p>
                      Another choice becomes possible, subject to eligibility,
                      interest costs and liquidation risk.
                    </p>
                  </div>
                  <button
                    className={styles.primaryButton}
                    onClick={() => selectTab("needs")}
                  >
                    What makes this work? <ArrowRight size={16} />
                  </button>
                </section>
              </>
            )}

            {tab === "needs" && (
              <section className={styles.needsPanel}>
                <div className={styles.sectionIntro}>
                  <span className={styles.eyebrow}>BUSINESS ANATOMY</span>
                  <h2>
                    A connection needs more
                    <br />
                    than two interested businesses.
                  </h2>
                  <p>
                    Use these questions to investigate whether the mechanism can
                    work. They are a research framework, not verified
                    dependencies for this case.
                  </p>
                </div>
                <div className={styles.needsGrid}>
                  {dependencies.map(
                    (
                      { title, subtitle, icon: Icon, description, owner },
                      index,
                    ) => (
                      <article key={title} className={styles.needCard}>
                        <div>
                          <span className={styles.needIcon}>
                            <Icon size={23} />
                          </span>
                          <span className={styles.needNumber}>
                            0{index + 1}
                          </span>
                        </div>
                        <span className={styles.eyebrow}>{subtitle}</span>
                        <h3>{title}</h3>
                        <p>{description}</p>
                        <span className={styles.ownerLabel}>{owner}</span>
                      </article>
                    ),
                  )}
                </div>
                <div className={styles.measurePanel}>
                  <div>
                    <span className={styles.eyebrow}>
                      MEASURE THE RIGHT THING
                    </span>
                    <h3>
                      Capital is a starting signal.
                      <br />
                      Follow it through to value.
                    </h3>
                    <p>
                      A large collateral balance alone does not establish new
                      users, borrowing or profit.
                    </p>
                  </div>
                  <ol>
                    {[
                      {
                        label: "Capacity",
                        text: "How much the market allows.",
                      },
                      {
                        label: "Deposited collateral",
                        text: "How much has actually been supplied.",
                      },
                      {
                        label: "Outstanding borrowing",
                        text: "How much is being borrowed.",
                      },
                      {
                        label: "Attributed net revenue",
                        text: "What remains from incremental activity after incentives and costs.",
                      },
                    ].map((item, index) => (
                      <li key={item.label}>
                        <span>{index + 1}</span>
                        <div>
                          <strong>{item.label}</strong>
                          <p>{item.text}</p>
                        </div>
                        {index < 3 && <ArrowDown size={15} />}
                      </li>
                    ))}
                  </ol>
                </div>
                <button
                  className={styles.primaryButton}
                  onClick={() => selectTab("opportunity")}
                >
                  Explore your role <ArrowRight size={16} />
                </button>
              </section>
            )}

            {tab === "opportunity" && (
              <section className={styles.opportunityPanel}>
                <div className={styles.sectionIntro}>
                  <span className={styles.eyebrow}>
                    YOUR PLACE IN THE EXCHANGE
                  </span>
                  <h2>
                    Turn a useful observation
                    <br />
                    into a researchable proposal.
                  </h2>
                  <p>
                    Your contribution could be finding the fit, validating the
                    demand and helping both teams agree on an economically
                    useful integration.
                  </p>
                </div>
                <div className={styles.opportunityGrid}>
                  <article className={styles.roleCard}>
                    <span className={styles.needIcon}>
                      <Lightbulb size={24} />
                    </span>
                    <h3>A possible role for you</h3>
                    <p>
                      Research the need → identify a capable provider → validate
                      the fit → facilitate agreement → measure the outcome.
                    </p>
                    <div className={styles.rolePaths}>
                      <span>Integration research</span>
                      <span>Commercial introductions</span>
                      <span>Implementation coordination</span>
                    </div>
                    <div className={styles.hypothesisNote}>
                      <CircleHelp size={17} />
                      <p>
                        Paid integration sourcing is a commercial hypothesis. No
                        compensation agreement or market rate is established for
                        this case.
                      </p>
                    </div>
                  </article>
                  <article className={styles.calculator}>
                    <span className={styles.eyebrow}>
                      ILLUSTRATIVE COMMERCIAL MODEL
                    </span>
                    <h3>What would a revenue share mean?</h3>
                    <p>Change the assumptions to understand the arithmetic.</p>
                    <div className={styles.calcInputs}>
                      <label>
                        Attributed annual net revenue ($)
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          value={netRevenue}
                          onChange={(event) =>
                            setNetRevenue(event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Negotiated share (%)
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max="100"
                          value={share}
                          onChange={(event) => setShare(event.target.value)}
                        />
                      </label>
                    </div>
                    <div className={styles.calcResult} aria-live="polite">
                      <span>Hypothetical annual compensation</span>
                      <strong>
                        {compensation === null ? "—" : money(compensation)}
                      </strong>
                      <small>
                        {validCalculation
                          ? "An example calculation, not a forecast or agreed fee."
                          : "Enter non-negative revenue and a share between 0 and 100%."}
                      </small>
                    </div>
                    <p className={styles.calcFootnote}>
                      Use revenue attributable to your integration, after agreed
                      incentives and costs. Deposited principal is a different
                      payment base.
                    </p>
                  </article>
                </div>
                <article className={styles.checklist}>
                  <div>
                    <span className={styles.eyebrow}>
                      BEFORE YOU MAKE THE INTRODUCTION
                    </span>
                    <h3>Build the evidence behind the opportunity.</h3>
                    <p>
                      Use this temporary checklist to explore the process.
                      Selections reset when you leave or reload.
                    </p>
                  </div>
                  <div>
                    {[
                      "Verify the product and integration terms in official sources.",
                      "Find evidence that holders want this new use.",
                      "Check liquidity, pricing, risk and technical feasibility.",
                      "Agree who benefits and how incremental value is measured.",
                      "Define your scope, attribution and payment in writing.",
                    ].map((question) => (
                      <label key={question}>
                        <input
                          type="checkbox"
                          checked={checked.includes(question)}
                          onChange={(event) =>
                            setChecked((values) =>
                              event.target.checked
                                ? [...values, question]
                                : values.filter((value) => value !== question),
                            )
                          }
                        />
                        <span className={styles.checkBox}>
                          {checked.includes(question) && <Check size={14} />}
                        </span>
                        <span>{question}</span>
                      </label>
                    ))}
                  </div>
                </article>
              </section>
            )}
          </div>

          <section className={styles.evidenceStrip}>
            <ShieldCheck size={19} />
            <div>
              <strong>Good opportunities survive good questions.</strong>
              <p>
                Huma’s documentation describes using PST as collateral to borrow
                USDC or USDS. It does not establish incremental revenue or a fee
                for outside facilitators. Verify current terms, demand and
                economics before making a commercial proposal.
              </p>
              <a
                className={styles.sourceReading}
                href="https://docs.huma.finance/products/huma-2.0/integrations"
                target="_blank"
                rel="noreferrer"
              >
                Read Huma’s official integration documentation{" "}
                <ExternalLink size={12} />
              </a>
            </div>
          </section>
          <footer className={styles.footer}>
            <span>
              BD ORACLE <span>·</span> THE ECONOMY, EXPLAINED THROUGH
              CONNECTIONS.
            </span>
            <span>
              {hosted
                ? "Browser workspace available · no server storage"
                : "Illustrative case · your research terminal remains separate"}
            </span>
          </footer>
          {hosted && (
            <details className={styles.hostedDetails}>
              <summary>Where is my research workspace?</summary>
              <p>
                This hosted view lets you explore the concept. Your existing
                local research terminal retains the CEX collectors, evidence
                entry and stored business network. Public Binance discovery and
                notes are available in the browser workspace. The full SQLite
                graph remains in the local terminal.
              </p>
              <a
                href="https://github.com/olamilekanalaga/crypto-business-/blob/feat/personal-economic-intelligence-terminal/README.md#run-locally"
                target="_blank"
                rel="noreferrer"
              >
                Open the local setup guide <ExternalLink size={13} />
              </a>
            </details>
          )}
        </main>
      </div>
    </div>
  );
}
