/** One STEM section, two elective-only instructional groups. */
export const STEM_GROUPS = [
  { code: "STEM_MEDICAL", label: "STEM - Medical", shortLabel: "Medical" },
  { code: "STEM_ENGINEERING", label: "STEM - Engineering", shortLabel: "Engineering" },
] as const;

export type StemGroupCode = (typeof STEM_GROUPS)[number]["code"];

export function isStemGroup(value: unknown): value is StemGroupCode {
  return value === "STEM_MEDICAL" || value === "STEM_ENGINEERING";
}

export function stemGroupLabel(code: unknown) {
  return STEM_GROUPS.find((item) => item.code === code)?.shortLabel ?? "Not Assigned";
}

export function publicShsProgram(code: string) {
  return isStemGroup(code) || code === "STEM" ? "STEM" : code;
}

/** Grade 11 single-section TVL majors and combined elective group helpers. */
export const TVL_GROUPS = [
  { code: "TVL_FOOD_PROCESSING", label: "TVL - Food Processing", shortLabel: "Food Processing" },
  { code: "TVL_OAP", label: "TVL - Organic Agriculture Production", shortLabel: "Organic Agriculture Production" },
] as const;
export const GRADE11_ELECTIVE_GROUPS = [...STEM_GROUPS, ...TVL_GROUPS] as const;
export function isGrade11ElectiveGroup(value: unknown): value is "STEM_MEDICAL" | "STEM_ENGINEERING" | "TVL_FOOD_PROCESSING" | "TVL_OAP" {
 return isStemGroup(value) || value === "TVL_FOOD_PROCESSING" || value === "TVL_OAP";
}
export function electiveGroupLabel(code: unknown) {
 return GRADE11_ELECTIVE_GROUPS.find((group) => group.code === code)?.shortLabel ?? "Not Assigned";
}
export function groupsForSectionProgram(code: string | null | undefined) {
 return code === "STEM" ? STEM_GROUPS : code === "TVL" ? TVL_GROUPS : [];
}
