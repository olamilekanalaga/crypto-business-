"use client";
import { useState } from "react";
import { Check, Loader2, Plus, ArrowUpRight } from "lucide-react";
import type { Overview, Opportunity } from "./types";
import { api, date } from "./api";
export const researchFields: Record<string, string> = {
  what_it_does: "What does this business actually do?",
  product_service: "What product or service does it provide?",
  customers: "Who are its customers or users?",
  actor_wants: "What does each actor want?",
  demand_behaviour: "What behaviour creates demand?",
  problem_solved: "What problem does it solve?",
  customer_exchange: "What do customers exchange?",
  payment_flow: "Who pays whom, and why?",
  revenue_model: "What is the revenue model?",
  suppliers: "Who supplies the business?",
  distribution: "Who distributes its product?",
  recurring_consumption: "What does it repeatedly consume?",
  depends_on: "Which businesses does it depend on?",
  dependents: "Which businesses depend on it?",
  new_activity: "What new economic activity emerges?",
  new_problems: "What new problems does this business create for other actors?",
};
const flowFields: Record<string, string> = {
  actor: "Actor",
  want: "Want",
  behaviour: "Behaviour",
  problem: "Problem",
  provider: "Provider",
  transaction: "Transaction",
  value: "Value",
  next_actor: "Next actor",
};
type Mode =
  | "finding"
  | "evidence"
  | "business"
  | "link"
  | "relationship"
  | "opportunity"
  | "identity"
  | "activity"
  | "contract";
export function Badge({ status }: { status: string }) {
  return (
    <span className={"badge " + status}>
      {status === "confirmed"
        ? "Confirmed fact"
        : status === "verified"
          ? "Identity verified"
          : status.replaceAll("_", " ")}
    </span>
  );
}
export default function Workspace({
  overview,
  subject,
  onSaved,
  initialMode = "finding",
  opportunity,
}: {
  overview: Overview;
  subject?: number;
  onSaved: () => void;
  initialMode?: Mode;
  opportunity?: Opportunity;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const modes: { key: Mode; label: string }[] = [
    { key: "finding", label: "Research finding" },
    { key: "evidence", label: "Source & evidence" },
    { key: "business", label: "Business / product" },
    { key: "activity", label: "Business activity" },
    { key: "link", label: "Connect records" },
    { key: "relationship", label: "Relationship" },
    { key: "opportunity", label: "Opportunity" },
    { key: "identity", label: "Verify asset identity" },
    { key: "contract", label: "Verify contract" },
  ];
  const entities = overview.entities.map((e) => ({
    value: String(e.id),
    label: `${e.name} · ${e.kind}`,
  }));
  const businesses = overview.entities
    .filter((e) => e.kind !== "asset")
    .map((e) => ({ value: String(e.id), label: `${e.name} · ${e.kind}` }));
  const evidence = [
    { value: "", label: "No evidence yet" },
    ...overview.evidence.map((e) => ({
      value: String(e.id),
      label: `#${e.id} ${e.title} · ${e.verification}`,
    })),
  ];
  const statuses = [
    { value: "hypothesis", label: "Hypothesis · needs investigation" },
    { value: "confirmed", label: "Confirmed fact · evidence required" },
    { value: "inference", label: "Reasonable inference" },
    { value: "unknown", label: "Unknown" },
  ];
  function select(
    name: string,
    label: string,
    options: { value: string; label: string }[],
    value?: string,
    optional = false,
  ) {
    return (
      <label className="field">
        {label}
        <select
          name={name}
          defaultValue={value ?? options[0]?.value}
          required={!optional}
        >
          {options.map((o) => (
            <option value={o.value} key={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  function input(
    name: string,
    label: string,
    placeholder = "",
    value = "",
    type = "text",
    optional = false,
  ) {
    return (
      <label className="field">
        {label}
        <input
          name={name}
          placeholder={placeholder}
          defaultValue={value}
          type={type}
          required={!optional}
          maxLength={name === "url" ? 2048 : 500}
        />
      </label>
    );
  }
  function area(
    name: string,
    label: string,
    placeholder = "",
    value = "",
    optional = false,
  ) {
    return (
      <label className="field full">
        {label}
        <textarea
          name={name}
          placeholder={placeholder}
          defaultValue={value}
          required={!optional}
          maxLength={20000}
          rows={3}
        />
      </label>
    );
  }
  const observation = () =>
    input(
      "observed_at",
      "Observed at (UTC)",
      "",
      new Date().toISOString().slice(0, 16),
      "datetime-local",
    );
  const withStatus = () => (
    <>
      {select("status", "How certain is this?", statuses)}
      {select("evidence_id", "Supporting evidence", evidence, undefined, true)}
      {observation()}
    </>
  );
  const modeActions: Record<Mode, string> = {
    finding: "save_claim",
    evidence: "save_evidence",
    business: "save_entity",
    link: "save_link",
    relationship: "save_relationship",
    opportunity: "save_opportunity",
    identity: "resolve",
    activity: "save_activity",
    contract: "verify_contract",
  };
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const values: Record<string, unknown> = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    for (const key of ["observed_at", "published_at", "announcement_date"])
      if (values[key])
        values[key] = new Date(String(values[key]) + "Z").toISOString();
    if (mode === "opportunity" && opportunity) values.id = opportunity.id;
    try {
      const saved = await api<{ id: number }>(modeActions[mode], values);
      setMessage(`Saved record #${saved.id}. Your research is stored locally.`);
      if (!(mode === "opportunity" && opportunity)) setVersion((v) => v + 1);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="workspace panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">YOUR RESEARCH DESK</span>
          <h2>Follow a question. Keep the evidence.</h2>
        </div>
        <span className="small muted">Stored in your local database</span>
      </div>
      <div className="form-tabs" role="tablist" aria-label="Record type">
        {modes.map((m) => (
          <button
            role="tab"
            aria-selected={mode === m.key}
            className={mode === m.key ? "selected" : ""}
            key={m.key}
            onClick={() => {
              setMode(m.key);
              setError("");
              setMessage("");
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} key={mode + version} className="research-form">
        {mode === "finding" && (
          <>
            <p className="form-help full">
              Write in simple language. Separate what a source says from what
              you think it means. New findings preserve earlier entries.
            </p>
            {select(
              "entity_id",
              "Research subject",
              entities,
              String(subject || entities[0]?.value || ""),
            )}
            {select(
              "field",
              "Research question",
              [
                ...Object.entries(researchFields),
                ...Object.entries(flowFields),
              ].map(([value, label]) => ({ value, label })),
            )}
            {area(
              "statement",
              "Your finding",
              "Explain the economic activity, customer need, or value exchange.",
            )}
            {withStatus()}
          </>
        )}
        {mode === "evidence" && (
          <>
            <p className="form-help full">
              Keep the original excerpt and your interpretation separate.
              “Confirmed” means you checked the source supports the specific
              claim; an integration alone does not prove payment.
            </p>
            {input(
              "title",
              "Source title",
              "e.g. Official product documentation",
            )}
            {input("url", "Source URL", "https://…", "", "url")}
            {select(
              "source_type",
              "Source type",
              [
                "Official documentation",
                "Company website",
                "Product documentation",
                "Announcement",
                "Financial data",
                "DefiLlama",
                "Blockchain data",
                "GitHub",
                "Official X",
                "Other public source",
              ].map((value) => ({ value, label: value })),
            )}
            {select("verification", "Verification status", statuses)}
            {observation()}
            {input(
              "published_at",
              "Publication / announcement date (UTC) · optional",
              "",
              "",
              "datetime-local",
              true,
            )}
            {area(
              "original_text",
              "Original evidence",
              "Paste the exact source passage or observations. This snapshot is retained.",
            )}
            {area(
              "interpretation",
              "Your interpretation",
              "What does this evidence support? What does it leave unknown?",
              "",
              true,
            )}
          </>
        )}
        {mode === "business" && (
          <>
            <p className="form-help full">
              A name creates a research record. It does not establish an
              operating business or a token relationship. Add evidence-backed
              findings and connections separately.
            </p>
            {input("name", "Name", "Organisation or product name")}
            {select("kind", "Record type", [
              {
                value: "organisation",
                label: "Organisation · company, foundation, DAO",
              },
              {
                value: "product",
                label: "Product · service, protocol, infrastructure",
              },
            ])}
          </>
        )}
        {mode === "activity" && (
          <>
            <p className="form-help full">
              Describe an activity a product enables an actor to perform. Keep
              the product, its operator, and any associated assets separate.
            </p>
            {select(
              "product_id",
              "Product",
              overview.entities
                .filter((e) => e.kind === "product")
                .map((e) => ({ value: String(e.id), label: e.name })),
              String(subject || ""),
            )}
            {input(
              "name",
              "Activity name",
              "e.g. A concrete business activity",
            )}
            {area(
              "enables",
              "What does this product enable?",
              "Describe the action in plain language.",
            )}
            {area(
              "actor",
              "Who performs this activity?",
              "Identify the user or business actor and their need.",
            )}
            {withStatus()}
          </>
        )}
        {mode === "link" && (
          <>
            <p className="form-help full">
              Connect organisation → product with “operates”, or product → asset
              with “associated asset”. Keep uncertain associations labelled.
            </p>
            {select(
              "from_id",
              "From",
              businesses,
              String(subject || businesses[0]?.value || ""),
            )}
            {select("type", "Connection type", [
              { value: "operates", label: "Operates · organisation → product" },
              {
                value: "associated_asset",
                label: "Associated asset · product → asset",
              },
            ])}
            {select("to_id", "To", entities)}
            {withStatus()}
          </>
        )}
        {mode === "relationship" && (
          <>
            <p className="form-help full">
              Describe both sides. Compatibility is not a partnership. An
              integration announcement is not evidence of a paying customer.
            </p>
            {select(
              "a_id",
              "Business A",
              businesses,
              String(subject || businesses[0]?.value || ""),
            )}
            {select("b_id", "Business B", businesses)}
            {select(
              "type",
              "Relationship type",
              [
                "customer/provider",
                "integration",
                "partnership",
                "distribution",
                "investment",
                "liquidity provision",
                "infrastructure dependency",
                "competition",
                "ecosystem membership",
              ].map((value) => ({ value, label: value })),
            )}
            {select("money", "Does money change hands?", [
              { value: "unknown", label: "Unknown · no payment evidence" },
              { value: "yes", label: "Yes · supported by evidence" },
              { value: "no", label: "No · supported by evidence" },
            ])}
            {area("a_provides", "What A provides")}
            {area("b_provides", "What B provides")}
            {area("reason", "Why the relationship exists")}
            {area("a_value", "Economic value A receives")}
            {area("b_value", "Economic value B receives")}
            {withStatus()}
            {input(
              "announcement_date",
              "Announcement date (UTC) · optional",
              "",
              "",
              "datetime-local",
              true,
            )}
          </>
        )}
        {mode === "opportunity" && (
          <>
            <p className="form-help full">
              A possibility for you to investigate, grounded in a business need.
              “Supported” requires confirmed evidence; it is still your
              assessment, not a recommendation.
            </p>
            {input(
              "title",
              "Opportunity",
              "e.g. A recurring business need",
              opportunity?.title,
            )}
            {select(
              "entity_id",
              "Relevant business / asset",
              [
                { value: "", label: "Independent research question" },
                ...entities,
              ],
              String(opportunity?.entity_id || subject || ""),
              true,
            )}
            {area(
              "friction",
              "What friction have you noticed?",
              "Who is struggling with what?",
              opportunity?.friction,
            )}
            {area(
              "proposed_solution",
              "How might you help?",
              "Your possible service, connection, or solution.",
              opportunity?.proposed_solution,
            )}
            {area(
              "buyer",
              "Who would need it, and why pay?",
              "Name the actor and the value they want.",
              opportunity?.buyer,
            )}
            {area(
              "next_step",
              "Next research step",
              "A question to answer or evidence to find.",
              opportunity?.next_step,
            )}
            {select(
              "stage",
              "Research stage",
              ["hypothesis", "investigating", "supported", "dismissed"].map(
                (value) => ({ value, label: value }),
              ),
              opportunity?.stage,
            )}
            {select(
              "evidence_id",
              "Supporting evidence",
              evidence,
              String(opportunity?.evidence_id || ""),
              true,
            )}
          </>
        )}
        {mode === "contract" && (
          <>
            <p className="form-help full">
              A source-reported address is not automatically verified. Record
              the exact network and address only after checking independent
              official documentation or chain evidence. This is your recorded
              verification judgement.
            </p>
            {input("identity_id", "CoinGecko ID", "Exact indexed identity ID")}
            {input("network", "Blockchain network", "Exact network name")}
            {input(
              "address",
              "Contract address",
              "Exact address including case",
            )}
            {select("evidence_id", "Confirmed address evidence", evidence)}
            {observation()}
          </>
        )}
        {mode === "identity" && (
          <>
            <p className="form-help full">
              A shared ticker is a lead, not identity proof. Compare the
              exchange’s official asset information with official
              project/network identifiers and record the evidence before
              approving a CoinGecko ID.
            </p>
            {select(
              "asset_id",
              "Exchange asset",
              overview.entities
                .filter((e) => e.kind === "asset")
                .map((e) => ({ value: String(e.id), label: e.name })),
              String(subject || ""),
            )}
            {input(
              "identity_id",
              "CoinGecko ID",
              "Exact ID from an indexed candidate",
            )}
            {select("evidence_id", "Confirmed identity evidence", evidence)}
          </>
        )}
        <div className="form-footer full">
          <button
            className="button primary"
            disabled={busy || (mode === "finding" && entities.length === 0)}
          >
            {busy ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}{" "}
            {busy
              ? "Saving…"
              : mode === "opportunity" && opportunity
                ? "Update opportunity"
                : "Save " +
                  (mode === "business"
                    ? "record"
                    : mode === "identity"
                      ? "verified identity"
                      : mode)}
          </button>
          <span className="small muted">
            Evidence first. Interpretation second.
          </span>
        </div>
      </form>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice success" role="status">
          <Check size={16} />
          {message}
        </p>
      )}
      {mode === "evidence" && overview.evidence.length > 0 && (
        <div className="evidence-library">
          <h3>Your source library</h3>
          {overview.evidence.slice(0, 20).map((e) => (
            <details key={e.id}>
              <summary>
                <span>
                  #{e.id} · {e.title}
                </span>
                <Badge status={e.verification} />
              </summary>
              <a href={e.url} target="_blank" rel="noreferrer">
                View original source <ArrowUpRight size={13} />
              </a>
              <p className="small muted">
                Observed {date(e.observed_at)} · {e.source_type}
              </p>
              <blockquote>{e.original_text}</blockquote>
              <p>{e.interpretation || "No interpretation recorded."}</p>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
