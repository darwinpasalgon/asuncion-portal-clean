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
  shs_track?: string;
  shs_strand_program?: string;
};

const shsPrograms: Record<string, Set<string>> = {
  Academic: new Set([
    "Science, Technology, Engineering, and Mathematics",
    "Humanities and Social Sciences",
    "Accountancy, Business, and Management",
  ]),
  "Technical-Vocational-Livelihood": new Set([
    "Organic Agriculture Production",
    "Food Processing",
  ]),
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
  const action = String(body.action ?? "import");

  async function firstLoginTeacherCandidates() {
    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("id,full_name,email,position,role,account_status,must_change_password")
      .eq("role", "teacher")
      .eq("account_status", "active")
      .eq("must_change_password", true);

    if (profileError) throw new Error("Unable to load Teacher accounts.");

    const { data: authPage, error: authError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authError) throw new Error("Unable to inspect Teacher sign-in status.");

    const authById = new Map((authPage.users ?? []).map((user) => [user.id, user]));
    return (profiles ?? []).filter((profile) => {
      const authUser = authById.get(profile.id);
      if (!authUser || authUser.last_sign_in_at) return false;
      if (authUser.user_metadata?.first_login_credential_recovered_at) return false;

      const createdAt = Date.parse(String(authUser.created_at ?? ""));
      const updatedAt = Date.parse(String(authUser.updated_at ?? ""));
      return (
        Number.isFinite(createdAt) &&
        Number.isFinite(updatedAt) &&
        updatedAt - createdAt > 5 * 60 * 1000
      );
    });
  }

  if (action === "credential_candidates") {
    try {
      const candidates = await firstLoginTeacherCandidates();
      return json({
        ok: true,
        count: candidates.length,
        candidates: candidates.map((item) => ({
          id: item.id,
          full_name: item.full_name,
          email: item.email,
          position: item.position,
        })),
      });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Unable to load Teacher accounts." },
        500
      );
    }
  }

  if (action === "reissue_credentials") {
    const userIds = Array.from(
      new Set(
        (Array.isArray(body.user_ids) ? body.user_ids : [])
          .map((value: unknown) => String(value ?? "").trim())
          .filter(Boolean)
      )
    ).slice(0, 20);

    if (!userIds.length) {
      return json({ error: "Select at least one Teacher account." }, 400);
    }

    try {
      const candidates = await firstLoginTeacherCandidates();
      const allowed = new Map(candidates.map((item) => [item.id, item]));
      const credentials: Array<Record<string, unknown>> = [];
      const errors: Array<Record<string, unknown>> = [];

      for (const userId of userIds) {
        const profile = allowed.get(userId);
        if (!profile) {
          errors.push({ user_id: userId, error: "Account is not eligible for first-login credential recovery." });
          continue;
        }

        const password = temporaryPassword();
        const { data: authUserResult } = await admin.auth.admin.getUserById(userId);
        const recoveredAt = new Date().toISOString();
        const { error: passwordError } = await admin.auth.admin.updateUserById(userId, {
          password,
          user_metadata: {
            ...(authUserResult?.user?.user_metadata ?? {}),
            first_login_credential_recovered_at: recoveredAt,
          },
        });

        if (passwordError) {
          errors.push({ user_id: userId, error: "Unable to update the temporary password." });
          continue;
        }

        const { error: profileUpdateError } = await admin
          .from("profiles")
          .update({
            must_change_password: true,
            temp_password_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (profileUpdateError) {
          errors.push({ user_id: userId, error: "Password updated but the first-login flag could not be refreshed." });
          continue;
        }

        await admin
          .from("password_reset_requests")
          .update({
            status: "cancelled",
            resolved_at: new Date().toISOString(),
            resolved_by: callerId,
          })
          .eq("user_id", userId)
          .eq("status", "pending");

        credentials.push({
          user_id: userId,
          full_name: profile.full_name,
          identifier: profile.email,
          position: profile.position,
          temporary_password: password,
          credential_status: "reissued",
        });
      }

      return json({
        ok: errors.length === 0,
        credentials,
        errors,
      }, errors.length && !credentials.length ? 500 : 200);
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Unable to recover Teacher credentials." },
        500
      );
    }
  }

  // Only Super Administrator may provision a Non-Teaching Personnel login.
  // The admin role must be chosen explicitly, not silently granted.
  if (action === "create_non_teaching_account") {
    const fullName = String(body.full_name ?? "").trim().replace(/\s+/g, " ");
    const position = String(body.position ?? "").trim();
    const adminRole = String(body.admin_role ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = normalizePhone(String(body.recovery_phone ?? "").trim());
    if (fullName.length < 3 || fullName.length > 180) {
      return json({error:"Enter the personnel's full name (3–180 characters)."},400);
    }
    if (position.length < 2 || position.length > 140) {
      return json({error:"Choose or enter a valid non-teaching designation."},400);
    }
    if (!["registrar","content_administrator","school_administrator"].includes(adminRole)) {
      return json({error:"Select a staff access role before creating an account."},400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return json({error:"A valid login email is required."},400);
    }
    if (phone === null) return json({error:"Enter a valid mobile number or leave it blank."},400);
    const {data: existingProfile, error: duplicateError} = await admin.from("profiles")
      .select("id").ilike("email",email).limit(1);
    if (duplicateError) return json({error:"Unable to check existing portal accounts."},500);
    if (existingProfile?.length) return json({error:"This email already has an account. Edit the existing account instead."},409);
    const {data: existingPersonnel, error: personnelCheckError} = await admin.from("non_teaching_personnel")
      .select("id,full_name,portal_user_id").ilike("email",email).limit(1);
    if (personnelCheckError) return json({error:"Unable to verify the existing non-teaching personnel directory."},500);
    const directoryEntry = existingPersonnel?.[0];
    if (directoryEntry?.portal_user_id) return json({error:"This personnel record is already linked to a portal account."},409);
    if (directoryEntry && directoryEntry.full_name.trim().toUpperCase() !== fullName.toUpperCase()) {
      return json({error:"This email belongs to an existing personnel record with a different name. Review the directory first."},409);
    }

    const provisioningToken = crypto.randomUUID();
    const password = temporaryPassword();
    const {error: tokenError} = await admin.from("account_provisioning_tokens").insert({
      token:provisioningToken,email,requested_role:"administrator",
      created_by:callerId,expires_at:new Date(Date.now()+5*60*1000).toISOString(),
    });
    if (tokenError) return json({error:"Unable to authorize secure staff account provisioning."},500);
    const {data: created,error: createError} = await admin.auth.admin.createUser({
      email,password,email_confirm:true,
      user_metadata:{
        requested_role:"administrator",provisioning_token:provisioningToken,
        full_name:fullName,position,admin_role:adminRole,recovery_phone:phone??"",
      },
      app_metadata:{anhs_provisioned:"true"},
    });
    if (createError || !created.user?.id) {
      await admin.from("account_provisioning_tokens").delete().eq("token",provisioningToken);
      return json({error:createError?.message??"Unable to create staff login."},409);
    }
    const userId = created.user.id;
    const {data: profile} = await admin.from("profiles")
      .select("id,role,admin_role,account_status,must_change_password").eq("id",userId).maybeSingle();
    if (!profile || profile.role !== "staff_administrator" ||
        profile.admin_role !== adminRole || profile.account_status !== "active" ||
        !profile.must_change_password) {
      await admin.auth.admin.deleteUser(userId);
      return json({error:"Staff role verification failed; partial login was rolled back."},500);
    }
    const {error: directoryError} = directoryEntry
      ? await admin.from("non_teaching_personnel").update({
          portal_user_id:userId,position,is_active:true,updated_at:new Date().toISOString()
        }).eq("id",directoryEntry.id).is("portal_user_id",null)
      : await admin.from("non_teaching_personnel").insert({
          full_name:fullName,email,position,portal_user_id:userId,is_active:true,
          personal:{},official:{},source_data:{origin:"manual_account_creation"},
        });
    if (directoryError) {
      await admin.auth.admin.deleteUser(userId);
      return json({error:"Could not link the non-teaching personnel directory, so the new login was rolled back."},500);
    }
    return json({
      ok:true,person_type:"non_teaching",account:{
        user_id:userId,full_name:fullName,identifier:email,position,
        access_role:adminRole,temporary_password:password,credential_status:"new",
      }
    });
  }

  if (action !== "import") return json({ error: "Invalid action." }, 400);

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
    let shsTrack: string | null = null;
    let shsStrandProgram: string | null = null;
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

      const requestedTrack = String(source.shs_track ?? "").trim();
      const requestedProgram = String(source.shs_strand_program ?? "").trim();
      if (gradeLevel === 12 && (requestedTrack || requestedProgram)) {
        if (!requestedTrack || !requestedProgram) {
          failures.push({
            row_number: rowNumber,
            name: fullName,
            error: "Grade 12 Track and Strand / Program must be supplied together.",
          });
          continue;
        }
        if (!shsPrograms[requestedTrack]?.has(requestedProgram)) {
          failures.push({
            row_number: rowNumber,
            name: fullName,
            error: "Select a valid Grade 12 Track and Strand / Program.",
          });
          continue;
        }
        shsTrack = requestedTrack;
        shsStrandProgram = requestedProgram;
      }

      const { data: validSection } = await admin
        .from("sections")
        .select("id,name,program_type")
        .eq("grade_level", gradeLevel)
        .eq("name", section)
        .eq("is_active", true)
        .maybeSingle();

      if (!validSection) {
        failures.push({ row_number: rowNumber, name: fullName, error: "Section does not match an active section for the Grade Level." });
        continue;
      }

      if (
        [11, 12].includes(gradeLevel) &&
        !["Regular SHS", "ALS-SHS"].includes(String(validSection.program_type ?? ""))
      ) {
        failures.push({
          row_number: rowNumber,
          name: fullName,
          error: "Set this Senior High section's Program Type in School Setup before importing learners.",
        });
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

            // Updating a Teacher Profile must never change the account password.
            // First-login credential recovery is handled only by the explicit recovery action.

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
      if (shsTrack && shsStrandProgram) {
        metadata.shs_track = shsTrack;
        metadata.shs_strand_program = shsStrandProgram;
      }
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
      if (gradeLevel === 12 && shsTrack && shsStrandProgram) {
        const { data: classifiedEnrollment, error: classificationError } = await admin
          .from("student_enrollments")
          .update({
            shs_track: shsTrack,
            shs_strand_program: shsStrandProgram,
            updated_at: new Date().toISOString(),
          })
          .eq("student_id", created.user.id)
          .eq("school_year_id", activeYear.id)
          .eq("enrollment_status", "active")
          .select("id")
          .maybeSingle();

        if (classificationError || !classifiedEnrollment) {
          await admin.auth.admin.deleteUser(created.user.id);
          failures.push({
            row_number: rowNumber,
            name: fullName,
            identifier,
            error: "Senior High Track and Strand / Program could not be saved, so the partial account was removed.",
          });
          continue;
        }
      }

      const learnerInformation = {
        student_id: created.user.id,
        last_name: String(source.last_name ?? "").trim() || null,
        first_name: String(source.first_name ?? "").trim() || null,
        middle_name: String(source.middle_name ?? "").trim() || null,
        name_extension: String(source.name_extension ?? "").trim() || null,
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
      shs_track: personType === "student" ? shsTrack : null,
      shs_strand_program: personType === "student" ? shsStrandProgram : null,
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
