"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  DEFAULT_SF9_LAYOUT,
  Sf9PrintForms,
  type Sf9LayoutSettings,
} from "./Sf9PrintForms";
import styles from "./sf9.module.css";

type Section = {
  id: string;
  grade_level: number;
  name: string;
};

type Student = {
  id: string;
  full_name: string;
  lrn: string | null;
  grade_level: number;
  section_id: string;
  section: string;
  tve_major: string | null;
};

export default function Sf9Page() {
  const [sections, setSections] = useState<Section[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [accessMode, setAccessMode] = useState<"admin" | "adviser" | "">("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [layoutSettings, setLayoutSettings] =
    useState<Sf9LayoutSettings>(DEFAULT_SF9_LAYOUT);
  const [savedLayoutSettings, setSavedLayoutSettings] =
    useState<Sf9LayoutSettings>(DEFAULT_SF9_LAYOUT);
  const [layoutEditorOpen, setLayoutEditorOpen] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [layoutMessage, setLayoutMessage] = useState("");

  async function loadBase() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/academic/sf9", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to load SF9 records.");
        return;
      }

      setSections(result.sections ?? []);
      setStudents(result.students ?? []);
      setAccessMode(result.accessMode ?? "");
      if (result.layoutSettings) {
        setLayoutSettings(result.layoutSettings);
        setSavedLayoutSettings(result.layoutSettings);
      }
      setSelectedSectionId((current) => {
        if (
          current &&
          (result.sections ?? []).some((section: Section) => section.id === current)
        ) {
          return current;
        }
        return result.sections?.[0]?.id ?? "";
      });
    } catch {
      setError("Unable to reach the SF9 service.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBase();
  }, []);

  useEffect(() => {
    setSelectedIds([]);
    setDetail(null);
    setSearch("");
  }, [selectedSectionId]);

  useEffect(() => {
    if (!selectedSectionId || selectedIds.length === 0) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    async function loadDetail() {
      setLoadingDetail(true);
      setError("");
      try {
        const params = new URLSearchParams({
          sectionId: selectedSectionId,
          studentIds: selectedIds.join(","),
        });
        const response = await fetch("/api/academic/sf9?" + params.toString(), {
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (!cancelled) setError(result.error ?? "Unable to prepare SF9.");
          return;
        }
        if (!cancelled) setDetail(result);
      } catch {
        if (!cancelled) setError("Unable to reach the SF9 service.");
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedSectionId, selectedIds]);

  const selectedSection = sections.find(
    (section) => section.id === selectedSectionId
  );

  const sectionStudents = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return students
      .filter((student) => student.section_id === selectedSectionId)
      .filter((student) => {
        if (!needle) return true;
        return [student.full_name, student.lrn ?? "", student.tve_major ?? ""].some(
          (value) => value.toLowerCase().includes(needle)
        );
      });
  }, [students, selectedSectionId, search]);

  function toggleStudent(studentId: string) {
    setSelectedIds((current) => {
      if (current.includes(studentId)) {
        return current.filter((id) => id !== studentId);
      }
      if (current.length >= 2) return current;
      return [...current, studentId];
    });
  }

  function printSf9() {
    if (!detail?.cards?.length) return;
    window.print();
  }

  function updateLayoutNumber(
    key: keyof Sf9LayoutSettings,
    value: string
  ) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return;
    setLayoutSettings((current) => ({
      ...current,
      [key]: numberValue,
    }));
    setLayoutMessage("");
  }

  function resetToExcelLayout() {
    setLayoutSettings(DEFAULT_SF9_LAYOUT);
    setLayoutMessage("Excel template defaults loaded in the preview. Click Save Layout to apply them school-wide.");
  }

  function cancelLayoutChanges() {
    setLayoutSettings(savedLayoutSettings);
    setLayoutMessage("");
    setLayoutEditorOpen(false);
  }

  async function saveLayout() {
    if (accessMode !== "admin") return;
    setSavingLayout(true);
    setError("");
    setLayoutMessage("");
    try {
      const response = await fetch("/api/academic/sf9", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_layout",
          settings: layoutSettings,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to save the SF9 layout.");
        return;
      }
      setLayoutSettings(result.settings ?? layoutSettings);
      setSavedLayoutSettings(result.settings ?? layoutSettings);
      setLayoutMessage("SF9 layout saved. Advisers will use these settings when they print report cards.");
    } catch {
      setError("Unable to reach the SF9 layout service.");
    } finally {
      setSavingLayout(false);
    }
  }

  const layoutFields: Array<{
    key: keyof Sf9LayoutSettings;
    label: string;
    unit: string;
    min: number;
    max: number;
    step: number;
    help: string;
  }> = [
    {
      key: "headerHeightMm",
      label: "Header Height",
      unit: "mm",
      min: 16,
      max: 40,
      step: 0.1,
      help: "Controls the school header block before the report title.",
    },
    {
      key: "headerGapMm",
      label: "School Name to Report Title",
      unit: "mm",
      min: 0,
      max: 15,
      step: 0.1,
      help: "The vertical gap after ASUNCION NATIONAL HIGH SCHOOL.",
    },
    {
      key: "logoSizeMm",
      label: "Logo Size",
      unit: "mm",
      min: 12,
      max: 30,
      step: 0.1,
      help: "DepEd and school logo size.",
    },
    {
      key: "leftCardWidthMm",
      label: "Left Card Width",
      unit: "mm",
      min: 110,
      max: 150,
      step: 0.1,
      help: "Physical width of the first report card on the A4 sheet.",
    },
    {
      key: "rightCardWidthMm",
      label: "Right Card Width",
      unit: "mm",
      min: 110,
      max: 150,
      step: 0.1,
      help: "Physical width of the second report card on the A4 sheet.",
    },
    {
      key: "centerLineMm",
      label: "Center Divider",
      unit: "mm",
      min: 0.1,
      max: 1.5,
      step: 0.01,
      help: "Width of the vertical divider between the two cards.",
    },
    {
      key: "leftCardOuterMm",
      label: "Left Card Outer Margin",
      unit: "mm",
      min: 0,
      max: 25,
      step: 0.1,
      help: "Space from the left card edge to its content.",
    },
    {
      key: "leftCardInnerMm",
      label: "Left Card Center Margin",
      unit: "mm",
      min: 0,
      max: 25,
      step: 0.1,
      help: "Space between the first card content and the center divider.",
    },
    {
      key: "rightCardInnerMm",
      label: "Right Card Center Margin",
      unit: "mm",
      min: 0,
      max: 25,
      step: 0.1,
      help: "Space between the center divider and the second card content.",
    },
    {
      key: "rightCardOuterMm",
      label: "Right Card Outer Margin",
      unit: "mm",
      min: 0,
      max: 25,
      step: 0.1,
      help: "Space from the second card content to its right edge.",
    },
    {
      key: "topMm",
      label: "Card Top Margin",
      unit: "mm",
      min: 0,
      max: 20,
      step: 0.1,
      help: "Top content inset inside both cards.",
    },
    {
      key: "bottomMm",
      label: "Card Bottom Margin",
      unit: "mm",
      min: 0,
      max: 20,
      step: 0.1,
      help: "Bottom content inset inside both cards.",
    },
    {
      key: "frontFontPt",
      label: "Front Base Font",
      unit: "pt",
      min: 5,
      max: 11,
      step: 0.1,
      help: "Base font size for the front page.",
    },
    {
      key: "backFontPt",
      label: "Back Base Font",
      unit: "pt",
      min: 5,
      max: 11,
      step: 0.1,
      help: "Base font size for the back page.",
    },
    {
      key: "lineHeight",
      label: "Line Spacing",
      unit: "×",
      min: 0.9,
      max: 1.5,
      step: 0.01,
      help: "Overall text line-height multiplier.",
    },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topActions}>
          <a href="/portal">
            <ArrowLeft size={16} />
            Back to Portal
          </a>
          <button type="button" onClick={() => void loadBase()} disabled={loading}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </nav>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>SCHOOL FORM 9</span>
            <h1>Learner&apos;s Progress Report Card</h1>
            <p>
              Print one or two learner report cards on one A4 landscape sheet.
              The second page is the aligned back side for duplex printing.
            </p>
          </div>
          <div className={styles.accessBadge}>
            <ShieldCheck size={18} />
            {accessMode === "adviser" ? "Section Adviser Access" : "Administrator Access"}
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}

        <section className={styles.instructions}>
          <FileSpreadsheet size={21} />
          <div>
            <strong>A4 Front and Back Layout</strong>
            <span>
              Select up to two learners from the same section. For one learner,
              the card stays on the left half at the correct physical size and
              the right half remains blank so front/back alignment is preserved.
            </span>
          </div>
        </section>

        {accessMode === "admin" && (
          <section className={styles.layoutEditor}>
            <div className={styles.layoutEditorHeader}>
              <div>
                <strong>SF9 Layout Editor</strong>
                <span>
                  Adjust the print layout visually. A4 Landscape is fixed. Changes
                  update the preview immediately and become school-wide only after
                  you click Save Layout.
                </span>
              </div>
              <button
                type="button"
                className={styles.layoutEditorToggle}
                onClick={() => setLayoutEditorOpen((current) => !current)}
              >
                <Settings2 size={16} />
                {layoutEditorOpen ? "Hide Layout Editor" : "Edit Layout"}
              </button>
            </div>

            {layoutEditorOpen && (
              <div className={styles.layoutEditorBody}>
                <div className={styles.layoutEditorNote}>
                  <strong>Excel reference:</strong> A4 Landscape. The current
                  defaults use the workbook&apos;s wider center separation and a
                  shorter header gap below ASUNCION NATIONAL HIGH SCHOOL. The same
                  geometry is retained when only one learner is selected.
                </div>

                <div className={styles.layoutGrid}>
                  {layoutFields.map((field) => (
                    <label key={field.key} className={styles.layoutField}>
                      <span>
                        {field.label} ({field.unit})
                      </span>
                      <input
                        type="number"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={Number(layoutSettings[field.key])}
                        onChange={(event) =>
                          updateLayoutNumber(field.key, event.target.value)
                        }
                      />
                      <small>{field.help}</small>
                    </label>
                  ))}
                </div>

                {layoutMessage && (
                  <div className={styles.layoutEditorNote}>{layoutMessage}</div>
                )}

                <div className={styles.layoutEditorActions}>
                  <button
                    type="button"
                    className={styles.layoutReset}
                    onClick={resetToExcelLayout}
                    disabled={savingLayout}
                  >
                    <RotateCcw size={15} />
                    Reset to Excel
                  </button>
                  <button
                    type="button"
                    className={styles.layoutCancel}
                    onClick={cancelLayoutChanges}
                    disabled={savingLayout}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.layoutSave}
                    onClick={() => void saveLayout()}
                    disabled={savingLayout}
                  >
                    <Save size={15} />
                    {savingLayout ? "Saving…" : "Save Layout"}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        <section className={styles.selectorPanel}>
          <div className={styles.selectorTop}>
            <label>
              <span>Section</span>
              <select
                value={selectedSectionId}
                disabled={loading || sections.length === 0}
                onChange={(event) => setSelectedSectionId(event.target.value)}
              >
                {sections.length === 0 && <option value="">No Section Available</option>}
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    Grade {section.grade_level} · {section.name}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.selectionCount}>
              <Users size={18} />
              <div>
                <span>SELECTED</span>
                <strong>{selectedIds.length} / 2 Learners</strong>
              </div>
            </div>

            <button
              type="button"
              className={styles.printButton}
              disabled={!detail?.cards?.length || loadingDetail}
              onClick={printSf9}
            >
              <Printer size={17} />
              {loadingDetail ? "Preparing…" : "Print SF9"}
            </button>
          </div>

          <div className={styles.search}>
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search learner, LRN, or TVE major"
            />
          </div>

          <div className={styles.studentList}>
            {loading ? (
              <div className={styles.empty}>Loading learners…</div>
            ) : sectionStudents.length === 0 ? (
              <div className={styles.empty}>
                No active learners found in the selected section.
              </div>
            ) : (
              sectionStudents.map((student) => {
                const checked = selectedIds.includes(student.id);
                const disabled = !checked && selectedIds.length >= 2;
                return (
                  <button
                    type="button"
                    key={student.id}
                    className={checked ? styles.selectedStudent : styles.student}
                    disabled={disabled}
                    onClick={() => toggleStudent(student.id)}
                  >
                    <span className={styles.checkBox}>
                      {checked && <CheckCircle2 size={18} />}
                    </span>
                    <div>
                      <strong>{student.full_name}</strong>
                      <span>LRN {student.lrn ?? "Not Recorded"}</span>
                      <small>
                        Grade {student.grade_level} · {student.section}
                        {student.tve_major ? " · " + student.tve_major : ""}
                      </small>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className={styles.previewHeading}>
          <div>
            <span>PRINT PREVIEW</span>
            <h2>
              {selectedSection
                ? "Grade " + selectedSection.grade_level + " · " + selectedSection.name
                : "Select a Section"}
            </h2>
          </div>
          <p>
            Only <strong>published</strong> term grades are printed. Attendance is
            summarized from the section&apos;s recorded daily attendance.
          </p>
        </section>

        {selectedIds.length === 0 ? (
          <section className={styles.previewPlaceholder}>
            <Printer size={34} />
            <strong>Select one or two learners</strong>
            <span>The A4 front and back preview will appear here.</span>
          </section>
        ) : loadingDetail || !detail ? (
          <section className={styles.previewPlaceholder}>
            Preparing the report card preview…
          </section>
        ) : (
          <section className={styles.previewCanvas}>
            <Sf9PrintForms detail={detail} layoutSettings={layoutSettings} />
          </section>
        )}
      </div>
    </main>
  );
}
