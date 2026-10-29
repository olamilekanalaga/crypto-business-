"use client";
import { useState } from "react";
import styles from "./BrowserDiscovery.module.css";
export default function TokenLogo({
  code,
  src,
}: {
  code: string;
  src?: string;
}) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <img
      className={styles.tokenLogo}
      src={src}
      alt={`${code} catalogue logo`}
      width={48}
      height={48}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className={styles.tokenLogo} aria-label={`${code} logo unavailable`}>
      {code.slice(0, 2)}
    </span>
  );
}
