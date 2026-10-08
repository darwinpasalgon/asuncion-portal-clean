"use client";

import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  CheckCircle2,
  FileSpreadsheet,
  Italic,
  MousePointer2,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import {
  DEFAULT_SF9_LAYOUT,
  Sf9PrintForms,
  type Sf9BlockId,
  type Sf9BlockStyle,
  type Sf9FontFamily,
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

type Sf9NumericLayoutKey = Exclude<
  keyof Sf9LayoutSettings,
  "paper" | "orientation" | "blockStyles"
>;

const SF9_BLOCK_LABELS: Record<Sf9BlockId, string> = {
  header: "School Header",
  reportTitle: "Learner's Performance Report",
  schoolYear: "School Year",
  learnerInfo: "Learner Information",
  parentNote: "Parent Note",
  frontSignatures: "School Head and Adviser Signatures",
  progressTitle: "Learning Progress Title",
  gradeTable: "Grades Table",
  descriptorTitle: "Performance Descriptors Title",
  descriptorTable: "Performance Descriptors Table",
  attendanceTable: "Attendance Table",
  comments: "Teacher's Comments",
  guardianSignatures: "Parent/Guardian Signatures",
  transfer: "Certificate of Transfer",
  cancellation: "Cancellation of Eligibility",
};

const SF9_FONT_OPTIONS: Array<{ value: Sf9FontFamily; label: string }> = [
  { value: "bookman", label: "Bookman Old Style" },
  { value: "arial", label: "Arial" },
  { value: "times", label: "Times New Roman" },
  { value: "calibri", label: "Calibri" },
  { value: "georgia", label: "Georgia" },
];

export default function Sf9Page() {
  const [sections, setSections] = useState<Section[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [accessMode, setAccessMode] = useState<"admin" | "adviser" | "">("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [layoutSettings, setLayoutSettings] =
    useState<Sf9LayoutSettings>(DEFAULT_SF9_LAYOUT);
  const [savedLayoutSettings, setSavedLayoutSettings] =
    useState<Sf9LayoutSettings>(DEFAULT_SF9_LAYOUT);
  const [layoutEditorOpen, setLayoutEditorOpen] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [layoutMessage, setLayoutMessage] = useState("");
  const [selectedBlock, setSelectedBlock] = useState<Sf9BlockId>("header");
  const [editorSampleId, setEditorSampleId] = useState("");
  const [editorDetail, setEditorDetail] = useState<any>(null);
  const [loadingEditorDetail, setLoadingEditorDetail] = useState(false);

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
      setStudents([]);
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
    setEditorSampleId("");
    setEditorDetail(null);
    setStudents([]);

    if (!selectedSectionId) return;

    let cancelled = false;
    async function loadSectionStudents() {
      setLoadingStudents(true);
      setError("");
      try {
        const params = new URLSearchParams({ sectionId: selectedSectionId });
        const response = await fetch("/api/academic/sf9?" + params.toString(), {
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (!cancelled) {
            setStudents([]);
            setError(result.error ?? "Unable to load learners in this section.");
          }
          return;
        }
        if (!cancelled) {
          setStudents(result.students ?? []);
        }
      } catch {
        if (!cancelled) {
          setStudents([]);
          setError("Unable to load learners in this section.");
        }
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    }

    void loadSectionStudents();
    return () => {
      cancelled = true;
    };
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

  const allSectionStudents = useMemo(
    () => students.filter((student) => student.section_id === selectedSectionId),
    [students, selectedSectionId]
  );

  useEffect(() => {
    if (!layoutEditorOpen || !selectedSectionId || editorSampleId) return;
    const firstLearner = allSectionStudents[0];
    if (firstLearner) setEditorSampleId(firstLearner.id);
  }, [
    layoutEditorOpen,
    selectedSectionId,
    editorSampleId,
    allSectionStudents,
  ]);

  useEffect(() => {
    if (!layoutEditorOpen || !selectedSectionId || !editorSampleId) {
      setEditorDetail(null);
      return;
    }

    let cancelled = false;
    async function loadEditorSample() {
      setLoadingEditorDetail(true);
      setError("");
      try {
        const params = new URLSearchParams({
          sectionId: selectedSectionId,
          studentIds: editorSampleId,
        });
        const response = await fetch("/api/academic/sf9?" + params.toString(), {
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (!cancelled) {
            setError(result.error ?? "Unable to prepare the sample SF9.");
            setEditorDetail(null);
          }
          return;
        }
        if (!cancelled) setEditorDetail(result);
      } catch {
        if (!cancelled) {
          setError("Unable to reach the SF9 service.");
          setEditorDetail(null);
        }
      } finally {
        if (!cancelled) setLoadingEditorDetail(false);
      }
    }

    void loadEditorSample();
    return () => {
      cancelled = true;
    };
  }, [layoutEditorOpen, selectedSectionId, editorSampleId]);

  const selectedSection = sections.find(
    (section) => section.id === selectedSectionId
  );

  const sectionStudents = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return allSectionStudents.filter((student) => {
        if (!needle) return true;
        return [student.full_name, student.lrn ?? "", student.tve_major ?? ""].some(
          (value) => value.toLowerCase().includes(needle)
        );
      });
  }, [allSectionStudents, search]);

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
    key: Sf9NumericLayoutKey,
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

  const selectedBlockStyle =
    layoutSettings.blockStyles?.[selectedBlock] ?? {};

  function updateBlockStyle(patch: Partial<Sf9BlockStyle>) {
    setLayoutSettings((current) => ({
      ...current,
      blockStyles: {
        ...(current.blockStyles ?? {}),
        [selectedBlock]: {
          ...(current.blockStyles?.[selectedBlock] ?? {}),
          ...patch,
        },
      },
    }));
    setLayoutMessage("");
  }

  function resetSelectedBlock() {
    setLayoutSettings((current) => {
      const nextBlocks = { ...(current.blockStyles ?? {}) };
      delete nextBlocks[selectedBlock];
      return { ...current, blockStyles: nextBlocks };
    });
    setLayoutMessage(
      `${SF9_BLOCK_LABELS[selectedBlock]} returned to the default formatting.`
    );
  }

  function toggleLayoutEditor() {
    setLayoutEditorOpen((current) => !current);
    setLayoutMessage("");
  }

  function handlePreviewBlockClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!layoutEditorOpen || accessMode !== "admin") return;
    const target = event.target as HTMLElement;
    const block = target.closest<HTMLElement>("[data-sf9-block]");
    const blockId = block?.dataset.sf9Block as Sf9BlockId | undefined;
    if (!blockId || !SF9_BLOCK_LABELS[blockId]) return;
    event.preventDefault();
    setSelectedBlock(blockId);
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
    key: Sf9NumericLayoutKey;
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
                <strong>SF9 Visual Layout Editor</strong>
                <span>
                  Edit the report card like a document. Click a part of the actual
                  report card preview, then change its font, alignment, spacing, or
                  position from the toolbar. A4 Landscape and the duplex card
                  structure stay protected.
                </span>
              </div>
              <button
                type="button"
                className={styles.layoutEditorToggle}
                onClick={toggleLayoutEditor}
              >
                <Settings2 size={16} />
                {layoutEditorOpen ? "Close Visual Editor" : "Edit Layout Visually"}
              </button>
            </div>

            {layoutEditorOpen && (
              <div className={styles.layoutEditorBody}>
                <div className={styles.visualEditorHint}>
                  <MousePointer2 size={17} />
                  <span>
                    <strong>Click directly on the report card below.</strong> The
                    selected section is edited on both cards, so one saved template
                    remains consistent for every learner.
                  </span>
                </div>

                <div className={styles.editorToolbar}>
                  <label className={styles.toolbarSelect}>
                    <span>Selected</span>
                    <select
                      value={selectedBlock}
                      onChange={(event) =>
                        setSelectedBlock(event.target.value as Sf9BlockId)
                      }
                    >
                      {Object.entries(SF9_BLOCK_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.toolbarSelect}>
                    <span>Font</span>
                    <select
                      value={selectedBlockStyle.fontFamily ?? ""}
                      onChange={(event) =>
                        updateBlockStyle({
                          fontFamily:
                            (event.target.value as Sf9FontFamily) || undefined,
                        })
                      }
                    >
                      <option value="">Default</option>
                      {SF9_FONT_OPTIONS.map((font) => (
                        <option key={font.value} value={font.value}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.toolbarCompactField}>
                    <span>Size</span>
                    <input
                      type="number"
                      min="5"
                      max="16"
                      step="0.1"
                      placeholder="Auto"
                      value={selectedBlockStyle.fontPt ?? ""}
                      onChange={(event) =>
                        updateBlockStyle({
                          fontPt: event.target.value
                            ? Number(event.target.value)
                            : undefined,
                        })
                      }
                    />
                  </label>

                  <div className={styles.toolbarButtonGroup}>
                    <button
                      type="button"
                      className={
                        selectedBlockStyle.bold
                          ? styles.toolbarButtonActive
                          : styles.toolbarButton
                      }
                      title="Bold"
                      onClick={() =>
                        updateBlockStyle({
                          bold: selectedBlockStyle.bold ? undefined : true,
                        })
                      }
                    >
                      <Bold size={16} />
                    </button>
                    <button
                      type="button"
                      className={
                        selectedBlockStyle.italic
                          ? styles.toolbarButtonActive
                          : styles.toolbarButton
                      }
                      title="Italic"
                      onClick={() =>
                        updateBlockStyle({
                          italic: selectedBlockStyle.italic ? undefined : true,
                        })
                      }
                    >
                      <Italic size={16} />
                    </button>
                  </div>

                  <div className={styles.toolbarButtonGroup}>
                    {([
                      ["left", AlignLeft],
                      ["center", AlignCenter],
                      ["right", AlignRight],
                    ] as const).map(([align, Icon]) => (
                      <button
                        type="button"
                        key={align}
                        className={
                          selectedBlockStyle.align === align
                            ? styles.toolbarButtonActive
                            : styles.toolbarButton
                        }
                        title={`Align ${align}`}
                        onClick={() =>
                          updateBlockStyle({
                            align:
                              selectedBlockStyle.align === align
                                ? undefined
                                : align,
                          })
                        }
                      >
                        <Icon size={16} />
                      </button>
                    ))}
                  </div>

                  <label className={styles.toolbarCompactField}>
                    <span>Line</span>
                    <input
                      type="number"
                      min="0.8"
                      max="2"
                      step="0.01"
                      placeholder="Auto"
                      value={selectedBlockStyle.lineHeight ?? ""}
                      onChange={(event) =>
                        updateBlockStyle({
                          lineHeight: event.target.value
                            ? Number(event.target.value)
                            : undefined,
                        })
                      }
                    />
                  </label>

                  <label className={styles.toolbarCompactField}>
                    <span>X mm</span>
                    <input
                      type="number"
                      min="-30"
                      max="30"
                      step="0.1"
                      value={selectedBlockStyle.offsetXMm ?? 0}
                      onChange={(event) =>
                        updateBlockStyle({
                          offsetXMm: Number(event.target.value),
                        })
                      }
                    />
                  </label>

                  <label className={styles.toolbarCompactField}>
                    <span>Y mm</span>
                    <input
                      type="number"
                      min="-30"
                      max="30"
                      step="0.1"
                      value={selectedBlockStyle.offsetYMm ?? 0}
                      onChange={(event) =>
                        updateBlockStyle({
                          offsetYMm: Number(event.target.value),
                        })
                      }
                    />
                  </label>

                  <button
                    type="button"
                    className={styles.resetSelectedButton}
                    onClick={resetSelectedBlock}
                  >
                    <RotateCcw size={15} />
                    Reset Selected
                  </button>
                </div>

                <div className={styles.currentSelection}>
                  Editing: <strong>{SF9_BLOCK_LABELS[selectedBlock]}</strong>
                </div>

                <div className={styles.inlineEditorPreview}>
                  <div className={styles.inlineEditorPreviewHeader}>
                    <div>
                      <strong>Editable Report Card Preview</strong>
                      <span>
                        Choose a sample learner, then click any text, table,
                        signature area, or section directly on the SF9 below.
                      </span>
                    </div>
                    <label className={styles.sampleLearnerPicker}>
                      <span>Sample Learner</span>
                      <select
                        value={editorSampleId}
                        disabled={loadingStudents || allSectionStudents.length === 0}
                        onChange={(event) =>
                          setEditorSampleId(event.target.value)
                        }
                      >
                        {loadingStudents ? (
                          <option value="">Loading Learners…</option>
                        ) : allSectionStudents.length === 0 ? (
                          <option value="">No Learners Available</option>
                        ) : (
                          allSectionStudents.map((student) => (
                            <option key={student.id} value={student.id}>
                              {student.full_name}
                            </option>
                          ))
                        )}
                      </select>
                    </label>
                  </div>

                  {loadingStudents ? (
                    <div className={styles.inlineEditorEmpty}>
                      Loading learners in the selected section…
                    </div>
                  ) : allSectionStudents.length === 0 ? (
                    <div className={styles.inlineEditorEmpty}>
                      <MousePointer2 size={28} />
                      <strong>No active learner is available in this section.</strong>
                      <span>
                        Choose another section with enrolled learners to preview
                        and edit the SF9 layout.
                      </span>
                    </div>
                  ) : loadingEditorDetail || !editorDetail ? (
                    <div className={styles.inlineEditorEmpty}>
                      Preparing the editable report card…
                    </div>
                  ) : (
                    <div
                      className={
                        styles.inlineEditorCanvas + " " + styles.editorPreviewActive
                      }
                    >
                      <div
                        className={styles.previewDocumentWrap}
                        data-selected-block={selectedBlock}
                        onClickCapture={handlePreviewBlockClick}
                      >
                        <Sf9PrintForms
                          detail={editorDetail}
                          layoutSettings={layoutSettings}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <details className={styles.advancedLayout}>
                  <summary>
                    <SlidersHorizontal size={16} />
                    Page Setup & Fine Spacing
                  </summary>
                  <div className={styles.layoutEditorNote}>
                    Use these controls only for the page geometry, card margins,
                    logo size, and overall spacing. Most text editing can be done
                    from the toolbar above by clicking the preview.
                  </div>
                  <div className={styles.layoutGrid}>
                    {layoutFields.map((field) => (
                      <label key={field.key} className={styles.layoutField}>
                        <span>
                          {field.label} ({field.unit})
                        </span>
                        <input
                          type="range"
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          value={Number(layoutSettings[field.key])}
                          onChange={(event) =>
                            updateLayoutNumber(field.key, event.target.value)
                          }
                        />
                        <div className={styles.rangeValueRow}>
                          <small>{field.help}</small>
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
                        </div>
                      </label>
                    ))}
                  </div>
                </details>

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
                    Reset All to Excel
                  </button>
                  <button
                    type="button"
                    className={styles.layoutCancel}
                    onClick={cancelLayoutChanges}
                    disabled={savingLayout}
                  >
                    Cancel Changes
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
            {loading || loadingStudents ? (
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
          <section
            className={
              layoutEditorOpen && accessMode === "admin"
                ? styles.previewCanvas + " " + styles.editorPreviewActive
                : styles.previewCanvas
            }
          >
            <div
              className={styles.previewDocumentWrap}
              data-selected-block={layoutEditorOpen ? selectedBlock : undefined}
              onClickCapture={handlePreviewBlockClick}
            >
              <Sf9PrintForms detail={detail} layoutSettings={layoutSettings} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
