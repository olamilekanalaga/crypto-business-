import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";

// Hosting the illustration does not publish or relocate the local research DB.
export function isHostedPreview() {
  return process.env.VERCEL === "1" || process.env.BD_ORACLE_PREVIEW === "1";
}

export default function ResearchGate({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isHostedPreview()) return children;
  return (
    <main style={{ maxWidth: 660, margin: "12vh auto", padding: 28 }}>
      <span className="eyebrow">BD ORACLE · RESEARCH WORKSPACE</span>
      <LockKeyhole
        size={32}
        style={{ margin: "28px 0", color: "var(--green)" }}
      />
      <h1>Your research stays in your local workspace.</h1>
      <p className="muted" style={{ margin: "24px 0" }}>
        This hosted version lets you explore the opportunity concept. Your saved
        businesses, evidence and private notes are available in the local app.
        Online research storage and sign-in are not connected yet.
      </p>
      <Link className="button primary" href="/">
        <ArrowLeft size={16} /> Explore the opportunity map
      </Link>
      <p style={{ marginTop: 24 }}>
        <a
          className="source-link"
          href="https://github.com/olamilekanalaga/crypto-business-#run-locally"
          target="_blank"
          rel="noreferrer"
        >
          Open local setup instructions ↗
        </a>
      </p>
    </main>
  );
}
