// Shared by the importer, profile service, and portal. Never infer missing HR facts.
export const personalFields = [
  ["last_name", "Last Name"], ["first_name", "First Name"], ["middle_name", "Middle Name"],
  ["name_extension", "Name Extension"], ["birth_date", "Birth date"], ["birth_place", "Place of birth"],
  ["mobile", "Mobile number"], ["address", "Home address"],
  ["additional_units", "Legacy/source units entry"],
  ["graduate_course", "Degree"],
  ["graduate_status", "Graduate Studies Status"],
  ["graduate_units_earned", "Graduate Studies Units Earned"],
  ["graduate_car_completed", "Completed Academic Requirements"],
  ["graduate_units", "Legacy graduate studies entry"],
  ["bachelors_degree", "Course"], ["bachelors_degree_other", "Other Bachelor's Degree"], ["major", "Major"], ["minor", "Minor"],
  ["bsed_earning_units", "BSEd-Earning Units"], ["education_units_major", "BSEd-Earning Units - Major"], ["education_units_minor", "BSEd-Earning Units - Minor"],
  ["skills", "SKILLS / SPECIALIZATION (NC I, NC II, NC III / TRAINERS METHODOLOGY)"],
  ["philsys_number", "Philsys (National ID) Number"], ["religion", "Religion"], ["ethnic_group", "Ethnic Group"],
] as const;

export const officialFields = [
  ["appointment_day_month_source", "Original appointment day / month from source"],
  ["appointment_year_source", "Original appointment year from source"],
  ["appointment_date", "Date of Original Appointment"],
  ["employment_status", "Employment Status"], ["employee_number", "Employee Number"],
  ["employment_end_date", "Employment End Date (leave blank if current)"],
  ["salary_grade", "Salary Grade / Step"], ["monthly_salary", "Monthly Salary (PHP)"],
  ["hr_notes", "HR Notes"],
] as const;

export const serviceFields = [
  ["date_from", "From"], ["date_to", "To (blank if present)"], ["designation", "Designation"],
  ["status", "Appointment Status"], ["salary", "Annual Salary (PHP)"], ["station", "Office / Station"],
  ["branch", "Government Branch"], ["leave_without_pay", "Leave Without Pay"], ["remarks", "Separation / Remarks"],
] as const;
export const ratingFields = [
  ["period", "Rating Period / School Year"], ["instrument", "Rating Instrument"], ["rating", "Final Rating"],
  ["description", "Adjectival Rating"], ["rater", "Rater"], ["date", "Date"], ["remarks", "Remarks"],
] as const;

export const bachelorDegreeOptions = [
  "BACHELOR OF ELEMENTARY EDUCATION (BEED)",
  "BACHELOR OF SECONDARY EDUCATION (BSED)",
  "BACHELOR OF EARLY CHILDHOOD EDUCATION (BECED)",
  "BACHELOR OF SPECIAL NEEDS EDUCATION (BSNED)",
  "BACHELOR OF PHYSICAL EDUCATION (BPED)",
  "BACHELOR OF TECHNOLOGY AND LIVELIHOOD EDUCATION (BTLED)",
  "BACHELOR OF TECHNICAL-VOCATIONAL TEACHER EDUCATION (BTVTED)",
  "OTHER BACHELOR'S DEGREE",
] as const;

export const requiredPersonnelProfileFields = [
  ["graduate_status", "Graduate Studies"],
  ["bachelors_degree", "Bachelor's Degree"],
  ["philsys_number", "PhilSys (National ID) Number"],
  ["religion", "Religion"],
  ["ethnic_group", "Ethnic Group"],
] as const;

export function normalizePhilSysNumber(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 16) {
    throw new Error("PhilSys (National ID) Number must contain exactly 16 digits.");
  }
  return digits.match(/.{1,4}/g)?.join(" - ") ?? digits;
}

export function normalizeGraduateProfile(input: Record<string, string>) {
  const result = { ...input };
  const status = String(result.graduate_status ?? "").trim().toUpperCase();
  if (status && !["GRADUATED", "ON GOING", "NONE"].includes(status)) {
    throw new Error("Graduate Studies must be Graduated, On Going, or None.");
  }
  result.graduate_status = status;

  if (status === "ON GOING") {
    const units = String(result.graduate_units_earned ?? "").trim();
    if (units && !/^\d{1,3}(?:\.\d{1,2})?$/.test(units)) {
      throw new Error("Graduate Studies Units Earned must be a valid number.");
    }
    result.graduate_units_earned = units;
    result.graduate_car_completed =
      String(result.graduate_car_completed ?? "").trim().toUpperCase() === "YES"
        ? "YES"
        : "NO";
  } else {
    result.graduate_units_earned = "";
    result.graduate_car_completed = "NO";
  }

  const bachelorDegree = String(result.bachelors_degree ?? "").trim().toUpperCase();
  if (bachelorDegree && !bachelorDegreeOptions.includes(bachelorDegree as (typeof bachelorDegreeOptions)[number])) {
    throw new Error("Select a valid Bachelor's Degree option.");
  }
  result.bachelors_degree = bachelorDegree;

  const needsMajorMinor =
    bachelorDegree === "BACHELOR OF SECONDARY EDUCATION (BSED)" ||
    bachelorDegree === "BACHELOR OF TECHNICAL-VOCATIONAL TEACHER EDUCATION (BTVTED)";

  if (!needsMajorMinor) {
    result.major = "";
    result.minor = "";
  }

  if (bachelorDegree === "OTHER BACHELOR'S DEGREE") {
    result.bachelors_degree_other = String(result.bachelors_degree_other ?? "").trim().toUpperCase();
  } else {
    result.bachelors_degree_other = "";
  }

  result.bsed_earning_units =
    String(result.bsed_earning_units ?? "").trim().toUpperCase() === "YES" ? "YES" : "NO";
  if (result.bsed_earning_units !== "YES") {
    result.education_units_major = "";
    result.education_units_minor = "";
  }

  result.philsys_number = normalizePhilSysNumber(result.philsys_number ?? "");
  return result;
}

export function personnelProfileMissingFields(input: Record<string, string>) {
  const missing: string[] = [];
  const graduateStatus = String(input.graduate_status ?? "").trim().toUpperCase();
  if (!["GRADUATED", "ON GOING", "NONE"].includes(graduateStatus)) {
    missing.push("Graduate Studies");
  }

  const bachelorDegree = String(input.bachelors_degree ?? "").trim().toUpperCase();
  if (!bachelorDegreeOptions.includes(bachelorDegree as (typeof bachelorDegreeOptions)[number])) {
    missing.push("Bachelor's Degree");
  } else {
    if (
      bachelorDegree === "OTHER BACHELOR'S DEGREE" &&
      !String(input.bachelors_degree_other ?? "").trim()
    ) {
      missing.push("Other Bachelor's Degree Course");
    }
  }

  const philsysDigits = String(input.philsys_number ?? "").replace(/\D/g, "");
  if (philsysDigits.length !== 16) {
    missing.push("PhilSys (National ID) Number");
  }
  if (!String(input.religion ?? "").trim()) {
    missing.push("Religion");
  }
  if (!String(input.ethnic_group ?? "").trim()) {
    missing.push("Ethnic Group");
  }
  return missing;
}

export type TeacherDetails = Record<string, string>;
export function cleanDetails(input: unknown, fields: readonly (readonly [string, string])[]): TeacherDetails {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid profile details.");
  const source = input as Record<string, unknown>;
  const allowed = new Set(fields.map(([key]) => key));
  if (Object.keys(source).some(key => !allowed.has(key))) throw new Error("Some fields cannot be edited here.");
  const result: TeacherDetails = {};
  for (const [key] of fields) {
    if (!(key in source)) continue;
    if (typeof source[key] !== "string") throw new Error(`Invalid value for ${key}.`);
    const rawValue = source[key].trim();
    if (rawValue.length > 2000) throw new Error("A profile field exceeds 2,000 characters.");
    if (rawValue && (key.endsWith("_date") || key === "date_from" || key === "date_to" || key === "date")) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rawValue) || !Number.isFinite(Date.parse(rawValue)) || new Date(rawValue).toISOString().slice(0, 10) !== rawValue) {
        throw new Error("Use a valid calendar date.");
      }
    }
    result[key] = rawValue.toUpperCase();
  }
  return result;
}

export function cleanEntries(input: unknown, fields: readonly (readonly [string, string])[]) {
  if (!Array.isArray(input) || input.length > 100) throw new Error("Use up to 100 entries per record.");
  return input.map(item => {
    const row = cleanDetails(item, fields);
    if (row.date_from && row.date_to && row.date_from > row.date_to) throw new Error("A service end date cannot precede its start date.");
    return row;
  });
}


export function cleanTeacherNamePart(value: unknown) {
  const cleaned = String(value ?? "").trim().replace(/\s+/g, " ");
  return ["-", "–", "—"].includes(cleaned) ? "" : cleaned;
}

export function normalizeTeacherNameExtension(value: unknown) {
  const cleaned = cleanTeacherNamePart(value);
  const raw = cleaned.replace(/\.$/, "").toUpperCase();
  if (raw === "JR") return "JR.";
  if (raw === "SR") return "SR.";
  if (["I", "II", "III", "IV", "V"].includes(raw)) return raw;
  return cleaned.toUpperCase();
}

export function normalizeTeacherNameFields(input: Record<string, string>) {
  let firstName = cleanTeacherNamePart(input.first_name).toUpperCase();
  const middleName = cleanTeacherNamePart(input.middle_name).toUpperCase();
  const lastName = cleanTeacherNamePart(input.last_name).toUpperCase();
  let extension = normalizeTeacherNameExtension(input.name_extension);

  if (!extension) {
    const match = firstName.match(/\s+(JR\.?|SR\.?|I|II|III|IV|V)$/i);
    if (match && match.index !== undefined) {
      firstName = firstName.slice(0, match.index).trim();
      extension = normalizeTeacherNameExtension(match[1] ?? "");
    }
  }

  return {
    ...input,
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
    name_extension: extension,
  };
}

export function teacherDisplayName(
  input: Record<string, string>,
  fallback = ""
) {
  const normalized = normalizeTeacherNameFields(input);
  const middleInitial = normalized.middle_name
    ? `${Array.from(normalized.middle_name)[0]?.toUpperCase() ?? ""}.`
    : "";

  return [
    normalized.first_name,
    middleInitial,
    normalized.last_name,
    normalized.name_extension,
  ]
    .filter(Boolean)
    .join(" ")
    .trim() || cleanTeacherNamePart(fallback).toUpperCase();
}
