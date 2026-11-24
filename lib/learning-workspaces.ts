export type IlawSession = {
  intentions: string;
  learning_experiences: string;
  assessment: string;
  ways_forward: string;
};
export type IlawContent = {
  title: string;
  subject: string;
  grade_level: number;
  section: string;
  term_no: number;
  week_no: number;
  lesson_date: string;
  duration_minutes: number;
  language: string;
  competencies: string;
  learner_context: string;
  references: string;
  materials: string;
  sessions: IlawSession[];
};
export const ILAW_SECTIONS = [
  { key: "intentions", letter: "I", title: "Intentions", hint: "What should learners know or be able to do? Include clear success criteria." },
  { key: "learning_experiences", letter: "L", title: "Learning Experiences", hint: "Write your lesson sequence, examples, questions, practice, and adaptations." },
  { key: "assessment", letter: "A", title: "Assessment", hint: "How will you check understanding during the lesson? Include prompts or assessment criteria." },
  { key: "ways_forward", letter: "W", title: "Ways Forward", hint: "Record your next steps, enrichment, or additional support. Add actual reflections after the lesson." },
] as const;
export const ARAL_AREAS = ["Reading", "Mathematics", "Science"] as const;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid form data.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, label: string, max = 5000, required = false): string {
  if (value !== undefined && value !== null && typeof value !== "string") throw new Error(`${label} must be text.`);
  const result = String(value ?? "").trim();
  if (result.length > max) throw new Error(`${label} is too long (maximum ${max} characters).`);
  if (required && !result) throw new Error(`${label} is required.`);
  return result;
}
export function integer(value: unknown, label: string, min: number, max: number): number {
  if (value === null || value === "" || typeof value === "boolean") throw new Error(`${label} is required.`);
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label} must be between ${min} and ${max}.`);
  return n;
}
export function uuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}
export function day(value: unknown, required = false): string {
  const s = text(value, "Date", 10, required);
  if (!s) return "";
  const d = new Date(s + "T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new Error("Enter a valid date.");
  return s;
}
export function resourceUrl(value: unknown): string {
  const s = text(value, "Resource link", 2000);
  if (!s) return "";
  try {
    const u = new URL(s);
    if (u.protocol === "https:" && !u.username && !u.password) return u.href;
  } catch { /* Return the same safe validation error for every invalid URL. */ }
  throw new Error("Resource links must use HTTPS and must not contain a username or password.");
}
export function validateIlaw(value: unknown, ready = false): IlawContent {
  const v = object(value);
  if (!Array.isArray(v.sessions) || v.sessions.length < 1 || v.sessions.length > 5) throw new Error("Choose between one and five sessions.");
  const content: IlawContent = {
    title: text(v.title, "Lesson title", 180, true),
    subject: text(v.subject, "Learning area", 120, true),
    grade_level: integer(v.grade_level, "Grade level", 7, 12),
    section: text(v.section, "Section", 120),
    term_no: integer(v.term_no, "Term", 1, 3),
    week_no: integer(v.week_no, "Week", 1, 53),
    lesson_date: day(v.lesson_date),
    duration_minutes: integer(v.duration_minutes, "Session duration", 10, 240),
    language: text(v.language, "Language", 80, true),
    competencies: text(v.competencies, "Learning competencies", 12000, ready),
    learner_context: text(v.learner_context, "Learner context", 8000),
    references: text(v.references, "References", 8000),
    materials: text(v.materials, "Materials", 5000),
    sessions: v.sessions.map((value, index) => {
      const s = object(value);
      return {
        intentions: text(s.intentions, `Session ${index + 1}: Intentions`, 12000, ready),
        learning_experiences: text(s.learning_experiences, `Session ${index + 1}: Learning Experiences`, 20000, ready),
        assessment: text(s.assessment, `Session ${index + 1}: Assessment`, 12000, ready),
        ways_forward: text(s.ways_forward, `Session ${index + 1}: Ways Forward`, 10000),
      };
    }),
  };
  if (JSON.stringify(content).length > 180000) throw new Error("This plan is too large. Shorten it or split it into separate plans.");
  return content;
}
export function validateSupportPlan(value: unknown) {
  const v = object(value);
  if (!ARAL_AREAS.includes(v.focus_area as typeof ARAL_AREAS[number])) throw new Error("Choose Reading, Mathematics, or Science.");
  if (!["active", "paused", "completed", "archived"].includes(String(v.status))) throw new Error("Choose a valid support status.");
  return {
    school_year_id: uuid(v.school_year_id, "School year"),
    student_id: uuid(v.student_id, "Learner"),
    tutor_id: uuid(v.tutor_id, "Tutor"),
    focus_area: String(v.focus_area),
    target_skill: text(v.target_skill, "Target skill", 500, true),
    assessment_basis: text(v.assessment_basis, "Assessment / referral basis", 5000, true),
    learner_instructions: text(v.learner_instructions, "Learner instructions", 8000),
    resource_url: resourceUrl(v.resource_url),
    status: String(v.status),
  };
}
export function validateSupportSession(value: unknown) {
  const v = object(value);
  if (!["scheduled", "present", "absent", "excused"].includes(String(v.attendance))) throw new Error("Choose a valid session attendance status.");
  const hasScore = v.score !== "" && v.score !== null && v.score !== undefined;
  const hasMax = v.max_score !== "" && v.max_score !== null && v.max_score !== undefined;
  if (typeof v.score === "boolean" || typeof v.max_score === "boolean") throw new Error("Enter a numeric score and maximum.");
  if (hasScore !== hasMax) throw new Error("Enter both the score and its maximum, or leave both blank.");
  const score = hasScore ? Number(v.score) : null;
  const max = hasMax ? Number(v.max_score) : null;
  if (hasScore && (!Number.isFinite(score) || !Number.isFinite(max) || score! < 0 || max! <= 0 || max! > 100000 || score! > max!)) throw new Error("The learning-check score must be between zero and its maximum.");
  return {
    plan_id: uuid(v.plan_id, "Support plan"),
    session_date: day(v.session_date, true),
    activity: text(v.activity, "Session activity", 10000, true),
    attendance: String(v.attendance),
    assessment_name: text(v.assessment_name, "Learning-check name", 180, hasScore),
    score,
    max_score: max,
    feedback: text(v.feedback, "Feedback for the learner", 8000),
    next_steps: text(v.next_steps, "Next steps", 5000),
    resource_url: resourceUrl(v.resource_url),
  };
}
export function sameTutorClass(tutorId: string, sectionId: string, assignments: Array<{ teacher_id: string; section_id: string; co_teacher_ids?: string[] | null }>, advisers: Array<{ teacher_id: string; section_id: string }>): boolean {
  return assignments.some(a => a.section_id === sectionId && (a.teacher_id === tutorId || (a.co_teacher_ids ?? []).includes(tutorId))) || advisers.some(a => a.section_id === sectionId && a.teacher_id === tutorId);
}
export function learningCheckLabel(score: number | null, maximum: number | null): string {
  if (score === null || maximum === null || maximum <= 0) return "Not recorded";
  return `${score} / ${maximum}`;
}
export function csvCell(value: unknown): string {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s) || /^[\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
