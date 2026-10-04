import * as XLSX from "npm:xlsx@0.18.5";
import {
  normalizeTeacherNameFields,
  teacherDisplayName,
} from "./teacher-profile.ts";

const text = (value: unknown) => String(value ?? "").replace(/\u00a0/g, " ").trim();
const compact = (value: unknown) => text(value).toLowerCase().replace(/[^a-z0-9]/g, "");

const months: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9,
  sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

function bachelorDegreeFields(value: unknown, majorValue: unknown, minorValue: unknown) {
  const raw = text(value).toUpperCase();
  let bachelors_degree = "";
  let bachelors_degree_other = "";

  if (["BACHELOR OF ELEMENTARY EDUCATION","BEED","BACHELOR OF ELEMENTARY EDUCATION (BEED)"].includes(raw)) {
    bachelors_degree = "BACHELOR OF ELEMENTARY EDUCATION (BEED)";
  } else if (["BACHELOR OF SECONDARY EDUCATION","BACHELOR IN SECONDARY EDUCATION","BACHELOR OF SCIENCE IN SECONDARY EDUCATION","BACHELOR IN SCIENCE SECONDARY EDUCATION","BSED","BSE","BACHELOR OF SECONDARY EDUCATION (BSED)"].includes(raw)) {
    bachelors_degree = "BACHELOR OF SECONDARY EDUCATION (BSED)";
  } else if (["BACHELOR OF EARLY CHILDHOOD EDUCATION","BECED","BACHELOR OF EARLY CHILDHOOD EDUCATION (BECED)"].includes(raw)) {
    bachelors_degree = "BACHELOR OF EARLY CHILDHOOD EDUCATION (BECED)";
  } else if (["BACHELOR OF SPECIAL NEEDS EDUCATION","BSNED","BACHELOR OF SPECIAL NEEDS EDUCATION (BSNED)"].includes(raw)) {
    bachelors_degree = "BACHELOR OF SPECIAL NEEDS EDUCATION (BSNED)";
  } else if (["BACHELOR OF PHYSICAL EDUCATION","BPED","BACHELOR OF PHYSICAL EDUCATION (BPED)"].includes(raw)) {
    bachelors_degree = "BACHELOR OF PHYSICAL EDUCATION (BPED)";
  } else if (["BACHELOR OF TECHNOLOGY AND LIVELIHOOD EDUCATION","BTLED","BACHELOR OF TECHNOLOGY AND LIVELIHOOD EDUCATION (BTLED)"].includes(raw)) {
    bachelors_degree = "BACHELOR OF TECHNOLOGY AND LIVELIHOOD EDUCATION (BTLED)";
  } else if (["BACHELOR OF TECHNICAL-VOCATIONAL TEACHER EDUCATION","BACHELOR OF TECHNICAL TEACHER EDUCATION","BTVTED","BACHELOR OF TECHNICAL-VOCATIONAL TEACHER EDUCATION (BTVTED)"].includes(raw)) {
    bachelors_degree = "BACHELOR OF TECHNICAL-VOCATIONAL TEACHER EDUCATION (BTVTED)";
  } else if (raw) {
    bachelors_degree = "OTHER BACHELOR'S DEGREE";
    bachelors_degree_other = raw;
  }

  return {
    bachelors_degree,
    bachelors_degree_other,
    major: text(majorValue).toUpperCase(),
    minor: text(minorValue).toUpperCase(),
  };
}

function legacyGraduateFields(value: unknown) {
  const raw = text(value).toUpperCase();
  if (!raw) {
    return {
      graduate_status: "",
      graduate_units_earned: "",
      graduate_car_completed: "NO",
    };
  }
  if (["GRADUATED", "GRADUATE", "GRAD"].includes(raw)) {
    return {
      graduate_status: "GRADUATED",
      graduate_units_earned: "",
      graduate_car_completed: "NO",
    };
  }
  if (["N/A", "NA", "NONE", "NOT APPLICABLE"].includes(raw)) {
    return {
      graduate_status: "NONE",
      graduate_units_earned: "",
      graduate_car_completed: "NO",
    };
  }
  const units = raw.match(/(\d+(?:\.\d+)?)/)?.[1] ?? "";
  return {
    graduate_status: "ON GOING",
    graduate_units_earned: units,
    graduate_car_completed: raw.includes("CAR") ? "YES" : "NO",
  };
}

function appointmentDate(dayMonthValue: unknown, yearValue: unknown) {
  const dayMonth = text(dayMonthValue);
  const year = Number(text(yearValue));
  if (!dayMonth || !Number.isInteger(year) || year < 1900 || year > 2200) return "";

  let day = 0;
  let month = 0;

  const numeric = dayMonth.match(/^(\d{1,2})[\/-](\d{1,2})$/);
  if (numeric) {
    day = Number(numeric[1]);
    month = Number(numeric[2]);
  } else {
    const named = dayMonth.match(/^(\d{1,2})[\s-]+([A-Za-z]+)$/);
    if (named) {
      day = Number(named[1]);
      month = months[named[2].toLowerCase()] ?? 0;
    }
  }

  if (!day || !month) return "";
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() + 1 !== month ||
    candidate.getUTCDate() !== day
  ) return "";

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseTeacherWorkbook(bytes: Uint8Array) {
  const workbook = XLSX.read(bytes, { type: "array", cellDates: false });
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
    const header = rows.findIndex(row => compact(row[1]) === "lastname" && compact(row[2]) === "firstname" && compact(row[3]) === "middlename");
    if (header < 0) continue;
    const top = rows.slice(Math.max(0, header - 3), header + 1);
    if (!top.some(row => compact(row[19]) === "depedemail") || !top.some(row => compact(row[16]).includes("philsys"))) {
      throw new Error("The teacher workbook columns have changed. Use the supplied 20-column Teacher's Profile layout.");
    }
    const records = [];
    let personnelType = "Teaching Personnel";
    for (let index = header + 1; index < rows.length; index++) {
      const row = rows[index];
      if (compact(row[0]) === "nonteachingpersonnel") {
        personnelType = "Non-Teaching Personnel";
        continue;
      }
      if (!text(row[1]) && !text(row[2])) continue;
      // Ignore repeated print headers, not incomplete personnel rows.
      if (compact(row[1]) === "lastname" && compact(row[2]) === "firstname") continue;
      const personal: Record<string, string> = {};
      const map: Record<number, string> = { 1: "last_name", 2: "first_name", 3: "middle_name", 7: "additional_units", 8: "graduate_course", 9: "graduate_units", 10: "bachelors_degree", 11: "major", 12: "minor", 13: "education_units_major", 14: "education_units_minor", 15: "skills", 16: "philsys_number", 17: "religion", 18: "ethnic_group" };
      for (const [col, key] of Object.entries(map)) personal[key] = text(row[Number(col)]).toUpperCase();
      Object.assign(personal, legacyGraduateFields(row[9]));
      Object.assign(personal, bachelorDegreeFields(row[10], row[11], row[12]));
      personal.bsed_earning_units =
        text(row[13]) || text(row[14]) ? "YES" : "NO";
      const normalizedPersonal = normalizeTeacherNameFields(personal);
      const official = {
        appointment_day_month_source: text(row[5]),
        appointment_year_source: text(row[6]),
        appointment_date: appointmentDate(row[5], row[6]),
      };
      records.push({
        source_row: index + 1,
        full_name: teacherDisplayName(
          normalizedPersonal,
          [text(row[2]), text(row[3]), text(row[1])].filter(Boolean).join(" ")
        ),
        email: text(row[19]).toLowerCase(), position: (text(row[4]) || "Teacher").toUpperCase(),
        teacher_personal: normalizedPersonal, teacher_official: official,
        source_data: { sheet: sheetName, row: index + 1, personnel_number: text(row[0]), personnel_type: personnelType },
      });
    }
    if (!records.length) throw new Error("No teacher records were found.");
    if (records.length > 1000) throw new Error("Upload up to 1,000 teacher records per workbook.");
    return records;
  }
  throw new Error("Teacher's Profile header not found. Upload the original Excel workbook with LASTNAME, FIRSTNAME, MIDDLENAME and DepEd Email columns.");
}
