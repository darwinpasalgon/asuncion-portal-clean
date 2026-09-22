"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Layers3,
  Plus,
  RefreshCw,
  School,
  Users,
} from "lucide-react";
import styles from "./school-setup.module.css";

type SchoolYear = {
  id: string;
  name: string;
  start_year: number;
  end_year: number;
  is_active: boolean;
};

type GradeLevel = {
  grade_level: number;
  label: string;
  sort_order: number;
};

type Section = {
  id: string;
  grade_level: number;
  name: string;
  is_active: boolean;
};

type Enrollment = {
  id: string;
  school_year_id: string;
  grade_level: number;
  section_id: string | null;
  enrollment_status: string;
};

export default function SchoolSetupPage() {
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/academic-structure", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to load school setup.");
        return;
      }

      setSchoolYears(result.schoolYears ?? []);
      setGradeLevels(result.gradeLevels ?? []);
      setSections(result.sections ?? []);
      setEnrollments(result.enrollments ?? []);
    } catch {
      setError("Unable to reach the school setup service.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const activeYear = schoolYears.find((year) => year.is_active) ?? null;
  const activeEnrollments = useMemo(
    () =>
      enrollments.filter(
        (item) =>
          item.school_year_id === activeYear?.id && item.enrollment_status === "active"
      ),
    [enrollments, activeYear]
  );

  async function addSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const data = new FormData(event.currentTarget);
    const gradeLevel = Number(data.get("gradeLevel") ?? 0);
    const name = String(data.get("sectionName") ?? "").trim();

    setWorking("add");
    try {
      const response = await fetch("/api/admin/academic-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_section", gradeLevel, name }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to add section.");
        return;
      }

      setSuccess(`Section ${name} added to Grade ${gradeLevel}.`);
      event.currentTarget.reset();
      await load();
    } catch {
      setError("Unable to reach the school setup service.");
    } finally {
      setWorking("");
    }
  }

  async function setSectionActive(section: Section, isActive: boolean) {
    setWorking(section.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/academic-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_section_active",
          id: section.id,
          isActive,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to update section.");
        return;
      }

      setSections((current) =>
        current.map((item) =>
          item.id === section.id ? { ...item, is_active: isActive } : item
        )
      );
      setSuccess(`${section.name} is now ${isActive ? "active" : "inactive"}.`);
    } catch {
      setError("Unable to reach the school setup service.");
    } finally {
      setWorking("");
    }
  }

  function countForSection(sectionId: string) {
    return activeEnrollments.filter((item) => item.section_id === sectionId).length;
  }

  function countForGrade(gradeLevel: number) {
    return activeEnrollments.filter((item) => item.grade_level === gradeLevel).length;
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topActions} aria-label="Administrator navigation">
          <a href="/portal" className={styles.topLink}>
            <ArrowLeft size={16} /> Back to portal
          </a>
          <a href="/portal/admin/accounts" className={styles.topLink}>
            Account approvals
          </a>
        </nav>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>ADMINISTRATION</span>
            <h1>School setup</h1>
            <p>
              Manage the academic structure used by student enrollment and future
              grades, attendance, schedules, and teacher assignments.
            </p>
          </div>
          {activeYear && (
            <div className={styles.activeYear}>
              <CheckCircle2 size={18} />
              <div>
                <span>ACTIVE SCHOOL YEAR</span>
                <strong>{activeYear.name}</strong>
              </div>
            </div>
          )}
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <div className={styles.summary}>
          <article>
            <School size={22} />
            <span>School year</span>
            <strong>{activeYear?.name ?? "Not set"}</strong>
          </article>
          <article>
            <Layers3 size={22} />
            <span>Grade levels</span>
            <strong>{gradeLevels.length}</strong>
          </article>
          <article>
            <BookOpen size={22} />
            <span>Active sections</span>
            <strong>{sections.filter((section) => section.is_active).length}</strong>
          </article>
          <article>
            <Users size={22} />
            <span>Active enrollments</span>
            <strong>{activeEnrollments.length}</strong>
          </article>
        </div>

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Grade levels and sections</h2>
              <p>
                Sections are stored in the database. Deactivating a section does
                not remove historical enrollment records.
              </p>
            </div>
            <button onClick={() => void load()} disabled={loading} className={styles.refresh}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          {loading ? (
            <div className={styles.loading}>Loading academic structure…</div>
          ) : (
            <div className={styles.gradeGrid}>
              {gradeLevels.map((grade) => {
                const gradeSections = sections.filter(
                  (section) => section.grade_level === grade.grade_level
                );

                return (
                  <article className={styles.gradeCard} key={grade.grade_level}>
                    <div className={styles.gradeHeader}>
                      <div>
                        <span>GRADE LEVEL</span>
                        <h3>{grade.label}</h3>
                      </div>
                      <strong>{countForGrade(grade.grade_level)} enrolled</strong>
                    </div>

                    {gradeSections.length === 0 ? (
                      <div className={styles.noSections}>
                        No sections added yet.
                      </div>
                    ) : (
                      <div className={styles.sectionList}>
                        {gradeSections.map((section) => (
                          <div className={styles.sectionRow} key={section.id}>
                            <div>
                              <strong>{section.name}</strong>
                              <span>
                                {countForSection(section.id)} student
                                {countForSection(section.id) === 1 ? "" : "s"}
                              </span>
                            </div>
                            <button
                              className={section.is_active ? styles.active : styles.inactive}
                              disabled={working === section.id}
                              onClick={() =>
                                void setSectionActive(section, !section.is_active)
                              }
                            >
                              {section.is_active ? "Active" : "Inactive"}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Add a section</h2>
              <p>
                Use this when you are ready to add Grade 11, Grade 12, or future
                section names.
              </p>
            </div>
          </div>

          <form className={styles.addForm} onSubmit={addSection}>
            <label>
              <span>Grade level</span>
              <select name="gradeLevel" required defaultValue="">
                <option value="" disabled>Select grade level</option>
                {gradeLevels.map((grade) => (
                  <option key={grade.grade_level} value={grade.grade_level}>
                    {grade.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Section name</span>
              <input
                name="sectionName"
                required
                minLength={2}
                maxLength={60}
                placeholder="e.g. Section name"
              />
            </label>

            <button type="submit" disabled={working === "add"}>
              <Plus size={17} />
              {working === "add" ? "Adding…" : "Add section"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
