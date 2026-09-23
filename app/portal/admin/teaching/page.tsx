"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Plus,
  RefreshCw,
  School,
  UserCheck,
  Users,
} from "lucide-react";
import styles from "./teaching.module.css";

type ActiveYear = { id: string; name: string };
type Grade = { grade_level: number; label: string; sort_order: number };
type Section = { id: string; grade_level: number; name: string; is_active: boolean };
type Subject = {
  id: string;
  grade_level: number;
  name: string;
  code: string | null;
  is_active: boolean;
};
type Teacher = { id: string; full_name: string; email: string };
type Assignment = {
  id: string;
  teacher_id: string;
  school_year_id: string;
  grade_level: number;
  section_id: string;
  subject_id: string;
  is_active: boolean;
  assigned_at: string;
};

export default function TeachingSetupPage() {
  const [activeYear, setActiveYear] = useState<ActiveYear | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentGrade, setAssignmentGrade] = useState("");
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
      setAssignments(result.assignments ?? []);
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

  function sectionName(id: string) {
    return sections.find((item) => item.id === id)?.name ?? "Unknown section";
  }

  function subjectName(id: string) {
    const subject = subjects.find((item) => item.id === id);
    return subject
      ? `${subject.name}${subject.code ? ` (${subject.code})` : ""}`
      : "Unknown subject";
  }

  function teacherName(id: string) {
    return teachers.find((item) => item.id === id)?.full_name ?? "Unknown teacher";
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
          code: String(data.get("subjectCode") ?? ""),
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
      <div className={styles.shell}>
        <nav className={styles.topActions} aria-label="Administrator navigation">
          <a href="/portal" className={styles.topLink}>
            <ArrowLeft size={16} /> Back to portal
          </a>
          <a href="/portal/admin/school-setup" className={styles.topLink}>
            School setup
          </a>
        </nav>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>ADMINISTRATION</span>
            <h1>Subjects & teacher assignments</h1>
            <p>
              Create the subjects offered by each grade level and connect each
              class subject to the Teacher responsible for it.
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
            <BookOpen size={22} />
            <span>Active subjects</span>
            <strong>{activeSubjects.length}</strong>
          </article>
          <article>
            <Users size={22} />
            <span>Active teachers</span>
            <strong>{teachers.length}</strong>
          </article>
          <article>
            <UserCheck size={22} />
            <span>Active assignments</span>
            <strong>{activeAssignments.length}</strong>
          </article>
        </div>

        <div className={styles.twoColumns}>
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <h2>Add a subject</h2>
                <p>Subjects are created for a specific grade level.</p>
              </div>
            </div>
            <form className={styles.form} onSubmit={addSubject}>
              <label>
                <span>Grade level</span>
                <select name="gradeLevel" required defaultValue="">
                  <option value="" disabled>Select grade level</option>
                  {grades.map((grade) => (
                    <option key={grade.grade_level} value={grade.grade_level}>
                      {grade.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Subject name</span>
                <input name="subjectName" required minLength={2} maxLength={100} placeholder="e.g. Mathematics" />
              </label>
              <label>
                <span>Subject code <small>optional</small></span>
                <input name="subjectCode" maxLength={30} placeholder="e.g. MATH8" />
              </label>
              <button type="submit" disabled={working === "subject"}>
                <Plus size={17} /> {working === "subject" ? "Adding…" : "Add subject"}
              </button>
            </form>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <h2>Assign a teacher</h2>
                <p>One Teacher is assigned to each section-subject combination for the active school year.</p>
              </div>
            </div>
            <form className={styles.form} onSubmit={saveAssignment}>
              <label>
                <span>Grade level</span>
                <select
                  name="gradeLevel"
                  required
                  value={assignmentGrade}
                  onChange={(event) => setAssignmentGrade(event.target.value)}
                >
                  <option value="">Select grade level</option>
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
                    {assignmentGrade ? "Select section" : "Select grade first"}
                  </option>
                  {sectionsForAssignment.map((section) => (
                    <option key={section.id} value={section.id}>{section.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Subject</span>
                <select name="subjectId" required defaultValue="" key={`subject-${assignmentGrade}`} disabled={!assignmentGrade || subjectsForAssignment.length === 0}>
                  <option value="" disabled>
                    {!assignmentGrade
                      ? "Select grade first"
                      : subjectsForAssignment.length
                        ? "Select subject"
                        : "Add a subject first"}
                  </option>
                  {subjectsForAssignment.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}{subject.code ? ` (${subject.code})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Teacher</span>
                <select name="teacherId" required defaultValue="" disabled={teachers.length === 0}>
                  <option value="" disabled>
                    {teachers.length ? "Select teacher" : "No active teachers"}
                  </option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={working === "assignment" || !assignmentGrade || subjectsForAssignment.length === 0 || teachers.length === 0}>
                <UserCheck size={17} /> {working === "assignment" ? "Saving…" : "Save assignment"}
              </button>
            </form>
          </section>
        </div>

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Subjects by grade</h2>
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
              <strong>No subjects added yet</strong>
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
                          <span>{subject.code || "No subject code"}</span>
                        </div>
                        <button
                          className={subject.is_active ? styles.active : styles.inactive}
                          disabled={working === subject.id}
                          onClick={() => void setSubjectActive(subject, !subject.is_active)}
                        >
                          {subject.is_active ? "Active" : "Inactive"}
                        </button>
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
              <h2>Teacher assignments</h2>
              <p>{activeYear ? activeYear.name : "Active school year"} class assignments.</p>
            </div>
          </div>

          {assignments.length === 0 ? (
            <div className={styles.empty}>
              <UserCheck size={28} />
              <strong>No teacher assignments yet</strong>
              <span>Create a subject, then assign it to a section and Teacher.</span>
            </div>
          ) : (
            <div className={styles.assignmentList}>
              {assignments.map((assignment) => (
                <article className={styles.assignmentRow} key={assignment.id}>
                  <div className={styles.assignmentIdentity}>
                    <span>Grade {assignment.grade_level}</span>
                    <strong>{sectionName(assignment.section_id)}</strong>
                  </div>
                  <div>
                    <span>SUBJECT</span>
                    <strong>{subjectName(assignment.subject_id)}</strong>
                  </div>
                  <div>
                    <span>TEACHER</span>
                    <strong>{teacherName(assignment.teacher_id)}</strong>
                  </div>
                  <button
                    className={assignment.is_active ? styles.active : styles.inactive}
                    disabled={working === assignment.id}
                    onClick={() => void setAssignmentActive(assignment, !assignment.is_active)}
                  >
                    {assignment.is_active ? "Active" : "Inactive"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
