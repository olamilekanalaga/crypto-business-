"use client";
import { useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { api } from "./api";
import type { Overview } from "./types";
import {
  anatomyLenses,
  relationLabels,
  type AnatomyNode,
} from "./anatomy-types";
export default function AnatomyForms({
  nodes,
  overview,
  centerId,
  onSaved,
}: {
  nodes: AnatomyNode[];
  overview: Overview;
  centerId: number | null;
  onSaved: (id: number, isNode: boolean) => void;
}) {
  const [tab, setTab] = useState("node"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [relation, setRelation] = useState("needs_to_operate"),
    [actuality, setActuality] = useState("potential");
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
        <select name={name} defaultValue={value} required={!optional}>
          {optional && <option value="">No evidence yet</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  function area(
    name: string,
    label: string,
    placeholder: string,
    optional = false,
  ) {
    return (
      <label className="field full">
        {label}
        <textarea
          name={name}
          rows={3}
          maxLength={20000}
          placeholder={placeholder}
          required={!optional}
        />
      </label>
    );
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = event.currentTarget;
    const values: Record<string, unknown> = Object.fromEntries(
      new FormData(form),
    );
    if (values.evidence_checked_at)
      values.evidence_checked_at = new Date(
        String(values.evidence_checked_at) + "Z",
      ).toISOString();
    if (values.observed_at)
      values.observed_at = new Date(
        String(values.observed_at) + "Z",
      ).toISOString();
    try {
      const saved = await api<{ id: number }>(
        tab === "node" ? "save_graph_node" : "save_graph_edge",
        values,
      );
      setMessage(
        tab === "node"
          ? "Research node saved locally."
          : "Connection saved locally with its evidence status.",
      );
      onSaved(saved.id, tab === "node");
      form.reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const nodeOptions = nodes.map((n) => ({
    value: String(n.id),
    label: `${n.name} · ${n.kind}`,
  }));
  return (
    <section className="panel anatomy-form">
      <div className="section-head">
        <div>
          <span className="eyebrow">BUILD YOUR UNDERSTANDING</span>
          <h2>Record a node or a meaningful connection.</h2>
          <p>
            Use the research workspace to create organisations, products and
            evidence. They become available here.
          </p>
        </div>
      </div>
      <div className="form-tabs" role="tablist" aria-label="Anatomy entry type">
        <button
          role="tab"
          aria-selected={tab === "node"}
          className={tab === "node" ? "selected" : ""}
          onClick={() => {
            setTab("node");
            setMessage("");
            setError("");
          }}
        >
          Nodes
        </button>
        <button
          role="tab"
          aria-selected={tab === "edge"}
          className={tab === "edge" ? "selected" : ""}
          onClick={() => {
            setTab("edge");
            setMessage("");
            setError("");
          }}
        >
          Connections
        </button>
      </div>
      <form className="research-form" onSubmit={submit} key={tab}>
        {tab === "node" ? (
          <>
            {select(
              "kind",
              "Node type",
              ["need", "capability", "actor", "resource"].map((value) => ({
                value,
                label: value,
              })),
            )}
            <label className="field">
              Name
              <input
                name="name"
                required
                maxLength={200}
                placeholder="e.g. Liquidity, developer support, hosting"
              />
            </label>
            {area(
              "description",
              "Description",
              "Define this concept in plain language. Creating a node does not assert a business dependency.",
            )}
          </>
        ) : (
          <>
            <p className="form-help full">
              State what connects these actors, what value each receives, and
              what remains unknown. A documented integration does not establish
              payment or a partnership.
            </p>
            {select(
              "source_id",
              "Source node",
              nodeOptions,
              String(centerId || ""),
            )}
            <label className="field">
              Connection type
              <select
                name="relation"
                value={relation}
                onChange={(e) => {
                  setRelation(e.target.value);
                  if (e.target.value === "could_benefit_from")
                    setActuality("potential");
                }}
              >
                {Object.entries(relationLabels)
                  .filter(([key]) => key !== "documented_relationship")
                  .map(([key, label]) => (
                    <option value={key} key={key}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            {select("target_id", "Target node", nodeOptions)}
            <label className="field">
              Dependency importance
              {relation === "needs_to_operate" ||
              relation === "needs_to_grow" ? (
                <>
                  <input
                    readOnly
                    value={
                      relation === "needs_to_operate"
                        ? "Essential for this dependency"
                        : "Optional / growth"
                    }
                    aria-label="Derived dependency importance"
                  />
                  <input
                    type="hidden"
                    name="essentiality"
                    value={
                      relation === "needs_to_operate" ? "essential" : "optional"
                    }
                  />
                </>
              ) : (
                <select name="essentiality" defaultValue="unknown">
                  <option value="unknown">Unknown</option>
                  <option value="essential">Essential</option>
                  <option value="optional">Optional</option>
                </select>
              )}
            </label>
            <label className="field">
              Relationship state
              <select
                name="actuality"
                value={actuality}
                onChange={(e) => setActuality(e.target.value)}
              >
                {relation !== "could_benefit_from" && (
                  <option value="existing">
                    Existing · a current connection
                  </option>
                )}
                <option value="potential">
                  Potential · proposed, not established
                </option>
              </select>
            </label>
            {select("lens", "Anatomy lens", [
              { value: "other", label: "Other / not assigned" },
              ...anatomyLenses.map((l) => ({
                value: l.id,
                label: l.name + " · " + l.equivalent,
              })),
            ])}
            {area(
              "source_context",
              "What the source provides or needs",
              "Describe this endpoint’s relevant capability or need.",
              true,
            )}
            {area(
              "target_context",
              "What the target provides or needs",
              "Describe this endpoint’s relevant capability or need.",
              true,
            )}
            {area(
              "explanation",
              "Why this connection exists",
              "Describe the need, what moves between the actors, and why it matters economically.",
            )}
            {area(
              "source_value",
              "Value received by source",
              "What the source actor receives, or why this dependency matters to it.",
            )}
            {area(
              "target_value",
              "Value received by target",
              "What the other actor receives. Leave uncertainty explicit.",
            )}
            {select("money", "Does money change hands?", [
              { value: "unknown", label: "Unknown" },
              ...(actuality === "existing"
                ? [
                    {
                      value: "yes",
                      label: "Yes · confirmed evidence required",
                    },
                    ...(!["pays_for", "earns_from"].includes(relation)
                      ? [
                          {
                            value: "no",
                            label: "No · confirmed evidence required",
                          },
                        ]
                      : []),
                  ]
                : []),
            ])}
            {select("money_direction", "Money flow direction", [
              { value: "unknown", label: "Unknown / not established" },
              ...(actuality === "existing"
                ? [
                    { value: "source_to_target", label: "Source pays target" },
                    { value: "target_to_source", label: "Target pays source" },
                    { value: "none", label: "No payment" },
                  ]
                : []),
            ])}
            <label className="field">
              Evidence last checked (UTC) · optional
              <input name="evidence_checked_at" type="datetime-local" />
            </label>
            {select("status", "Evidence status", [
              { value: "hypothesis", label: "Hypothesis" },
              { value: "inference", label: "Reasonable inference" },
              { value: "unknown", label: "Unknown" },
              ...(actuality === "existing"
                ? [
                    {
                      value: "confirmed",
                      label: "Confirmed fact · evidence required",
                    },
                  ]
                : []),
            ])}
            {select(
              "evidence_id",
              "Supporting evidence",
              overview.evidence.map((e) => ({
                value: String(e.id),
                label: `#${e.id} ${e.title} · ${e.verification}`,
              })),
              undefined,
              true,
            )}
            <label className="field">
              Observed at (UTC)
              <input
                name="observed_at"
                type="datetime-local"
                required
                defaultValue={new Date().toISOString().slice(0, 16)}
              />
            </label>
            {area(
              "evidence_gaps",
              "What remains unverified?",
              "What would validate or disprove the connection? Check alternatives, user demand, technical feasibility and commercial terms.",
              false,
            )}
          </>
        )}
        <div className="form-footer full">
          <button
            type="submit"
            className="button primary"
            disabled={busy || (tab === "edge" && nodes.length < 2)}
          >
            {busy ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
            Save {tab === "node" ? "node" : "connection"}
          </button>
          <span className="small muted">
            Your judgement is recorded. No connection is generated
            automatically.
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
    </section>
  );
}
