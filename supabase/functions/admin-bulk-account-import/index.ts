import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { cleanDetails, personalFields, officialFields } from "../_shared/teacher-profile.ts";

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
  teacher_personal?: Record<string, string>;
  teacher_official?: Record<string, string>;
  source_data?: Record<string, unknown>;
  row_number?: number;
  full_name?: string;
  lrn?: string;
  grade_level?: number;
  section?: string;
  email?: string;
  position?: string;
  recovery_phone?: string;
  last_name?: string;
  first_name?: string;
  middle_name?: string;
  name_extension?: string;
  sex?: string;
  birth_date?: string;
  mother_tongue?: string;
  ethnic_group?: string;
  religion?: string;
  address_house_street_purok?: string;
  address_barangay?: string;
  address_municipality_city?: string;
  address_province?: string;
  father_name?: string;
  mother_maiden_name?: string;
  guardian_name?: string;
  guardian_relationship?: string;
  guardian_contact_number?: string;
  learning_modality?: string;
  remarks?: string;
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

function cleanLearnerNamePart(value: unknown) {
  const cleaned = String(value ?? "").trim().replace(/\s+/g, " ");
  return ["-", "–", "—"].includes(cleaned) ? "" : cleaned;
}

function normalizeLearnerExtension(value: unknown) {
  const cleaned = cleanLearnerNamePart(value);
  const raw = cleaned.replace(/\.$/, "").toUpperCase();
  if (raw === "JR") return "JR.";
  if (raw === "SR") return "SR.";
  if (["I", "II", "III", "IV", "V"].includes(raw)) return raw;
  return cleaned;
}

function learnerNameParts(source: ImportRow) {
  let firstName = cleanLearnerNamePart(source.first_name);
  const middleName = cleanLearnerNamePart(source.middle_name);
  const lastName = cleanLearnerNamePart(source.last_name);
  let extension = normalizeLearnerExtension(source.name_extension);

  if (!extension) {
    const match = firstName.match(/\s+(Jr\.?|Sr\.?|I|II|III|IV|V)$/i);
    if (match && match.index !== undefined) {
      firstName = firstName.slice(0, match.index).trim();
      extension = normalizeLearnerExtension(match[1] ?? "");
    }
  }

  return {
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
    name_extension: extension,
  };
}

function learnerDisplayName(source: ImportRow) {
  const parts = learnerNameParts(source);
  const middleInitial = parts.middle_name
    ? `${Array.from(parts.middle_name)[0]?.toUpperCase() ?? ""}.`
    : "";
  return [
    parts.first_name,
    middleInitial,
    parts.last_name,
    parts.name_extension,
  ].filter(Boolean).join(" ");
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
    .select("role,account_status,admin_role")
    .eq("id", callerId)
    .maybeSingle();

  if (
    !caller ||
    caller.role !== "administrator" ||
    caller.account_status !== "active" ||
    caller.admin_role !== "super_administrator"
  ) {
    return json({ error: "Super Administrator access required." }, 403);
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
  const reissuedCredentials: Array<Record<string, unknown>> = [];
  const failures: Array<Record<string, unknown>> = [];
  let updatedProfiles = 0;

  async function saveTeacherInformation(teacherId: string, source: ImportRow) {
    const personal = cleanDetails(source.teacher_personal ?? {}, personalFields);
    // Preserve original source cells and populate the uniform appointment date only when HR has not already verified one.
    const parsedOfficial = cleanDetails(source.teacher_official ?? {}, officialFields);
    const sourceOfficial = Object.fromEntries(
      Object.entries(parsedOfficial).filter(([key]) => key.endsWith("_source"))
    );
    const { data: current, error: readError } = await admin.from("teacher_information").select("personal,official,version").eq("teacher_id", teacherId).maybeSingle();
    if (readError) throw new Error("Unable to read teacher information.");
    const nonempty = (data: Record<string, string>) => Object.fromEntries(Object.entries(data).filter(([, value]) => value !== ""));
    const currentOfficial = (current?.official ?? {}) as Record<string, string>;
    const importedAppointmentDate =
      !String(currentOfficial.appointment_date ?? "").trim() &&
      String(parsedOfficial.appointment_date ?? "").trim()
        ? { appointment_date: parsedOfficial.appointment_date }
        : {};
    const update = {
      personal: { ...(current?.personal ?? {}), ...nonempty(personal) },
      official: {
        ...currentOfficial,
        ...nonempty(sourceOfficial as Record<string, string>),
        ...importedAppointmentDate,
      },
      source_data: { file_name: fileName, sheet: String(source.source_data?.sheet ?? "").slice(0, 100), row: Number(source.row_number) || null, personnel_number: String(source.source_data?.personnel_number ?? "").slice(0, 100), position: String(source.position ?? "").slice(0, 200), email: String(source.email ?? "").slice(0, 254) },
      version: (current?.version ?? 0) + 1, updated_by: callerId, updated_at: new Date().toISOString(),
    };
    const query = current
      ? admin.from("teacher_information").update(update).eq("teacher_id", teacherId).eq("version", current.version)
      : admin.from("teacher_information").insert({ teacher_id: teacherId, ...update });
    const { data: saved, error } = await query.select("teacher_id").maybeSingle();
    if (error || !saved) throw new Error("Teacher details could not be saved. Reload the file and retry.");
  }

  for (const source of rows) {
    const rowNumber = Number(source.row_number ?? 0) || null;
    const suppliedFullName = String(source.full_name ?? "").trim();
    const fullName =
      personType === "student"
        ? learnerDisplayName(source) || suppliedFullName
        : suppliedFullName;
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
        .select("id,role,requested_role,position,must_change_password")
        .ilike("email", email)
        .limit(1);

      if ((existingProfile ?? []).length) {
        if ((existingProfile?.[0]?.role === "teacher" || existingProfile?.[0]?.requested_role === "teacher") && source.teacher_personal) {
          try {
            await saveTeacherInformation(existingProfile[0].id, source);
            if (!existingProfile[0].position && position) {
              await admin
                .from("profiles")
                .update({ position, updated_at: new Date().toISOString() })
                .eq("id", existingProfile[0].id);
            }

            // A previous large import may have created the account before the worker timed out.
            // If the teacher still has the one-time-password flag, issue a fresh password so
            // the administrator never loses access to the credential after an interrupted batch.
            if (existingProfile[0].must_change_password) {
              const recoveryPassword = temporaryPassword();
              const { error: passwordError } = await admin.auth.admin.updateUserById(
                existingProfile[0].id,
                { password: recoveryPassword }
              );
              if (passwordError) {
                throw new Error("Unable to reissue the temporary password for this Teacher account.");
              }
              reissuedCredentials.push({
                row_number: rowNumber,
                full_name: fullName,
                identifier: email,
                position,
                temporary_password: recoveryPassword,
                credential_status: "reissued",
              });
            }

            updatedProfiles += 1;
          } catch (error) {
            failures.push({ row_number: rowNumber, name: fullName, identifier: email, error: error instanceof Error ? error.message : "Unable to update the teacher profile." });
          }
          continue;
        }
        failures.push({ row_number: rowNumber, name: fullName, identifier: email, error: "This email already has a portal account." });
        continue;
      }

      identifier = email;
      authEmail = email;
    }

    const password = temporaryPassword();
    const provisioningToken = crypto.randomUUID();
    const { error: provisioningError } = await admin
      .from("account_provisioning_tokens")
      .insert({
        token: provisioningToken,
        email: authEmail,
        requested_role: personType,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        created_by: callerId,
      });

    if (provisioningError) {
      failures.push({
        row_number: rowNumber,
        name: fullName,
        identifier,
        error: "Unable to authorize secure account provisioning.",
      });
      continue;
    }

    const metadata: Record<string, unknown> = {
      requested_role: personType,
      provisioning_token: provisioningToken,
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
      await admin
        .from("account_provisioning_tokens")
        .delete()
        .eq("token", provisioningToken);
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

    if (personType === "student") {
      const nameParts = learnerNameParts(source);
      const learnerInformation = {
        student_id: created.user.id,
        last_name: nameParts.last_name || null,
        first_name: nameParts.first_name || null,
        middle_name: nameParts.middle_name || null,
        name_extension: nameParts.name_extension || null,
        sex: ["M", "F"].includes(String(source.sex ?? "").trim().toUpperCase())
          ? String(source.sex).trim().toUpperCase()
          : null,
        birth_date: String(source.birth_date ?? "").trim() || null,
        mother_tongue: String(source.mother_tongue ?? "").trim() || null,
        ethnic_group: String(source.ethnic_group ?? "").trim() || null,
        religion: String(source.religion ?? "").trim() || null,
        address_house_street_purok:
          String(source.address_house_street_purok ?? "").trim() || null,
        address_barangay: String(source.address_barangay ?? "").trim() || null,
        address_municipality_city:
          String(source.address_municipality_city ?? "").trim() || null,
        address_province: String(source.address_province ?? "").trim() || null,
        father_name: String(source.father_name ?? "").trim() || null,
        mother_maiden_name:
          String(source.mother_maiden_name ?? "").trim() || null,
        guardian_name: String(source.guardian_name ?? "").trim() || null,
        guardian_relationship:
          String(source.guardian_relationship ?? "").trim() || null,
        guardian_contact_number: phone || null,
        learning_modality:
          String(source.learning_modality ?? "").trim() || null,
        remarks: String(source.remarks ?? "").trim() || null,
        updated_by: callerId,
        updated_at: new Date().toISOString(),
      };

      const { error: learnerInfoError } = await admin
        .from("learner_information")
        .upsert(learnerInformation, { onConflict: "student_id" });

      if (learnerInfoError) {
        await admin.auth.admin.deleteUser(created.user.id);
        failures.push({
          row_number: rowNumber,
          name: fullName,
          identifier,
          error: "Learner information could not be saved, so the partial account was removed.",
        });
        continue;
      }
    }

    if (personType === "teacher") {
      try {
        await saveTeacherInformation(created.user.id, source);
      } catch (error) {
        await admin.auth.admin.deleteUser(created.user.id);
        failures.push({ row_number: rowNumber, name: fullName, identifier, error: error instanceof Error ? error.message : "Teacher information could not be saved; the partial account was removed." });
        continue;
      }
    }

    successes.push({
      row_number: rowNumber,
      full_name: fullName,
      identifier,
      grade_level: gradeLevel,
      section: personType === "student" ? section : null,
      position: personType === "teacher" ? position : null,
      temporary_password: password,
      credential_status: "new",
    });
  }

  await admin.from("masterlist_import_batches").insert({
    school_year_id: activeYear.id,
    person_type: personType,
    file_name: fileName,
    total_rows: rows.length,
    imported_rows: successes.length + updatedProfiles,
    skipped_rows: failures.length,
    created_by: callerId,
  });

  return json({
    ok: true,
    active_school_year: activeYear.name,
    imported: successes.length,
    updated_profiles: updatedProfiles,
    skipped: failures.length,
    accounts: successes,
    reissued_credentials: reissuedCredentials,
    errors: failures,
  });
});
