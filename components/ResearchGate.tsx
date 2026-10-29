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
      <h1>Open your browser workspace.</h1>
      <p className="muted" style={{ margin: "24px 0" }}>
        Collect public Binance assets and save notes directly on this device.
        Download and import JSON backups to move them between devices. Existing
        SQLite business graphs and evidence records remain in the local app.
      </p>
      <Link className="button primary" href="/discover">
        <ArrowLeft size={16} /> Open browser database
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
