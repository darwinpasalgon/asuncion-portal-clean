import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

type PersonType = "student" | "teacher";
type ImportRow = {
  row_number?: number;
  full_name?: string;
  lrn?: string;
  grade_level?: number;
  section?: string;
  email?: string;
  position?: string;
  mobile?: string;
};

function normalizePhone(input: string) {
  const value = input.trim();
  if (!value) return "";
  const raw = value.replace(/[\s()-]/g, "");
  if (/^09\d{9}$/.test(raw)) return `+63${raw.slice(1)}`;
  if (/^639\d{9}$/.test(raw)) return `+${raw}`;
  if (/^\+\d{8,15}$/.test(raw)) return raw;
  return null;
}

function temporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(10);
  crypto.getRandomValues(values);
  const chars = Array.from(values, (v) => alphabet[v % alphabet.length]).join("");
  return `ANHS-${chars.slice(0, 5)}-${chars.slice(5)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return json({ error: "Account import service unavailable." }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "Unauthorized." }, 401);

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authCaller, error: callerError } = await admin.auth.getUser(token);
  const callerId = authCaller?.user?.id ?? "";
  if (callerError || !callerId) return json({ error: "Unauthorized." }, 401);

  const { data: caller } = await admin
    .from("profiles")
    .select("role,account_status")
    .eq("id", callerId)
    .maybeSingle();

  if (!caller || caller.role !== "administrator" || caller.account_status !== "active") {
    return json({ error: "Administrator access required." }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const personType: PersonType = body.person_type === "teacher" ? "teacher" : "student";
  const fileName = String(body.file_name ?? "account-import.csv").slice(0, 240);
  const rows = Array.isArray(body.rows) ? (body.rows as ImportRow[]) : [];

  if (!rows.length || rows.length > 50) {
    return json({ error: "Import batches must contain between 1 and 50 records." }, 400);
  }

  const { data: activeYear } = await admin
    .from("school_years")
    .select("id,name")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!activeYear) return json({ error: "No active school year is configured." }, 409);

  const normalized: Array<{
    rowNumber: number;
    fullName: string;
    lrn: string;
    gradeLevel: number | null;
    section: string;
    email: string;
    position: string;
    mobile: string;
  }> = [];

  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] ?? {};
    const rowNumber = Number(row.row_number ?? i + 2);
    const fullName = String(row.full_name ?? "").trim();
    const lrn = String(row.lrn ?? "").replace(/\s/g, "");
    const email = String(row.email ?? "").trim().toLowerCase();
    const gradeLevel = Number(row.grade_level ?? 0);
    const section = String(row.section ?? "").trim();
    const position = String(row.position ?? "").trim() || "Teacher";
    const mobile = normalizePhone(String(row.mobile ?? ""));

    if (!fullName) return json({ error: `Row ${rowNumber}: Full Name is required.` }, 400);
    if (mobile === null) return json({ error: `Row ${rowNumber}: Mobile number is invalid.` }, 400);

    if (personType === "student") {
      if (!/^\d{12}$/.test(lrn)) return json({ error: `Row ${rowNumber}: LRN must contain exactly 12 digits.` }, 400);
      if (!Number.isInteger(gradeLevel) || gradeLevel < 7 || gradeLevel > 12) {
        return json({ error: `Row ${rowNumber}: Grade Level must be 7–12.` }, 400);
      }
      if (!section) return json({ error: `Row ${rowNumber}: Section is required.` }, 400);
      if (seen.has(lrn)) return json({ error: `Row ${rowNumber}: Duplicate LRN in this batch.` }, 409);
      seen.add(lrn);
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: `Row ${rowNumber}: Enter a valid Teacher email.` }, 400);
      }
      if (seen.has(email)) return json({ error: `Row ${rowNumber}: Duplicate email in this batch.` }, 409);
      seen.add(email);
    }

    normalized.push({
      rowNumber,
      fullName,
      lrn,
      gradeLevel: personType === "student" ? gradeLevel : null,
      section,
      email,
      position,
      mobile: mobile ?? "",
    });
  }

  if (personType === "student") {
    const lrns = normalized.map((row) => row.lrn);
    const { data: existing } = await admin.from("profiles").select("lrn").in("lrn", lrns);
    if ((existing ?? []).length) {
      return json({ error: `The LRN ${existing?.[0]?.lrn ?? ""} already has a portal account.` }, 409);
    }

    const { data: activeSections } = await admin
      .from("sections")
      .select("grade_level,name")
      .eq("is_active", true);

    const validSections = new Set(
      (activeSections ?? []).map(
        (s) => `${Number(s.grade_level)}|${String(s.name).trim().toLowerCase()}`
      )
    );

    for (const row of normalized) {
      if (!validSections.has(`${row.gradeLevel}|${row.section.toLowerCase()}`)) {
        return json({
          error: `Row ${row.rowNumber}: ${row.section} is not an active Grade ${row.gradeLevel} section.`,
        }, 409);
      }
    }
  } else {
    const emails = normalized.map((row) => row.email);
    const { data: existing } = await admin.from("profiles").select("email").in("email", emails);
    if ((existing ?? []).length) {
      return json({ error: `The email ${existing?.[0]?.email ?? ""} already has a portal account.` }, 409);
    }
  }

  const createdIds: string[] = [];
  const credentials: Array<Record<string, unknown>> = [];

  for (const row of normalized) {
    const password = temporaryPassword();
    const authEmail =
      personType === "student"
        ? `student.${row.lrn}@asuncion-nhs.invalid`
        : row.email;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        requested_role: personType,
        full_name: row.fullName,
        recovery_phone: row.mobile,
        lrn: personType === "student" ? row.lrn : null,
        grade_level: personType === "student" ? row.gradeLevel : null,
        section: personType === "student" ? row.section : null,
        position: personType === "teacher" ? row.position : null,
      },
      app_metadata: { anhs_provisioned: true },
    });

    if (createError || !created.user) {
      for (const id of createdIds.reverse()) await admin.auth.admin.deleteUser(id);
      return json({
        error: `Row ${row.rowNumber}: Account creation failed. This batch was rolled back.`,
        detail: createError?.message ?? null,
      }, 400);
    }

    createdIds.push(created.user.id);
    credentials.push({
      user_id: created.user.id,
      person_type: personType,
      full_name: row.fullName,
      identifier: personType === "student" ? row.lrn : row.email,
      grade_level: row.gradeLevel,
      section: personType === "student" ? row.section : null,
      position: personType === "teacher" ? row.position : null,
      temporary_password: password,
    });
  }

  const { error: batchError } = await admin.from("masterlist_import_batches").insert({
    school_year_id: activeYear.id,
    person_type: personType,
    file_name: fileName,
    total_rows: normalized.length,
    imported_rows: normalized.length,
    skipped_rows: 0,
    created_by: callerId,
  });

  return json({
    ok: true,
    imported: credentials.length,
    credentials,
    audit_warning: batchError
      ? "Accounts were created, but the import history could not be recorded."
      : null,
  });
});
