"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  FileSpreadsheet,
  Printer,
  RefreshCw,
} from "lucide-react";
import { Sf2PrintForm, type Sf2ReportData } from "./Sf2PrintForm";
import { GeneratingProgress } from "@/components/school-forms/GeneratingProgress";
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
  const [printing, setPrinting] = useState(false);
  const reportRequestId = useRef(0);
  const [reportKey, setReportKey] = useState("");
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
    if (!targetSection || !targetMonth) return false;
    const requestId = ++reportRequestId.current;
    setLoadingReport(true);
    setReport(null);
    setReportKey("");
    setError("");
    try {
      const params = new URLSearchParams({sectionId: targetSection, month: targetMonth});
      const response = await fetch(`/api/academic/sf2?${params.toString()}`, {cache:"no-store"});
      const result = await response.json().catch(() => ({}));
      if (requestId !== reportRequestId.current) return false;
      if (!response.ok || !result.report) {
        setError(result.error ?? "Unable to generate SF2.");
        return false;
      }
      setReport(result.report as Sf2ReportData);
      setReportKey(targetSection + "|" + targetMonth);
      return true;
    } catch {
      if (requestId === reportRequestId.current) setError("Unable to reach the SF2 service.");
      return false;
    } finally {
      if (requestId === reportRequestId.current) setLoadingReport(false);
    }
  }

  async function printSf2() {
    if (printing || !sectionId || !month) return;
    setPrinting(true);
    try {
      // Always fetch the latest monthly SF2 before printing.
      if (!await loadReport(sectionId, month)) return;
      await new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      if (document.fonts?.ready) await document.fonts.ready;
      // Print inside a clean, temporary document instead of the portal's
      // scrollable DOM. This avoids Chromium including an ancestor/body gutter.
      const printDocument = document.querySelector(`.${styles.printOnly} .sf2-print-document`);
      if (!printDocument) {
        setError("SF2 print sheet is not ready. Please generate the report and try again.");
        return;
      }
      const iframe = document.createElement("iframe");
      iframe.title = "SF2 Clean Print Document";
      iframe.setAttribute("aria-hidden", "true");
      iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0;overflow:hidden;";
      document.body.appendChild(iframe);
      const dispose = () => { iframe.remove(); };
      try {
        const printWindow = iframe.contentWindow;
        const printDoc = printWindow?.document;
        if (!printWindow || !printDoc) throw new Error("Unable to create a clean print document.");

        // Reuse only the form markup and the compiled stylesheets.
        const stylesheets = Array.from(
          document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>(
            'head link[rel="stylesheet"], head style'
          )
        ).map((node) => node.outerHTML).join("\n");
        printDoc.open();
        printDoc.write(
          '<!doctype html><html><head><meta charset="utf-8">' +
          '<base href="' + window.location.origin + '/">' +
          stylesheets +
          '<style>' +
          'html,body{margin:0!important;padding:0!important;width:auto!important;' +
          'max-width:none!important;height:auto!important;min-height:0!important;' +
          'overflow:visible!important;scrollbar-width:none!important;}' +
          'html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important;width:0!important;}' +
          '.' + styles.printOnly + '{display:block!important;}' +
          '@media print{html,body{overflow:visible!important;scrollbar-width:none!important;}' +
          'html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important;}}' +
          '</style></head><body>' +
          '<div class="' + styles.printOnly + ' ' + styles.printScope + '">' +
          printDocument.outerHTML + '</div></body></html>'
        );
        printDoc.close();

        // Wait for layout CSS, fonts, and the two DepEd images before printing.
        await Promise.all(
          Array.from(printDoc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map(
            (link) => new Promise<void>((resolve, reject) => {
              if (link.sheet) return resolve();
              const timeout = window.setTimeout(() => reject(new Error("SF2 print styles could not load.")), 8000);
              const finish = (ok: boolean) => {
                window.clearTimeout(timeout);
                if (ok) resolve(); else reject(new Error("SF2 print styles could not load."));
              };
              link.addEventListener("load", () => finish(true), { once: true });
              link.addEventListener("error", () => finish(false), { once: true });
            })
          )
        );
        if (printDoc.fonts?.ready) await printDoc.fonts.ready;
        const images = Array.from(printDoc.querySelectorAll<HTMLImageElement>("img"));
        await Promise.all(images.map((img) => img.decode?.().catch(() => undefined)));
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        );

        printWindow.addEventListener("afterprint", dispose, { once: true });
        printWindow.focus();
        printWindow.print();
        // Safety cleanup for browsers that do not fire afterprint on iframes.
        window.setTimeout(dispose, 60000);
      } catch (error) {
        dispose();
        throw error;
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to print SF2.");
    } finally { setPrinting(false); }
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
  const previewIsCurrent = Boolean(report && reportKey === sectionId + "|" + month);
  const maxMonth = useMemo(() => {
    if (!activeYear) return "";
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const schoolYearEnd = `${activeYear.end_year}-05`;
    return current < schoolYearEnd ? current : schoolYearEnd;
  }, [activeYear]);

  return (
    <>
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
            disabled={loadingBase || printing || !sectionId || !month}
            onClick={() => void printSf2()}
          >
            <Printer size={16} />
            {printing ? "Preparing Print…" : "Print SF2"}
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

        {(loadingBase || loadingReport || printing) && (
          <GeneratingProgress
            form="SF2"
            message={
              printing
                ? "Preparing SF2 for printing…"
                : loadingBase
                  ? "Loading SF2 sections…"
                  : "Generating monthly SF2…"
            }
            detail={
              printing
                ? "Refreshing attendance and preparing the print-ready sheet."
                : loadingBase
                  ? "Checking school year and section access."
                  : "Compiling attendance, class totals, and learner records."
            }
          />
        )}

        {previewIsCurrent && report && !report.completeness.complete && (
          <div className={styles.warning}>
            <strong>Attendance is not yet complete for {monthName(report.month)}.</strong>{" "}
            {report.completeness.missing_entries} learner attendance entr
            {report.completeness.missing_entries === 1 ? "y is" : "ies are"} still missing
            across {report.completeness.missing_dates.length} school day
            {report.completeness.missing_dates.length === 1 ? "" : "s"}. Missing entries
            are shown as <b>?</b> in the preview until the adviser completes attendance.
          </div>
        )}

        {previewIsCurrent && report && report.completeness.complete && (
          <div className={styles.notice}>
            <FileSpreadsheet size={15} style={{ verticalAlign: "middle", marginRight: 7 }} />
            Monthly attendance is complete. SF2 is ready for official printing.
          </div>
        )}

        <div className={`${styles.previewFrame} ${styles.printScope}`}>
          {loadingBase || loadingReport ? (
            <div className={styles.empty}>Generating the monthly SF2 report…</div>
          ) : previewIsCurrent && report ? (
            <Sf2PrintForm report={report} />
          ) : (
            <div className={styles.empty}>
              Select a section and month to preview School Form 2. Print SF2 also generates the latest report automatically.
            </div>
          )}
        </div>
      </div>
    </main>
    {/* The printed form is NOT inside the screen's scrollable preview. */}
    <div className={`${styles.printOnly} ${styles.printScope}`} aria-hidden="true">
      {previewIsCurrent && report ? <Sf2PrintForm report={report} /> : null}
    </div>
    </>
  );
}
