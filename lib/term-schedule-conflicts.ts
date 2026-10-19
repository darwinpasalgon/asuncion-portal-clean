export type TermPeriod = {
  id: string;
  school_year_id: string;
  section_id: string;
  term_no: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject_label: string;
  instructor_ids: string[];
};
const combinedTvl = "ORGANIC AGRICULTURE PRODUCTION/FOOD PROCESSING";
const separateTvl = new Set(["ORGANIC AGRICULTURE PRODUCTION", "FOOD PROCESSING"]);
export function termPeriodConflicts(target: TermPeriod, others: TermPeriod[]) {
  return others.filter(other => {
    if (other.id === target.id || other.school_year_id !== target.school_year_id ||
        other.term_no !== target.term_no || other.day_of_week !== target.day_of_week ||
        other.start_time.slice(0, 5) >= target.end_time.slice(0, 5) ||
        other.end_time.slice(0, 5) <= target.start_time.slice(0, 5)) return false;
    const sharedTeacher = other.instructor_ids.some(id => target.instructor_ids.includes(id));
    const combined = target.section_id !== other.section_id && target.subject_label === combinedTvl && other.subject_label === combinedTvl;
    const parallelMajors = target.subject_label !== other.subject_label && separateTvl.has(target.subject_label) && separateTvl.has(other.subject_label);
    return (sharedTeacher && !combined) || (target.section_id === other.section_id && !parallelMajors);
  });
}
