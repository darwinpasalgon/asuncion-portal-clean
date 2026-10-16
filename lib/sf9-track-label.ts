/** Present the full senior-high program name on printed SF9.
 * Legacy aliases and internal elective-group codes must never appear on the
 * Track line. A learner's Medical or Engineering group is for electives only.
 */
const TRACK_LABELS: Record<string, string> = {
  BE: "Business and Entrepreneurship",
  BUSINESS_ENTREPRENEURSHIP: "Business and Entrepreneurship",
  BUSINESS_AND_ENTREPRENEURSHIP: "Business and Entrepreneurship",
  "BUSINESS AND ENTREPRENEURSHIP": "Business and Entrepreneurship",

  STEM: "Science, Technology, Engineering, and Mathematics",
  STEM_MEDICAL: "Science, Technology, Engineering, and Mathematics",
  STEM_ENGINEERING: "Science, Technology, Engineering, and Mathematics",
  "STEM MEDICAL": "Science, Technology, Engineering, and Mathematics",
  "STEM ENGINEERING": "Science, Technology, Engineering, and Mathematics",
  "SCIENCE TECHNOLOGY ENGINEERING AND MATHEMATICS": "Science, Technology, Engineering, and Mathematics",

  ASSH: "Arts, Social Sciences, and Humanities",
  "ARTS SOCIAL SCIENCES AND HUMANITIES": "Arts, Social Sciences, and Humanities",
  HUMSS: "Humanities and Social Sciences",
  ABM: "Accountancy, Business, and Management",

  TVL: "Technical-Vocational-Livelihood",
  "TECHNICAL VOCATIONAL LIVELIHOOD": "Technical-Vocational-Livelihood",
  TVL_OAP: "Technical-Vocational-Livelihood",
  TVL_FOOD_PROCESSING: "Technical-Vocational-Livelihood",
  "TVL FOOD PROCESSING": "Technical-Vocational-Livelihood",
  "TVL ORGANIC AGRICULTURE PRODUCTION": "Technical-Vocational-Livelihood",

  ALS_SHS: "Alternative Learning System - Senior High School",
};

export function sf9TrackLabel(raw: string | null | undefined): string {
  const value = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!value) return "";
  const normalized = value.toUpperCase();
  const clean = normalized.replace(/[\s\-–,()]+/g, " ").trim();
  return TRACK_LABELS[normalized] ?? TRACK_LABELS[clean] ?? value;
}
