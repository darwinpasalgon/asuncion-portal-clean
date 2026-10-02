// Shared by the importer, profile service, and portal. Never infer missing HR facts.
export const personalFields = [
  ["last_name", "Last name"], ["first_name", "First name"], ["middle_name", "Middle name"],
  ["name_extension", "Name extension"], ["birth_date", "Birth date"], ["birth_place", "Place of birth"],
  ["mobile", "Mobile number"], ["address", "Home address"],
  ["additional_units", "Units earned / CAR (source column H)"],
  ["graduate_course", "Graduate course / master's degree"], ["graduate_units", "Graduate units earned / CAR"],
  ["bachelors_degree", "Bachelor's degree / course"], ["major", "Major"], ["minor", "Minor"],
  ["education_units_major", "Education units earned / major"], ["education_units_minor", "Education units earned / minor"],
  ["skills", "Skills / specialization / NC / trainers methodology"],
  ["philsys_number", "PhilSys (National ID) number"], ["religion", "Religion"], ["ethnic_group", "Ethnic group"],
] as const;

export const officialFields = [
  ["appointment_day_month_source", "Original appointment: day / month as supplied"],
  ["appointment_year_source", "Original appointment: year as supplied"],
  ["appointment_date", "Verified original appointment date"],
  ["employment_status", "Employment status"], ["employee_number", "Employee number"],
  ["employment_end_date", "Employment end date (leave blank if current)"],
  ["salary_grade", "Salary grade / step"], ["monthly_salary", "Monthly salary (PHP)"],
  ["hr_notes", "HR notes"],
] as const;

export const serviceFields = [
  ["date_from", "From"], ["date_to", "To (blank if present)"], ["designation", "Designation"],
  ["status", "Appointment status"], ["salary", "Annual salary (PHP)"], ["station", "Office / station"],
  ["branch", "Government branch"], ["leave_without_pay", "Leave without pay"], ["remarks", "Separation / remarks"],
] as const;
export const ratingFields = [
  ["period", "Rating period / school year"], ["instrument", "Rating instrument"], ["rating", "Final rating"],
  ["description", "Adjectival rating"], ["rater", "Rater"], ["date", "Date"], ["remarks", "Remarks"],
] as const;

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
    const value = source[key].trim();
    if (value.length > 2000) throw new Error("A profile field exceeds 2,000 characters.");
    if (value && (key.endsWith("_date") || key === "date_from" || key === "date_to" || key === "date")) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
        throw new Error("Use a valid calendar date.");
      }
    }
    result[key] = value;
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
