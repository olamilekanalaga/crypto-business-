"use client";
import { useEffect, useState } from "react";
import {
  CATEGORIES,
  blankClassification,
  validateClassification,
  type Classification,
} from "@/lib/product-classification";
import styles from "./BrowserDiscovery.module.css";
export default function ProductClassification({
  value,
  saved,
  busy,
  onSave,
  onDirty,
}: {
  value?: Classification;
  saved: boolean;
  busy: boolean;
  onSave: (c: Classification) => Promise<void>;
  onDirty: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<Classification>(() =>
    value
      ? { ...value, categories: [...value.categories] }
      : blankClassification(),
  );
  const [error, setError] = useState("");
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(value || blankClassification());
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  return (
    <section
      className={styles.classification}
      aria-label="Product classification"
    >
      <h3>What does the product provide?</h3>
      <p>
        {saved
          ? "Your saved classification"
          : value
            ? "Suggested project · ticker candidate only"
            : "Unclassified · research needed"}
        . Tags describe products, not token payouts or verified company
        ownership.
      </p>
      {value && (
        <p className={styles.classificationMeta}>
          {value.status === "reviewed" ? "Reviewed by you" : "Needs review"} ·{" "}
          {saved ? "Recorded" : "Source inspected"}:{" "}
          {new Date(value.updatedAt).toLocaleDateString()}
          {value.source && (
            <>
              {" "}
              ·{" "}
              <a href={value.source} target="_blank" rel="noreferrer">
                Read source ↗
              </a>
            </>
          )}
        </p>
      )}
      <fieldset disabled={busy}>
        <legend>Product categories · select all that apply</legend>
        <div className={styles.categoryChoices}>
          {CATEGORIES.map((category) => (
            <label key={category}>
              <input
                type="checkbox"
                checked={draft.categories.includes(category)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    categories: e.target.checked
                      ? [...draft.categories, category]
                      : draft.categories.filter((c) => c !== category),
                  })
                }
              />
              {category}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Project or product name
        <input
          disabled={busy}
          value={draft.project}
          maxLength={200}
          onChange={(e) => setDraft({ ...draft, project: e.target.value })}
        />
      </label>
      <label>
        What it provides
        <textarea
          disabled={busy}
          rows={3}
          maxLength={4000}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </label>
      <label>
        Classification source URL
        <input
          disabled={busy}
          type="url"
          placeholder="https://official-project.example/docs"
          value={draft.source}
          maxLength={2000}
          onChange={(e) => setDraft({ ...draft, source: e.target.value })}
        />
      </label>
      <label>
        Classification review
        <select
          disabled={busy}
          value={draft.status}
          onChange={(e) =>
            setDraft({
              ...draft,
              status: e.target.value as Classification["status"],
            })
          }
        >
          <option value="needs_review">Needs review</option>
          <option value="reviewed">Reviewed by me</option>
        </select>
      </label>
      <p>
        Review the product and its association with this Binance asset before
        choosing “Reviewed by me.” This records your assessment; it does not
        verify the identity elsewhere in BD Oracle.
      </p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button
          className="button primary"
          disabled={busy}
          onClick={async () => {
            setError("");
            try {
              await onSave(
                validateClassification({
                  ...draft,
                  updatedAt: new Date().toISOString(),
                }),
              );
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Save classification
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => setDraft(blankClassification())}
        >
          Mark unclassified
        </button>
        {dirty && (
          <button
            className="text-button"
            onClick={() =>
              setDraft(
                value
                  ? { ...value, categories: [...value.categories] }
                  : blankClassification(),
              )
            }
          >
            Discard category edits
          </button>
        )}
      </div>
    </section>
  );
}
