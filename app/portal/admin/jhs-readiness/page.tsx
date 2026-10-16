"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowLeft, ArrowUpRight, BookOpenCheck, CalendarCheck2,
  CheckCircle2, CircleAlert, ClipboardCheck, GraduationCap,
  RefreshCw, ShieldCheck, Users,
} from "lucide-react";
import styles from "./readiness.module.css";

type SectionReadiness = {
  id: string;
  gradeLevel: number;
  name: string;
  learners: number;
  missingTve: number;
  unmatchedTve: number;
  unmatchedMajors: string[];
  tveSubjectId: string | null;
  missingSubjects: string[];
  teachingAssignments: number;
  unscheduledAssignments: number;
  attendanceDays: number;
  learnersWithAttendance: number;
  draftGradeLearners: number;
  publishedGradeLearners: number;
  grade7RotationsComplete: boolean | null;
};
type ReadinessData = {
  year: { id: string; name: string } | null;
  month: string | null;
  generatedAt?: string;
  sections: SectionReadiness[];
  note?: string;
};
const grades = [0, 7, 8, 9, 10] as const;
function countMissing(row: SectionReadiness) {
  return row.missingTve + row.unmatchedTve + row.missingSubjects.length +
    row.unscheduledAssignments + (row.grade7RotationsComplete === false ? 1 : 0);
}
function labelMonth(value: string | null) {
  if (!value) return "this month";
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-PH", {
    month: "long", year: "numeric",
  });
}
export default function JhsReadinessPage() {
  const [data, setData] = useState<ReadinessData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [grade, setGrade] = useState<number>(0);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [sort, setSort] = useState<"grade" | "missing" | "attendance">("grade");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/jhs-readiness", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to load JHS readiness.");
      setData(body);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to load JHS readiness.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);
  const all = useMemo(() => data?.sections ?? [], [data]);
  const totals = useMemo(() => all.reduce(
    (summary, section) => ({
      sections: summary.sections + 1,
      learners: summary.learners + section.learners,
      missingTve: summary.missingTve + section.missingTve,
      unmatchedTve: summary.unmatchedTve + section.unmatchedTve,
      withPublished: summary.withPublished + section.publishedGradeLearners,
      sectionsWithAttendance: summary.sectionsWithAttendance + (section.attendanceDays ? 1 : 0),
    }), { sections: 0, learners: 0, missingTve: 0, unmatchedTve: 0, withPublished: 0, sectionsWithAttendance: 0 }
  ), [all]);
  const shown = useMemo(() => {
    const selected = all.filter((row) => (!grade || row.gradeLevel === grade) &&
      (!onlyIssues || countMissing(row) > 0 || row.attendanceDays === 0 || row.publishedGradeLearners === 0));
    selected.sort((a, b) => sort === "missing"
      ? countMissing(b) - countMissing(a) || a.gradeLevel - b.gradeLevel || a.name.localeCompare(b.name)
      : sort === "attendance"
        ? a.attendanceDays - b.attendanceDays || a.gradeLevel - b.gradeLevel || a.name.localeCompare(b.name)
        : a.gradeLevel - b.gradeLevel || a.name.localeCompare(b.name));
    return selected;
  }, [all, grade, onlyIssues, sort]);
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.crumb}>
          <a href="/portal"><ArrowLeft size={15}/> Portal Dashboard</a>
          <button type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={15} className={loading ? styles.spinning : ""}/>
            {loading ? "Checking…" : "Refresh Audit"}
          </button>
        </div>
        <header className={styles.heading}>
          <div>
            <span className={styles.eyebrow}><ShieldCheck size={14}/> JHS OPERATIONS · LIVE READINESS</span>
            <h1>Grades 7–10 Readiness</h1>
            <p>School Year {data?.year?.name ?? "2026–2027"} · Section-by-section follow-up for TVE majors, teacher setup, attendance, and grades.</p>
          </div>
          <span className={styles.readOnly}><CheckCircle2 size={15}/> Read-Only Audit</span>
        </header>
        {error && <div className={styles.error} role="alert">{error}</div>}
        <section className={styles.metrics} aria-label="Grade 7 to 10 overview">
          <div className={styles.metric}><Users size={20}/><span>Active Learners</span><strong>{totals.learners.toLocaleString("en-PH")}</strong><small>Across {totals.sections} sections</small></div>
          <div className={styles.metric}><CircleAlert size={20}/><span>TVE Majors Missing</span><strong>{totals.missingTve.toLocaleString("en-PH")}</strong><small>Grades 8–10; Grade 7 excluded</small></div>
          <div className={styles.metric}><GraduationCap size={20}/><span>TVE Teacher Mismatches</span><strong>{totals.unmatchedTve}</strong><small>Assigned majors without a matching teacher</small></div>
          <div className={styles.metric}><ClipboardCheck size={20}/><span>Attendance Started</span><strong>{totals.sectionsWithAttendance}/{totals.sections}</strong><small>Sections with records in {labelMonth(data?.month ?? null)}</small></div>
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Section Follow-Up</h2>
              <p>Open the corresponding portal tool to fix a missing item. Numbers reflect saved records, not expected future grades.</p>
            </div>
            <div className={styles.filters}>
              <label>Grade
                <select value={grade} onChange={(event) => setGrade(Number(event.target.value))}>
                  {grades.map((level) => <option key={level} value={level}>{level === 0 ? "All JHS" : "Grade " + level}</option>)}
                </select>
              </label>
              <label>Sort
                <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                  <option value="grade">Grade & Section</option>
                  <option value="missing">Most Missing Items</option>
                  <option value="attendance">Attendance Activity</option>
                </select>
              </label>
              <label className={styles.checkbox}>
                <input type="checkbox" checked={onlyIssues} onChange={(event) => setOnlyIssues(event.target.checked)}/>
                Follow-up Only
              </label>
            </div>
          </div>
          {loading && !data ? <p className={styles.empty}>Checking school records and assignments…</p>
            : !data?.year ? <p className={styles.empty}>No active school year was found.</p>
            : !shown.length ? <p className={styles.empty}>No sections match the selected filters.</p> :
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead><tr>
                    <th>Section</th><th>Learners</th><th>TVE Major</th><th>Subject Setup</th>
                    <th>Attendance</th><th>Grades</th><th>Action</th>
                  </tr></thead>
                  <tbody>{shown.map((row) => {
                    const goodTve = row.gradeLevel === 7 || (row.missingTve === 0 && row.unmatchedTve === 0);
                    const goodSetup = row.missingSubjects.length === 0 && row.unscheduledAssignments === 0 &&
                      row.grade7RotationsComplete !== false;
                    return <tr key={row.id}>
                      <td><strong>Grade {row.gradeLevel}</strong><span>{row.name}</span></td>
                      <td className={styles.number}>{row.learners}</td>
                      <td>
                        {row.gradeLevel === 7 ? <span className={styles.muted}>Exploratory TVE</span> :
                          <><span className={goodTve ? styles.positive : styles.warning}>
                            {row.missingTve === 0 ? "Majors Assigned" : row.missingTve + " unassigned"}
                          </span>{row.unmatchedTve > 0 && <small className={styles.warning}>
                            {row.unmatchedTve} without matching teacher: {row.unmatchedMajors.join(", ")}
                          </small>}</>}
                      </td>
                      <td>
                        <span className={goodSetup ? styles.positive : styles.warning}>
                          {goodSetup ? "Assigned & Scheduled" : "Needs Review"}
                        </span>
                        {!!row.missingSubjects.length && <small>{row.missingSubjects.join(", ")} not assigned</small>}
                        {!!row.unscheduledAssignments && <small>{row.unscheduledAssignments} without schedules</small>}
                        {row.grade7RotationsComplete === false && <small>Exploratory TVE rotation incomplete</small>}
                      </td>
                      <td><strong>{row.attendanceDays} day{row.attendanceDays === 1 ? "" : "s"}</strong>
                        <small>{row.learnersWithAttendance}/{row.learners} learners with records in {labelMonth(data.month)}</small>
                      </td>
                      <td><strong>{row.publishedGradeLearners}/{row.learners}</strong>
                        <small>learners with at least one published term grade</small>
                        {!!row.draftGradeLearners && <small>{row.draftGradeLearners} with draft grades</small>}
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <a href={"/portal/admin/learners?grade=" + row.gradeLevel + "&section=" + encodeURIComponent(row.id)}>Learners <ArrowUpRight size={13}/></a>
                          <a href={"/portal/admin/teaching?focus=subject-teacher&grade=" + row.gradeLevel + "&section=" + encodeURIComponent(row.id)}>Teachers <ArrowUpRight size={13}/></a>
                          <a href={"/portal/attendance?section=" + encodeURIComponent(row.id)}>Attendance <ArrowUpRight size={13}/></a>
                          <a href={"/portal/sf9"}>SF9 <ArrowUpRight size={13}/></a>
                        </div>
                      </td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>}
          <div className={styles.tableFoot}>Showing {shown.length} of {all.length} sections · Updated from active school records, without altering any data.</div>
        </section>
        <div className={styles.notes}>
          <article><CalendarCheck2 size={19}/><div><h3>Attendance is not automatically marked absent</h3>
            <p>Days shown here have at least one attendance entry this month. Missing entries still need an adviser to review or mark No Classes. Historical SF2 completeness must be verified separately.</p></div></article>
          <article><BookOpenCheck size={19}/><div><h3>Grade coverage is not final report-card readiness</h3>
            <p>A learner is counted with published grades when at least one term grade has been published. SF9 requires the appropriate subject and term grades for a complete card.</p></div></article>
          <article><Activity size={19}/><div><h3>TVE overlaps are reviewed, not erased</h3>
            <p>Combined TVE classes can legitimately share times and instructors. Check the class program before correcting a flagged teaching schedule.</p></div></article>
        </div>
      </div>
    </main>
  );
}
