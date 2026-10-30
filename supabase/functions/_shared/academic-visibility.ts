/** Shared by Next.js and Edge Functions; never widens database permissions. */
export type MajorEnrollment = {
  tve_major?: string | null;
  shs_elective_group?: string | null;
};
export type TeachingAssignment = {
  id: string;
  grade_level: number;
  teacher_id: string;
  co_teacher_ids?: string[] | null;
  major?: string | null;
};
export type TermTeachingLink = {
  teacher_assignment_id: string | null;
  term_teacher_id: string | null;
  term_no: number;
  requires_learner_group?: boolean;
};
export function learnerMajor(gradeLevel: number, enrollment: MajorEnrollment) {
  return String(gradeLevel === 11 ? enrollment.shs_elective_group ?? "" : enrollment.tve_major ?? "").trim();
}
export function matchesLearnerMajor(assignment: { grade_level: number; major?: string | null }, enrollment: MajorEnrollment) {
  return !assignment.major || learnerMajor(assignment.grade_level, enrollment) === assignment.major;
}
export function teacherTerms(assignment: TeachingAssignment, links: TermTeachingLink[], userId: string) {
  return assignment.grade_level === 12
    ? links.filter(link => link.teacher_assignment_id === assignment.id && link.term_teacher_id === userId)
    : [];
}
export function teacherCanSeeAssignment(assignment: TeachingAssignment, links: TermTeachingLink[], userId: string) {
  const termLinks = assignment.grade_level === 12 ? links.filter(link => link.teacher_assignment_id === assignment.id) : [];
  return assignment.grade_level === 12
    ? termLinks.some(link => link.term_teacher_id === userId)
    : assignment.teacher_id === userId || (assignment.co_teacher_ids ?? []).includes(userId);
}
export function teacherCanReadRoster(assignment: TeachingAssignment, links: TermTeachingLink[], userId: string) {
  if (!teacherCanSeeAssignment(assignment, links, userId)) return false;
  const termLinks = assignment.grade_level === 12 ? links.filter(link => link.teacher_assignment_id === assignment.id) : [];
  return !termLinks.length || teacherTerms(assignment, links, userId).some(link => !link.requires_learner_group);
}
