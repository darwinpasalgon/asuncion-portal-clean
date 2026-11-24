"use client";
import { useEffect, useState } from "react";
import { PORTAL_LABEL, PORTAL_NAME } from "@/lib/portal-brand";
import styles from "./portal-loading.module.css";

export default function PortalLoadingScreen({ detail = "Getting your school tools ready.", error, onRetry, embedded = false }: {
  detail?: string; error?: string; onRetry?: () => void; embedded?: boolean;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setSlow(true), 12_000); return () => window.clearTimeout(timer); }, []);
  return <div className={styles.screen + (embedded ? " " + styles.embedded : "")}>
    <section className={styles.card} role={error ? "alert" : "status"} aria-live="polite">
      <div className={styles.seal}><img src="/school-logo.png" alt="" width={70} height={70} /></div>
      <span className={styles.brand}>{PORTAL_LABEL}</span>
      <h1>{error ? "Unable to open your workspace" : "Opening your workspace"}</h1>
      <p className={styles.detail}>{error || detail}</p>
      {!error && <div className={styles.track} aria-hidden="true"><span /></div>}
      {!error && <div className={styles.dots} aria-hidden="true"><i /><i /><i /></div>}
      {(error || slow) && <div className={styles.recovery}>
        {!error && <p>This is taking longer than usual. Please check your connection.</p>}
        <button type="button" onClick={onRetry ?? (() => window.location.reload())}>Try again</button>
        {error && <a href="/">Return to sign in</a>}
      </div>}
    </section>
    <p className={styles.school}>Asuncion National High School <span aria-hidden="true">·</span> {PORTAL_NAME}</p>
  </div>;
}

