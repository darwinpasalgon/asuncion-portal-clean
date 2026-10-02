export const TECHNICAL_VOCATIONAL_EDUCATION = "Technical Vocational Education";

export const TECHNICAL_VOCATIONAL_MAJORS = [
  "Computer Systems Servicing",
  "Electrical Installation and Maintenance",
  "Food Processing",
  "Animal Production",
  "Agriculture Crop Production",
] as const;

export type TechnicalVocationalMajor =
  (typeof TECHNICAL_VOCATIONAL_MAJORS)[number];

export function isTechnicalVocationalEducation(name?: string | null) {
  return String(name ?? "").trim().toLowerCase() ===
    TECHNICAL_VOCATIONAL_EDUCATION.toLowerCase();
}

export function requiresTechnicalVocationalMajor(
  gradeLevel: number,
  subjectName?: string | null
) {
  return [8, 9, 10].includes(gradeLevel) &&
    isTechnicalVocationalEducation(subjectName);
}
