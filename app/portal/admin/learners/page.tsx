"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  ChevronRight,
  Download,
  Edit3,
  GraduationCap,
  History,
  KeyRound,
  RefreshCw,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";
import styles from "./learners.module.css";
import ActionWaitOverlay from "@/app/components/action-wait-overlay";
import { TECHNICAL_VOCATIONAL_MAJORS } from "@/lib/subject-config";

type LearnerStatus =
  | "active"
  | "transferred_in"
  | "transferred_out"
  | "dropped"
  | "graduated"
  | "retained"
  | "archived";

type SchoolYear = {
  id: string;
  name: string;
  start_year: number;
  end_year: number;
  is_active: boolean;
};

type Section = {
  id: string;
  grade_level: number;
  name: string;
  is_active: boolean;
};

type LearnerInfo = {
  last_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  name_extension?: string | null;
  sex?: string | null;
  birth_date?: string | null;
  mother_tongue?: string | null;
  ethnic_group?: string | null;
  religion?: string | null;
  address_house_street_purok?: string | null;
  address_barangay?: string | null;
  address_municipality_city?: string | null;
  address_province?: string | null;
  father_name?: string | null;
  mother_maiden_name?: string | null;
  guardian_name?: string | null;
  guardian_relationship?: string | null;
  guardian_contact_number?: string | null;
  learning_modality?: string | null;
  remarks?: string | null;
};

type Enrollment = {
  id: string;
  student_id: string;
  school_year_id: string;
  school_year: string;
  school_year_start: number | null;
  school_year_end: number | null;
  school_year_is_active: boolean;
  grade_level: number;
  section_id: string | null;
  section: string;
  tve_major: string | null;
  enrollment_status: string;
  learner_status: LearnerStatus;
  status_note: string | null;
  status_changed_at: string | null;
  enrolled_at: string;
  source_enrollment_id: string | null;
  adviser_name: string;
};

type EnrollmentEvent = {
  id: string;
  school_year: string;
  event_type: string;
  from_grade_level: number | null;
  from_section: string;
  to_grade_level: number | null;
  to_section: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string;
};

type Learner = {
  id: string;
  full_name: string;
  lrn: string | null;
  recovery_phone: string | null;
  account_status: string;
  grade_level: number | null;
  section: string | null;
  created_at: string;
  learner_info: LearnerInfo | null;
  enrollments: Enrollment[];
  events: EnrollmentEvent[];
};

type StatusTarget = {
  learner: Learner;
  enrollment: Enrollment;
  status: LearnerStatus;
  note: string;
};

type MoveTarget = {
  learner: Learner;
  enrollment: Enrollment;
  targetSectionId: string;
  note: string;
};

const statusOptions: Array<{ value: LearnerStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "transferred_in", label: "Transferred In" },
  { value: "transferred_out", label: "Transferred Out" },
  { value: "dropped", label: "Dropped" },
  { value: "graduated", label: "Graduated" },
  { value: "retained", label: "Retained" },
  { value: "archived", label: "Archived" },
];

const statusLabels: Record<LearnerStatus, string> = {
  active: "Active",
  transferred_in: "Transferred In",
  transferred_out: "Transferred Out",
  dropped: "Dropped",
  graduated: "Graduated",
  retained: "Retained",
  archived: "Archived",
};

function display(value: unknown) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : value + "T00:00:00");
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function addressOf(info: LearnerInfo | null) {
  if (!info) return "—";
  return [
    info.address_house_street_purok,
    info.address_barangay,
    info.address_municipality_city,
    info.address_province,
  ]
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .join(", ") || "—";
}

function escapeCsv(value: unknown) {
  return '"' + String(value ?? "").replace(/"/g, '""') + '"';
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const content = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\r\n");
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function LearnerManagementPage() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [activeYear, setActiveYear] = useState<SchoolYear | null>(null);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailLearner, setDetailLearner] = useState<Learner | null>(null);
  const [statusTarget, setStatusTarget] = useState<StatusTarget | null>(null);
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [transitionType, setTransitionType] = useState<"promoted" | "retained" | "graduated">("promoted");
  const [targetYearId, setTargetYearId] = useState("");
  const [targetSectionId, setTargetSectionId] = useState("");
  const [transitionNote, setTransitionNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [majorSaving, setMajorSaving] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/learners", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to load learners.");

      const years = (result.school_years ?? []) as SchoolYear[];
      const active = (result.active_year ?? null) as SchoolYear | null;
      setLearners((result.learners ?? []) as Learner[]);
      setSections((result.sections ?? []) as Section[]);
      setSchoolYears(years);
      setActiveYear(active);
      setSelectedYearId((current) => current || active?.id || years.at(-1)?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load learners.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const selectedYear = useMemo(
    () => schoolYears.find((year) => year.id === selectedYearId) ?? null,
    [schoolYears, selectedYearId]
  );

  function enrollmentForYear(learner: Learner) {
    return learner.enrollments.find((item) => item.school_year_id === selectedYearId) ?? null;
  }

  const gradeOptions = useMemo(
    () => Array.from(new Set(sections.map((section) => section.grade_level))).sort((a, b) => a - b),
    [sections]
  );

  const sectionOptions = useMemo(
    () =>
      gradeFilter
        ? sections.filter(
            (section) =>
              section.grade_level === Number(gradeFilter) && section.is_active
          )
        : sections.filter((section) => section.is_active),
    [sections, gradeFilter]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    const rows = learners.flatMap((learner) => {
      const enrollment = enrollmentForYear(learner);
      if (!enrollment) return [];
      if (gradeFilter && enrollment.grade_level !== Number(gradeFilter)) return [];
      if (sectionFilter && enrollment.section_id !== sectionFilter) return [];
      if (
        statusFilter !== "all" &&
        (enrollment.learner_status ?? "active") !== statusFilter
      ) {
        return [];
      }

      if (query) {
        const matches = [
          learner.full_name,
          learner.lrn,
          learner.learner_info?.last_name,
          learner.learner_info?.first_name,
          learner.learner_info?.sex,
          enrollment.section,
          enrollment.adviser_name,
          enrollment.tve_major,
        ]
          .map((item) => String(item ?? "").toLowerCase())
          .some((item) => item.includes(query));

        if (!matches) return [];
      }

      return [{ learner, enrollment }];
    });

    if (!sectionFilter) return rows;

    const sexRank = (sex: string | null | undefined) => {
      const normalized = String(sex ?? "").trim().toUpperCase();
      if (normalized === "M") return 0;
      if (normalized === "F") return 1;
      return 2;
    };

    return rows.sort((a, b) => {
      const bySex =
        sexRank(a.learner.learner_info?.sex) -
        sexRank(b.learner.learner_info?.sex);
      if (bySex !== 0) return bySex;

      const aLast =
        String(a.learner.learner_info?.last_name ?? "").trim() ||
        a.learner.full_name;
      const bLast =
        String(b.learner.learner_info?.last_name ?? "").trim() ||
        b.learner.full_name;
      const byLast = aLast.localeCompare(bLast, undefined, {
        sensitivity: "base",
      });
      if (byLast !== 0) return byLast;

      const aFirst = String(
        a.learner.learner_info?.first_name ?? a.learner.full_name
      ).trim();
      const bFirst = String(
        b.learner.learner_info?.first_name ?? b.learner.full_name
      ).trim();
      return aFirst.localeCompare(bFirst, undefined, {
        sensitivity: "base",
      });
    });
  }, [learners, selectedYearId, gradeFilter, sectionFilter, statusFilter, search]);

  const summary = useMemo(() => {
    const enrolled = filtered.filter(({ enrollment }) =>
      ["active", "transferred_in"].includes(enrollment.learner_status ?? "active")
    ).length;
    const male = filtered.filter(
      ({ learner }) => learner.learner_info?.sex === "M"
    ).length;
    const female = filtered.filter(
      ({ learner }) => learner.learner_info?.sex === "F"
    ).length;
    return { total: filtered.length, enrolled, male, female };
  }, [filtered]);

  const selectedRows = useMemo(
    () =>
      filtered.filter(({ learner }) => selectedIds.includes(learner.id)),
    [filtered, selectedIds]
  );

  const selectedGrades = useMemo(
    () => Array.from(new Set(selectedRows.map(({ enrollment }) => enrollment.grade_level))),
    [selectedRows]
  );

  const transitionSourceGrade =
    selectedGrades.length === 1 ? selectedGrades[0] : null;

  const transitionTargetGrade =
    transitionSourceGrade === null
      ? null
      : transitionType === "promoted"
        ? transitionSourceGrade + 1
        : transitionSourceGrade;

  const futureYears = useMemo(
    () =>
      selectedYear
        ? schoolYears.filter((year) => year.start_year > selectedYear.start_year)
        : [],
    [schoolYears, selectedYear]
  );

  const targetSections = useMemo(
    () =>
      transitionTargetGrade
        ? sections.filter(
            (section) =>
              section.grade_level === transitionTargetGrade && section.is_active
          )
        : [],
    [sections, transitionTargetGrade]
  );

  useEffect(() => {
    setSelectedIds([]);
    setSectionFilter("");
  }, [selectedYearId, gradeFilter]);

  useEffect(() => {
    setTargetSectionId("");
    if (!targetYearId && futureYears.length === 1) {
      setTargetYearId(futureYears[0].id);
    }
  }, [transitionType, transitionTargetGrade, futureYears, targetYearId]);

  async function postAction(body: Record<string, unknown>) {
    setWorking(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/learners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          (result.error ?? "The learner record could not be updated.") +
            (result.detail ? " " + result.detail : "")
        );
      }
      return result;
    } finally {
      setWorking(false);
    }
  }

  async function saveTveMajor(
    learnerId: string,
    enrollmentId: string,
    major: string
  ) {
    setMajorSaving(enrollmentId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/learners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_tve_major",
          enrollment_id: enrollmentId,
          tve_major: major,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          (result.error ?? "Unable to update the learner TVE Major.") +
            (result.detail ? " " + result.detail : "")
        );
      }

      const nextMajor = major || null;
      setLearners((current) =>
        current.map((learner) =>
          learner.id === learnerId
            ? {
                ...learner,
                enrollments: learner.enrollments.map((enrollment) =>
                  enrollment.id === enrollmentId
                    ? { ...enrollment, tve_major: nextMajor }
                    : enrollment
                ),
              }
            : learner
        )
      );

      setDetailLearner((current) =>
        current?.id === learnerId
          ? {
              ...current,
              enrollments: current.enrollments.map((enrollment) =>
                enrollment.id === enrollmentId
                  ? { ...enrollment, tve_major: nextMajor }
                  : enrollment
              ),
            }
          : current
      );

      setSuccess("Learner TVE Major updated.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update the learner TVE Major."
      );
    } finally {
      setMajorSaving("");
    }
  }

  async function saveStatus() {
    if (!statusTarget) return;
    try {
      await postAction({
        action: "update_status",
        enrollment_id: statusTarget.enrollment.id,
        learner_status: statusTarget.status,
        note: statusTarget.note,
      });
      setStatusTarget(null);
      setSuccess("Learner status updated.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update learner status.");
    }
  }

  async function saveMove() {
    if (!moveTarget?.targetSectionId) return;
    try {
      await postAction({
        action: "move_section",
        enrollment_id: moveTarget.enrollment.id,
        target_section_id: moveTarget.targetSectionId,
        note: moveTarget.note,
      });
      setMoveTarget(null);
      setSuccess("Learner section updated.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to move learner.");
    }
  }

  async function runTransition() {
    if (!selectedRows.length || !selectedYear) return;

    if (selectedGrades.length !== 1) {
      setError("Select learners from only one Grade Level for a bulk transition.");
      return;
    }

    if (transitionType === "graduated") {
      if (transitionSourceGrade !== 12) {
        setError("Only Grade 12 learners can be marked Graduated.");
        return;
      }
    } else if (!targetYearId || !targetSectionId || !transitionTargetGrade) {
      setError("Choose the target school year and section.");
      return;
    }

    try {
      const result = await postAction({
        action: "transition",
        transition_type: transitionType,
        source_school_year_id: selectedYear.id,
        target_school_year_id:
          transitionType === "graduated" ? null : targetYearId,
        target_grade_level:
          transitionType === "graduated"
            ? transitionSourceGrade
            : transitionTargetGrade,
        target_section_id:
          transitionType === "graduated" ? null : targetSectionId,
        student_ids: selectedRows.map(({ learner }) => learner.id),
        note: transitionNote,
      });

      setTransitionOpen(false);
      setSelectedIds([]);
      setTransitionNote("");
      setTargetSectionId("");

      if (Number(result.failed ?? 0) > 0) {
        const first = Array.isArray(result.errors) ? result.errors[0]?.error : "";
        setSuccess(
          `${result.succeeded ?? 0} learner(s) updated. ${result.failed ?? 0} learner(s) need review.`
        );
        if (first) setError(first);
      } else {
        setSuccess(
          transitionType === "promoted"
            ? "Selected learners were promoted to the target school year."
            : transitionType === "retained"
              ? "Selected learners were retained and enrolled in the target school year."
              : "Selected Grade 12 learners were marked Graduated."
        );
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk transition failed.");
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function toggleAll() {
    const ids = filtered.map(({ learner }) => learner.id);
    const everySelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    setSelectedIds(everySelected ? [] : ids);
  }

  function exportMasterlist() {
    const yearName = selectedYear?.name ?? "School_Year";
    const className =
      gradeFilter && sectionFilter
        ? `Grade_${gradeFilter}_${sections.find((item) => item.id === sectionFilter)?.name ?? "Section"}`
        : gradeFilter
          ? `Grade_${gradeFilter}`
          : "All_Learners";

    downloadCsv(
      `ANHS_${yearName.replace(/\s+/g, "_")}_${className.replace(/\s+/g, "_")}_Masterlist.csv`,
      [
        "LRN",
        "Learner Name",
        "Sex",
        "Grade Level",
        "Section",
        "TVE Major",
        "Learner Status",
        "Adviser",
        "Guardian",
        "Guardian Contact",
        "Address",
      ],
      filtered.map(({ learner, enrollment }) => [
        learner.lrn ?? "",
        learner.full_name,
        learner.learner_info?.sex ?? "",
        enrollment.grade_level,
        enrollment.section,
        enrollment.tve_major ?? "",
        statusLabels[enrollment.learner_status ?? "active"],
        enrollment.adviser_name,
        learner.learner_info?.guardian_name ?? "",
        learner.learner_info?.guardian_contact_number ?? learner.recovery_phone ?? "",
        addressOf(learner.learner_info),
      ])
    );
  }

  const allFilteredSelected =
    filtered.length > 0 &&
    filtered.every(({ learner }) => selectedIds.includes(learner.id));

  const selectedCredentialSection =
    sections.find((section) => section.id === sectionFilter) ?? null;

  return (
    <main className={styles.page}>
      <ActionWaitOverlay
        visible={working || Boolean(majorSaving)}
        message="Please wait…"
      />
      <div className={styles.shell}>
        <nav className={styles.topbar}>
          <a href="/portal"><ArrowLeft size={16} />Back to portal</a>
          <div>
            <a href="/portal/admin/masterlist">Bulk import SF1</a>
            <a href="/portal/admin/users">Users & accounts</a>
          </div>
        </nav>

        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <div className={styles.headerIcon}><GraduationCap size={22} /></div>
            <div>
              <span>ACADEMIC RECORDS</span>
              <h1>Learner management</h1>
              <p>
                Manage class placement, enrollment status, TVE majors, learner history,
                and school-year transitions from one organized workspace.
              </p>
            </div>
          </div>
          <div className={styles.yearCard}>
            <CheckCircle2 size={18} />
            <div>
              <small>ACTIVE SCHOOL YEAR</small>
              <strong>{activeYear?.name ?? "Not configured"}</strong>
            </div>
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <section className={styles.panel}>
          <div className={styles.controls}>
            <label className={styles.search}>
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search learner, LRN, section, or adviser"
              />
            </label>

            <select
              value={selectedYearId}
              onChange={(event) => setSelectedYearId(event.target.value)}
              aria-label="School year"
            >
              {schoolYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}{year.is_active ? " · Active" : ""}
                </option>
              ))}
            </select>

            <select
              value={gradeFilter}
              onChange={(event) => {
                setGradeFilter(event.target.value);
                setSectionFilter("");
              }}
              aria-label="Grade level"
            >
              <option value="">All grade levels</option>
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>Grade {grade}</option>
              ))}
            </select>

            <select
              value={sectionFilter}
              onChange={(event) => setSectionFilter(event.target.value)}
              aria-label="Section"
            >
              <option value="">All sections</option>
              {sectionOptions.map((section) => (
                <option key={section.id} value={section.id}>
                  Grade {section.grade_level} · {section.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Learner status"
            >
              <option value="all">All statuses</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button className={styles.refresh} onClick={() => void loadData()} disabled={loading}>
              <RefreshCw size={16} />Refresh
            </button>
          </div>

          <div className={styles.summaryBar}>
            <div className={styles.summaryPills}>
              <div className={styles.summaryCard}>
                <span className={styles.summaryIcon}><Users size={16} /></span>
                <div><small>Total learners</small><strong>{summary.total}</strong></div>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryIcon}><CheckCircle2 size={16} /></span>
                <div><small>Enrolled</small><strong>{summary.enrolled}</strong></div>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryIcon}><UserRound size={16} /></span>
                <div><small>Male</small><strong>{summary.male}</strong></div>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryIcon}><UserRound size={16} /></span>
                <div><small>Female</small><strong>{summary.female}</strong></div>
              </div>
            </div>
            <div className={styles.bulkActions}>
              <button
                className={styles.secondary}
                onClick={exportMasterlist}
                disabled={!filtered.length}
              >
                <Download size={16} />Export masterlist
              </button>
              <form
                action="/api/admin/reissue-section-credentials"
                method="post"
                onSubmit={(event) => {
                  if (!gradeFilter || !selectedCredentialSection) {
                    event.preventDefault();
                    setError("Select one Grade Level and one Section first.");
                    return;
                  }
                  const confirmed = window.confirm(
                    `Generate a fresh temporary-credentials CSV for Grade ${gradeFilter} - ${selectedCredentialSection.name}? Existing temporary credentials for learners who have not changed their password yet will be replaced.`
                  );
                  if (!confirmed) event.preventDefault();
                }}
              >
                <input type="hidden" name="grade_level" value={gradeFilter} />
                <input
                  type="hidden"
                  name="section"
                  value={selectedCredentialSection?.name ?? ""}
                />
                <button
                  type="submit"
                  className={styles.secondary}
                  disabled={!gradeFilter || !selectedCredentialSection}
                >
                  <KeyRound size={16} />Download credentials
                </button>
              </form>
              <button
                className={styles.primary}
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setTransitionOpen(true);
                }}
                disabled={!selectedIds.length}
              >
                <GraduationCap size={16} />
                Transition {selectedIds.length ? `(${selectedIds.length})` : ""}
              </button>
            </div>
          </div>

          {loading ? (
            <div className={styles.empty}>Loading learner records…</div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>
              No learners match the selected school year and filters.
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleAll}
                        aria-label="Select all learners"
                      />
                    </th>
                    <th>Learner</th>
                    <th>LRN</th>
                    <th>Sex</th>
                    <th>Class</th>
                    <th>TVE Major</th>
                    <th>Status</th>
                    <th>Adviser</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(({ learner, enrollment }) => (
                    <tr key={learner.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(learner.id)}
                          onChange={() => toggleSelected(learner.id)}
                          aria-label={`Select ${learner.full_name}`}
                        />
                      </td>
                      <td>
                        <div className={styles.nameCell}>
                          <span className={styles.avatar}><UserRound size={17} /></span>
                          <div>
                            <strong>{learner.full_name}</strong>
                            <small>{learner.learner_info?.guardian_contact_number || learner.recovery_phone || "No contact number"}</small>
                          </div>
                        </div>
                      </td>
                      <td>{learner.lrn || "—"}</td>
                      <td>
                        {learner.learner_info?.sex === "M"
                          ? "Male"
                          : learner.learner_info?.sex === "F"
                            ? "Female"
                            : "—"}
                      </td>
                      <td>
                        <strong>Grade {enrollment.grade_level}</strong>
                        <small className={styles.blockText}>{enrollment.section || "No section"}</small>
                      </td>
                      <td>
                        {[8, 9, 10].includes(enrollment.grade_level) ? (
                          <select
                            className={styles.majorSelect}
                            value={enrollment.tve_major ?? ""}
                            disabled={majorSaving === enrollment.id}
                            aria-label={`TVE Major for ${learner.full_name}`}
                            onChange={(event) =>
                              void saveTveMajor(
                                learner.id,
                                enrollment.id,
                                event.target.value
                              )
                            }
                          >
                            <option value="">Not assigned</option>
                            {TECHNICAL_VOCATIONAL_MAJORS.map((major) => (
                              <option key={major} value={major}>
                                {major}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={styles.notApplicable}>
                            {enrollment.grade_level === 7 ? "Exploratory" : "—"}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`${styles.status} ${styles[enrollment.learner_status ?? "active"]}`}>
                          {statusLabels[enrollment.learner_status ?? "active"]}
                        </span>
                      </td>
                      <td>{enrollment.adviser_name || "Not assigned"}</td>
                      <td>
                        <div className={styles.actions}>
                          <button onClick={() => setDetailLearner(learner)}>
                            <UserRound size={14} />View
                          </button>
                          <button
                            onClick={() =>
                              setStatusTarget({
                                learner,
                                enrollment,
                                status: enrollment.learner_status ?? "active",
                                note: enrollment.status_note ?? "",
                              })
                            }
                          >
                            <Edit3 size={14} />Status
                          </button>
                          <button
                            onClick={() =>
                              setMoveTarget({
                                learner,
                                enrollment,
                                targetSectionId: "",
                                note: "",
                              })
                            }
                          >
                            <ArrowRightLeft size={14} />Move
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {detailLearner && (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={`${styles.modal} ${styles.detailModal}`} role="dialog" aria-modal="true">
            <div className={styles.modalHead}>
              <div>
                <span>LEARNER PROFILE</span>
                <h2>{detailLearner.full_name}</h2>
                <p>LRN {detailLearner.lrn || "Not recorded"}</p>
              </div>
              <button className={styles.iconButton} onClick={() => setDetailLearner(null)} aria-label="Close">
                <X size={19} />
              </button>
            </div>

            <div className={styles.detailGrid}>
              <div><span>Sex</span><strong>{display(detailLearner.learner_info?.sex)}</strong></div>
              <div><span>Birth date</span><strong>{dateLabel(detailLearner.learner_info?.birth_date)}</strong></div>
              <div><span>Mother tongue</span><strong>{display(detailLearner.learner_info?.mother_tongue)}</strong></div>
              <div><span>Ethnic group</span><strong>{display(detailLearner.learner_info?.ethnic_group)}</strong></div>
              <div><span>Religion</span><strong>{display(detailLearner.learner_info?.religion)}</strong></div>
              <div><span>Learning modality</span><strong>{display(detailLearner.learner_info?.learning_modality)}</strong></div>
              {[8, 9, 10].includes(enrollmentForYear(detailLearner)?.grade_level ?? 0) && (
                <div>
                  <span>TVE Major</span>
                  <strong>{display(enrollmentForYear(detailLearner)?.tve_major)}</strong>
                </div>
              )}
            </div>

            <section className={styles.detailSection}>
              <h3>Address & family information</h3>
              <div className={styles.detailRows}>
                <div><span>Address</span><strong>{addressOf(detailLearner.learner_info)}</strong></div>
                <div><span>Father</span><strong>{display(detailLearner.learner_info?.father_name)}</strong></div>
                <div><span>Mother&apos;s maiden name</span><strong>{display(detailLearner.learner_info?.mother_maiden_name)}</strong></div>
                <div><span>Guardian</span><strong>{display(detailLearner.learner_info?.guardian_name)}</strong></div>
                <div><span>Relationship</span><strong>{display(detailLearner.learner_info?.guardian_relationship)}</strong></div>
                <div><span>Guardian contact</span><strong>{display(detailLearner.learner_info?.guardian_contact_number || detailLearner.recovery_phone)}</strong></div>
                <div><span>SF1 remarks</span><strong>{display(detailLearner.learner_info?.remarks)}</strong></div>
              </div>
            </section>

            <section className={styles.detailSection}>
              <h3><History size={17} />Enrollment history</h3>
              {detailLearner.enrollments.length ? (
                <div className={styles.historyTable}>
                  <table>
                    <thead>
                      <tr><th>School Year</th><th>Grade & Section</th><th>Status</th><th>Adviser</th><th>Note</th></tr>
                    </thead>
                    <tbody>
                      {detailLearner.enrollments.map((enrollment) => (
                        <tr key={enrollment.id}>
                          <td>{enrollment.school_year}</td>
                          <td>Grade {enrollment.grade_level} · {enrollment.section || "No section"}</td>
                          <td>{statusLabels[enrollment.learner_status ?? "active"]}</td>
                          <td>{enrollment.adviser_name || "—"}</td>
                          <td>{enrollment.status_note || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={styles.muted}>No enrollment history found.</p>
              )}
            </section>

            <section className={styles.detailSection}>
              <h3>Enrollment activity</h3>
              {detailLearner.events.length ? (
                <div className={styles.timeline}>
                  {detailLearner.events.slice(0, 12).map((event) => (
                    <div key={event.id}>
                      <span>{dateLabel(event.created_at)}</span>
                      <strong>{event.event_type.replaceAll("_", " ")}</strong>
                      <p>
                        {event.school_year || "School year"}
                        {event.to_grade_level ? ` · Grade ${event.to_grade_level}` : ""}
                        {event.to_section ? ` · ${event.to_section}` : ""}
                        {event.note ? ` · ${event.note}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.muted}>No status or movement events have been recorded yet.</p>
              )}
            </section>

            <div className={styles.modalActions}>
              <a
                className={styles.linkButton}
                href={`/portal/admin/users?q=${encodeURIComponent(detailLearner.lrn || detailLearner.full_name)}`}
              >
                <Edit3 size={15} />Edit SF1 profile
              </a>
              <button type="button" onClick={() => setDetailLearner(null)}>Close</button>
            </div>
          </section>
        </div>
      )}

      {statusTarget && (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.modal} role="dialog" aria-modal="true">
            <div className={styles.modalHead}>
              <div>
                <span>LEARNER STATUS</span>
                <h2>{statusTarget.learner.full_name}</h2>
                <p>{selectedYear?.name} · Grade {statusTarget.enrollment.grade_level} · {statusTarget.enrollment.section}</p>
              </div>
              <button className={styles.iconButton} onClick={() => setStatusTarget(null)} aria-label="Close">
                <X size={19} />
              </button>
            </div>

            <label className={styles.field}>
              <span>Status</span>
              <select
                value={statusTarget.status}
                onChange={(event) =>
                  setStatusTarget({
                    ...statusTarget,
                    status: event.target.value as LearnerStatus,
                  })
                }
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Note / reason</span>
              <textarea
                value={statusTarget.note}
                onChange={(event) =>
                  setStatusTarget({ ...statusTarget, note: event.target.value })
                }
                placeholder="Optional reason, destination school, date, or other note"
              />
            </label>

            <p className={styles.helpText}>
              This changes the learner&apos;s academic enrollment status only. It does not delete or suspend the learner&apos;s portal account.
            </p>

            <div className={styles.modalActions}>
              <button type="button" onClick={() => setStatusTarget(null)}>Cancel</button>
              <button className={styles.primary} type="button" onClick={() => void saveStatus()} disabled={working}>
                {working ? "Saving…" : "Save status"}
              </button>
            </div>
          </section>
        </div>
      )}

      {moveTarget && (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.modal} role="dialog" aria-modal="true">
            <div className={styles.modalHead}>
              <div>
                <span>MOVE SECTION</span>
                <h2>{moveTarget.learner.full_name}</h2>
                <p>Grade {moveTarget.enrollment.grade_level} · Current: {moveTarget.enrollment.section}</p>
              </div>
              <button className={styles.iconButton} onClick={() => setMoveTarget(null)} aria-label="Close">
                <X size={19} />
              </button>
            </div>

            <label className={styles.field}>
              <span>New section</span>
              <select
                value={moveTarget.targetSectionId}
                onChange={(event) =>
                  setMoveTarget({ ...moveTarget, targetSectionId: event.target.value })
                }
              >
                <option value="">Select section</option>
                {sections
                  .filter(
                    (section) =>
                      section.is_active &&
                      section.grade_level === moveTarget.enrollment.grade_level &&
                      section.id !== moveTarget.enrollment.section_id
                  )
                  .map((section) => (
                    <option key={section.id} value={section.id}>{section.name}</option>
                  ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Reason / note</span>
              <textarea
                value={moveTarget.note}
                onChange={(event) => setMoveTarget({ ...moveTarget, note: event.target.value })}
                placeholder="Optional"
              />
            </label>

            <div className={styles.modalActions}>
              <button type="button" onClick={() => setMoveTarget(null)}>Cancel</button>
              <button
                className={styles.primary}
                type="button"
                onClick={() => void saveMove()}
                disabled={working || !moveTarget.targetSectionId}
              >
                {working ? "Moving…" : "Move learner"}
              </button>
            </div>
          </section>
        </div>
      )}

      {transitionOpen && (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.modal} role="dialog" aria-modal="true">
            <div className={styles.modalHead}>
              <div>
                <span>SCHOOL-YEAR TRANSITION</span>
                <h2>{selectedIds.length} learner{selectedIds.length === 1 ? "" : "s"} selected</h2>
                <p>{selectedYear?.name ?? "Selected school year"}</p>
              </div>
              <button className={styles.iconButton} onClick={() => setTransitionOpen(false)} aria-label="Close">
                <X size={19} />
              </button>
            </div>

            {selectedGrades.length !== 1 ? (
              <div className={styles.inlineWarning}>
                Select learners from only one Grade Level before using bulk transition.
              </div>
            ) : (
              <>
                <label className={styles.field}>
                  <span>Action</span>
                  <select
                    value={transitionType}
                    onChange={(event) => {
                      setTransitionType(
                        event.target.value as "promoted" | "retained" | "graduated"
                      );
                      setTargetSectionId("");
                    }}
                  >
                    <option value="promoted" disabled={(transitionSourceGrade ?? 12) >= 12}>
                      Promote to next Grade Level
                    </option>
                    <option value="retained">Retain in current Grade Level</option>
                    <option value="graduated" disabled={transitionSourceGrade !== 12}>
                      Mark Grade 12 as Graduated
                    </option>
                  </select>
                </label>

                {transitionType !== "graduated" && (
                  <>
                    <div className={styles.transitionGrid}>
                      <label className={styles.field}>
                        <span>Target school year</span>
                        <select
                          value={targetYearId}
                          onChange={(event) => setTargetYearId(event.target.value)}
                        >
                          <option value="">Select future school year</option>
                          {futureYears.map((year) => (
                            <option key={year.id} value={year.id}>{year.name}</option>
                          ))}
                        </select>
                      </label>

                      <label className={styles.field}>
                        <span>Target Grade Level</span>
                        <input value={transitionTargetGrade ? `Grade ${transitionTargetGrade}` : ""} readOnly />
                      </label>
                    </div>

                    {futureYears.length === 0 && (
                      <div className={styles.inlineWarning}>
                        No later school year is configured yet. Create the next school year in School Setup before promotion or retention.
                      </div>
                    )}

                    <label className={styles.field}>
                      <span>Target section</span>
                      <select
                        value={targetSectionId}
                        onChange={(event) => setTargetSectionId(event.target.value)}
                        disabled={!targetYearId}
                      >
                        <option value="">Select section</option>
                        {targetSections.map((section) => (
                          <option key={section.id} value={section.id}>{section.name}</option>
                        ))}
                      </select>
                    </label>
                  </>
                )}

                <label className={styles.field}>
                  <span>Transition note</span>
                  <textarea
                    value={transitionNote}
                    onChange={(event) => setTransitionNote(event.target.value)}
                    placeholder="Optional"
                  />
                </label>

                <p className={styles.helpText}>
                  Promotion and retention create a new enrollment record for the target school year and preserve the current school year in the learner&apos;s history.
                </p>
              </>
            )}

            <div className={styles.modalActions}>
              <button type="button" onClick={() => setTransitionOpen(false)}>Cancel</button>
              <button
                className={styles.primary}
                type="button"
                onClick={() => void runTransition()}
                disabled={
                  working ||
                  selectedGrades.length !== 1 ||
                  (transitionType !== "graduated" &&
                    (!futureYears.length || !targetYearId || !targetSectionId)) ||
                  (transitionType === "graduated" && transitionSourceGrade !== 12)
                }
              >
                <ChevronRight size={16} />
                {working
                  ? "Processing…"
                  : transitionType === "promoted"
                    ? "Promote learners"
                    : transitionType === "retained"
                      ? "Retain learners"
                      : "Mark graduated"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
