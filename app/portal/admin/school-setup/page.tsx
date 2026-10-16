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
import { captureRefreshScroll, restoreRefreshScroll } from "@/lib/background-refresh";

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
  program_type: string | null;
  shs_program_code: string | null;
};

type Enrollment = {
  id: string;
  school_year_id: string;
  grade_level: number;
  section_id: string | null;
  enrollment_status: string;
};

const GRADE11_PROGRAM_OPTIONS = [
  { code: "STEM", name: "Academic · STEM" },
  { code: "TVL", name: "TVL · Combined Majors" },
  { code: "BUSINESS_ENTREPRENEURSHIP", name: "Academic · Business and Entrepreneurship" },
  { code: "ASSH", name: "Academic · Arts, Social Sciences and Humanities" },
  { code: "TVL_OAP", name: "TVL · Organic Agriculture Production" },
  { code: "TVL_FOOD_PROCESSING", name: "TVL · Food Processing" },
] as const;

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
  const [newSectionGrade, setNewSectionGrade] = useState("");
  const [newSectionProgramType, setNewSectionProgramType] = useState("");

  async function load(background = false) {
    const scrollY = captureRefreshScroll(background);
    if (!background) setLoading(true);
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
      if (!background) setLoading(false);
      restoreRefreshScroll(scrollY);
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
      await load(true);
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
      await load(true);
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
    const programType = String(data.get("programType") ?? "").trim();

    setWorking("add");
    try {
      const response = await fetch("/api/admin/academic-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_section",
          gradeLevel,
          name,
          programType,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to add section.");
        return;
      }

      setSuccess(
        `Section ${name} added to ${gradeLevel === 0 ? "ALS A&E" : `Grade ${gradeLevel}`}.`
      );
      form.reset();
      setNewSectionGrade("");
      setNewSectionProgramType("");
      await load(true);
    } catch {
      setError("Unable to reach the school setup service.");
    } finally {
      setWorking("");
    }
  }

  async function setSectionProgramType(section: Section, programType: string) {
    if (![11, 12].includes(section.grade_level) || !programType) return;

    setWorking(`program-${section.id}`);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/academic-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_section_program_type",
          id: section.id,
          programType,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to update the section Program Type.");
        return;
      }

      setSections((current) =>
        current.map((item) =>
          item.id === section.id ? { ...item, program_type: programType } : item
        )
      );
      setSuccess(`${section.name} is now classified as ${programType}.`);
    } catch {
      setError("Unable to reach the school setup service.");
    } finally {
      setWorking("");
    }
  }

  async function setGrade11Program(section: Section, programCode: string) {
    if (section.grade_level !== 11) return;
    setWorking("shs-program-" + section.id);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/academic-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_grade11_program", id: section.id, programCode }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to assign the Grade 11 program.");
      setSections((previous) => previous.map((item) => item.id === section.id
        ? { ...item, shs_program_code: programCode || null } : item));
      setSuccess("Grade 11 " + section.name + " program updated. SF9 electives will follow this program.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to update Grade 11 program.");
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
          <a href="/portal/admin/users" className={styles.topLink}>
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

        <div style={{margin:"12px 0",padding:"13px 16px",borderRadius:12,border:"1px solid #cde7e3",background:"#f2fbf8",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div>
            <strong style={{fontSize:13}}>Grade 11 STEM Elective Groups</strong>
            <p style={{fontSize:12,margin:"5px 0 0",color:"#567d86"}}>Keep one STEM section and assign Medical or Engineering electives to individual learners.</p>
          </div>
          <a href="/portal/admin/stem-elective-groups" style={{fontWeight:750,fontSize:13,color:"#197b74"}}>Assign Learner Elective Groups →</a>
        </div>

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
                            <div className={styles.sectionInfo}>
                              <strong>{section.name}</strong>
                              <span>
                                {countForSection(section.id)} student
                                {countForSection(section.id) === 1 ? "" : "s"}
                              </span>
                              {section.program_type && (
                                <span className={styles.programBadge}>
                                  {section.program_type}
                                </span>
                              )}
                              {section.grade_level === 11 && section.shs_program_code && (
                                <span className={styles.programBadge}>
                                  {GRADE11_PROGRAM_OPTIONS.find((item) => item.code === section.shs_program_code)?.name ?? (section.shs_program_code?.startsWith("STEM_") ? "Academic · STEM" : section.shs_program_code)}
                                </span>
                              )}
                            </div>
                            <div className={styles.sectionActions}>
                              {section.grade_level === 11 && (
                                <select
                                  className={styles.programSelect}
                                  value={section.shs_program_code === "STEM_MEDICAL" || section.shs_program_code === "STEM_ENGINEERING" ? "STEM" : section.shs_program_code ?? ""}
                                  disabled={working === "shs-program-" + section.id}
                                  aria-label={`Track and Program for Grade 11 ${section.name}`}
                                  onChange={(event) => void setGrade11Program(section, event.target.value)}
                                >
                                  <option value="">Select Track / Program</option>
                                  <optgroup label="Academic">
                                    {GRADE11_PROGRAM_OPTIONS.filter((item) =>
                                      item.code.startsWith("STEM") || item.code === "BUSINESS_ENTREPRENEURSHIP" || item.code === "ASSH"
                                    ).map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                                  </optgroup>
                                  <optgroup label="TVL">
                                    {GRADE11_PROGRAM_OPTIONS.filter((item) =>
                                      (section.name === "Amber" ? item.code === "TVL" : item.code.startsWith("TVL_") || item.code === "TVL")
                                    ).map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                                  </optgroup>
                                </select>
                              )}
                              {[11, 12].includes(section.grade_level) && (
                                <select
                                  className={styles.programSelect}
                                  value={section.program_type ?? ""}
                                  disabled={working === `program-${section.id}`}
                                  onChange={(event) =>
                                    void setSectionProgramType(
                                      section,
                                      event.target.value
                                    )
                                  }
                                  aria-label={`Program Type for ${section.name}`}
                                >
                                  <option value="" disabled>
                                    Program Type Not Set
                                  </option>
                                  <option value="Regular SHS">Regular SHS</option>
                                  <option value="ALS-SHS">ALS-SHS</option>
                                </select>
                              )}
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
                Add sections for Grades 7–12 or ALS A&E. ALS A&E is treated as a
                special non-numbered level in the portal.
              </p>
            </div>
          </div>

          <form className={styles.addForm} onSubmit={addSection}>
            <label>
              <span>Grade Level</span>
              <select
                name="gradeLevel"
                required
                value={newSectionGrade}
                onChange={(event) => {
                  setNewSectionGrade(event.target.value);
                  setNewSectionProgramType("");
                }}
              >
                <option value="" disabled>Select Grade Level / Program</option>
                {gradeLevels.map((grade) => (
                  <option key={grade.grade_level} value={grade.grade_level}>
                    {grade.label}
                  </option>
                ))}
              </select>
            </label>

            {(newSectionGrade === "11" || newSectionGrade === "12") && (
              <label>
                <span>Program Type</span>
                <select
                  name="programType"
                  required
                  value={newSectionProgramType}
                  onChange={(event) => setNewSectionProgramType(event.target.value)}
                >
                  <option value="" disabled>Select Program Type</option>
                  <option value="Regular SHS">Regular SHS</option>
                  <option value="ALS-SHS">ALS-SHS</option>
                </select>
              </label>
            )}

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
