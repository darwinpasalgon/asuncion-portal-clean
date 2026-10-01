import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
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
  recovery_phone?: string;
};

function temporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(10);
  crypto.getRandomValues(values);
  const chars = Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
  return `ANHS-${chars.slice(0, 5)}-${chars.slice(5)}`;
}

function normalizePhone(input: string) {
  const raw = input.replace(/[\s()-]/g, "");
  if (!raw) return "";
  if (/^09\d{9}$/.test(raw)) return `+63${raw.slice(1)}`;
  if (/^639\d{9}$/.test(raw)) return `+${raw}`;
  if (/^\+\d{8,15}$/.test(raw)) return raw;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) {
    return json({ error: "Account provisioning service unavailable." }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "Unauthorized." }, 401);

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerResult, error: callerError } = await admin.auth.getUser(token);
  const callerId = callerResult?.user?.id ?? "";
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
  const fileName = String(body.file_name ?? "Account import.csv").slice(0, 255);
  const rows = Array.isArray(body.rows) ? (body.rows as ImportRow[]) : [];

  if (!rows.length) return json({ error: "No account rows were supplied." }, 400);
  if (rows.length > 200) {
    return json({ error: "Import up to 200 accounts at a time." }, 400);
  }

  const { data: activeYear } = await admin
    .from("school_years")
    .select("id,name")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!activeYear) return json({ error: "No active school year is configured." }, 409);

  const successes: Array<Record<string, unknown>> = [];
  const failures: Array<Record<string, unknown>> = [];

  for (const source of rows) {
    const rowNumber = Number(source.row_number ?? 0) || null;
    const fullName = String(source.full_name ?? "").trim();
    const phone = normalizePhone(String(source.recovery_phone ?? "").trim());

    if (!fullName) {
      failures.push({ row_number: rowNumber, name: "", error: "Full Name is required." });
      continue;
    }
    if (phone === null) {
      failures.push({ row_number: rowNumber, name: fullName, error: "Mobile number is invalid." });
      continue;
    }

    let authEmail = "";
    let identifier = "";
    let gradeLevel: number | null = null;
    let section = "";
    let position = "";

    if (personType === "student") {
      const lrn = String(source.lrn ?? "").replace(/\s/g, "");
      gradeLevel = Number(source.grade_level ?? 0);
      section = String(source.section ?? "").trim();

      if (!/^\d{12}$/.test(lrn)) {
        failures.push({ row_number: rowNumber, name: fullName, error: "LRN must contain exactly 12 digits." });
        continue;
      }
      if (!Number.isInteger(gradeLevel) || gradeLevel < 7 || gradeLevel > 12) {
        failures.push({ row_number: rowNumber, name: fullName, error: "Grade Level must be 7–12." });
        continue;
      }

      const { data: validSection } = await admin
        .from("sections")
        .select("id,name")
        .eq("grade_level", gradeLevel)
        .eq("name", section)
        .eq("is_active", true)
        .maybeSingle();

      if (!validSection) {
        failures.push({ row_number: rowNumber, name: fullName, error: "Section does not match an active section for the Grade Level." });
        continue;
      }

      const { data: existingProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("lrn", lrn)
        .limit(1);

      if ((existingProfile ?? []).length) {
        failures.push({ row_number: rowNumber, name: fullName, identifier: lrn, error: "This LRN already has a portal account." });
        continue;
      }

      identifier = lrn;
      authEmail = `student.${lrn}@asuncion-nhs.invalid`;
    } else {
      const email = String(source.email ?? "").trim().toLowerCase();
      position = String(source.position ?? "").trim() || "Teacher";

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        failures.push({ row_number: rowNumber, name: fullName, error: "Enter a valid Teacher email address." });
        continue;
      }

      const { data: existingProfile } = await admin
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .limit(1);

      if ((existingProfile ?? []).length) {
        failures.push({ row_number: rowNumber, name: fullName, identifier: email, error: "This email already has a portal account." });
        continue;
      }

      identifier = email;
      authEmail = email;
    }

    const password = temporaryPassword();
    const metadata: Record<string, unknown> = {
      requested_role: personType,
      full_name: fullName,
      recovery_phone: phone ?? "",
    };

    if (personType === "student") {
      metadata.lrn = identifier;
      metadata.grade_level = gradeLevel;
      metadata.section = section;
    } else {
      metadata.position = position;
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: { anhs_provisioned: "true" },
    });

    if (createError || !created.user?.id) {
      failures.push({
        row_number: rowNumber,
        name: fullName,
        identifier,
        error: createError?.message || "Unable to create the portal account.",
      });
      continue;
    }

    const { data: createdProfile } = await admin
      .from("profiles")
      .select("id,role,account_status,must_change_password")
      .eq("id", created.user.id)
      .maybeSingle();

    if (
      !createdProfile ||
      createdProfile.role !== personType ||
      createdProfile.account_status !== "active" ||
      !createdProfile.must_change_password
    ) {
      await admin.auth.admin.deleteUser(created.user.id);
      failures.push({
        row_number: rowNumber,
        name: fullName,
        identifier,
        error: "Account validation failed and the partial account was removed.",
      });
      continue;
    }

    successes.push({
      row_number: rowNumber,
      full_name: fullName,
      identifier,
      grade_level: gradeLevel,
      section: personType === "student" ? section : null,
      position: personType === "teacher" ? position : null,
      temporary_password: password,
    });
  }

  await admin.from("masterlist_import_batches").insert({
    school_year_id: activeYear.id,
    person_type: personType,
    file_name: fileName,
    total_rows: rows.length,
    imported_rows: successes.length,
    skipped_rows: failures.length,
    created_by: callerId,
  });

  return json({
    ok: true,
    active_school_year: activeYear.name,
    imported: successes.length,
    skipped: failures.length,
    accounts: successes,
    errors: failures,
  });
});
