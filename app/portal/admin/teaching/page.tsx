"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  School,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import styles from "./teaching.module.css";
import ActionWaitOverlay from "@/app/components/action-wait-overlay";
import {
  TECHNICAL_VOCATIONAL_MAJORS,
  isTechnicalVocationalEducation,
  requiresTechnicalVocationalMajor,
} from "@/lib/subject-config";

type ActiveYear = { id: string; name: string };
type Grade = { grade_level: number; label: string; sort_order: number };
type Section = { id: string; grade_level: number; name: string; is_active: boolean };
type Subject = {
  id: string;
  grade_level: number;
  name: string;
  is_active: boolean;
  is_graded?: boolean;
  include_in_school_forms?: boolean;
};
type Teacher = {
  id: string;
  full_name: string;
  email: string;
  position?: string | null;
  is_head_teacher?: boolean;
  linked?: boolean;
};
type Assignment = {
  id: string;
  teacher_id: string;
  school_year_id: string;
  grade_level: number;
  section_id: string;
  subject_id: string;
  major: string | null;
  is_active: boolean;
  assigned_at: string;
};
type Adviser = {
  id: string;
  teacher_id: string;
  school_year_id: string;
  section_id: string;
  is_active: boolean;
  assigned_at: string;
};

export default function TeachingSetupPage() {
  const [activeYear, setActiveYear] = useState<ActiveYear | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjectTeachers, setSubjectTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [advisers, setAdvisers] = useState<Adviser[]>([]);
  const [assignmentGrade, setAssignmentGrade] = useState("");
  const [assignmentSubject, setAssignmentSubject] = useState("");
  const [assignmentMajor, setAssignmentMajor] = useState("");
  const [adviserGrade, setAdviserGrade] = useState("");
  const [setupGrade, setSetupGrade] = useState("");
  const [setupSectionId, setSetupSectionId] = useState("");
  const [setupAdviserId, setSetupAdviserId] = useState("");
  const [setupTeachers, setSetupTeachers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/teaching-setup", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "Unable to load teaching setup.");
        return;
      }

      setActiveYear(result.activeYear ?? null);
      setGrades(result.grades ?? []);
      setSections(result.sections ?? []);
      setSubjects(result.subjects ?? []);
      setTeachers(result.teachers ?? []);
      setSubjectTeachers(result.subjectTeachers ?? result.teachers ?? []);
      setAssignments(result.assignments ?? []);
      setAdvisers(result.advisers ?? []);
    } catch {
      setError("Unable to reach the teaching setup service.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const activeSubjects = subjects.filter((item) => item.is_active);
  const activeSections = sections.filter((item) => item.is_active);
  const activeAssignments = assignments.filter((item) => item.is_active);
  const activeAdvisers = advisers.filter((item) => item.is_active);

  const sectionsForAdviser = useMemo(
    () =>
      activeSections.filter(
        (item) => String(item.grade_level) === adviserGrade
      ),
    [activeSections, adviserGrade]
  );

  const sectionsForAssignment = useMemo(
    () =>
      activeSections.filter(
        (item) => String(item.grade_level) === assignmentGrade
      ),
    [activeSections, assignmentGrade]
  );

  const subjectsForAssignment = useMemo(
    () =>
      activeSubjects.filter(
        (item) => String(item.grade_level) === assignmentGrade
      ),
    [activeSubjects, assignmentGrade]
  );

  const sectionsForSetup = useMemo(
    () =>
      activeSections.filter(
        (item) => String(item.grade_level) === setupGrade
      ),
    [activeSections, setupGrade]
  );

  const subjectsForSetup = useMemo(
    () =>
      activeSubjects.filter(
        (item) => String(item.grade_level) === setupGrade
      ),
    [activeSubjects, setupGrade]
  );

  const setupSection = useMemo(
    () => activeSections.find((item) => item.id === setupSectionId) ?? null,
    [activeSections, setupSectionId]
  );

  const setupRows = useMemo(
    () =>
      subjectsForSetup.flatMap((subject) => {
        if (requiresTechnicalVocationalMajor(subject.grade_level, subject.name)) {
          return TECHNICAL_VOCATIONAL_MAJORS.map((major) => ({
            key: `${subject.id}::${major}`,
            subject,
            major,
          }));
        }
        return [{ key: `${subject.id}::`, subject, major: null as string | null }];
      }),
    [subjectsForSetup]
  );

  const groupedAssignments = useMemo(() => {
    return grades
      .map((grade) => ({
        grade,
        sections: activeSections
          .filter((section) => section.grade_level === grade.grade_level)
          .map((section) => ({
            section,
            assignments: assignments.filter(
              (assignment) => assignment.section_id === section.id
            ),
          }))
          .filter((item) => item.assignments.length > 0),
      }))
      .filter((item) => item.sections.length > 0);
  }, [grades, activeSections, assignments]);

  function sectionName(id: string) {
    return sections.find((item) => item.id === id)?.name ?? "Unknown section";
  }

  function subjectName(id: string) {
    const subject = subjects.find((item) => item.id === id);
    return subject?.name ?? "Unknown subject";
  }

  function teacherName(id: string) {
    return (
      subjectTeachers.find((item) => item.id === id)?.full_name ??
      teachers.find((item) => item.id === id)?.full_name ??
      "Unknown teacher"
    );
  }

  function academicLevelLabel(gradeLevel: number) {
  return gradeLevel === 0 ? "ALS A&E" : `Grade ${gradeLevel}`;
}

function subjectTeacherLabel(teacher: Teacher) {
    return teacher.is_head_teacher && teacher.position
      ? `${teacher.full_name} · ${teacher.position}`
      : teacher.full_name;
  }

  function adviserForSection(sectionId: string) {
    return activeAdvisers.find((item) => item.section_id === sectionId) ?? null;
  }

  function assignmentFor(
    sectionId: string,
    subjectId: string,
    major: string | null
  ) {
    return assignments.find(
      (item) =>
        item.section_id === sectionId &&
        item.subject_id === subjectId &&
        (item.major ?? null) === major
    ) ?? null;
  }

  function prepareSectionSetup(sectionId: string) {
    setSetupSectionId(sectionId);
    const adviser = adviserForSection(sectionId);
    setSetupAdviserId(adviser?.teacher_id ?? "");

    const section = activeSections.find((item) => item.id === sectionId);
    if (!section) {
      setSetupTeachers({});
      return;
    }

    const next: Record<string, string> = {};
    activeSubjects
      .filter((subject) => subject.grade_level === section.grade_level)
      .forEach((subject) => {
        if (requiresTechnicalVocationalMajor(subject.grade_level, subject.name)) {
          TECHNICAL_VOCATIONAL_MAJORS.forEach((major) => {
            const assignment = assignmentFor(sectionId, subject.id, major);
            next[`${subject.id}::${major}`] =
              assignment?.is_active ? assignment.teacher_id : "";
          });
        } else {
          const assignment = assignmentFor(sectionId, subject.id, null);
          next[`${subject.id}::`] =
            assignment?.is_active ? assignment.teacher_id : "";
        }
      });
    setSetupTeachers(next);
  }

  async function saveSectionSetup() {
    if (!setupSection || !setupGrade) return;

    setWorking("section-setup");
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/teaching-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_section_setup",
          gradeLevel: Number(setupGrade),
          sectionId: setupSection.id,
          adviserTeacherId: setupAdviserId,
          assignments: setupRows.map((row) => ({
            subjectId: row.subject.id,
            major: row.major,
            teacherId: setupTeachers[row.key] ?? "",
          })),
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "Unable to save the section setup.");
        return;
      }

      setSuccess(
        `${academicLevelLabel(setupSection.grade_level)} ${setupSection.name} setup saved. ${result.activeAssignments ?? 0} active subject assignment(s).`
      );
      await load();
    } catch {
      setError("Unable to reach the teaching setup service.");
    } finally {
      setWorking("");
    }
  }

  async function saveAdviser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setWorking("adviser");
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/teaching-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_adviser",
          gradeLevel: Number(data.get("gradeLevel") ?? 0),
          sectionId: String(data.get("sectionId") ?? ""),
          teacherId: String(data.get("teacherId") ?? ""),
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "Unable to assign the Section Adviser.");
        return;
      }

      setSuccess("Section Adviser assigned. This teacher now has grading authority for the section.");
      form.reset();
      setAdviserGrade("");
      await load();
    } catch {
      setError("Unable to reach the teaching setup service.");
    } finally {
      setWorking("");
    }
  }

  async function removeAdviser(adviser: Adviser) {
    setWorking(adviser.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/teaching-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_adviser",
          id: adviser.id,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "Unable to remove the Section Adviser.");
        return;
      }

      setSuccess("Section Adviser removed. Grade encoding is disabled for that section until a new adviser is assigned.");
      await load();
    } catch {
      setError("Unable to reach the teaching setup service.");
    } finally {
      setWorking("");
    }
  }

  async function addSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setWorking("subject");
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/teaching-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_subject",
          gradeLevel: Number(data.get("gradeLevel") ?? 0),
          name: String(data.get("subjectName") ?? ""),
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "Unable to add subject.");
        return;
      }

      setSuccess("Subject added successfully.");
      form.reset();
      await load();
    } catch {
      setError("Unable to reach the teaching setup service.");
    } finally {
      setWorking("");
    }
  }

  async function editSubject(subject: Subject) {
    const nextName = window.prompt("Edit subject name", subject.name)?.trim();
    if (!nextName || nextName === subject.name) return;

    setWorking(subject.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/teaching-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_subject",
          id: subject.id,
          name: nextName,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "Unable to update subject.");
        return;
      }

      setSuccess("Subject updated successfully.");
      await load();
    } catch {
      setError("Unable to reach the teaching setup service.");
    } finally {
      setWorking("");
    }
  }

  async function removeSubject(subject: Subject) {
    if (
      !window.confirm(
        `Remove ${subject.name} from Grade ${subject.grade_level}? Subjects already used in school records will be made inactive instead of permanently deleted.`
      )
    ) {
      return;
    }

    setWorking(subject.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/teaching-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_subject",
          id: subject.id,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "Unable to remove subject.");
        return;
      }

      setSuccess(
        result.message ??
          (result.deleted
            ? "Subject removed permanently."
            : "Subject removed from active use.")
      );
      await load();
    } catch {
      setError("Unable to reach the teaching setup service.");
    } finally {
      setWorking("");
    }
  }

  async function saveAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setWorking("assignment");
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/teaching-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_teacher",
          gradeLevel: Number(data.get("gradeLevel") ?? 0),
          sectionId: String(data.get("sectionId") ?? ""),
          subjectId: String(data.get("subjectId") ?? ""),
          major: assignmentMajor,
          teacherId: String(data.get("teacherId") ?? ""),
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "Unable to save teacher assignment.");
        return;
      }

      setSuccess("Teacher assignment saved.");
      form.reset();
      setAssignmentGrade("");
      setAssignmentSubject("");
      setAssignmentMajor("");
      await load();
    } catch {
      setError("Unable to reach the teaching setup service.");
    } finally {
      setWorking("");
    }
  }

  async function setSubjectActive(subject: Subject, isActive: boolean) {
    setWorking(subject.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/teaching-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_subject_active",
          id: subject.id,
          isActive,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "Unable to update subject.");
        return;
      }

      setSuccess(`${subject.name} is now ${isActive ? "active" : "inactive"}.`);
      await load();
    } catch {
      setError("Unable to reach the teaching setup service.");
    } finally {
      setWorking("");
    }
  }

  async function setAssignmentActive(assignment: Assignment, isActive: boolean) {
    setWorking(assignment.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/teaching-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_assignment_active",
          id: assignment.id,
          isActive,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "Unable to update teacher assignment.");
        return;
      }

      setSuccess(`Assignment ${isActive ? "reactivated" : "deactivated"}.`);
      await load();
    } catch {
      setError("Unable to reach the teaching setup service.");
    } finally {
      setWorking("");
    }
  }

  return (
    <main className={styles.page}>
      <ActionWaitOverlay visible={Boolean(working)} message="Please wait…" />
      <div className={styles.shell}>
        <nav className={styles.topActions} aria-label="Administrator navigation">
          <a href="/portal" className={styles.topLink}>
            <ArrowLeft size={16} /> Back to Portal
          </a>
          <a href="/portal/admin/school-setup" className={styles.topLink}>
            School setup
          </a>
        </nav>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>ADMINISTRATION</span>
            <h1>Advisers, Subjects & Teacher Assignments</h1>
            <p>
              Assign one Section Adviser to each class, then connect subject teachers
              to their subjects. Only the Section Adviser can encode and publish grades
              for learners in that section. An Adviser may also be a subject teacher.
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
            <BookOpen size={22} />
            <span>Active Subjects</span>
            <strong>{activeSubjects.length}</strong>
          </article>
          <article>
            <Users size={22} />
            <span>Subject Teacher Options</span>
            <strong>{subjectTeachers.length}</strong>
          </article>
          <article>
            <UserCheck size={22} />
            <span>Section Advisers</span>
            <strong>{activeAdvisers.length}</strong>
          </article>
        </div>

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Quick Section Setup</h2>
              <p>
                Recommended workflow: choose one Grade Level and Section, then assign the Adviser
                and all Subject Teachers from one grouped screen. Head Teachers are available as
                Subject Teachers but remain separate from the Section Adviser list.
              </p>
            </div>
            <button className={styles.refresh} onClick={() => void load()} disabled={loading}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          <div className={styles.setupPicker}>
            <label>
              <span>Grade Level / Program</span>
              <select
                value={setupGrade}
                onChange={(event) => {
                  setSetupGrade(event.target.value);
                  setSetupSectionId("");
                  setSetupAdviserId("");
                  setSetupTeachers({});
                }}
              >
                <option value="">Select Grade Level / Program</option>
                {grades.map((grade) => (
                  <option key={grade.grade_level} value={grade.grade_level}>
                    {grade.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Section</span>
              <select
                value={setupSectionId}
                disabled={!setupGrade}
                onChange={(event) => prepareSectionSetup(event.target.value)}
              >
                <option value="">
                  {setupGrade ? "Select Section" : "Select Grade Level / Program First"}
                </option>
                {sectionsForSetup.map((section) => {
                  const adviser = adviserForSection(section.id);
                  const activeCount = activeAssignments.filter(
                    (assignment) => assignment.section_id === section.id
                  ).length;
                  return (
                    <option key={section.id} value={section.id}>
                      {section.name} · {activeCount}/{activeSubjects.filter(
                        (subject) => subject.grade_level === section.grade_level &&
                          !requiresTechnicalVocationalMajor(subject.grade_level, subject.name)
                      ).length + activeSubjects.filter(
                        (subject) => subject.grade_level === section.grade_level &&
                          requiresTechnicalVocationalMajor(subject.grade_level, subject.name)
                      ).length * TECHNICAL_VOCATIONAL_MAJORS.length} assignment rows
                      {adviser ? ` · Adviser: ${teacherName(adviser.teacher_id)}` : " · No Adviser"}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>

          {setupSection ? (
            <div className={styles.setupWorkspace}>
              <div className={styles.setupHeader}>
                <div>
                  <span>SECTION</span>
                  <h3>{academicLevelLabel(setupSection.grade_level)} · {setupSection.name}</h3>
                </div>
                <label>
                  <span>Section Adviser</span>
                  <select
                    value={setupAdviserId}
                    onChange={(event) => setSetupAdviserId(event.target.value)}
                  >
                    <option value="">Not Assigned</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.full_name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={styles.setupTableWrap}>
                <table className={styles.setupTable}>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>TVE Major</th>
                      <th>Subject Teacher</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {setupRows.map((row) => {
                      const current = assignmentFor(
                        setupSection.id,
                        row.subject.id,
                        row.major
                      );
                      const selectedTeacher = setupTeachers[row.key] ?? "";
                      return (
                        <tr key={row.key}>
                          <td>
                            <strong>{row.subject.name}</strong>
                            {row.subject.is_graded === false && (
                              <small>Schedule / Teaching Load Only · No Grades</small>
                            )}
                            {row.subject.grade_level === 7 &&
                              isTechnicalVocationalEducation(row.subject.name) && (
                                <small>Exploratory</small>
                              )}
                          </td>
                          <td>{row.major ?? "—"}</td>
                          <td>
                            <select
                              value={selectedTeacher}
                              onChange={(event) =>
                                setSetupTeachers((currentTeachers) => ({
                                  ...currentTeachers,
                                  [row.key]: event.target.value,
                                }))
                              }
                            >
                              <option value="">Not Assigned</option>
                              {subjectTeachers.map((teacher) => (
                                <option key={teacher.id} value={teacher.id}>
                                  {subjectTeacherLabel(teacher)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <span
                              className={
                                selectedTeacher ? styles.setupAssigned : styles.setupMissing
                              }
                            >
                              {selectedTeacher
                                ? current?.is_active &&
                                  current.teacher_id === selectedTeacher
                                  ? "Assigned"
                                  : "Ready to Save"
                                : current?.is_active
                                  ? "Will Remove"
                                  : "Not Assigned"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className={styles.setupFooter}>
                <div>
                  <strong>
                    {setupRows.filter((row) => setupTeachers[row.key]).length}
                    /{setupRows.length} Assignment Rows Selected
                  </strong>
                  <span>
                    Unassigned rows can be completed later. Clearing an existing Teacher and saving
                    will deactivate that assignment.
                  </span>
                </div>
                <button
                  onClick={() => void saveSectionSetup()}
                  disabled={working === "section-setup" || setupRows.length === 0}
                >
                  <Save size={17} />
                  {working === "section-setup" ? "Saving Section…" : "Save Section Setup"}
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.setupEmpty}>
              <School size={30} />
              <strong>Select a Grade Level and Section</strong>
              <span>All subjects and Teacher assignments for that section will appear together.</span>
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Assign Section Adviser</h2>
              <p>
                Each section can have one active Adviser for the school year. The Adviser is the only
                teacher allowed to encode and publish grades for learners in that section.
              </p>
            </div>
          </div>

          <form className={styles.adviserForm} onSubmit={saveAdviser}>
            <label>
              <span>Grade Level / Program</span>
              <select
                name="gradeLevel"
                required
                value={adviserGrade}
                onChange={(event) => setAdviserGrade(event.target.value)}
              >
                <option value="">Select Grade Level / Program</option>
                {grades.map((grade) => (
                  <option key={grade.grade_level} value={grade.grade_level}>
                    {grade.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Section</span>
              <select
                name="sectionId"
                required
                defaultValue=""
                key={`adviser-section-${adviserGrade}`}
                disabled={!adviserGrade}
              >
                <option value="" disabled>
                  {adviserGrade ? "Select section" : "Select Grade Level / Program first"}
                </option>
                {sectionsForAdviser.map((section) => {
                  const current = adviserForSection(section.id);
                  return (
                    <option key={section.id} value={section.id}>
                      {section.name}{current ? ` · Current: ${teacherName(current.teacher_id)}` : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <label>
              <span>Adviser</span>
              <select name="teacherId" required defaultValue="" disabled={teachers.length === 0}>
                <option value="" disabled>
                  {teachers.length ? "Select teacher" : "No active teachers"}
                </option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={working === "adviser" || !adviserGrade || teachers.length === 0}>
              <UserCheck size={17} /> {working === "adviser" ? "Assigning…" : "Assign Adviser"}
            </button>
          </form>

          <div className={styles.adviserList}>
            {activeSections.map((section) => {
              const current = adviserForSection(section.id);
              return (
                <div className={styles.adviserRow} key={section.id}>
                  <div>
                    <span>{academicLevelLabel(section.grade_level)}</span>
                    <strong>{section.name}</strong>
                  </div>
                  <div>
                    <span>SECTION ADVISER</span>
                    <strong>{current ? teacherName(current.teacher_id) : "Not assigned"}</strong>
                  </div>
                  {current ? (
                    <button
                      className={styles.removeAdviser}
                      disabled={working === current.id}
                      onClick={() => void removeAdviser(current)}
                    >
                      {working === current.id ? "Removing…" : "Remove"}
                    </button>
                  ) : (
                    <span className={styles.noAdviser}>Grades Locked</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className={styles.twoColumns}>
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <h2>Add a Subject</h2>
                <p>Subjects are created for a specific Grade Level or ALS A&E program.</p>
              </div>
            </div>
            <form className={styles.form} onSubmit={addSubject}>
              <label>
                <span>Grade Level / Program</span>
                <select name="gradeLevel" required defaultValue="">
                  <option value="" disabled>Select Grade Level</option>
                  {grades.map((grade) => (
                    <option key={grade.grade_level} value={grade.grade_level}>
                      {grade.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Subject Name</span>
                <input name="subjectName" required minLength={2} maxLength={100} placeholder="e.g. Mathematics" />
              </label>
              <button type="submit" disabled={working === "subject"}>
                <Plus size={17} /> {working === "subject" ? "Adding…" : "Add subject"}
              </button>
            </form>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <h2>Advanced: Assign One Subject Teacher</h2>
                <p>
                  One Teacher is assigned to each section-subject combination. Subject teachers keep
                  their teaching assignment even when the Section Adviser is a different teacher.
                </p>
              </div>
            </div>
            <form className={styles.form} onSubmit={saveAssignment}>
              <label>
                <span>Grade Level / Program</span>
                <select
                  name="gradeLevel"
                  required
                  value={assignmentGrade}
                  onChange={(event) => {
                    setAssignmentGrade(event.target.value);
                    setAssignmentSubject("");
                    setAssignmentMajor("");
                  }}
                >
                  <option value="">Select Grade Level / Program</option>
                  {grades.map((grade) => (
                    <option key={grade.grade_level} value={grade.grade_level}>
                      {grade.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Section</span>
                <select name="sectionId" required defaultValue="" key={`section-${assignmentGrade}`} disabled={!assignmentGrade}>
                  <option value="" disabled>
                    {assignmentGrade ? "Select section" : "Select Grade Level / Program first"}
                  </option>
                  {sectionsForAssignment.map((section) => (
                    <option key={section.id} value={section.id}>{section.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Subject</span>
                <select
                  name="subjectId"
                  required
                  value={assignmentSubject}
                  onChange={(event) => {
                    setAssignmentSubject(event.target.value);
                    const selected = subjectsForAssignment.find(
                      (subject) => subject.id === event.target.value
                    );
                    if (
                      !selected ||
                      !requiresTechnicalVocationalMajor(
                        Number(assignmentGrade),
                        selected.name
                      )
                    ) {
                      setAssignmentMajor("");
                    }
                  }}
                  disabled={!assignmentGrade || subjectsForAssignment.length === 0}
                >
                  <option value="">
                    {!assignmentGrade
                      ? "Select Grade Level / Program first"
                      : subjectsForAssignment.length
                        ? "Select subject"
                        : "Add a subject first"}
                  </option>
                  {subjectsForAssignment.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>

              {requiresTechnicalVocationalMajor(
                Number(assignmentGrade),
                subjectsForAssignment.find(
                  (subject) => subject.id === assignmentSubject
                )?.name
              ) && (
                <label>
                  <span>TVE Major</span>
                  <select
                    name="major"
                    required
                    value={assignmentMajor}
                    onChange={(event) => setAssignmentMajor(event.target.value)}
                  >
                    <option value="">Select Major</option>
                    {TECHNICAL_VOCATIONAL_MAJORS.map((major) => (
                      <option key={major} value={major}>{major}</option>
                    ))}
                  </select>
                </label>
              )}

              {Number(assignmentGrade) === 7 &&
                isTechnicalVocationalEducation(
                  subjectsForAssignment.find(
                    (subject) => subject.id === assignmentSubject
                  )?.name
                ) && (
                  <div className={styles.exploratoryNote}>
                    Grade 7 Technical Vocational Education is exploratory. No major is required.
                  </div>
                )}
              <label>
                <span>Teacher</span>
                <select name="teacherId" required defaultValue="" disabled={subjectTeachers.length === 0}>
                  <option value="" disabled>
                    {subjectTeachers.length ? "Select Teacher or Head Teacher" : "No active teaching personnel"}
                  </option>
                  {subjectTeachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {subjectTeacherLabel(teacher)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={
                  working === "assignment" ||
                  !assignmentGrade ||
                  !assignmentSubject ||
                  subjectsForAssignment.length === 0 ||
                  subjectTeachers.length === 0 ||
                  (requiresTechnicalVocationalMajor(
                    Number(assignmentGrade),
                    subjectsForAssignment.find(
                      (subject) => subject.id === assignmentSubject
                    )?.name
                  ) && !assignmentMajor)
                }
              >
                <UserCheck size={17} /> {working === "assignment" ? "Saving…" : "Save Assignment"}
              </button>
            </form>
          </section>
        </div>

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Subjects by Grade</h2>
              <p>Inactive subjects remain in historical records but cannot receive new active assignments.</p>
            </div>
            <button className={styles.refresh} onClick={() => void load()} disabled={loading}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          {loading ? (
            <div className={styles.loading}>Loading subjects…</div>
          ) : subjects.length === 0 ? (
            <div className={styles.empty}>
              <GraduationCap size={28} />
              <strong>No Subjects Added Yet</strong>
              <span>Add your first subject using the form above.</span>
            </div>
          ) : (
            <div className={styles.subjectGrid}>
              {grades.map((grade) => {
                const gradeSubjects = subjects.filter(
                  (subject) => subject.grade_level === grade.grade_level
                );
                if (gradeSubjects.length === 0) return null;

                return (
                  <article className={styles.subjectCard} key={grade.grade_level}>
                    <div className={styles.subjectCardHeader}>
                      <strong>{grade.label}</strong>
                      <span>{gradeSubjects.length} subject{gradeSubjects.length === 1 ? "" : "s"}</span>
                    </div>
                    {gradeSubjects.map((subject) => (
                      <div className={styles.row} key={subject.id}>
                        <div>
                          <strong>{subject.name}</strong>
                          <span>
                            {subject.is_graded === false
                              ? "Schedule / Teaching Load Only · Excluded from Grades and School Forms"
                              : isTechnicalVocationalEducation(subject.name)
                                ? subject.grade_level === 7
                                  ? "Exploratory"
                                  : [8, 9, 10].includes(subject.grade_level)
                                    ? "Major selected during teacher assignment"
                                    : "Subject"
                                : subject.is_active
                                  ? "Active subject"
                                  : "Inactive subject"}
                          </span>
                        </div>
                        <div className={styles.subjectActions}>
                          <button
                            className={styles.editSubject}
                            disabled={working === subject.id}
                            onClick={() => void editSubject(subject)}
                          >
                            <Pencil size={14} /> Edit
                          </button>
                          <button
                            className={subject.is_active ? styles.active : styles.inactive}
                            disabled={working === subject.id}
                            onClick={() => void setSubjectActive(subject, !subject.is_active)}
                          >
                            {subject.is_active ? "Active" : "Inactive"}
                          </button>
                          <button
                            className={styles.removeSubject}
                            disabled={working === subject.id}
                            onClick={() => void removeSubject(subject)}
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Subject Teacher Assignments</h2>
              <p>
                {activeYear ? activeYear.name : "Active School Year"} subject assignments.
                These assignments identify who teaches each subject; grading authority belongs to the Section Adviser.
              </p>
            </div>
          </div>

          {assignments.length === 0 ? (
            <div className={styles.empty}>
              <UserCheck size={28} />
              <strong>No Teacher Assignments Yet</strong>
              <span>Use Quick Section Setup above to assign a whole section at once.</span>
            </div>
          ) : (
            <div className={styles.groupedAssignments}>
              {groupedAssignments.map(({ grade, sections: gradeSections }) => (
                <section className={styles.assignmentGradeGroup} key={grade.grade_level}>
                  <div className={styles.assignmentGradeHeading}>
                    <strong>{grade.label}</strong>
                    <span>
                      {gradeSections.reduce(
                        (total, item) =>
                          total +
                          item.assignments.filter((assignment) => assignment.is_active).length,
                        0
                      )} active assignment(s)
                    </span>
                  </div>
                  <div className={styles.assignmentSectionGrid}>
                    {gradeSections.map(({ section, assignments: sectionAssignments }) => (
                      <article className={styles.assignmentSectionCard} key={section.id}>
                        <div className={styles.assignmentSectionHeading}>
                          <div>
                            <span>SECTION</span>
                            <strong>{section.name}</strong>
                          </div>
                          <button
                            onClick={() => {
                              setSetupGrade(String(section.grade_level));
                              prepareSectionSetup(section.id);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            Edit Section
                          </button>
                        </div>
                        {sectionAssignments.map((assignment) => (
                          <div className={styles.assignmentCompactRow} key={assignment.id}>
                            <div>
                              <strong>
                                {subjectName(assignment.subject_id)}
                                {assignment.major ? ` · ${assignment.major}` : ""}
                              </strong>
                              <span>{teacherName(assignment.teacher_id)}</span>
                            </div>
                            <button
                              className={assignment.is_active ? styles.active : styles.inactive}
                              disabled={working === assignment.id}
                              onClick={() =>
                                void setAssignmentActive(assignment, !assignment.is_active)
                              }
                            >
                              {assignment.is_active ? "Active" : "Inactive"}
                            </button>
                          </div>
                        ))}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
