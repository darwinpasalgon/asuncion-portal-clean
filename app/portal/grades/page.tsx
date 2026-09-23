"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  GraduationCap,
  Save,
  Send,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import styles from "./grades.module.css";

type Role = "student" | "teacher";
type ActiveYear = {
  id: string;
  name: string;
  start_year: number;
  end_year: number;
};
type Profile = {
  id: string;
  full_name: string;
  role: Role;
};
type Assignment = {
  id: string;
  teacher_id: string;
  grade_level: number;
  section_id: string;
  subject_id: string;
};
type Section = {
  id: string;
  grade_level: number;
  name: string;
};
type Subject = {
  id: string;
  grade_level: number;
  name: string;
  code: string | null;
  grading_scheme: string;
  is_active: boolean;
};
type Enrollment = {
  id: string;
  student_id: string;
  grade_level: number;
  section_id: string | null;
};
type Student = {
  id: string;
  full_name: string;
  lrn: string | null;
};
type Grade = {
  id: string;
  student_id: string;
  teacher_assignment_id: string;
  school_year_id: string;
  term_no: number;
  ww_ps: number | null;
  pt_ps: number | null;
  st1_ps: number | null;
  st2_ps: number | null;
  term_exam_ps: number | null;
  initial_grade: number;
  term_grade: number;
  status: "draft" | "published";
  published_at: string | null;
  updated_at: string;
};

type GradeDraft = {
  wwPs: string;
  ptPs: string;
  st1Ps: string;
  st2Ps: string;
  termExamPs: string;
};

const SCHEMES: Record<
  string,
  {
    short: string;
    description: string;
    ww: number;
    pt: number;
    ex: number;
    stRequired: boolean;
    termExamRequired: boolean;
  }
> = {
  ks23_standard: {
    short: "WW 20% · PT 50% · EX 30%",
    description: "Grades 7–10 Standard",
    ww: 20,
    pt: 50,
    ex: 30,
    stRequired: true,
    termExamRequired: true,
  },
  ks23_tle_mapeh: {
    short: "WW 20% · PT 60% · EX 20%",
    description: "Grades 7–10 TLE / MAPEH",
    ww: 20,
    pt: 60,
    ex: 20,
    stRequired: true,
    termExamRequired: true,
  },
  shs_core_academic: {
    short: "WW 20% · PT 50% · EX 30%",
    description: "SHS Core / Academic",
    ww: 20,
    pt: 50,
    ex: 30,
    stRequired: true,
    termExamRequired: true,
  },
  shs_field_arts_creative: {
    short: "WW 15% · PT 70% · TE 15%",
    description: "SHS Field / Arts / Creative",
    ww: 15,
    pt: 70,
    ex: 15,
    stRequired: false,
    termExamRequired: true,
  },
  shs_research_design: {
    short: "WW 40% · PT 60%",
    description: "SHS Research / Design",
    ww: 40,
    pt: 60,
    ex: 0,
    stRequired: false,
    termExamRequired: false,
  },
  shs_work_immersion: {
    short: "WW 20% · PT 80%",
    description: "SHS Work Immersion",
    ww: 20,
    pt: 80,
    ex: 0,
    stRequired: false,
    termExamRequired: false,
  },
};

function descriptor(grade: number) {
  if (grade >= 90) return "Advancing / Namumukod-tangi";
  if (grade >= 80) return "Benchmarking / Napamamalas";
  if (grade >= 75) return "Connecting / Natutungo";
  if (grade >= 65) return "Developing / Napauunlad";
  return "Emerging / Nagsisimula";
}

function blankDraft(): GradeDraft {
  return {
    wwPs: "",
    ptPs: "",
    st1Ps: "",
    st2Ps: "",
    termExamPs: "",
  };
}

function gradeToDraft(grade?: Grade): GradeDraft {
  if (!grade) return blankDraft();
  return {
    wwPs: grade.ww_ps === null ? "" : String(grade.ww_ps),
    ptPs: grade.pt_ps === null ? "" : String(grade.pt_ps),
    st1Ps: grade.st1_ps === null ? "" : String(grade.st1_ps),
    st2Ps: grade.st2_ps === null ? "" : String(grade.st2_ps),
    termExamPs: grade.term_exam_ps === null ? "" : String(grade.term_exam_ps),
  };
}

export default function GradesPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeYear, setActiveYear] = useState<ActiveYear | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, GradeDraft>>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/academic/grades", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "Unable to load grades.");
        return;
      }

      setRole(result.role ?? null);
      setProfile(result.profile ?? null);
      setActiveYear(result.activeYear ?? null);
      setAssignments(result.assignments ?? []);
      setSections(result.sections ?? []);
      setSubjects(result.subjects ?? []);
      setEnrollments(result.enrollments ?? []);
      setStudents(result.students ?? []);
      setGrades(result.grades ?? []);

      if (!selectedAssignmentId && result.assignments?.[0]?.id) {
        setSelectedAssignmentId(result.assignments[0].id);
      }
    } catch {
      setError("Unable to reach the grades service.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const sectionMap = useMemo(
    () => new Map(sections.map((item) => [item.id, item.name])),
    [sections]
  );
  const subjectMap = useMemo(
    () => new Map(subjects.map((item) => [item.id, item])),
    [subjects]
  );
  const studentMap = useMemo(
    () => new Map(students.map((item) => [item.id, item])),
    [students]
  );

  const selectedAssignment = assignments.find(
    (item) => item.id === selectedAssignmentId
  );
  const selectedSubject = selectedAssignment
    ? subjectMap.get(selectedAssignment.subject_id)
    : undefined;
  const scheme = selectedSubject
    ? SCHEMES[selectedSubject.grading_scheme] ?? SCHEMES.ks23_standard
    : SCHEMES.ks23_standard;

  const classStudents = useMemo(() => {
    if (!selectedAssignment) return [];
    return enrollments
      .filter(
        (item) =>
          item.section_id === selectedAssignment.section_id &&
          item.grade_level === selectedAssignment.grade_level
      )
      .map((item) => studentMap.get(item.student_id))
      .filter((item): item is Student => Boolean(item))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [selectedAssignment, enrollments, studentMap]);

  useEffect(() => {
    if (role !== "teacher" || !selectedAssignmentId) return;

    const next: Record<string, GradeDraft> = {};
    for (const student of classStudents) {
      const grade = grades.find(
        (item) =>
          item.student_id === student.id &&
          item.teacher_assignment_id === selectedAssignmentId &&
          item.term_no === selectedTerm
      );
      next[student.id] = gradeToDraft(grade);
    }
    setDrafts(next);
  }, [role, selectedAssignmentId, selectedTerm, classStudents, grades]);

  function assignmentLabel(assignment: Assignment) {
    const subject = subjectMap.get(assignment.subject_id);
    return `Grade ${assignment.grade_level} · ${sectionMap.get(assignment.section_id) ?? "Unknown"} · ${subject?.name ?? "Unknown subject"}${subject?.code ? ` (${subject.code})` : ""}`;
  }

  function updateDraft(studentId: string, field: keyof GradeDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [studentId]: {
        ...(current[studentId] ?? blankDraft()),
        [field]: value,
      },
    }));
  }

  async function saveGrade(studentId: string) {
    if (!selectedAssignmentId) return;
    const draft = drafts[studentId] ?? blankDraft();

    setWorking(studentId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/academic/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_grade",
          assignmentId: selectedAssignmentId,
          studentId,
          termNo: selectedTerm,
          wwPs: draft.wwPs,
          ptPs: draft.ptPs,
          st1Ps: draft.st1Ps,
          st2Ps: draft.st2Ps,
          termExamPs: draft.termExamPs,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to save the grade.");
        return;
      }

      setSuccess("Grade saved. Initial Grade and Term Grade were recalculated.");
      await load();
    } catch {
      setError("Unable to reach the grades service.");
    } finally {
      setWorking("");
    }
  }

  async function setPublication(publish: boolean) {
    if (!selectedAssignmentId) return;

    setWorking("publish");
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/academic/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: publish ? "publish_term" : "unpublish_term",
          assignmentId: selectedAssignmentId,
          termNo: selectedTerm,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to update term publication.");
        return;
      }

      setSuccess(
        publish
          ? `Term ${selectedTerm} grades published to students.`
          : `Term ${selectedTerm} grades returned to draft.`
      );
      await load();
    } catch {
      setError("Unable to reach the grades service.");
    } finally {
      setWorking("");
    }
  }

  const selectedTermGrades = grades.filter(
    (item) =>
      item.teacher_assignment_id === selectedAssignmentId &&
      item.term_no === selectedTerm
  );

  const allPublished =
    classStudents.length > 0 &&
    classStudents.every((student) =>
      selectedTermGrades.some(
        (grade) => grade.student_id === student.id && grade.status === "published"
      )
    );

  const studentReport = useMemo(() => {
    if (role !== "student") return [];

    return assignments.map((assignment) => {
      const subject = subjectMap.get(assignment.subject_id);
      const terms = [1, 2, 3].map((term) =>
        grades.find(
          (grade) =>
            grade.teacher_assignment_id === assignment.id &&
            grade.term_no === term
        )
      );

      const complete = terms.every(Boolean);
      const finalGrade = complete
        ? Math.round(
            terms.reduce((sum, item) => sum + Number(item?.term_grade ?? 0), 0) / 3
          )
        : null;

      return {
        assignment,
        subject,
        terms,
        finalGrade,
      };
    });
  }, [role, assignments, subjectMap, grades]);

  if (loading) {
    return (
      <main className={styles.loading}>
        <GraduationCap size={34} />
        <strong>Loading grade records…</strong>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topActions}>
          <a href="/portal" className={styles.topLink}>
            <ArrowLeft size={16} /> Back to portal
          </a>
        </nav>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>ACADEMIC RECORDS</span>
            <h1>{role === "teacher" ? "Term gradebook" : "My grades"}</h1>
            <p>
              {role === "teacher"
                ? "Encode assessment percentage scores, review the computed Initial and Term Grades, then publish the term when the class is complete."
                : "Published Term Grades and Final Grades for the active school year."}
            </p>
          </div>

          <div className={styles.yearCard}>
            <ShieldCheck size={18} />
            <div>
              <span>SCHOOL YEAR</span>
              <strong>{activeYear?.name ?? "Not configured"}</strong>
            </div>
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <section className={styles.policy}>
          <BookOpenCheck size={22} />
          <div>
            <strong>DepEd three-term grading</strong>
            <p>
              Term 1, Term 2, and Term 3 are used. For SY 2026–2027, Initial
              Grades are converted through the adjusted transmutation table.
              Final Grade is the rounded average of the three Term Grades.
            </p>
          </div>
        </section>

        {role === "teacher" && (
          <>
            <section className={styles.controls}>
              <label>
                <span>Assigned class</span>
                <select
                  value={selectedAssignmentId}
                  onChange={(event) => setSelectedAssignmentId(event.target.value)}
                >
                  {assignments.length === 0 && (
                    <option value="">No assigned classes</option>
                  )}
                  {assignments.map((assignment) => (
                    <option key={assignment.id} value={assignment.id}>
                      {assignmentLabel(assignment)}
                    </option>
                  ))}
                </select>
              </label>

              <div className={styles.termTabs}>
                {[1, 2, 3].map((term) => (
                  <button
                    type="button"
                    key={term}
                    className={selectedTerm === term ? styles.termActive : styles.termButton}
                    onClick={() => setSelectedTerm(term)}
                  >
                    Term {term}
                  </button>
                ))}
              </div>
            </section>

            {selectedAssignment && selectedSubject && (
              <section className={styles.schemeCard}>
                <div>
                  <span>SUBJECT</span>
                  <strong>
                    {selectedSubject.name}
                    {selectedSubject.code ? ` (${selectedSubject.code})` : ""}
                  </strong>
                  <small>
                    Grade {selectedAssignment.grade_level} ·{" "}
                    {sectionMap.get(selectedAssignment.section_id)}
                  </small>
                </div>
                <div>
                  <span>ASSESSMENT PROFILE</span>
                  <strong>{scheme.description}</strong>
                  <small>{scheme.short}</small>
                </div>
                {scheme.ex > 0 && (
                  <div>
                    <span>EXAMINATION BREAKDOWN</span>
                    <strong>
                      {scheme.stRequired ? "ST1 30% · ST2 30% · TE 40%" : "Term Exam"}
                    </strong>
                    <small>Within the Examinations component</small>
                  </div>
                )}
              </section>
            )}

            <section className={styles.gradePanel}>
              <div className={styles.panelHeading}>
                <div>
                  <h2>Term {selectedTerm} encoding</h2>
                  <p>
                    Enter component Percentage Scores from 0–100. Save each learner
                    to calculate the official grade.
                  </p>
                </div>
                <div className={styles.publishActions}>
                  {allPublished ? (
                    <button
                      className={styles.unpublish}
                      disabled={working === "publish"}
                      onClick={() => void setPublication(false)}
                    >
                      <Undo2 size={16} /> Return to draft
                    </button>
                  ) : (
                    <button
                      className={styles.publish}
                      disabled={working === "publish" || classStudents.length === 0}
                      onClick={() => void setPublication(true)}
                    >
                      <Send size={16} /> Publish Term {selectedTerm}
                    </button>
                  )}
                </div>
              </div>

              {classStudents.length === 0 ? (
                <div className={styles.empty}>
                  No active students are enrolled in this assigned section.
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.gradeTable}>
                    <thead>
                      <tr>
                        <th>Learner</th>
                        <th>WW %</th>
                        <th>PT %</th>
                        {scheme.stRequired && <th>ST1 %</th>}
                        {scheme.stRequired && <th>ST2 %</th>}
                        {scheme.termExamRequired && <th>Term Exam %</th>}
                        <th>Initial</th>
                        <th>Term Grade</th>
                        <th>Descriptor / Support</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {classStudents.map((student) => {
                        const saved = grades.find(
                          (item) =>
                            item.student_id === student.id &&
                            item.teacher_assignment_id === selectedAssignmentId &&
                            item.term_no === selectedTerm
                        );
                        const draft = drafts[student.id] ?? blankDraft();

                        return (
                          <tr key={student.id}>
                            <td>
                              <strong>{student.full_name}</strong>
                              <span>{student.lrn ? `LRN ${student.lrn}` : "Student"}</span>
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={draft.wwPs}
                                onChange={(event) =>
                                  updateDraft(student.id, "wwPs", event.target.value)
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={draft.ptPs}
                                onChange={(event) =>
                                  updateDraft(student.id, "ptPs", event.target.value)
                                }
                              />
                            </td>
                            {scheme.stRequired && (
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={draft.st1Ps}
                                  onChange={(event) =>
                                    updateDraft(student.id, "st1Ps", event.target.value)
                                  }
                                />
                              </td>
                            )}
                            {scheme.stRequired && (
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={draft.st2Ps}
                                  onChange={(event) =>
                                    updateDraft(student.id, "st2Ps", event.target.value)
                                  }
                                />
                              </td>
                            )}
                            {scheme.termExamRequired && (
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={draft.termExamPs}
                                  onChange={(event) =>
                                    updateDraft(student.id, "termExamPs", event.target.value)
                                  }
                                />
                              </td>
                            )}
                            <td className={styles.numberCell}>
                              {saved ? Number(saved.initial_grade).toFixed(2) : "—"}
                            </td>
                            <td className={styles.termGrade}>
                              {saved?.term_grade ?? "—"}
                            </td>
                            <td>
                              {saved ? (
                                <>
                                  <strong>{descriptor(saved.term_grade)}</strong>
                                  <span className={saved.term_grade < 75 ? styles.intervention : styles.onTrack}>
                                    {saved.term_grade < 75
                                      ? "Intervention needed"
                                      : "Meets minimum standard"}
                                  </span>
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>
                              {saved ? (
                                <span className={saved.status === "published" ? styles.published : styles.draft}>
                                  {saved.status === "published" ? "Published" : "Draft"}
                                </span>
                              ) : (
                                <span className={styles.notSaved}>Not saved</span>
                              )}
                            </td>
                            <td>
                              <button
                                className={styles.saveButton}
                                disabled={working === student.id}
                                onClick={() => void saveGrade(student.id)}
                              >
                                <Save size={15} />
                                {working === student.id ? "Saving…" : "Save"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {role === "student" && (
          <section className={styles.studentPanel}>
            <div className={styles.panelHeading}>
              <div>
                <h2>{profile?.full_name}</h2>
                <p>
                  Only grades published by your subject teachers are shown here.
                </p>
              </div>
            </div>

            {studentReport.length === 0 ? (
              <div className={styles.empty}>
                No published subject grades are available yet.
              </div>
            ) : (
              <div className={styles.studentGradeList}>
                {studentReport.map(({ assignment, subject, terms, finalGrade }) => (
                  <article key={assignment.id} className={styles.studentSubject}>
                    <div className={styles.subjectHeading}>
                      <div>
                        <span>
                          Grade {assignment.grade_level} ·{" "}
                          {sectionMap.get(assignment.section_id)}
                        </span>
                        <strong>
                          {subject?.name ?? "Subject"}
                          {subject?.code ? ` (${subject.code})` : ""}
                        </strong>
                      </div>
                      {finalGrade !== null ? (
                        <div className={styles.finalBox}>
                          <span>FINAL GRADE</span>
                          <strong>{finalGrade}</strong>
                          <small>{finalGrade >= 75 ? "Passed" : "Failed"}</small>
                        </div>
                      ) : (
                        <div className={styles.finalPending}>Final grade pending</div>
                      )}
                    </div>

                    <div className={styles.termGrid}>
                      {terms.map((term, index) => (
                        <div key={index}>
                          <span>TERM {index + 1}</span>
                          {term ? (
                            <>
                              <strong>{term.term_grade}</strong>
                              <small>{descriptor(term.term_grade)}</small>
                              {term.term_grade < 75 && (
                                <em>Intervention needed</em>
                              )}
                            </>
                          ) : (
                            <>
                              <strong>—</strong>
                              <small>Not published</small>
                            </>
                          )}
                        </div>
                      ))}

                      <div className={styles.finalSummary}>
                        <span>FINAL</span>
                        {finalGrade !== null ? (
                          <>
                            <strong>{finalGrade}</strong>
                            <small>{descriptor(finalGrade)}</small>
                            <em className={finalGrade >= 75 ? styles.passed : styles.failed}>
                              {finalGrade >= 75 ? "Passed" : "Failed"}
                            </em>
                          </>
                        ) : (
                          <>
                            <strong>—</strong>
                            <small>Requires all 3 terms</small>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {!role && !error && (
          <div className={styles.empty}>No grade workspace is available.</div>
        )}

        <section className={styles.legend}>
          <h2>Grades 4–12 proficiency descriptors</h2>
          <div>
            <span><strong>90–100</strong> Advancing / Namumukod-tangi</span>
            <span><strong>80–89</strong> Benchmarking / Napamamalas</span>
            <span><strong>75–79</strong> Connecting / Natutungo</span>
            <span><strong>65–74</strong> Developing / Napauunlad</span>
            <span><strong>0–64</strong> Emerging / Nagsisimula</span>
          </div>
          <p>
            A Term Grade below 75 signals the need for learner intervention.
            Passed/Failed is applied to the Final Grade after all three terms.
          </p>
        </section>
      </div>
    </main>
  );
}
