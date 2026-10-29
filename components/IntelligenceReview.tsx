"use client";
import { useEffect, useState } from "react";
import { api, date } from "./api";
import { Badge } from "./Workspace";
import { BrainCircuit, Upload, ShieldCheck } from "lucide-react";
import type { Evidence, Overview } from "./types";
type Proposal = {
  id: number;
  provider: string;
  model: string;
  kind: string;
  confidence: number;
  explanation: string;
  evidence_gaps: string;
  payload: Record<string, unknown>;
  source_ids: number[];
  sources: Evidence[];
  status: string;
  reviewer_note?: string;
  created_record_id?: number;
  created_record_type?: string;
  created_at: string;
};
export default function IntelligenceReview({
  overview,
}: {
  overview: Overview;
}) {
  const [proposals, setProposals] = useState<Proposal[]>([]),
    [status, setStatus] = useState<{
      enabled: boolean;
      provider: string;
    } | null>(null),
    [content, setContent] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [notes, setNotes] = useState<Record<number, string>>({}),
    [busy, setBusy] = useState(false),
    [nodes, setNodes] = useState<{ id: number; name: string; kind: string }[]>(
      [],
    ),
    [edits, setEdits] = useState<
      Record<
        number,
        {
          explanation?: string;
          evidence_gaps?: string;
          payload?: Record<string, unknown>;
        }
      >
    >({});
  async function load() {
    try {
      const [s, p, g] = await Promise.all([
        api<{ enabled: boolean; provider: string }>("intelligence_status"),
        api<{ proposals: Proposal[] }>("list_proposals"),
        api<{ catalog: { id: number; name: string; kind: string }[] }>(
          "anatomy",
        ),
      ]);
      setNodes(g.catalog);
      setStatus(s);
      setProposals(p.proposals);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function importProposal(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("import_proposal", JSON.parse(content));
      setContent("");
      await load();
      setMessage(
        "Proposal staged for human review. No research fact or graph connection was created.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function review(id: number, decision: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("review_proposal", {
        id,
        decision,
        reviewer_note: notes[id] || "",
        ...(decision === "accept" ? edits[id] || {} : {}),
      });
      await load();
      setMessage(
        decision === "accept"
          ? "Retained as a research hypothesis, not a verified fact."
          : "Proposal rejected. Its original content and sources remain in review history.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function editPayload(p: Proposal, key: string, value: string) {
    setEdits((current) => ({
      ...current,
      [p.id]: {
        ...current[p.id],
        payload: { ...p.payload, ...current[p.id]?.payload, [key]: value },
      },
    }));
  }
  function readable(key: string, value: unknown) {
    if (key === "source_id" || key === "target_id") {
      const node = nodes.find((n) => n.id === Number(value));
      return node
        ? `${node.name} · ${node.kind}`
        : `Unresolved node #${String(value)}`;
    }
    if (key === "entity_id") {
      const entity = overview.entities.find((e) => e.id === Number(value));
      return entity
        ? `${entity.name} · ${entity.kind}`
        : `Unresolved entity #${String(value)}`;
    }
    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : JSON.stringify(value);
  }
  return (
    <>
      <div className="notice subtle">
        <BrainCircuit size={20} />
        <span>
          <strong>
            {status?.enabled
              ? "Optional provider available"
              : "External intelligence is disabled."}
          </strong>{" "}
          No model API is called by this workspace. Structured suggestions stay
          outside your research graph until you explicitly review them.
        </span>
      </div>
      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">OPTIONAL INTELLIGENCE BOUNDARY</span>
            <h2>Source-linked proposals. Human judgement.</h2>
            <p>
              An imported confidence score is not a probability of truth.
              Provider and model names are declared metadata, not authenticated
              origin.
            </p>
          </div>
          <ShieldCheck size={24} />
        </div>
        <details className="proposal-import">
          <summary>Import a structured proposal for review</summary>
          <p className="small muted">
            This advanced handoff accepts structured output from a future
            adapter or an external research process. Refer to existing entity,
            graph-node and evidence IDs. Importing does not generate, fetch,
            verify or publish anything.
          </p>
          <form className="research-form" onSubmit={importProposal}>
            <label className="field full">
              Structured proposal JSON
              <textarea
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                maxLength={90000}
                spellCheck={false}
                placeholder="Paste one structured proposal with kind, payload, source_ids, explanation, evidence_gaps and confidence."
              />
            </label>
            <button className="button primary" disabled={busy}>
              <Upload size={14} />
              Stage proposal
            </button>
          </form>
        </details>
      </section>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Proposal review queue</h2>
            <p>
              Accept means keep for investigation. It never confirms a
              partnership, customer, payment or dependency.
            </p>
          </div>
          <span className="count-pill">{proposals.length} proposals</span>
        </div>
        {proposals.length ? (
          proposals.map((p) => (
            <article className="proposal-card" key={p.id}>
              <div className="section-head">
                <div>
                  <span className="eyebrow">
                    {p.kind.replaceAll("_", " ")} · #{p.id}
                  </span>
                  <h3>{p.explanation}</h3>
                </div>
                <Badge status={p.status} />
              </div>
              <p className="small muted">
                Declared source: {p.provider} / {p.model} · Reported confidence{" "}
                {p.confidence} · Imported {date(p.created_at)}
              </p>
              <dl className="proposal-payload">
                {Object.entries(p.payload).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key.replaceAll("_", " ")}</dt>
                    <dd>{readable(key, value)}</dd>
                  </div>
                ))}
              </dl>
              <div className="evidence-gap">
                <span className="eyebrow">MISSING EVIDENCE & VALIDATION</span>
                <p>{p.evidence_gaps}</p>
              </div>
              {p.sources?.map((source) => (
                <details className="relationship-evidence" key={source.id}>
                  <summary>Source: {source.title}</summary>
                  {/^https?:\/\//.test(source.url) && (
                    <a
                      className="source-link"
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open original source
                    </a>
                  )}
                  <blockquote>{source.original_text}</blockquote>
                  <p className="small muted">
                    Source status: {source.verification} · Observed{" "}
                    {date(source.observed_at)}
                  </p>
                </details>
              ))}
              {p.status === "proposed" ? (
                <div className="proposal-review">
                  <details className="proposal-edit">
                    <summary>Edit this hypothesis before keeping it</summary>
                    <label className="field">
                      Edited explanation for proposal {p.id}
                      <textarea
                        rows={3}
                        value={edits[p.id]?.explanation ?? p.explanation}
                        onChange={(e) =>
                          setEdits((d) => ({
                            ...d,
                            [p.id]: { ...d[p.id], explanation: e.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="field">
                      Edited evidence gaps for proposal {p.id}
                      <textarea
                        rows={3}
                        value={edits[p.id]?.evidence_gaps ?? p.evidence_gaps}
                        onChange={(e) =>
                          setEdits((d) => ({
                            ...d,
                            [p.id]: {
                              ...d[p.id],
                              evidence_gaps: e.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    {(p.kind === "finding" ||
                      p.kind === "research_question") && (
                      <label className="field">
                        Edited finding for proposal {p.id}
                        <textarea
                          rows={3}
                          value={String(
                            edits[p.id]?.payload?.[
                              p.kind === "finding" ? "statement" : "question"
                            ] ??
                              p.payload[
                                p.kind === "finding" ? "statement" : "question"
                              ],
                          )}
                          onChange={(e) =>
                            editPayload(
                              p,
                              p.kind === "finding" ? "statement" : "question",
                              e.target.value,
                            )
                          }
                        />
                      </label>
                    )}
                    {p.kind === "connection" &&
                      [
                        "source_context",
                        "target_context",
                        "source_value",
                        "target_value",
                      ].map((key) => (
                        <label className="field" key={key}>
                          {key.replaceAll("_", " ")} for proposal {p.id}
                          <textarea
                            rows={2}
                            value={String(
                              edits[p.id]?.payload?.[key] ??
                                p.payload[key] ??
                                "",
                            )}
                            onChange={(e) =>
                              editPayload(p, key, e.target.value)
                            }
                          />
                        </label>
                      ))}
                    <p className="small muted">
                      The original proposed content is retained separately from
                      your edits.
                    </p>
                  </details>
                  <label className="field">
                    Review note for proposal {p.id}
                    <textarea
                      rows={2}
                      value={notes[p.id] || ""}
                      onChange={(e) =>
                        setNotes((n) => ({ ...n, [p.id]: e.target.value }))
                      }
                      placeholder="What does the evidence support, and what still needs investigation?"
                    />
                  </label>
                  <div>
                    <button
                      className="button primary"
                      disabled={busy || !notes[p.id]?.trim()}
                      onClick={() => void review(p.id, "accept")}
                    >
                      Keep as research hypothesis
                    </button>
                    <button
                      className="button secondary"
                      disabled={busy || !notes[p.id]?.trim()}
                      onClick={() => void review(p.id, "reject")}
                    >
                      Reject proposal
                    </button>
                  </div>
                </div>
              ) : (
                <p className="notice subtle">
                  {p.status === "accepted"
                    ? "Human-reviewed and retained as a hypothesis."
                    : "Rejected."}{" "}
                  {p.reviewer_note}
                </p>
              )}
            </article>
          ))
        ) : (
          <div className="empty">
            <h3>No proposals awaiting review.</h3>
            <p>
              Continue with stored relationships and manual research. A future
              model adapter can submit structured drafts here, without granting
              itself verification authority.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
