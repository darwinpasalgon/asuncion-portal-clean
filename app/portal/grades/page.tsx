"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  GraduationCap,
  Save,
  Send,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import styles from "./grades.module.css";
import { isTechnicalVocationalEducation } from "@/lib/subject-config";

type Role = "student" | "teacher";
type ActiveYear = { id: string; name: string; start_year: number; end_year: number };
type Profile = { id: string; full_name: string; role: Role };
type Assignment = {
  id: string;
  teacher_id: string;
  grade_level: number;
  section_id: string;
  subject_id: string;
  major: string | null;
  co_teacher_ids?: string[] | null;
};
type Section = { id: string; grade_level: number; name: string };
type Subject = {
  id: string;
  grade_level: number;
  name: string;
  is_active: boolean;
};
type Enrollment = {
  id: string;
  student_id: string;
  grade_level: number;
  section_id: string | null;
  tve_major: string | null;
};
type Student = {
  id: string;
  full_name: string;
  lrn: string | null;
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  name_extension: string | null;
  sex: string | null;
};
type Grade = {
  id: string;
  student_id: string;
  teacher_assignment_id: string;
  school_year_id: string;
  term_no: number;
  term_grade: number;
  music_grade: number | null;
  arts_grade: number | null;
  physical_education_grade: number | null;
  health_grade: number | null;
  status: "draft" | "published";
  published_at: string | null;
  updated_at: string;
};

function descriptor(grade: number) {
  if (grade >= 90) return "Advancing / Namumukod-tangi";
  if (grade >= 80) return "Benchmarking / Napamamalas";
  if (grade >= 75) return "Connecting / Natutungo";
  if (grade >= 65) return "Developing / Napauunlad";
  return "Emerging / Nagsisimula";
}

function sexGroup(value: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "m" || normalized === "male") return "Male";
  if (normalized === "f" || normalized === "female") return "Female";
  return "Unspecified";
}

function isMapeh(name?: string | null) {
  return String(name ?? "").trim().toLowerCase() === "mapeh";
}

type MapehDraft = {
  music: string;
  arts: string;
  physicalEducation: string;
  health: string;
};

function emptyMapehDraft(): MapehDraft {
  return { music: "", arts: "", physicalEducation: "", health: "" };
}

function computedMapehAverage(draft: MapehDraft) {
  const values = [
    draft.music,
    draft.arts,
    draft.physicalEducation,
    draft.health,
  ].map((value) => Number(value));
  if (
    values.some(
      (value) => !Number.isInteger(value) || value < 0 || value > 100
    )
  ) {
    return null;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / 4);
}

function compareStudents(a: Student, b: Student) {
  const rank = (value: string | null) => {
    const group = sexGroup(value);
    return group === "Male" ? 0 : group === "Female" ? 1 : 2;
  };

  const bySex = rank(a.sex) - rank(b.sex);
  if (bySex !== 0) return bySex;

  const byLast = (a.last_name ?? a.full_name).localeCompare(
    b.last_name ?? b.full_name,
    undefined,
    { sensitivity: "base" }
  );
  if (byLast !== 0) return byLast;

  const byFirst = (a.first_name ?? a.full_name).localeCompare(
    b.first_name ?? b.full_name,
    undefined,
    { sensitivity: "base" }
  );
  if (byFirst !== 0) return byFirst;

  return a.full_name.localeCompare(b.full_name, undefined, {
    sensitivity: "base",
  });
}

export default function GradesPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [isSectionAdviser, setIsSectionAdviser] = useState(false);
  const [adviserSections, setAdviserSections] = useState<Section[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeYear, setActiveYear] = useState<ActiveYear | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subjectAssignments, setSubjectAssignments] = useState<Assignment[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [teacherView, setTeacherView] = useState<"adviser" | "subjects">("adviser");
  const [selectedSubjectAssignmentId, setSelectedSubjectAssignmentId] = useState("");
  const [selectedSubjectTerm, setSelectedSubjectTerm] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [mapehDrafts, setMapehDrafts] = useState<Record<string, MapehDraft>>({});
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
      setIsSectionAdviser(Boolean(result.isSectionAdviser));
      setAdviserSections(result.adviserSections ?? []);
      setProfile(result.profile ?? null);
      setActiveYear(result.activeYear ?? null);
      setAssignments(result.assignments ?? []);
      setSubjectAssignments(result.subjectAssignments ?? []);
      setSections(result.sections ?? []);
      setSubjects(result.subjects ?? []);
      setEnrollments(result.enrollments ?? []);
      setStudents(result.students ?? []);
      setGrades(result.grades ?? []);

      if (!selectedAssignmentId && result.assignments?.[0]?.id) {
        setSelectedAssignmentId(result.assignments[0].id);
      }
      if (
        !selectedSubjectAssignmentId &&
        result.subjectAssignments?.[0]?.id
      ) {
        setSelectedSubjectAssignmentId(result.subjectAssignments[0].id);
      }
      if (
        result.role === "teacher" &&
        !result.isSectionAdviser &&
        result.subjectAssignments?.length
      ) {
        setTeacherView("subjects");
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

  const gradebookAssignments = useMemo(
    () =>
      assignments.filter((assignment, index, all) => {
        const subject = subjectMap.get(assignment.subject_id);
        if (!isTechnicalVocationalEducation(subject?.name)) return true;
        return (
          all.findIndex(
            (item) =>
              item.section_id === assignment.section_id &&
              item.subject_id === assignment.subject_id
          ) === index
        );
      }),
    [assignments, subjectMap]
  );

  const selectedAssignment = assignments.find(
    (item) => item.id === selectedAssignmentId
  );

  const selectedSubject = selectedAssignment
    ? subjectMap.get(selectedAssignment.subject_id)
    : null;
  const selectedIsTve = isTechnicalVocationalEducation(selectedSubject?.name);
  const selectedIsMapeh = isMapeh(selectedSubject?.name);

  function gradeAssignmentIdForStudent(studentId: string) {
    if (!selectedAssignment) return "";
    if (!selectedIsTve) return selectedAssignment.id;

    const enrollment = enrollments.find(
      (item) =>
        item.student_id === studentId &&
        item.section_id === selectedAssignment.section_id
    );
    if (!enrollment?.tve_major) return "";

    return (
      assignments.find(
        (item) =>
          item.section_id === selectedAssignment.section_id &&
          item.subject_id === selectedAssignment.subject_id &&
          item.major === enrollment.tve_major
      )?.id ?? ""
    );
  }

  function savedGradeForStudent(studentId: string) {
    const targetAssignmentId = gradeAssignmentIdForStudent(studentId);
    if (!targetAssignmentId) return undefined;
    return grades.find(
      (item) =>
        item.student_id === studentId &&
        item.teacher_assignment_id === targetAssignmentId &&
        item.term_no === selectedTerm
    );
  }

  const classStudents = useMemo(() => {
    if (!selectedAssignment) return [];
    return enrollments
      .filter(
        (item) =>
          item.section_id === selectedAssignment.section_id &&
          item.grade_level === selectedAssignment.grade_level &&
          (selectedIsTve ||
            !selectedAssignment.major ||
            item.tve_major === selectedAssignment.major)
      )
      .map((item) => studentMap.get(item.student_id))
      .filter((item): item is Student => Boolean(item))
      .sort(compareStudents);
  }, [
    selectedAssignment,
    selectedIsTve,
    enrollments,
    studentMap,
  ]);

  const classStudentGroups = useMemo(
    () =>
      ["Male", "Female", "Unspecified"]
        .map((group) => ({
          group,
          students: classStudents.filter(
            (student) => sexGroup(student.sex) === group
          ),
        }))
        .filter((item) => item.students.length > 0),
    [classStudents]
  );

  const selectedSubjectAssignment = subjectAssignments.find(
    (item) => item.id === selectedSubjectAssignmentId
  );
  const selectedSubjectAssignmentSubject = selectedSubjectAssignment
    ? subjectMap.get(selectedSubjectAssignment.subject_id)
    : null;
  const selectedSubjectAssignmentIsTve = isTechnicalVocationalEducation(
    selectedSubjectAssignmentSubject?.name
  );

  const subjectClassStudents = useMemo(() => {
    if (!selectedSubjectAssignment) return [];
    return enrollments
      .filter(
        (item) =>
          item.section_id === selectedSubjectAssignment.section_id &&
          item.grade_level === selectedSubjectAssignment.grade_level &&
          (!selectedSubjectAssignmentIsTve ||
            !selectedSubjectAssignment.major ||
            item.tve_major === selectedSubjectAssignment.major)
      )
      .map((item) => studentMap.get(item.student_id))
      .filter((item): item is Student => Boolean(item))
      .sort(compareStudents);
  }, [
    selectedSubjectAssignment,
    selectedSubjectAssignmentIsTve,
    enrollments,
    studentMap,
  ]);

  const subjectClassStudentGroups = useMemo(
    () =>
      subjectClassStudents.length > 0
        ? [{ group: "Learners", students: subjectClassStudents }]
        : [],
    [subjectClassStudents]
  );

  function publishedSubjectGradeForStudent(studentId: string) {
    if (!selectedSubjectAssignment) return undefined;
    return grades.find(
      (item) =>
        item.student_id === studentId &&
        item.teacher_assignment_id === selectedSubjectAssignment.id &&
        item.term_no === selectedSubjectTerm &&
        item.status === "published"
    );
  }

  function subjectAssignmentLabel(assignment: Assignment) {
    const subject = subjectMap.get(assignment.subject_id);
    return `Grade ${assignment.grade_level} · ${sectionMap.get(
      assignment.section_id
    ) ?? "Unknown"} · ${subject?.name ?? "Unknown subject"}${
      assignment.major ? ` · ${assignment.major}` : ""
    }`;
  }

  useEffect(() => {
    if (role !== "teacher" || !selectedAssignmentId) return;

    const next: Record<string, string> = {};
    const nextMapeh: Record<string, MapehDraft> = {};

    for (const student of classStudents) {
      const targetAssignmentId = gradeAssignmentIdForStudent(student.id);
      const grade = targetAssignmentId
        ? grades.find(
            (item) =>
              item.student_id === student.id &&
              item.teacher_assignment_id === targetAssignmentId &&
              item.term_no === selectedTerm
          )
        : undefined;

      next[student.id] = grade ? String(grade.term_grade) : "";
      nextMapeh[student.id] = grade
        ? {
            music:
              grade.music_grade === null ? "" : String(grade.music_grade),
            arts: grade.arts_grade === null ? "" : String(grade.arts_grade),
            physicalEducation:
              grade.physical_education_grade === null
                ? ""
                : String(grade.physical_education_grade),
            health:
              grade.health_grade === null ? "" : String(grade.health_grade),
          }
        : emptyMapehDraft();
    }

    setDrafts(next);
    setMapehDrafts(nextMapeh);
  }, [
    role,
    selectedAssignmentId,
    selectedTerm,
    classStudents,
    grades,
    selectedIsTve,
    assignments,
    enrollments,
  ]);

  function assignmentLabel(assignment: Assignment) {
    const subject = subjectMap.get(assignment.subject_id);
    const showMajor =
      assignment.major && !isTechnicalVocationalEducation(subject?.name);
    return `Grade ${assignment.grade_level} · ${sectionMap.get(assignment.section_id) ?? "Unknown"} · ${subject?.name ?? "Unknown subject"}${showMajor ? ` · ${assignment.major}` : ""}`;
  }

  function updateMapehDraft(
    studentId: string,
    field: keyof MapehDraft,
    value: string
  ) {
    setMapehDrafts((current) => ({
      ...current,
      [studentId]: {
        ...(current[studentId] ?? emptyMapehDraft()),
        [field]: value,
      },
    }));
  }

  async function saveGrade(studentId: string) {
    if (!selectedAssignmentId) return;

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
          termGrade: drafts[studentId],
          components: selectedIsMapeh
            ? mapehDrafts[studentId] ?? emptyMapehDraft()
            : undefined,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to save the Term Grade.");
        return;
      }

      setSuccess(`Term ${selectedTerm} grade saved.`);
      await load();
    } catch {
      setError("Unable to reach the grades service.");
    } finally {
      setWorking("");
    }
  }

  async function saveAllGrades() {
    if (!selectedAssignmentId || classStudents.length === 0) return;

    setWorking("save-all");
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/academic/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_all_grades",
          assignmentId: selectedAssignmentId,
          termNo: selectedTerm,
          records: classStudents.map((student) => ({
            studentId: student.id,
            termGrade: drafts[student.id] ?? "",
            components: selectedIsMapeh
              ? mapehDrafts[student.id] ?? emptyMapehDraft()
              : undefined,
          })),
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to save all Term Grades.");
        return;
      }

      setSuccess(
        `Term ${selectedTerm} grades saved for ${result.count ?? classStudents.length} learner(s).`
      );
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

  const allPublished =
    classStudents.length > 0 &&
    classStudents.every(
      (student) => savedGradeForStudent(student.id)?.status === "published"
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

      return { assignment, subject, terms, finalGrade };
    });
  }, [role, assignments, subjectMap, grades]);

  if (loading) {
    return (
      <main className={styles.loading}>
        <GraduationCap size={34} />
        <strong>Loading Grade Records…</strong>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topActions}>
          <a href="/portal" className={styles.topLink}>
            <ArrowLeft size={16} /> Back to Portal
          </a>
        </nav>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>ACADEMIC RECORDS</span>
            <h1>{role === "teacher" ? "Grades" : "My Grades"}</h1>
            <p>
              {role === "teacher"
                ? "Section Advisers can encode and publish official grades. Subject Teachers can view published grades only for the subjects assigned to them."
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

        {role === "teacher" &&
          isSectionAdviser &&
          subjectAssignments.length > 0 && (
            <section className={styles.teacherViewTabs}>
              <button
                type="button"
                className={teacherView === "adviser" ? styles.teacherViewActive : ""}
                onClick={() => setTeacherView("adviser")}
              >
                Adviser Gradebook
              </button>
              <button
                type="button"
                className={teacherView === "subjects" ? styles.teacherViewActive : ""}
                onClick={() => setTeacherView("subjects")}
              >
                My Subject Grades
              </button>
            </section>
          )}

        {role === "teacher" &&
          !isSectionAdviser &&
          subjectAssignments.length === 0 && (
            <section className={styles.gradePanel}>
              <div className={styles.empty}>
                No graded Subject Teacher assignments are available for your account yet.
              </div>
            </section>
          )}

        {role === "teacher" && isSectionAdviser && teacherView === "adviser" && (
          <>
            {assignments.length === 0 && adviserSections.length > 0 && (
              <section className={styles.gradePanel}>
                <div className={styles.panelHeading}>
                  <div>
                    <h2>
                      {adviserSections
                        .map((section) => `Grade ${section.grade_level} · ${section.name}`)
                        .join(", ")}
                    </h2>
                    <p>Your Section Adviser assignment is active for the current school year.</p>
                  </div>
                </div>
                <div className={styles.empty}>
                  <strong>Subjects & Teachers Not Yet Configured</strong>
                  <span>
                    This section is correctly assigned to you as Adviser, but it does not have
                    active Subject/Teacher assignments yet. Once the Administrator configures the
                    subjects for this section, they will appear here for grade encoding.
                  </span>
                </div>
              </section>
            )}

            <section className={styles.controls}>
              <label>
                <span>Assigned Class</span>
                <select
                  value={selectedAssignmentId}
                  disabled={assignments.length === 0}
                  onChange={(event) => setSelectedAssignmentId(event.target.value)}
                >
                  {assignments.length === 0 && (
                    <option value="">No Assigned Classes</option>
                  )}
                  {gradebookAssignments.map((assignment) => (
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

            {selectedIsTve && classStudents.some(
              (student) => !gradeAssignmentIdForStudent(student.id)
            ) && (
              <div className={styles.tveSetupNote}>
                <strong>
                  {
                    classStudents.filter(
                      (student) => !gradeAssignmentIdForStudent(student.id)
                    ).length
                  } learner(s) still need TVE setup
                </strong>
                <span>
                  Assign each learner&apos;s TVE Major in My Students and make sure the
                  matching TVE Subject Teacher is configured. Major names remain hidden
                  from this Gradebook.
                </span>
                <a href="/portal/my-students">Open My Students</a>
              </div>
            )}

            <section className={styles.gradePanel}>
              <div className={styles.panelHeading}>
                <div>
                  <h2>Term {selectedTerm}</h2>
                  <p>
                    {selectedIsMapeh
                      ? "Enter Music, Arts, Physical Education, and Health. The MAPEH Term Grade is calculated automatically."
                      : selectedIsTve
                        ? "Enter one TVE Term Grade per learner. TVE majors are handled automatically and are not shown in the Gradebook."
                        : "Enter a whole-number Term Grade from 0–100. Grades below 75 are flagged for intervention."}
                  </p>
                </div>
                <div className={styles.publishActions}>
                  {!allPublished && (
                    <button
                      className={styles.saveAll}
                      disabled={Boolean(working) || classStudents.length === 0}
                      onClick={() => void saveAllGrades()}
                    >
                      <Save size={16} />
                      {working === "save-all" ? "Saving All…" : "Save All Grades"}
                    </button>
                  )}
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
                  {selectedIsMapeh ? (
                    <div className={styles.mapehGradebook}>
                      <div className={styles.mapehHeader}>
                        <span>Learner</span>
                        <span>Music</span>
                        <span>Arts</span>
                        <span>PE</span>
                        <span>Health</span>
                        <span>MAPEH Result</span>
                        <span>Action</span>
                      </div>

                      {classStudentGroups.map(({ group, students: groupStudents }) => (
                        <Fragment key={group}>
                          <div className={styles.mapehGroupHeading}>
                            <strong>{group}</strong>
                            <span>
                              {groupStudents.length} learner
                              {groupStudents.length === 1 ? "" : "s"}
                            </span>
                          </div>

                          {groupStudents.map((student) => {
                            const saved = savedGradeForStudent(student.id);
                            const draft =
                              mapehDrafts[student.id] ?? emptyMapehDraft();
                            const average = computedMapehAverage(draft);
                            const effectiveGrade =
                              average ?? saved?.term_grade ?? null;
                            const published = saved?.status === "published";

                            return (
                              <div className={styles.mapehRow} key={student.id}>
                                <div className={styles.mapehLearner}>
                                  <strong>{student.full_name}</strong>
                                  <span>
                                    {(student.last_name && student.first_name
                                      ? `${student.last_name}, ${student.first_name}${
                                          student.middle_name
                                            ? ` ${student.middle_name}`
                                            : ""
                                        }${
                                          student.name_extension
                                            ? ` ${student.name_extension}`
                                            : ""
                                        }`
                                      : student.full_name)}
                                  </span>
                                  {student.lrn && <small>LRN {student.lrn}</small>}
                                </div>

                                {(
                                  [
                                    ["music", "Music"],
                                    ["arts", "Arts"],
                                    ["physicalEducation", "PE"],
                                    ["health", "Health"],
                                  ] as Array<[keyof MapehDraft, string]>
                                ).map(([field, label]) => (
                                  <label
                                    className={styles.mapehComponent}
                                    key={field}
                                  >
                                    <span>{label}</span>
                                    <input
                                      className={styles.componentInput}
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="1"
                                      value={draft[field]}
                                      disabled={published}
                                      onChange={(event) =>
                                        updateMapehDraft(
                                          student.id,
                                          field,
                                          event.target.value
                                        )
                                      }
                                      aria-label={`${student.full_name} ${label} Term ${selectedTerm} grade`}
                                    />
                                  </label>
                                ))}

                                <div className={styles.mapehResult}>
                                  <div className={styles.autoGrade}>
                                    <strong>
                                      {effectiveGrade === null ? "—" : effectiveGrade}
                                    </strong>
                                    <small>Automatic Average</small>
                                  </div>
                                  {effectiveGrade !== null && (
                                    <>
                                      <span className={styles.mapehDescriptor}>
                                        {descriptor(effectiveGrade)}
                                      </span>
                                      <span
                                        className={
                                          effectiveGrade < 75
                                            ? styles.intervention
                                            : styles.onTrack
                                        }
                                      >
                                        {effectiveGrade < 75
                                          ? "Intervention needed"
                                          : "Meets minimum standard"}
                                      </span>
                                    </>
                                  )}
                                  {saved ? (
                                    <span
                                      className={
                                        saved.status === "published"
                                          ? styles.published
                                          : styles.draft
                                      }
                                    >
                                      {saved.status === "published"
                                        ? "Published"
                                        : "Draft"}
                                    </span>
                                  ) : (
                                    <span className={styles.notSaved}>Not Saved</span>
                                  )}
                                </div>

                                <div className={styles.mapehAction}>
                                  <button
                                    className={styles.saveButton}
                                    disabled={
                                      working === student.id ||
                                      working === "save-all" ||
                                      published ||
                                      average === null
                                    }
                                    onClick={() => void saveGrade(student.id)}
                                  >
                                    <Save size={15} />
                                    {working === student.id ? "Saving…" : "Save"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </Fragment>
                      ))}
                    </div>
                  ) : (
                    <table className={styles.gradeTable}>
                      <thead>
                        <tr>
                          <th>Learner</th>
                          <th>Term Grade</th>
                          <th>Proficiency Descriptor</th>
                          <th>Support</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {classStudentGroups.map(({ group, students: groupStudents }) => (
                          <Fragment key={group}>
                            <tr className={styles.sexGroupRow}>
                              <td colSpan={6}>
                                <strong>{group}</strong>
                                <span>
                                  {groupStudents.length} learner
                                  {groupStudents.length === 1 ? "" : "s"}
                                </span>
                              </td>
                            </tr>
                            {groupStudents.map((student) => {
                              const saved = savedGradeForStudent(student.id);
                              const value = drafts[student.id] ?? "";

                              return (
                                <tr key={student.id}>
                                  <td>
                                    <strong>{student.full_name}</strong>
                                    <span>
                                      {(student.last_name && student.first_name
                                        ? `${student.last_name}, ${student.first_name}${
                                            student.middle_name
                                              ? ` ${student.middle_name}`
                                              : ""
                                          }${
                                            student.name_extension
                                              ? ` ${student.name_extension}`
                                              : ""
                                          }`
                                        : student.full_name)}
                                      {student.lrn ? ` · LRN ${student.lrn}` : ""}
                                    </span>
                                  </td>
                                  <td>
                                    <input
                                      className={styles.termInput}
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="1"
                                      value={value}
                                      disabled={saved?.status === "published"}
                                      onChange={(event) =>
                                        setDrafts((current) => ({
                                          ...current,
                                          [student.id]: event.target.value,
                                        }))
                                      }
                                      aria-label={`${student.full_name} Term ${selectedTerm} grade`}
                                    />
                                  </td>
                                  <td>
                                    {saved ? (
                                      <strong>{descriptor(saved.term_grade)}</strong>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                  <td>
                                    {saved ? (
                                      <span
                                        className={
                                          saved.term_grade < 75
                                            ? styles.intervention
                                            : styles.onTrack
                                        }
                                      >
                                        {saved.term_grade < 75
                                          ? "Intervention needed"
                                          : "Meets minimum standard"}
                                      </span>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                  <td>
                                    {saved ? (
                                      <span
                                        className={
                                          saved.status === "published"
                                            ? styles.published
                                            : styles.draft
                                        }
                                      >
                                        {saved.status === "published"
                                          ? "Published"
                                          : "Draft"}
                                      </span>
                                    ) : (
                                      <span className={styles.notSaved}>Not Saved</span>
                                    )}
                                  </td>
                                  <td>
                                    <button
                                      className={styles.saveButton}
                                      disabled={
                                        working === student.id ||
                                        working === "save-all" ||
                                        saved?.status === "published" ||
                                        (selectedIsTve &&
                                          !gradeAssignmentIdForStudent(student.id))
                                      }
                                      onClick={() => void saveGrade(student.id)}
                                      title={
                                        selectedIsTve &&
                                        !gradeAssignmentIdForStudent(student.id)
                                          ? "Assign this learner's TVE Major in My Students first."
                                          : undefined
                                      }
                                    >
                                      <Save size={15} />
                                      {working === student.id ? "Saving…" : "Save"}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </section>
          </>
        )}

        {role === "teacher" &&
          subjectAssignments.length > 0 &&
          (!isSectionAdviser || teacherView === "subjects") && (
            <>
              <section className={styles.controls}>
                <label>
                  <span>My Subject</span>
                  <select
                    value={selectedSubjectAssignmentId}
                    onChange={(event) =>
                      setSelectedSubjectAssignmentId(event.target.value)
                    }
                  >
                    {subjectAssignments.map((assignment) => (
                      <option key={assignment.id} value={assignment.id}>
                        {subjectAssignmentLabel(assignment)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className={styles.termTabs}>
                  {[1, 2, 3].map((term) => (
                    <button
                      type="button"
                      key={term}
                      className={
                        selectedSubjectTerm === term
                          ? styles.termActive
                          : styles.termButton
                      }
                      onClick={() => setSelectedSubjectTerm(term)}
                    >
                      Term {term}
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.gradePanel}>
                <div className={styles.panelHeading}>
                  <div>
                    <h2>Published Subject Grades · Term {selectedSubjectTerm}</h2>
                    <p>
                      Read-only view. You can see only published grades for the
                      subject and section assigned to your Teacher account.
                    </p>
                  </div>
                  <span className={styles.readOnlyBadge}>VIEW ONLY</span>
                </div>

                {!selectedSubjectAssignment ? (
                  <div className={styles.empty}>
                    Select one of your graded Subject Teacher assignments.
                  </div>
                ) : subjectClassStudents.length === 0 ? (
                  <div className={styles.empty}>
                    No active learners are assigned to this subject.
                  </div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.gradeTable}>
                      <thead>
                        <tr>
                          <th>Learner</th>
                          <th>Term Grade</th>
                          <th>Proficiency Descriptor</th>
                          <th>Support</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjectClassStudentGroups.map(
                          ({ group, students: groupStudents }) => (
                            <Fragment key={group}>
                              <tr className={styles.sexGroupRow}>
                                <td colSpan={5}>
                                  <strong>{group}</strong>
                                  <span>
                                    {groupStudents.length} learner
                                    {groupStudents.length === 1 ? "" : "s"}
                                  </span>
                                </td>
                              </tr>
                              {groupStudents.map((student) => {
                                const published =
                                  publishedSubjectGradeForStudent(student.id);

                                return (
                                  <tr key={student.id}>
                                    <td>
                                      <strong>{student.full_name}</strong>
                                      <span>
                                        {(student.last_name && student.first_name
                                          ? `${student.last_name}, ${student.first_name}${
                                              student.middle_name
                                                ? ` ${student.middle_name}`
                                                : ""
                                            }${
                                              student.name_extension
                                                ? ` ${student.name_extension}`
                                                : ""
                                            }`
                                          : student.full_name)}
                                        {student.lrn
                                          ? ` · LRN ${student.lrn}`
                                          : ""}
                                      </span>
                                    </td>
                                    <td>
                                      {published ? (
                                        <strong className={styles.subjectGradeValue}>
                                          {published.term_grade}
                                        </strong>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                    <td>
                                      {published
                                        ? descriptor(published.term_grade)
                                        : "—"}
                                    </td>
                                    <td>
                                      {published ? (
                                        <span
                                          className={
                                            published.term_grade < 75
                                              ? styles.intervention
                                              : styles.onTrack
                                          }
                                        >
                                          {published.term_grade < 75
                                            ? "Intervention needed"
                                            : "Meets minimum standard"}
                                        </span>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                    <td>
                                      {published ? (
                                        <span className={styles.published}>
                                          Published
                                        </span>
                                      ) : (
                                        <span className={styles.notSaved}>
                                          Not Published
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </Fragment>
                          )
                        )}
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
                <p>Only grades published by your Section Adviser are shown here.</p>
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
                          {assignment.major &&
                          !isTechnicalVocationalEducation(subject?.name)
                            ? ` · ${assignment.major}`
                            : ""}
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
                              {isMapeh(subject?.name) &&
                                term.music_grade !== null &&
                                term.arts_grade !== null &&
                                term.physical_education_grade !== null &&
                                term.health_grade !== null && (
                                  <span className={styles.componentSummary}>
                                    Music {term.music_grade} · Arts {term.arts_grade} ·
                                    PE {term.physical_education_grade} · Health {term.health_grade}
                                  </span>
                                )}
                              {term.term_grade < 75 && <em>Intervention needed</em>}
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
                            <em
                              className={
                                finalGrade >= 75 ? styles.passed : styles.failed
                              }
                            >
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

        <section className={styles.legend}>
          <h2>Proficiency Descriptors</h2>
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
