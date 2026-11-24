"use client";

import { useEffect, useState } from "react";
import { ChevronDown, RefreshCw, Trophy } from "lucide-react";
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

  return <TopVisitorsView report={report} loading={loading} error={error} onRefresh={() => setRefresh(value => value + 1)} />;
}

export function TopVisitorsView({ report, loading, error, onRefresh }: {
  report: PortalVisitorsReport | null; loading: boolean; error: string; onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visitors = report?.visitors ?? [];
  const visible = expanded ? visitors : visitors.slice(0, 5);
  return (
    <section className={styles.card} aria-labelledby="portal-visitors-heading" aria-busy={loading}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.icon}><Trophy size={20} aria-hidden="true" /></span>
          <div><h2 id="portal-visitors-heading">Top 20 Portal Visitors</h2><p>School community · Last 30 days</p></div>
        </div>
        <button type="button" className={styles.refresh} disabled={loading} onClick={onRefresh} aria-label="Refresh top visitors">
          <RefreshCw size={15} aria-hidden="true" className={loading ? styles.spinning : undefined} /><span>Refresh</span>
        </button>
      </header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!report && loading && <p className={styles.empty} role="status">Loading portal visitors…</p>}
      {report && !visitors.length && <p className={styles.empty}>Names will appear as members visit the portal.</p>}
      {visitors.length > 0 && <ol className={styles.list} id="portal-visitors-list">
        {visible.map(visitor => <li key={visitor.rank} className={visitor.is_you ? styles.you : undefined}>
          <span className={styles.rank} aria-label={"Rank " + visitor.rank}>{visitor.rank}</span>
          <div className={styles.name}><strong>{visitor.full_name}</strong>{visitor.is_you && <span className={styles.youBadge}>You</span>}</div>
          <div className={styles.count}><strong>{visitor.visit_days}</strong><span>{visitor.visit_days === 1 ? "day" : "days"}</span></div>
        </li>)}
      </ol>}
      {visitors.length > 5 && <button type="button" className={styles.expand} onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls="portal-visitors-list">
        {expanded ? "Show less" : "View all " + visitors.length + " visitors"}<ChevronDown size={15} aria-hidden="true" className={expanded ? styles.rotated : undefined} />
      </button>}
      <footer className={styles.footer}>
        <span>One visit per person per day. Equal totals are listed alphabetically.</span>
        {report && <span>Tracking since {displayDate(report.tracking_started_on)}.</span>}
      </footer>
    </section>
  );
}

