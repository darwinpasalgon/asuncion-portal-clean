"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Trophy } from "lucide-react";
import type { PortalVisitorsReport } from "@/lib/portal-visitors";
import styles from "./top-visitors-card.module.css";

function displayDate(date: string) {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(date + "T00:00:00Z"));
}

export default function TopVisitorsCard() {
  const [report, setReport] = useState<PortalVisitorsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    let busy = false;
    let controller: AbortController | null = null;
    async function load() {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      setLoading(true);
      setError("");
      controller = new AbortController();
      const signal = controller.signal;
      const timeout = window.setTimeout(() => controller?.abort(), 12_000);
      try {
        let response = await fetch("/api/portal-visitors", { cache: "no-store", signal });
        if (response.status === 401) {
          await fetch("/api/auth/me", { cache: "no-store", signal });
          response = await fetch("/api/portal-visitors", { cache: "no-store", signal });
        }
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403
          ? "Please sign in again to view portal visitors."
          : "Unable to load visitors. Please try again.");
        const data: PortalVisitorsReport = await response.json();
        if (active) setReport(data);
      } catch (err) {
        if (active) setError(err instanceof Error && err.message === "Please sign in again to view portal visitors."
          ? err.message : "Unable to load visitors. Please try again.");
      } finally {
        window.clearTimeout(timeout);
        busy = false;
        if (active) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    const visible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);

  return (
    <section className={styles.card} aria-labelledby="portal-visitors-heading" aria-busy={loading}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.icon}><Trophy size={21} aria-hidden="true" /></span>
          <div>
            <h2 id="portal-visitors-heading">Top 10 Portal Visitors</h2>
            <p>Our school community · Last 30 days</p>
          </div>
        </div>
        <button type="button" className={styles.refresh} disabled={loading}
          onClick={() => setRefresh(value => value + 1)} aria-label="Refresh top visitors">
          <RefreshCw size={15} aria-hidden="true" className={loading ? styles.spinning : undefined} />
          Refresh
        </button>
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {!report && loading && <p className={styles.empty} role="status">Loading portal visitors…</p>}
      {report && report.visitors.length === 0 && <p className={styles.empty}>Names will appear as members visit the portal.</p>}
      {report && report.visitors.length > 0 && (
        <ol className={styles.list}>
          {report.visitors.map(visitor => (
            <li key={visitor.rank} className={visitor.is_you ? styles.you : undefined}>
              <span className={styles.rank} aria-label={"Rank " + visitor.rank}>{visitor.rank}</span>
              <div className={styles.name}>
                <strong>{visitor.full_name}</strong>
                {visitor.is_you && <span className={styles.youBadge}>You</span>}
              </div>
              <div className={styles.count}>
                <strong>{visitor.visit_days}</strong>
                <span>{visitor.visit_days === 1 ? "day" : "days"}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
      <footer className={styles.footer}>
        <span>One visit per person per day. Equal totals are listed alphabetically.</span>
        {report && <span>All-user tracking started {displayDate(report.tracking_started_on)}.</span>}
      </footer>
    </section>
  );
}

