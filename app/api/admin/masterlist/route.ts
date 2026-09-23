import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

type PersonType = "student" | "teacher";

type ParsedRow = {
  rowNumber: number;
  fullName: string;
  lrn: string;
  gradeLevel: number | null;
  section: string;
  sectionId: string | null;
  email: string;
  position: string;
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

async function activeYear(token: string) {
  const rows = await getRows(
    "school_years?is_active=eq.true&select=id,name&limit=1",
    token
  );
  return rows?.[0] ?? null;
}

function normalizeHeader(value: string) {
  const key = value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, string> = {
    lrn: "lrn",
    fullname: "fullName",
    name: "fullName",
    learnername: "fullName",
    teachername: "fullName",
    grade: "gradeLevel",
    gradelevel: "gradeLevel",
    section: "section",
    email: "email",
    emailaddress: "email",
    position: "position",
    designation: "position",
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

function normalizeCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
  return `ANHS-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

async function hashCode(code: string) {
  const bytes = new TextEncoder().encode(normalizeCode(code));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function validateFile(file: File, personType: PersonType, token: string) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return {
      rows: [] as ParsedRow[],
      fatal:
        "Upload a CSV file. If you are using Excel, choose Save As → CSV UTF-8 (Comma delimited).",
    };
  }

  if (file.size > 2 * 1024 * 1024) {
    return { rows: [] as ParsedRow[], fatal: "CSV file must be 2 MB or smaller." };
  }

  const table = parseCsv(await file.text());
  if (table.length < 2) {
    return { rows: [] as ParsedRow[], fatal: "The CSV does not contain any data rows." };
  }

  if (table.length - 1 > 2000) {
    return {
      rows: [] as ParsedRow[],
      fatal: "Import up to 2,000 people per CSV file.",
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
      rows: [] as ParsedRow[],
      fatal:
        personType === "student"
          ? "Student CSV needs these columns: LRN, Full Name, Grade Level, Section."
          : "Teacher CSV needs these columns: Full Name, Email. Position is optional.",
    };
  }

  const year = await activeYear(token);
  if (!year) return { rows: [] as ParsedRow[], fatal: "No active school year is configured." };

  const [sections, profiles, roster] = await Promise.all([
    getRows(
      "sections?is_active=eq.true&select=id,grade_level,name&order=grade_level.asc,name.asc",
      token
    ),
    getRows("profiles?select=lrn,email", token),
    getRows(
      `account_activation_roster?school_year_id=eq.${encodeURIComponent(
        year.id
      )}&status=neq.disabled&select=person_type,lrn,email,status`,
      token
    ),
  ]);

  const sectionMap = new Map<string, { id: string; name: string }>();
  for (const item of sections ?? []) {
    sectionMap.set(
      `${Number(item.grade_level)}|${String(item.name).trim().toLowerCase()}`,
      { id: String(item.id), name: String(item.name) }
    );
  }

  const profileLrns = new Set(
    (profiles ?? []).map((item: { lrn?: string | null }) => String(item.lrn ?? "")).filter(Boolean)
  );
  const profileEmails = new Set(
    (profiles ?? [])
      .map((item: { email?: string | null }) => String(item.email ?? "").trim().toLowerCase())
      .filter(Boolean)
  );
  const rosterLrns = new Set(
    (roster ?? [])
      .filter((item: { person_type?: string }) => item.person_type === "student")
      .map((item: { lrn?: string | null }) => String(item.lrn ?? ""))
      .filter(Boolean)
  );
  const rosterEmails = new Set(
    (roster ?? [])
      .filter((item: { person_type?: string }) => item.person_type === "teacher")
      .map((item: { email?: string | null }) => String(item.email ?? "").trim().toLowerCase())
      .filter(Boolean)
  );

  const seen = new Set<string>();
  const parsed: ParsedRow[] = [];

  for (let rowIndex = 1; rowIndex < table.length; rowIndex += 1) {
    const values = table[rowIndex];
    const data: Record<string, string> = {};

    headers.forEach((header, index) => {
      data[header] = String(values[index] ?? "").trim();
    });

    const fullName = data.fullName ?? "";
    const lrn = (data.lrn ?? "").replace(/\s/g, "");
    const email = (data.email ?? "").trim().toLowerCase();
    const position = (data.position ?? "").trim();
    const gradeLevel = data.gradeLevel ? Number(data.gradeLevel) : null;
    const requestedSection = (data.section ?? "").trim();

    const errors: string[] = [];
    let sectionId: string | null = null;
    let section = requestedSection;

    if (!fullName) errors.push("Full Name is required.");

    if (personType === "student") {
      if (!/^\d{12}$/.test(lrn)) errors.push("LRN must contain exactly 12 digits.");
      if (!Number.isInteger(gradeLevel) || Number(gradeLevel) < 7 || Number(gradeLevel) > 12) {
        errors.push("Grade Level must be 7–12.");
      }

      if (Number.isInteger(gradeLevel) && requestedSection) {
        const matched = sectionMap.get(
          `${Number(gradeLevel)}|${requestedSection.toLowerCase()}`
        );
        if (!matched) {
          errors.push("Section does not match an active section for the grade.");
        } else {
          sectionId = matched.id;
          section = matched.name;
        }
      } else if (!requestedSection) {
        errors.push("Section is required.");
      }

      if (profileLrns.has(lrn)) errors.push("This LRN already has a portal account.");
      if (rosterLrns.has(lrn)) errors.push("This LRN is already in the activation masterlist.");
      if (seen.has(lrn)) errors.push("Duplicate LRN in this CSV.");
      if (lrn) seen.add(lrn);
    } else {
      if (!validEmail(email)) errors.push("Enter a valid email address.");
      if (profileEmails.has(email)) errors.push("This email already has a portal account.");
      if (rosterEmails.has(email)) errors.push("This email is already in the activation masterlist.");
      if (seen.has(email)) errors.push("Duplicate email in this CSV.");
      if (email) seen.add(email);
    }

    parsed.push({
      rowNumber: rowIndex + 1,
      fullName,
      lrn,
      gradeLevel: Number.isInteger(gradeLevel) ? Number(gradeLevel) : null,
      section,
      sectionId,
      email,
      position,
      valid: errors.length === 0,
      error: errors.join(" "),
    });
  }

  return { rows: parsed, fatal: "", year };
}

export async function GET(request: NextRequest) {
  const token = getToken(request);
  if (!token || !(await isAdmin(token))) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  try {
    const year = await activeYear(token);
    if (!year) {
      return NextResponse.json({ activeYear: null, roster: [], batches: [] });
    }

    const [roster, batches, sections] = await Promise.all([
      getRows(
        `account_activation_roster?school_year_id=eq.${encodeURIComponent(
          year.id
        )}&select=id,person_type,full_name,lrn,email,position,grade_level,section_id,activation_code_last4,status,claimed_at,created_at&order=created_at.desc&limit=1000`,
        token
      ),
      getRows(
        `masterlist_import_batches?school_year_id=eq.${encodeURIComponent(
          year.id
        )}&select=id,person_type,file_name,total_rows,imported_rows,skipped_rows,created_at&order=created_at.desc&limit=50`,
        token
      ),
      getRows(
        "sections?select=id,grade_level,name&order=grade_level.asc,name.asc",
        token
      ),
    ]);

    return NextResponse.json({ activeYear: year, roster, batches, sections });
  } catch {
    return NextResponse.json(
      { error: "Unable to load the account masterlist." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const token = getToken(request);
  if (!token || !(await isAdmin(token))) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);
    const action = String(body?.action ?? "");
    const id = String(body?.id ?? "");

    if (!id || !["regenerate", "disable"].includes(action)) {
      return NextResponse.json({ error: "Invalid masterlist action." }, { status: 400 });
    }

    const rows = await getRows(
      `account_activation_roster?id=eq.${encodeURIComponent(
        id
      )}&select=id,status,person_type,full_name,lrn,email&limit=1`,
      token
    ).catch(() => []);

    const row = rows?.[0];
    if (!row) return NextResponse.json({ error: "Masterlist record not found." }, { status: 404 });
    if (row.status !== "unclaimed") {
      return NextResponse.json(
        { error: "Only unclaimed activation records can be changed." },
        { status: 409 }
      );
    }

    if (action === "disable") {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/account_activation_roster?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { ...authHeaders(token), Prefer: "return=representation" },
          body: JSON.stringify({ status: "disabled", updated_at: new Date().toISOString() }),
          cache: "no-store",
        }
      );
      if (!response.ok) {
        return NextResponse.json({ error: "Unable to disable this record." }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    const code = randomCode();
    const hash = await hashCode(code);
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/account_activation_roster?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { ...authHeaders(token), Prefer: "return=representation" },
        body: JSON.stringify({
          activation_code_hash: hash,
          activation_code_last4: normalizeCode(code).slice(-4),
          updated_at: new Date().toISOString(),
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: "Unable to regenerate the activation code." }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      activation: {
        id,
        fullName: row.full_name,
        identifier: row.person_type === "student" ? row.lrn : row.email,
        code,
      },
    });
  }

  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Invalid request format." }, { status: 400 });
  }

  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  const personType: PersonType =
    String(form.get("personType") ?? "") === "teacher" ? "teacher" : "student";
  const file = form.get("file");

  if (!(file instanceof File) || !["preview", "import"].includes(action)) {
    return NextResponse.json({ error: "Select a CSV masterlist file." }, { status: 400 });
  }

  const validation = await validateFile(file, personType, token);
  if (validation.fatal) {
    return NextResponse.json({ error: validation.fatal }, { status: 400 });
  }

  const rows = validation.rows;
  const validRows = rows.filter((row) => row.valid);

  if (action === "preview") {
    return NextResponse.json({
      ok: true,
      personType,
      rows,
      summary: {
        total: rows.length,
        valid: validRows.length,
        invalid: rows.length - validRows.length,
      },
    });
  }

  if (!validRows.length) {
    return NextResponse.json(
      { error: "There are no valid new records to import." },
      { status: 400 }
    );
  }

  const year = validation.year;
  if (!year) {
    return NextResponse.json({ error: "No active school year is configured." }, { status: 409 });
  }

  const adminId = await getUserId(token);
  const batchResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/masterlist_import_batches`,
    {
      method: "POST",
      headers: { ...authHeaders(token), Prefer: "return=representation" },
      body: JSON.stringify({
        school_year_id: year.id,
        person_type: personType,
        file_name: file.name,
        total_rows: rows.length,
        imported_rows: validRows.length,
        skipped_rows: rows.length - validRows.length,
        created_by: adminId || null,
      }),
      cache: "no-store",
    }
  );

  const batchRows = await batchResponse.json().catch(() => []);
  const batch = batchRows?.[0];
  if (!batchResponse.ok || !batch?.id) {
    return NextResponse.json({ error: "Unable to create the import batch." }, { status: 400 });
  }

  const activations = [];
  const payload = [];

  for (const row of validRows) {
    const code = randomCode();
    payload.push({
      school_year_id: year.id,
      person_type: personType,
      full_name: row.fullName,
      lrn: personType === "student" ? row.lrn : null,
      email: personType === "teacher" ? row.email : null,
      position: personType === "teacher" ? row.position || "Teacher" : null,
      grade_level: personType === "student" ? row.gradeLevel : null,
      section_id: personType === "student" ? row.sectionId : null,
      activation_code_hash: await hashCode(code),
      activation_code_last4: normalizeCode(code).slice(-4),
      status: "unclaimed",
      import_batch_id: batch.id,
      created_by: adminId || null,
    });

    activations.push({
      fullName: row.fullName,
      identifier: personType === "student" ? row.lrn : row.email,
      gradeLevel: row.gradeLevel,
      section: row.section,
      position: row.position || "Teacher",
      code,
    });
  }

  const importResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/account_activation_roster`,
    {
      method: "POST",
      headers: { ...authHeaders(token), Prefer: "return=representation" },
      body: JSON.stringify(payload),
      cache: "no-store",
    }
  );

  if (!importResponse.ok) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/masterlist_import_batches?id=eq.${encodeURIComponent(batch.id)}`,
      { method: "DELETE", headers: authHeaders(token), cache: "no-store" }
    ).catch(() => null);

    return NextResponse.json(
      { error: "The masterlist could not be imported. No activation codes were issued." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    batchId: batch.id,
    activations,
    summary: {
      total: rows.length,
      imported: validRows.length,
      skipped: rows.length - validRows.length,
    },
  });
}
