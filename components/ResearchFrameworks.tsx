"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Plus, Save, Trash2 } from "lucide-react";
import { api } from "./api";
type Question = { topic: string; prompt: string; optional: boolean };
type Framework = {
  id: number;
  name: string;
  description: string;
  questions: Question[];
  origin: string;
  revision: number;
};
export default function ResearchFrameworks({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [items, setItems] = useState<Framework[]>([]),
    [selected, setSelected] = useState(""),
    [draft, setDraft] = useState<Partial<Framework> | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      const data = await api<{ frameworks: Framework[] }>("taxonomy");
      setItems(data.frameworks);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const chosen = items.find((f) => String(f.id) === selected);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ id: number }>("save_framework", {
        ...draft,
        expected_revision: draft.revision,
      });
      await load();
      setSelected(String(result.id));
      setDraft(null);
      setMessage(
        "Research framework saved. No business facts or connections were created.",
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function updateQuestion(
    i: number,
    key: keyof Question,
    value: string | boolean,
  ) {
    setDraft((d) => ({
      ...d,
      questions: d?.questions?.map((q, index) =>
        index === i ? { ...q, [key]: value } : q,
      ),
    }));
  }
  return (
    <section
      className={
        "panel research-frameworks " + (compact ? "compact-frameworks" : "")
      }
    >
      <div className="section-head">
        <div>
          <span className="eyebrow">REUSABLE DEPENDENCY TAXONOMY</span>
          <h2>Research frameworks</h2>
          <p>
            Starting questions for different kinds of businesses. They do not
            establish what this business needs.
          </p>
        </div>
        <BookOpen size={21} />
      </div>
      <div className="framework-toolbar">
        <label className="field">
          Choose a research framework
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setDraft(null);
              setMessage("");
            }}
          >
            <option value="">Choose questions to investigate</option>
            {items.map((f) => (
              <option value={f.id} key={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button secondary"
          onClick={() =>
            setDraft({
              name: "",
              description: "",
              questions: [{ topic: "", prompt: "", optional: false }],
            })
          }
        >
          <Plus size={14} />
          New framework
        </button>
        {chosen && (
          <button
            className="button secondary"
            onClick={() => {
              setDraft({
                ...chosen,
                questions: chosen.questions.map((q) => ({ ...q })),
              });
              setMessage("");
            }}
          >
            Edit framework
          </button>
        )}
      </div>
      {chosen && !draft && (
        <div className="framework-questions">
          <h3>{chosen.name}</h3>
          <p>{chosen.description}</p>
          <span className="small muted">
            Revision {chosen.revision} ·{" "}
            {chosen.origin === "starter"
              ? "Generic starter questions"
              : "Researcher-defined questions"}
          </span>
          <ul>
            {chosen.questions.map((q, i) => (
              <li key={i}>
                <span className="eyebrow">
                  {q.topic}
                  {q.optional ? " · OPTIONAL QUESTION" : ""}
                </span>
                <p>{q.prompt}</p>
              </li>
            ))}
          </ul>
          <Link className="text-button" href="/?view=workspace">
            Record findings with their own evidence
            <ArrowUpRight size={14} />
          </Link>
        </div>
      )}
      {draft && (
        <form className="research-form framework-editor" onSubmit={save}>
          <label className="field">
            Framework name
            <input
              required
              value={draft.name || ""}
              maxLength={200}
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value }))
              }
            />
          </label>
          <label className="field">
            Framework description
            <input
              required
              value={draft.description || ""}
              maxLength={5000}
              onChange={(e) =>
                setDraft((d) => ({ ...d, description: e.target.value }))
              }
            />
          </label>
          {draft.questions?.map((q, i) => (
            <div className="framework-question-editor full" key={i}>
              <label className="field">
                Topic {i + 1}
                <input
                  required
                  maxLength={200}
                  value={q.topic}
                  onChange={(e) => updateQuestion(i, "topic", e.target.value)}
                />
              </label>
              <label className="field">
                Research question {i + 1}
                <textarea
                  required
                  rows={2}
                  maxLength={2000}
                  value={q.prompt}
                  onChange={(e) => updateQuestion(i, "prompt", e.target.value)}
                />
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={q.optional}
                  onChange={(e) =>
                    updateQuestion(i, "optional", e.target.checked)
                  }
                />
                Optional question
              </label>
              <button
                type="button"
                className="icon-button"
                aria-label={"Remove question " + (i + 1)}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    questions: d?.questions?.filter((_, index) => index !== i),
                  }))
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="form-footer full">
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  questions: [
                    ...(d?.questions || []),
                    { topic: "", prompt: "", optional: false },
                  ],
                }))
              }
            >
              <Plus size={14} />
              Add question
            </button>
            <button className="button primary" disabled={busy}>
              <Save size={14} />
              {busy ? "Saving…" : "Save framework"}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
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
    </section>
  );
}
