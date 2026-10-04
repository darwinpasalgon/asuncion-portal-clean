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
  const [newSchoolYearStart, setNewSchoolYearStart] = useState("");

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

  async function addSchoolYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const startYear = Number(newSchoolYearStart);
    if (!Number.isInteger(startYear)) {
      setError("Enter a valid school-year start year.");
      return;
    }

    setWorking("add-school-year");
    try {
      const response = await fetch("/api/admin/academic-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_school_year", startYear }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to create the school year.");
        return;
      }

      setNewSchoolYearStart("");
      setSuccess(`School Year ${startYear}–${startYear + 1} created. It remains inactive until you activate it.`);
      await load();
    } catch {
      setError("Unable to reach the school setup service.");
    } finally {
      setWorking("");
    }
  }

  async function activateSchoolYear(year: SchoolYear) {
    if (year.is_active) return;
    const confirmed = window.confirm(
      `Activate School Year ${year.name}? This will make it the official active school year and synchronize learner profile Grade/Section values from its enrollments.`
    );
    if (!confirmed) return;

    setWorking(`year-${year.id}`);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/academic-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "activate_school_year",
          schoolYearId: year.id,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to activate the school year.");
        return;
      }

      setSuccess(
        `School Year ${year.name} is now active. ${Number(result.synced_profiles ?? 0)} learner profile(s) synchronized.`
      );
      await load();
    } catch {
      setError("Unable to reach the school setup service.");
    } finally {
      setWorking("");
    }
  }

  async function addSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const form = event.currentTarget;
    const data = new FormData(form);
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
      form.reset();
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
            <h1>School Setup</h1>
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
            <span>School Year</span>
            <strong>{activeYear?.name ?? "Not set"}</strong>
          </article>
          <article>
            <Layers3 size={22} />
            <span>Grade Levels</span>
            <strong>{gradeLevels.length}</strong>
          </article>
          <article>
            <BookOpen size={22} />
            <span>Active Sections</span>
            <strong>{sections.filter((section) => section.is_active).length}</strong>
          </article>
          <article>
            <Users size={22} />
            <span>Active Enrollments</span>
            <strong>{activeEnrollments.length}</strong>
          </article>
        </div>

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>School Years</h2>
              <p>
                Create the next school year before bulk promotion or retention.
                A future school year can receive learner enrollments while remaining inactive.
              </p>
            </div>
          </div>

          <div className={styles.schoolYearList}>
            {schoolYears.map((year) => {
              const isPast = Boolean(
                activeYear && year.start_year < activeYear.start_year
              );
              return (
                <div className={styles.schoolYearRow} key={year.id}>
                  <div>
                    <strong>{year.name}</strong>
                    <span>
                      {year.is_active
                        ? "Official active school year"
                        : isPast
                          ? "Historical school year"
                          : "Future / inactive school year"}
                    </span>
                  </div>
                  {year.is_active ? (
                    <span className={styles.yearActiveBadge}>Active</span>
                  ) : (
                    <button
                      type="button"
                      className={styles.yearActivateButton}
                      disabled={isPast || working === `year-${year.id}`}
                      onClick={() => void activateSchoolYear(year)}
                    >
                      {working === `year-${year.id}` ? "Activating…" : "Activate"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <form className={styles.addYearForm} onSubmit={addSchoolYear}>
            <label>
              <span>New School-Year Start</span>
              <input
                type="number"
                min={2000}
                max={2100}
                value={newSchoolYearStart}
                onChange={(event) => setNewSchoolYearStart(event.target.value)}
                placeholder="2027"
                required
              />
            </label>
            <div className={styles.yearPreview}>
              <span>School Year</span>
              <strong>
                {newSchoolYearStart
                  ? `${newSchoolYearStart}–${Number(newSchoolYearStart) + 1}`
                  : "YYYY–YYYY"}
              </strong>
            </div>
            <button type="submit" disabled={working === "add-school-year"}>
              <Plus size={17} />
              {working === "add-school-year" ? "Creating…" : "Create school year"}
            </button>
          </form>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Grade Levels and Sections</h2>
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
              <h2>Add a Section</h2>
              <p>
                Use this when you are ready to add Grade 11, Grade 12, or future
                section names.
              </p>
            </div>
          </div>

          <form className={styles.addForm} onSubmit={addSection}>
            <label>
              <span>Grade Level</span>
              <select name="gradeLevel" required defaultValue="">
                <option value="" disabled>Select Grade Level</option>
                {gradeLevels.map((grade) => (
                  <option key={grade.grade_level} value={grade.grade_level}>
                    {grade.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Section Name</span>
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
