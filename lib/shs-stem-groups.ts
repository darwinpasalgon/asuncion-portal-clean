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
