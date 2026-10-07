"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Sf9PrintForms } from "./Sf9PrintForms";
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
            <Sf9PrintForms detail={detail} />
          </section>
        )}
      </div>
    </main>
  );
}
