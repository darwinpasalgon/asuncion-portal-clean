import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

type PersonType = "student" | "teacher";

type ImportRow = {
  rowNumber: number;
  fullName: string;
  lrn: string;
  gradeLevel: number | null;
  section: string;
  email: string;
  position: string;
  recoveryPhone: string;
  valid: boolean;
  error: string;
};

function authHeaders(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function getToken(request: NextRequest) {
  return request.cookies.get("anhs-access-token")?.value ?? "";
}

async function getUserId(token: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) return "";

  const user = await response.json().catch(() => null);
  return String(user?.id ?? "");
}

async function isAdmin(token: string) {
  const userId = await getUserId(token);
  if (!userId) return false;

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(
      userId
    )}&select=role,account_status&limit=1`,
    { headers: authHeaders(token), cache: "no-store" }
  );

  if (!response.ok) return false;
  const rows = await response.json().catch(() => []);
  return rows?.[0]?.role === "administrator" && rows?.[0]?.account_status === "active";
}

async function getRows(path: string, token: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Query failed.");
  return response.json();
}

async function getAllProfiles(token: string) {
  const pageSize = 1000;
  const collected: Array<{ lrn: string | null; email: string }> = [];

  for (let start = 0; start < 10000; start += pageSize) {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=lrn,email&order=created_at.asc`,
      {
        headers: {
          ...authHeaders(token),
          Range: `${start}-${start + pageSize - 1}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) throw new Error("Unable to load existing accounts.");
    const rows = (await response.json().catch(() => [])) as Array<{
      lrn: string | null;
      email: string;
    }>;

    collected.push(...rows);
    if (rows.length < pageSize) break;
  }

  return collected;
}

function normalizeHeader(value: string) {
  const key = value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, string> = {
    lrn: "lrn",
    fullname: "fullName",
    name: "fullName",
    learnername: "fullName",
    studentname: "fullName",
    teachername: "fullName",
    grade: "gradeLevel",
    gradelevel: "gradeLevel",
    section: "section",
    email: "email",
    emailaddress: "email",
    position: "position",
    designation: "position",
    mobile: "recoveryPhone",
    mobilenumber: "recoveryPhone",
    phone: "recoveryPhone",
    phonenumber: "recoveryPhone",
    contact: "recoveryPhone",
    contactnumber: "recoveryPhone",
  };
  return aliases[key] ?? key;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows.filter((item) => item.some((value) => value.trim() !== ""));
}

function normalizePhone(input: string) {
  const raw = input.replace(/[\s()-]/g, "");
  if (!raw) return "";
  if (/^09\d{9}$/.test(raw)) return `+63${raw.slice(1)}`;
  if (/^639\d{9}$/.test(raw)) return `+${raw}`;
  if (/^\+\d{8,15}$/.test(raw)) return raw;
  return null;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function validateFile(file: File, personType: PersonType, token: string) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return {
      fatal:
        "Upload a CSV file. In Excel, choose Save As → CSV UTF-8 (Comma delimited).",
      rows: [] as ImportRow[],
    };
  }

  if (file.size > 2 * 1024 * 1024) {
    return { fatal: "CSV file must be 2 MB or smaller.", rows: [] as ImportRow[] };
  }

  const table = parseCsv(await file.text());
  if (table.length < 2) {
    return { fatal: "The CSV does not contain any account rows.", rows: [] as ImportRow[] };
  }

  if (table.length - 1 > 200) {
    return {
      fatal:
        "Import up to 200 accounts per file. Split larger masterlists into smaller CSV files.",
      rows: [] as ImportRow[],
    };
  }

  const headers = table[0].map(normalizeHeader);
  const required =
    personType === "student"
      ? ["lrn", "fullName", "gradeLevel", "section"]
      : ["fullName", "email"];

  const missing = required.filter((key) => !headers.includes(key));
  if (missing.length) {
    return {
      fatal:
        personType === "student"
          ? "Student CSV needs: LRN, Full Name, Grade Level, Section. Mobile is optional."
          : "Teacher CSV needs: Full Name, Email. Position and Mobile are optional.",
      rows: [] as ImportRow[],
    };
  }

  const [sections, profiles, years] = await Promise.all([
    getRows(
      "sections?is_active=eq.true&select=id,grade_level,name&order=grade_level.asc,name.asc",
      token
    ),
    getAllProfiles(token),
    getRows("school_years?is_active=eq.true&select=id,name&limit=1", token),
  ]);

  const activeYear = years?.[0] ?? null;
  if (!activeYear) {
    return { fatal: "No active school year is configured.", rows: [] as ImportRow[] };
  }

  const sectionMap = new Map<string, string>();
  for (const item of sections ?? []) {
    sectionMap.set(
      `${Number(item.grade_level)}|${String(item.name).trim().toLowerCase()}`,
      String(item.name)
    );
  }

  const existingLrns = new Set(
    profiles.map((item) => String(item.lrn ?? "")).filter(Boolean)
  );
  const existingEmails = new Set(
    profiles
      .map((item) => String(item.email ?? "").trim().toLowerCase())
      .filter(Boolean)
  );

  const seen = new Set<string>();
  const parsed: ImportRow[] = [];

  for (let rowIndex = 1; rowIndex < table.length; rowIndex += 1) {
    const values = table[rowIndex];
    const data: Record<string, string> = {};

    headers.forEach((header, index) => {
      data[header] = String(values[index] ?? "").trim();
    });

    const fullName = data.fullName ?? "";
    const lrn = (data.lrn ?? "").replace(/\s/g, "");
    const email = (data.email ?? "").trim().toLowerCase();
    const requestedSection = (data.section ?? "").trim();
    const gradeLevel = data.gradeLevel ? Number(data.gradeLevel) : null;
    const position = (data.position ?? "").trim() || "Teacher";
    const rawPhone = data.recoveryPhone ?? "";
    const normalizedPhone = normalizePhone(rawPhone);
    const errors: string[] = [];
    let section = requestedSection;

    if (!fullName) errors.push("Full Name is required.");
    if (normalizedPhone === null) errors.push("Mobile number is invalid.");

    if (personType === "student") {
      if (!/^\d{12}$/.test(lrn)) errors.push("LRN must contain exactly 12 digits.");
      if (!Number.isInteger(gradeLevel) || Number(gradeLevel) < 7 || Number(gradeLevel) > 12) {
        errors.push("Grade Level must be 7–12.");
      }

      if (Number.isInteger(gradeLevel) && requestedSection) {
        const canonical = sectionMap.get(
          `${Number(gradeLevel)}|${requestedSection.toLowerCase()}`
        );
        if (!canonical) {
          errors.push("Section does not match an active section for the Grade Level.");
        } else {
          section = canonical;
        }
      } else if (!requestedSection) {
        errors.push("Section is required.");
      }

      if (existingLrns.has(lrn)) errors.push("This LRN already has a portal account.");
      if (seen.has(lrn)) errors.push("Duplicate LRN in this CSV.");
      if (lrn) seen.add(lrn);
    } else {
      if (!validEmail(email)) errors.push("Enter a valid Teacher email address.");
      if (existingEmails.has(email)) errors.push("This email already has a portal account.");
      if (seen.has(email)) errors.push("Duplicate email in this CSV.");
      if (email) seen.add(email);
    }

    parsed.push({
      rowNumber: rowIndex + 1,
      fullName,
      lrn,
      gradeLevel: Number.isInteger(gradeLevel) ? Number(gradeLevel) : null,
      section,
      email,
      position,
      recoveryPhone: normalizedPhone ?? rawPhone,
      valid: errors.length === 0,
      error: errors.join(" "),
    });
  }

  return { fatal: "", rows: parsed, activeYear };
}

export async function GET(request: NextRequest) {
  const token = getToken(request);
  if (!token || !(await isAdmin(token))) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  try {
    const [years, sections, batches] = await Promise.all([
      getRows("school_years?is_active=eq.true&select=id,name&limit=1", token),
      getRows(
        "sections?is_active=eq.true&select=id,grade_level,name&order=grade_level.asc,name.asc",
        token
      ),
      getRows(
        "masterlist_import_batches?select=id,person_type,file_name,total_rows,imported_rows,skipped_rows,created_at&order=created_at.desc&limit=30",
        token
      ),
    ]);

    return NextResponse.json({
      activeYear: years?.[0] ?? null,
      sections,
      batches,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load the bulk account import workspace." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const token = getToken(request);
  if (!token || !(await isAdmin(token))) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const action = String(form.get("action") ?? "");
  const personType: PersonType =
    String(form.get("personType") ?? "") === "teacher" ? "teacher" : "student";
  const file = form.get("file");

  if (!(file instanceof File) || !["preview", "import"].includes(action)) {
    return NextResponse.json({ error: "Choose a CSV masterlist file." }, { status: 400 });
  }

  try {
    const validation = await validateFile(file, personType, token);
    if (validation.fatal) {
      return NextResponse.json({ error: validation.fatal }, { status: 400 });
    }

    const rows = validation.rows;
    const valid = rows.filter((row) => row.valid).length;

    if (action === "preview") {
      return NextResponse.json({
        ok: true,
        rows,
        summary: {
          total: rows.length,
          valid,
          invalid: rows.length - valid,
        },
      });
    }

    if (!valid) {
      return NextResponse.json(
        { error: "There are no valid new accounts to import." },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/admin-bulk-account-import`,
      {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          person_type: personType,
          file_name: file.name,
          rows: rows.map((row) => ({
            row_number: row.rowNumber,
            full_name: row.fullName,
            lrn: row.lrn || null,
            grade_level: row.gradeLevel,
            section: row.section || null,
            email: row.email || null,
            position: row.position || null,
            recovery_phone: row.recoveryPhone || "",
          })),
        }),
        cache: "no-store",
      }
    );

    const result = await response.json().catch(() => ({}));
    return NextResponse.json(result, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: "Unable to process the account import." },
      { status: 500 }
    );
  }
}
