"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  FileSpreadsheet,
  Printer,
  RefreshCw,
} from "lucide-react";
import { Sf2PrintForm, type Sf2ReportData } from "./Sf2PrintForm";
import styles from "./sf2.module.css";

type Section = { id: string; grade_level: number; name: string };
type Year = { id: string; name: string; start_year: number; end_year: number };

function monthName(value: string) {
  if (!value) return "";
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

export default function Sf2Page() {
  const [activeYear, setActiveYear] = useState<Year | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [accessMode, setAccessMode] = useState<"adviser" | "admin" | null>(null);
  const [sectionId, setSectionId] = useState("");
  const [month, setMonth] = useState("");
  const [report, setReport] = useState<Sf2ReportData | null>(null);
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState("");

  async function loadBase() {
    setLoadingBase(true);
    setError("");
    try {
      const response = await fetch("/api/academic/sf2", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to load SF2.");
        return;
      }

      const loadedSections = (result.sections ?? []) as Section[];
      setActiveYear((result.activeYear ?? null) as Year | null);
      setSections(loadedSections);
      setAccessMode(result.accessMode ?? null);
      setMonth(String(result.defaultMonth ?? ""));
      setSectionId((current) => current || loadedSections[0]?.id || "");
    } catch {
      setError("Unable to reach the SF2 service.");
    } finally {
      setLoadingBase(false);
    }
  }

  async function loadReport(targetSection = sectionId, targetMonth = month) {
    if (!targetSection || !targetMonth) return;
    setLoadingReport(true);
    setError("");
    try {
      const params = new URLSearchParams({
        sectionId: targetSection,
        month: targetMonth,
      });
      const response = await fetch(`/api/academic/sf2?${params.toString()}`, {
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setReport(null);
        setError(result.error ?? "Unable to generate SF2.");
        return;
      }
      setReport((result.report ?? null) as Sf2ReportData | null);
    } catch {
      setReport(null);
      setError("Unable to reach the SF2 service.");
    } finally {
      setLoadingReport(false);
    }
  }

  useEffect(() => {
    void loadBase();
  }, []);

  useEffect(() => {
    if (!loadingBase && sectionId && month) {
      void loadReport(sectionId, month);
    }
  }, [loadingBase, sectionId, month]);

  const minMonth = activeYear ? `${activeYear.start_year}-06` : "";
  const maxMonth = useMemo(() => {
    if (!activeYear) return "";
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const schoolYearEnd = `${activeYear.end_year}-05`;
    return current < schoolYearEnd ? current : schoolYearEnd;
  }, [activeYear]);

  const pageSets = report
    ? Math.max(
        1,
        Math.ceil(report.learners.male.length / 21),
        Math.ceil(report.learners.female.length / 25)
      )
    : 1;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topBar}>
          <a href="/portal?open=school-forms" className={styles.backLink}>
            <ArrowLeft size={16} />
            Back to School Forms
          </a>
          <button
            type="button"
            className={styles.printButton}
            disabled={!report || loadingReport}
            onClick={() => window.print()}
          >
            <Printer size={16} />
            Print SF2
          </button>
        </div>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>SCHOOL FORM 2 · MONTHLY REPORT</span>
            <h1>Daily Attendance Report of Learners</h1>
            <p>
              Generated directly from the official daily attendance records using
              the uploaded DepEd SF2 layout.
            </p>
          </div>
          {activeYear && (
            <div className={styles.yearCard}>
              <span>SCHOOL YEAR</span>
              <strong>{activeYear.name}</strong>
              <span>{accessMode === "admin" ? "Administrator Access" : "Section Adviser Access"}</span>
            </div>
          )}
        </header>

        {error && <div className={styles.error}>{error}</div>}

        <section className={styles.controls}>
          <label>
            <span>Section</span>
            <select
              value={sectionId}
              disabled={loadingBase}
              onChange={(event) => setSectionId(event.target.value)}
            >
              {sections.length === 0 && <option value="">No Adviser Section Available</option>}
              {sections.map((section) => (
                <option value={section.id} key={section.id}>
                  Grade {section.grade_level} · {section.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Report Month</span>
            <input
              type="month"
              value={month}
              min={minMonth}
              max={maxMonth}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>

          <button
            type="button"
            className={styles.loadButton}
            disabled={!sectionId || !month || loadingReport}
            onClick={() => void loadReport()}
          >
            {loadingReport ? <RefreshCw size={16} /> : <CalendarDays size={16} />}
            {loadingReport ? "Generating…" : "Generate Monthly SF2"}
          </button>
        </section>

        {report && !report.completeness.complete && (
          <div className={styles.warning}>
            <strong>Attendance is not yet complete for {monthName(report.month)}.</strong>{" "}
            {report.completeness.missing_entries} learner attendance entr
            {report.completeness.missing_entries === 1 ? "y is" : "ies are"} still missing
            across {report.completeness.missing_dates.length} school day
            {report.completeness.missing_dates.length === 1 ? "" : "s"}. Missing entries
            are shown as <b>?</b> in the preview until the adviser completes attendance.
          </div>
        )}

        {report && report.completeness.complete && (
          <div className={styles.notice}>
            <FileSpreadsheet size={15} style={{ verticalAlign: "middle", marginRight: 7 }} />
            Monthly attendance is complete. SF2 is ready for official printing.
          </div>
        )}

        {report && pageSets > 1 && (
          <div className={styles.notice}>
            This section exceeds the learner slots in the uploaded SF2 template. The portal
            automatically creates {pageSets} SF2 page set{pageSets === 1 ? "" : "s"} so no learner
            is omitted.
          </div>
        )}

        <div className={styles.previewFrame}>
          {loadingBase || loadingReport ? (
            <div className={styles.empty}>Generating the monthly SF2 report…</div>
          ) : report ? (
            <Sf2PrintForm report={report} />
          ) : (
            <div className={styles.empty}>
              Select a section and month to generate School Form 2.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
