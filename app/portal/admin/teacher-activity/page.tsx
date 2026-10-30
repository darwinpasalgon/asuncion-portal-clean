"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { activityLabels, activityStatus, type ActivityStatus, type TeacherActivity } from "@/lib/teacher-activity";
import styles from "./page.module.css";

type Report = { teachers: TeacherActivity[]; generated_at: string; tracking_started_at: string };
function date(value: string | null) {
  if (!value) return "No record";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value));
}
function download(rows: TeacherActivity[]) {
  const cell = (v: unknown) => {
    const raw = String(v ?? "");
    return '"' + (/^[\s\uFEFF]*[=+@-]/.test(raw) ? "'" + raw : raw).replace(/"/g, '""') + '"';
  };
  const lines = [
    ["Teacher", "DepEd Email", "Position", "Portal Usage", "Last Sign-In (Manila)", "Last Visit (Manila)", "Days Used (30 Days)", "Days Used (7 Days)"],
    ...rows.map(r => [r.full_name, r.email, r.position, activityLabels[activityStatus(r)], date(r.last_sign_in_at), date(r.last_seen_at), r.active_days_30, r.active_days_7]),
  ];
  const url = URL.createObjectURL(new Blob(["\uFEFF" + lines.map(r => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = "ANHS_Teacher_Portal_Activity.csv"; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
export default function TeacherActivityPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ActivityStatus | "all">("all");
  const load = useCallback(async () => {
    setLoading(true); setError(""); setReport(null);
    try {
      const response = await fetch("/api/admin/teacher-activity", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load teacher activity.");
      setReport(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load teacher activity."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const rows = useMemo(() => (report?.teachers ?? []).filter(r =>
    (filter === "all" || activityStatus(r) === filter) &&
    [r.full_name, r.email, r.position].some(v => v.toLowerCase().includes(search.trim().toLowerCase()))
  ), [report, filter, search]);
  return <main className={styles.page}><div className={styles.content}>
    <nav className={styles.toolbar}><a href="/portal/admin/users">← Users & Accounts</a>
      <button disabled={loading} onClick={() => void load()}>{loading ? "Checking…" : "Refresh"}</button></nav>
    <header><span className={styles.eyebrow}>SUPER ADMINISTRATOR · PERSONNEL</span>
      <h1>Teacher Portal Activity</h1><p>See which teachers have opened the portal and how often they return.</p></header>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <section className={styles.summary} aria-label="Teacher activity totals">
      {(["all", "active", "opened", "never"] as const).map(key => <button key={key}
        aria-pressed={filter === key} onClick={() => setFilter(key)}>
        <span>{key === "all" ? "All teachers" : activityLabels[key]}</span>
        <strong>{report ? report.teachers.filter(r => key === "all" || activityStatus(r) === key).length : "—"}</strong>
      </button>)}
    </section>
    <section className={styles.panel}>
      <div className={styles.toolbar}><input aria-label="Search teachers" placeholder="Search name, email or position"
        value={search} onChange={e => setSearch(e.target.value)} />
        <select aria-label="Filter by portal usage" value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
          <option value="all">All teachers</option>{(["active", "opened", "never"] as const).map(key =>
            <option key={key} value={key}>{activityLabels[key]}</option>)}
        </select><button disabled={loading || !rows.length} onClick={() => download(rows)}>Download CSV</button></div>
      {loading ? <p role="status">Loading teacher activity…</p> : report && <>
        <p className={styles.meta}>{rows.length} of {report.teachers.length} active teacher accounts · Updated {date(report.generated_at)} (Philippine time)</p>
        <div className={styles.tableWrap}><table><thead><tr>
          {["Teacher", "Portal usage", "Last sign-in", "Last portal visit", "Days used / 30", "Days used / 7"].map(h => <th key={h}>{h}</th>)}
        </tr></thead><tbody>{rows.map(r => <tr key={r.id}>
          <td><strong>{r.full_name}</strong><small>{r.email}</small><small>{r.position}</small></td>
          <td><span className={styles[activityStatus(r)]}>{activityLabels[activityStatus(r)]}</span></td>
          <td>{date(r.last_sign_in_at)}</td><td>{date(r.last_seen_at)}</td>
          <td>{r.active_days_30}</td><td>{r.active_days_7}</td>
        </tr>)}</tbody></table></div>
        {!rows.length && <p>No teachers match this filter.</p>}
      </>}
    </section>
    <aside className={styles.notes}>
      <strong>How the labels work</strong>
      <p><b>Active recently:</b> visits on at least 3 different days in the past 30 calendar days, including at least one in the past 7 days.
        {" "}<b>Has logged in:</b> a recorded sign-in or visit, below that threshold. <b>Never logged in:</b> no recorded sign-in or visit.</p>
      <p>Daily visit tracking started {report ? date(report.tracking_started_at) : "with this update"}. Earlier sign-ins are shown, but historical days used cannot be reconstructed.
        Dates use Philippine time. A visible portal tab counts as a visit; this does not measure work completed or time worked.</p>
    </aside>
  </div></main>;
}
