// Shared by the importer, profile service, and portal. Never infer missing HR facts.
export const personalFields = [
  ["last_name", "Last Name"], ["first_name", "First Name"], ["middle_name", "Middle Name"],
  ["name_extension", "Name Extension"], ["birth_date", "Birth date"], ["birth_place", "Place of birth"],
  ["mobile", "Mobile number"], ["address", "Home address"],
  ["additional_units", "Legacy/source units entry"],
  ["graduate_course", "Degree"],
  ["graduate_units", "Indicate if graduated or units earned if not graduated or CAR for completed Academic Requirements"],
  ["bachelors_degree", "Course"], ["major", "Major"], ["minor", "Minor"],
  ["education_units_major", "BSED-Earning Units - Major"], ["education_units_minor", "BSED-Earning Units - Minor"],
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
