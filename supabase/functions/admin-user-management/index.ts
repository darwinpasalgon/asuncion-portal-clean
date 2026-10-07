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

const teachingPositions = new Set([
  "TEACHER I", "TEACHER II", "TEACHER III", "TEACHER IV", "TEACHER V", "TEACHER VI", "TEACHER VII",
  "MASTER TEACHER I", "MASTER TEACHER II", "MASTER TEACHER III", "MASTER TEACHER IV", "MASTER TEACHER V",
  "HEAD TEACHER I", "HEAD TEACHER II", "HEAD TEACHER III", "HEAD TEACHER IV", "HEAD TEACHER V", "HEAD TEACHER VI",
]);

const normalizePhone = (input: string) => {
  const raw = input.replace(/[\s()-]/g, "");
  if (!raw) return "";
  if (/^09\d{9}$/.test(raw)) return `+63${raw.slice(1)}`;
  if (/^639\d{9}$/.test(raw)) return `+${raw}`;
  if (/^\+\d{8,15}$/.test(raw)) return raw;
  return null;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function nullableBoolean(value: unknown) {
  if (value === true || value === false) return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return null;
}

function joinedName(parts: unknown[]) {
  return parts.map(clean).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function temporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(10);
  crypto.getRandomValues(values);
  const chars = Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
  return `ANHS-${chars.slice(0, 5)}-${chars.slice(5)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return json({ error: "User management service unavailable." }, 500);

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
    .select("id,role,account_status,admin_role")
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
  const action = String(body.action ?? "");
  const userId = String(body.user_id ?? "");

  if (action === "reset_section_temp_passwords") {
    const gradeLevel = Number(body.grade_level ?? 0);
    const section = String(body.section ?? "").trim();

    if (!Number.isInteger(gradeLevel) || gradeLevel < 7 || gradeLevel > 12 || !section) {
      return json({ error: "Select a valid Grade Level and Section." }, 400);
    }

    const { data: validSection } = await admin
      .from("sections")
      .select("id")
      .eq("grade_level", gradeLevel)
      .eq("name", section)
      .eq("is_active", true)
      .maybeSingle();

    if (!validSection) {
      return json({ error: "The selected section is not active for that Grade Level." }, 409);
    }

    const { data: learners, error: learnersError } = await admin
      .from("profiles")
      .select("id,full_name,lrn,must_change_password,account_status")
      .eq("role", "student")
      .eq("grade_level", gradeLevel)
      .eq("section", section)
      .eq("must_change_password", true)
      .order("full_name");

    if (learnersError) {
      return json({ error: "Unable to load learners for the selected section." }, 500);
    }

    if (!(learners ?? []).length) {
      return json({
        error: "No learners in this section are still using temporary passwords.",
      }, 409);
    }

    const accounts: Array<Record<string, unknown>> = [];
    const errors: Array<Record<string, unknown>> = [];

    for (const learner of learners ?? []) {
      const password = temporaryPassword();
      const { error: passwordError } = await admin.auth.admin.updateUserById(
        learner.id,
        { password }
      );

      if (passwordError) {
        errors.push({
          id: learner.id,
          full_name: learner.full_name,
          lrn: learner.lrn,
          error: passwordError.message,
        });
        continue;
      }

      accounts.push({
        id: learner.id,
        full_name: learner.full_name,
        lrn: learner.lrn,
        temporary_password: password,
      });
    }

    if (accounts.length) {
      await admin
        .from("profiles")
        .update({
          must_change_password: true,
          updated_at: new Date().toISOString(),
        })
        .in("id", accounts.map((item) => String(item.id)));
    }

    return json({
      ok: errors.length === 0,
      grade_level: gradeLevel,
      section,
      reset: accounts.length,
      failed: errors.length,
      accounts,
      errors,
    }, errors.length && !accounts.length ? 500 : 200);
  }

  if (!["update", "suspend", "reactivate", "delete"].includes(action) || !userId) {
    return json({ error: "Invalid user-management request." }, 400);
  }
  if (userId === callerId) {
    return json({ error: "You cannot modify your own Administrator account here." }, 409);
  }

  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("id,full_name,email,recovery_phone,lrn,requested_role,role,account_status,grade_level,section,position")
    .eq("id", userId)
    .maybeSingle();

  if (targetError || !target) return json({ error: "User account not found." }, 404);
  if (target.role === "administrator") {
    return json({ error: "Administrator accounts cannot be managed from this page." }, 403);
  }

  const personType = target.role === "teacher" || target.requested_role === "teacher"
    ? "teacher"
    : "student";

  if (action === "suspend" || action === "reactivate") {
    if (action === "reactivate" && target.account_status === "pending") {
      return json({ error: "Pending accounts must be approved from Account approvals." }, 409);
    }

    const nextStatus = action === "suspend" ? "suspended" : "active";
    const { data, error } = await admin
      .from("profiles")
      .update({ account_status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("id,account_status")
      .single();

    if (error) return json({ error: "Unable to update account status." }, 500);
    return json({ ok: true, account: data });
  }

  if (action === "delete") {
    const blockers: string[] = [];

    if (personType === "student") {
      const [{ count: grades }, { count: attendance }] = await Promise.all([
        admin.from("student_term_grades").select("id", { count: "exact", head: true }).eq("student_id", userId),
        admin.from("daily_attendance").select("id", { count: "exact", head: true }).eq("student_id", userId),
      ]);

      if ((grades ?? 0) > 0) blockers.push(`${grades} grade record${grades === 1 ? "" : "s"}`);
      if ((attendance ?? 0) > 0) blockers.push(`${attendance} attendance record${attendance === 1 ? "" : "s"}`);
    } else {
      const [
        { count: assignments },
        { count: advisers },
        { count: encodedGrades },
        { count: recordedAttendance },
        { count: announcements },
        { count: resources },
      ] = await Promise.all([
        admin.from("teacher_assignments").select("id", { count: "exact", head: true }).eq("teacher_id", userId),
        admin.from("section_advisers").select("id", { count: "exact", head: true }).eq("teacher_id", userId),
        admin.from("student_term_grades").select("id", { count: "exact", head: true }).eq("encoded_by", userId),
        admin.from("daily_attendance").select("id", { count: "exact", head: true }).eq("recorded_by", userId),
        admin.from("announcements").select("id", { count: "exact", head: true }).eq("created_by", userId),
        admin.from("learning_resources").select("id", { count: "exact", head: true }).eq("created_by", userId),
      ]);

      if ((assignments ?? 0) > 0) blockers.push(`${assignments} teaching assignment${assignments === 1 ? "" : "s"}`);
      if ((advisers ?? 0) > 0) blockers.push(`${advisers} adviser assignment${advisers === 1 ? "" : "s"}`);
      if ((encodedGrades ?? 0) > 0) blockers.push(`${encodedGrades} encoded grade record${encodedGrades === 1 ? "" : "s"}`);
      if ((recordedAttendance ?? 0) > 0) blockers.push(`${recordedAttendance} attendance record${recordedAttendance === 1 ? "" : "s"}`);
      if ((announcements ?? 0) > 0) blockers.push(`${announcements} announcement${announcements === 1 ? "" : "s"}`);
      if ((resources ?? 0) > 0) blockers.push(`${resources} learning resource${resources === 1 ? "" : "s"}`);
    }

    if (blockers.length) {
      return json({
        error: "This account has official school records and cannot be permanently deleted. Suspend it instead.",
        blockers,
      }, 409);
    }

    if (personType === "teacher") {
      // Defensive cleanup of configuration records that may still reference the teacher.
      await admin.from("section_advisers").delete().eq("teacher_id", userId);
      await admin.from("teacher_assignments").delete().eq("teacher_id", userId);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return json({ error: "The account could not be permanently deleted." }, 500);
    }

    return json({ ok: true, deleted: true });
  }

  const fullName = String(body.full_name ?? "").trim();
  const recoveryPhone = normalizePhone(String(body.recovery_phone ?? "").trim());
  if (!fullName) return json({ error: "Full name is required." }, 400);
  if (recoveryPhone === null) return json({ error: "Enter a valid mobile number or leave it blank." }, 400);

  if (personType === "student") {
    const lrn = String(body.lrn ?? "").trim();
    const gradeLevel = Number(body.grade_level ?? 0);
    const sectionId = String(body.section_id ?? "");

    if (!/^\d{12}$/.test(lrn)) {
      return json({ error: "Student LRN must contain exactly 12 digits." }, 400);
    }
    if (!Number.isInteger(gradeLevel) || gradeLevel < 7 || gradeLevel > 12 || !sectionId) {
      return json({ error: "Select a valid Grade Level and Section." }, 400);
    }

    const { data: duplicate } = await admin
      .from("profiles")
      .select("id")
      .eq("lrn", lrn)
      .neq("id", userId)
      .limit(1);
    if ((duplicate ?? []).length) return json({ error: "That LRN is already used by another account." }, 409);

    const { data: section } = await admin
      .from("sections")
      .select("id,grade_level,name,is_active")
      .eq("id", sectionId)
      .eq("grade_level", gradeLevel)
      .eq("is_active", true)
      .maybeSingle();

    if (!section) return json({ error: "Select an active Section for the chosen Grade Level." }, 409);

    const oldProfile = {
      full_name: target.full_name,
      recovery_phone: target.recovery_phone,
      lrn: target.lrn,
      grade_level: target.grade_level,
      section: target.section,
    };

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        full_name: fullName,
        recovery_phone: recoveryPhone,
        lrn,
        grade_level: gradeLevel,
        section: section.name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (profileError) return json({ error: "Unable to update the Student profile." }, 500);

    const { data: year } = await admin
      .from("school_years")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (year && target.account_status === "active") {
      const { error: enrollmentError } = await admin
        .from("student_enrollments")
        .upsert(
          {
            student_id: userId,
            school_year_id: year.id,
            grade_level: gradeLevel,
            section_id: section.id,
            enrollment_status: "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "student_id,school_year_id" }
        );

      if (enrollmentError) {
        await admin.from("profiles").update(oldProfile).eq("id", userId);
        return json({ error: "Student profile was not changed because the current enrollment could not be updated." }, 500);
      }
    }

    const learnerEmail = clean(body.learner_email).toLowerCase();
    if (learnerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(learnerEmail)) {
      return json({ error: "Enter a valid learner email address or leave it blank." }, 400);
    }

    const guardianRelationship = clean(body.guardian_relationship);
    if (
      guardianRelationship &&
      !["Parent", "Relative", "Non-relative"].includes(guardianRelationship)
    ) {
      return json({ error: "Choose a valid Guardian relationship." }, 400);
    }

    const motherMaidenReason = clean(body.mother_maiden_reason);
    if (
      motherMaidenReason &&
      !["No mother", "Not disclosed"].includes(motherMaidenReason)
    ) {
      return json({ error: "Choose a valid reason for not specifying the mother's maiden name." }, 400);
    }

    const indigenous = nullableBoolean(body.is_indigenous_peoples);
    const specialNeeds = nullableBoolean(body.has_special_educational_needs);
    const cctRecipient = nullableBoolean(body.cct_recipient);
    const vaccinated = nullableBoolean(body.vaccinated_covid19);
    const permanentSame = nullableBoolean(body.permanent_same_as_current);

    const primaryEthnicity = clean(body.ethnic_group);
    if (indigenous === true && !primaryEthnicity) {
      return json({ error: "Enter the learner's primary ethnicity for an Indigenous Peoples record." }, 400);
    }

    const lsenType = clean(body.lsen_type);
    if (specialNeeds === true && !lsenType) {
      return json({ error: "Select the learner's Special Educational Needs classification." }, 400);
    }

    const cctHouseholdId = clean(body.cct_household_id);
    if (
      cctRecipient === true &&
      (cctHouseholdId.length < 12 || cctHouseholdId.length > 21)
    ) {
      return json({ error: "4Ps Household ID must contain 12 to 21 characters." }, 400);
    }

    const guardianNoMiddle = nullableBoolean(body.guardian_no_middle_name) === true;
    const motherNoMiddle = nullableBoolean(body.mother_no_middle_name) === true;
    const fatherNoMiddle = nullableBoolean(body.father_no_middle_name) === true;

    const guardianStructuredName = joinedName([
      body.guardian_first_name,
      guardianNoMiddle ? "" : body.guardian_middle_name,
      body.guardian_last_name,
      body.guardian_name_extension,
    ]);
    const motherStructuredName = motherMaidenReason
      ? ""
      : joinedName([
          body.mother_first_name,
          motherNoMiddle ? "" : body.mother_middle_name,
          body.mother_last_name,
          body.mother_name_extension,
        ]);
    const fatherStructuredName = joinedName([
      body.father_first_name,
      fatherNoMiddle ? "" : body.father_middle_name,
      body.father_last_name,
      body.father_name_extension,
    ]);

    const currentResidence = {
      house: clean(body.address_house_street_purok) || null,
      barangay: clean(body.address_barangay) || null,
      municipality: clean(body.address_municipality_city) || null,
      province: clean(body.address_province) || null,
      zip: clean(body.address_zip_code) || null,
    };

    const learnerInfo = {
      student_id: userId,
      last_name: clean(body.last_name) || null,
      first_name: clean(body.first_name) || null,
      middle_name: clean(body.middle_name) || null,
      name_extension: clean(body.name_extension) || null,
      sex: ["M", "F"].includes(clean(body.sex).toUpperCase())
        ? clean(body.sex).toUpperCase()
        : null,
      birth_date: clean(body.birth_date) || null,

      mother_tongue: clean(body.mother_tongue) || null,
      mother_tongue_secondary: clean(body.mother_tongue_secondary) || null,
      mother_tongue_tertiary: clean(body.mother_tongue_tertiary) || null,
      is_indigenous_peoples: indigenous,
      ethnic_group: indigenous === false ? null : primaryEthnicity || null,
      ethnicity_secondary:
        indigenous === false ? null : clean(body.ethnicity_secondary) || null,
      religion: clean(body.religion) || null,
      learner_email: learnerEmail || null,

      address_house_street_purok: currentResidence.house,
      address_barangay: currentResidence.barangay,
      address_municipality_city: currentResidence.municipality,
      address_province: currentResidence.province,
      address_zip_code: currentResidence.zip,

      permanent_same_as_current: permanentSame,
      permanent_address_house_street_purok:
        permanentSame === true
          ? currentResidence.house
          : clean(body.permanent_address_house_street_purok) || null,
      permanent_address_barangay:
        permanentSame === true
          ? currentResidence.barangay
          : clean(body.permanent_address_barangay) || null,
      permanent_address_municipality_city:
        permanentSame === true
          ? currentResidence.municipality
          : clean(body.permanent_address_municipality_city) || null,
      permanent_address_province:
        permanentSame === true
          ? currentResidence.province
          : clean(body.permanent_address_province) || null,
      permanent_address_zip_code:
        permanentSame === true
          ? currentResidence.zip
          : clean(body.permanent_address_zip_code) || null,
      permanent_address_other_barangay:
        permanentSame === true
          ? null
          : clean(body.permanent_address_other_barangay) || null,

      guardian_last_name: clean(body.guardian_last_name) || null,
      guardian_first_name: clean(body.guardian_first_name) || null,
      guardian_middle_name: guardianNoMiddle ? null : clean(body.guardian_middle_name) || null,
      guardian_no_middle_name: guardianNoMiddle,
      guardian_name_extension: clean(body.guardian_name_extension) || null,
      guardian_name: guardianStructuredName || clean(body.guardian_name) || null,
      guardian_relationship: guardianRelationship || null,
      guardian_contact_number: recoveryPhone || null,

      mother_last_name: motherMaidenReason ? null : clean(body.mother_last_name) || null,
      mother_first_name: motherMaidenReason ? null : clean(body.mother_first_name) || null,
      mother_middle_name:
        motherMaidenReason || motherNoMiddle ? null : clean(body.mother_middle_name) || null,
      mother_no_middle_name: motherNoMiddle,
      mother_name_extension:
        motherMaidenReason ? null : clean(body.mother_name_extension) || null,
      mother_maiden_reason: motherMaidenReason || null,
      mother_maiden_name:
        motherStructuredName || (motherMaidenReason ? null : clean(body.mother_maiden_name) || null),

      father_last_name: clean(body.father_last_name) || null,
      father_first_name: clean(body.father_first_name) || null,
      father_middle_name: fatherNoMiddle ? null : clean(body.father_middle_name) || null,
      father_no_middle_name: fatherNoMiddle,
      father_name_extension: clean(body.father_name_extension) || null,
      father_name: fatherStructuredName || clean(body.father_name) || null,

      citizenship: clean(body.citizenship) || null,
      cct_recipient: cctRecipient,
      cct_household_id: cctRecipient === true ? cctHouseholdId || null : null,
      has_special_educational_needs: specialNeeds,
      lsen_type: specialNeeds === true ? lsenType || null : null,
      vaccinated_covid19: vaccinated,
      learning_modality: clean(body.learning_modality) || null,
      remarks: clean(body.remarks) || null,
      updated_by: callerId,
      updated_at: new Date().toISOString(),
    };

    const { error: learnerInfoError } = await admin
      .from("learner_information")
      .upsert(learnerInfo, { onConflict: "student_id" });

    if (learnerInfoError) {
      return json({
        error: "The account was updated, but the SF1 learner profile information could not be saved.",
      }, 500);
    }

    return json({ ok: true });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const teacherFullName = fullName.toUpperCase();
  const position = String(body.position ?? "").trim().toUpperCase();
  if (!position) {
    return json({ error: "Select a Teacher position." }, 400);
  }
  const currentPosition = String(target.position ?? "").trim().toUpperCase();
  if (!teachingPositions.has(position) && position !== currentPosition) {
    return json({ error: "Select a valid DepEd teaching position." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Enter a valid Teacher email address." }, 400);
  }

  const { data: emailDuplicate } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .neq("id", userId)
    .limit(1);
  if ((emailDuplicate ?? []).length) {
    return json({ error: "That email is already used by another portal account." }, 409);
  }

  const emailChanged = email !== String(target.email ?? "").toLowerCase();
  if (emailChanged) {
    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
    });
    if (authError) return json({ error: "The Teacher login email could not be changed." }, 500);
  }

  const { error: teacherProfileError } = await admin
    .from("profiles")
    .update({
      full_name: teacherFullName,
      email,
      recovery_phone: recoveryPhone,
      position,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (teacherProfileError) {
    if (emailChanged && target.email) {
      await admin.auth.admin.updateUserById(userId, {
        email: target.email,
        email_confirm: true,
      });
    }
    return json({ error: "Unable to update the Teacher profile." }, 500);
  }

  return json({ ok: true });
});
