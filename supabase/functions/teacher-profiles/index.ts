import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import {
  cleanDetails,
  cleanEntries,
  personalFields,
  officialFields,
  serviceFields,
  ratingFields,
  normalizeTeacherNameFields,
  teacherDisplayName,
  normalizeGraduateProfile,
  personnelProfileMissingFields,
} from "../_shared/teacher-profile.ts";
import { parseTeacherWorkbook } from "../_shared/teacher-workbook.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const teachingPositions = new Set([
  "TEACHER I", "TEACHER II", "TEACHER III", "TEACHER IV", "TEACHER V", "TEACHER VI", "TEACHER VII",
  "MASTER TEACHER I", "MASTER TEACHER II", "MASTER TEACHER III", "MASTER TEACHER IV", "MASTER TEACHER V",
]);

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  if (!token) return json({ error: "Unauthorized." }, 401);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Unauthorized." }, 401);
  const { data: caller } = await admin.from("profiles").select("id,role,admin_role,account_status,must_change_password").eq("id", auth.user.id).single();
  if (!caller || caller.account_status !== "active") return json({ error: "An active account is required." }, 403);
  if (caller.must_change_password) return json({ error: "Change your temporary password before opening teacher records." }, 403);
  const superAdmin = caller.role === "administrator" && caller.admin_role === "super_administrator";
  let canManage = superAdmin;
  if (caller.role === "staff_administrator") {
    const { data } = await admin.from("administrator_permissions").select("permission").eq("administrator_id", caller.id).eq("permission", "hr.manage").maybeSingle();
    canManage = Boolean(data);
  }
  const { data: linkedNonTeaching } = await admin
    .from("non_teaching_personnel")
    .select("id,full_name,email,position,personal,official,portal_user_id,is_active,updated_at")
    .eq("portal_user_id", caller.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!canManage && caller.role !== "teacher" && !linkedNonTeaching) {
    return json({ error: "Teaching, Non-Teaching, or Human Resources access required." }, 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid request." }, 400);
  const action = String(body.action ?? "get");

  if (action === "profile_attention") {
    const incompleteTeachers: Array<Record<string, unknown>> = [];
    const incompleteNonTeaching: Array<Record<string, unknown>> = [];

    if (canManage) {
      const [{ data: teacherProfiles }, { data: teacherInfo }, { data: nonTeaching }] =
        await Promise.all([
          admin
            .from("profiles")
            .select("id,full_name,email,position,role,requested_role,account_status")
            .eq("account_status", "active")
            .or("role.eq.teacher,requested_role.eq.teacher")
            .order("full_name")
            .limit(1000),
          admin
            .from("teacher_information")
            .select("teacher_id,personal")
            .limit(1000),
          admin
            .from("non_teaching_personnel")
            .select("id,full_name,email,position,personal,portal_user_id,is_active")
            .eq("is_active", true)
            .order("full_name")
            .limit(1000),
        ]);

      const nonTeachingPortalIds = new Set(
        (nonTeaching ?? [])
          .map((item) => String(item.portal_user_id ?? ""))
          .filter(Boolean)
      );
      const teacherPersonal = new Map(
        (teacherInfo ?? []).map((item) => [
          String(item.teacher_id),
          (item.personal ?? {}) as Record<string, string>,
        ])
      );

      for (const teacher of teacherProfiles ?? []) {
        if (nonTeachingPortalIds.has(String(teacher.id))) continue;
        const missing = personnelProfileMissingFields(
          teacherPersonal.get(String(teacher.id)) ?? {}
        );
        if (!missing.length) continue;
        incompleteTeachers.push({
          id: teacher.id,
          full_name: teacher.full_name,
          email: teacher.email,
          position: teacher.position,
          personnel_type: "teaching",
          missing_fields: missing,
        });
      }

      for (const person of nonTeaching ?? []) {
        const missing = personnelProfileMissingFields(
          (person.personal ?? {}) as Record<string, string>
        );
        if (!missing.length) continue;
        incompleteNonTeaching.push({
          id: person.id,
          portal_user_id: person.portal_user_id,
          full_name: person.full_name,
          email: person.email,
          position: person.position,
          personnel_type: "non_teaching",
          missing_fields: missing,
        });
      }
    }

    let self: Record<string, unknown> | null = null;
    if (linkedNonTeaching) {
      const missing = personnelProfileMissingFields(
        (linkedNonTeaching.personal ?? {}) as Record<string, string>
      );
      self = {
        personnel_type: "non_teaching",
        full_name: linkedNonTeaching.full_name,
        missing_fields: missing,
        complete: missing.length === 0,
      };
    } else if (caller.role === "teacher") {
      const { data: ownInfo } = await admin
        .from("teacher_information")
        .select("personal")
        .eq("teacher_id", caller.id)
        .maybeSingle();
      const missing = personnelProfileMissingFields(
        (ownInfo?.personal ?? {}) as Record<string, string>
      );
      self = {
        personnel_type: "teaching",
        missing_fields: missing,
        complete: missing.length === 0,
      };
    }

    return json({
      self,
      can_manage: canManage,
      incomplete_teaching: incompleteTeachers,
      incomplete_non_teaching: incompleteNonTeaching,
      teaching_count: incompleteTeachers.length,
      non_teaching_count: incompleteNonTeaching.length,
      total_incomplete: incompleteTeachers.length + incompleteNonTeaching.length,
    });
  }

  if (action === "preview") {
    if (!superAdmin) return json({ error: "Super Administrator access required for account imports." }, 403);
    const encoded = String(body.file_base64 ?? "");
    if (!encoded || encoded.length > 4 * 1024 * 1024) return json({ error: "Upload a teacher Excel file up to 3 MB." }, 400);
    try {
      const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
      return json({ rows: parseTeacherWorkbook(bytes) });
    } catch (error) { return json({ error: error instanceof Error ? error.message : "Unable to read the workbook." }, 400); }
  }
  if (action === "save_non_teaching") {
    if (!superAdmin) return json({ error: "Super Administrator access required." }, 403);
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return json({ saved: 0, errors: [] });
    if (rows.length > 200) return json({ error: "Save up to 200 non-teaching personnel at a time." }, 400);

    let saved = 0;
    const errors: Array<Record<string, unknown>> = [];

    for (const source of rows) {
      try {
        const fullName = String(source?.full_name ?? "").trim().toUpperCase();
        const email = String(source?.email ?? source?.import_email ?? "").trim().toLowerCase();
        const position = String(source?.position ?? "").trim().toUpperCase();

        if (!fullName) throw new Error("Full name is required.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error("A valid personnel email is required.");
        }

        const personal = cleanDetails(source?.teacher_personal ?? {}, personalFields);
        const official = cleanDetails(source?.teacher_official ?? {}, officialFields);
        const sourceData = {
          ...(source?.source_data ?? {}),
          personnel_type: "Non-Teaching Personnel",
        };

        const { error } = await admin
          .from("non_teaching_personnel")
          .upsert(
            {
              full_name: fullName,
              email,
              position,
              personal,
              official,
              source_data: sourceData,
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "email" }
          );

        if (error) throw new Error("Unable to save this personnel record.");
        saved += 1;
      } catch (error) {
        errors.push({
          full_name: String(source?.full_name ?? ""),
          email: String(source?.email ?? source?.import_email ?? ""),
          error: error instanceof Error ? error.message : "Unable to save personnel record.",
        });
      }
    }

    return json({ ok: errors.length === 0, saved, errors }, errors.length && !saved ? 400 : 200);
  }

  if (action === "list") {
    if (!canManage) return json({ error: "Human Resources access required." }, 403);
    const { data, error } = await admin.from("profiles").select("id,full_name,email,position,account_status,role,requested_role").or("role.eq.teacher,requested_role.eq.teacher").order("full_name").limit(1000);
    if (error) return json({ error: "Unable to load teachers." }, 500);
    return json({ teachers: data, can_manage: true, can_import: superAdmin });
  }

  if (action === "list_non_teaching") {
    if (!canManage) return json({ error: "Human Resources access required." }, 403);
    const { data, error } = await admin
      .from("non_teaching_personnel")
      .select("id,full_name,email,position,personal,portal_user_id,is_active,updated_at")
      .eq("is_active", true)
      .order("full_name")
      .limit(1000);
    if (error) return json({ error: "Unable to load Non-Teaching Personnel." }, 500);
    return json({ personnel: data ?? [], can_manage: true });
  }

  if (action === "get_non_teaching") {
    if (!canManage) return json({ error: "Human Resources access required." }, 403);
    const personnelId = String(body.personnel_id ?? "");
    if (!personnelId) return json({ error: "Select a Non-Teaching Personnel record." }, 400);
    const { data: person, error } = await admin
      .from("non_teaching_personnel")
      .select("id,full_name,email,position,personal,official,portal_user_id,is_active,updated_at")
      .eq("id", personnelId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) return json({ error: "Unable to load the personnel profile." }, 500);
    if (!person) return json({ error: "Non-Teaching Personnel record not found." }, 404);
    return json({
      personnel: person,
      missing_fields: personnelProfileMissingFields(
        (person.personal ?? {}) as Record<string, string>
      ),
      can_manage: true,
    });
  }

  if (action === "save_non_teaching_profile") {
    if (!canManage) return json({ error: "Human Resources access required." }, 403);
    const personnelId = String(body.personnel_id ?? "");
    if (!personnelId) return json({ error: "Select a Non-Teaching Personnel record." }, 400);

    const { data: person, error: readError } = await admin
      .from("non_teaching_personnel")
      .select("id,full_name,email,position,personal,portal_user_id,is_active")
      .eq("id", personnelId)
      .eq("is_active", true)
      .maybeSingle();
    if (readError) return json({ error: "Unable to load the personnel profile." }, 500);
    if (!person) return json({ error: "Non-Teaching Personnel record not found." }, 404);

    try {
      const mergedPersonal = {
        ...((person.personal ?? {}) as Record<string, string>),
        ...cleanDetails(body.personal ?? {}, personalFields),
      };
      const normalized = normalizeGraduateProfile(
        normalizeTeacherNameFields(mergedPersonal)
      );
      const missing = personnelProfileMissingFields(normalized);
      if (missing.length) {
        return json({
          error: `Complete the required profile fields: ${missing.join(", ")}.`,
          missing_fields: missing,
        }, 400);
      }

      const displayName = teacherDisplayName(normalized, person.full_name);
      const { data: saved, error: saveError } = await admin
        .from("non_teaching_personnel")
        .update({
          personal: normalized,
          full_name: displayName || person.full_name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", personnelId)
        .select("id,full_name,email,position,personal,official,portal_user_id,is_active,updated_at")
        .single();

      if (saveError || !saved) {
        return json({ error: "Unable to save the personnel profile." }, 500);
      }

      if (person.portal_user_id && displayName && displayName !== person.full_name) {
        await admin
          .from("profiles")
          .update({ full_name: displayName, updated_at: new Date().toISOString() })
          .eq("id", person.portal_user_id);
      }

      return json({
        personnel: saved,
        missing_fields: personnelProfileMissingFields(
          (saved.personal ?? {}) as Record<string, string>
        ),
        can_manage: true,
      });
    } catch (error) {
      return json({
        error: error instanceof Error ? error.message : "Invalid personnel details.",
      }, 400);
    }
  }
  if (linkedNonTeaching && !canManage && !body.teacher_id) {
    const record = {
      teacher_id: caller.id,
      personal: linkedNonTeaching.personal ?? {},
      official: linkedNonTeaching.official ?? {},
      service_records: [],
      ratings: [],
      version: 0,
    };

    if (action === "get") {
      return json({
        teacher: {
          id: caller.id,
          full_name: linkedNonTeaching.full_name,
          email: linkedNonTeaching.email ?? "",
          position: linkedNonTeaching.position ?? "",
        },
        record,
        personnel_type: "non_teaching",
        can_manage: false,
      });
    }

    if (action !== "save") return json({ error: "Unknown action." }, 400);
    if (["official", "service_records", "ratings", "source_data", "position"].some(key => key in body)) {
      return json({ error: "Only Human Resources can edit official employment records and ratings." }, 403);
    }

    try {
      const mergedPersonal = {
        ...((linkedNonTeaching.personal ?? {}) as Record<string, string>),
        ...cleanDetails(body.personal ?? {}, personalFields),
      };
      const normalized = normalizeGraduateProfile(
        normalizeTeacherNameFields(mergedPersonal)
      );
      const missing = personnelProfileMissingFields(normalized);
      if (missing.length) {
        return json({
          error: `Complete the required profile fields: ${missing.join(", ")}.`,
          missing_fields: missing,
        }, 400);
      }

      const displayName = teacherDisplayName(normalized, linkedNonTeaching.full_name);
      const { data: saved, error: saveError } = await admin
        .from("non_teaching_personnel")
        .update({
          personal: normalized,
          full_name: displayName || linkedNonTeaching.full_name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", linkedNonTeaching.id)
        .select("id,full_name,email,position,personal,official,updated_at")
        .single();

      if (saveError || !saved) return json({ error: "Unable to save personnel information." }, 500);

      if (displayName && displayName !== linkedNonTeaching.full_name) {
        await admin
          .from("profiles")
          .update({ full_name: displayName, updated_at: new Date().toISOString() })
          .eq("id", caller.id);
      }

      return json({
        teacher: {
          id: caller.id,
          full_name: saved.full_name,
          email: saved.email ?? "",
          position: saved.position ?? "",
        },
        record: {
          teacher_id: caller.id,
          personal: saved.personal ?? {},
          official: saved.official ?? {},
          service_records: [],
          ratings: [],
          version: 0,
        },
        personnel_type: "non_teaching",
        can_manage: false,
      });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Invalid details." }, 400);
    }
  }

  const teacherId = String(body.teacher_id ?? caller.id);
  if (!canManage && teacherId !== caller.id) return json({ error: "You can only access your own teacher profile." }, 403);
  const { data: teacher } = await admin.from("profiles").select("id,full_name,email,position,account_status,role,requested_role").eq("id", teacherId).or("role.eq.teacher,requested_role.eq.teacher").maybeSingle();
  if (!teacher) return json({ error: "Teacher not found." }, 404);
  const { data: existing, error: readError } = await admin.from("teacher_information").select("*").eq("teacher_id", teacherId).maybeSingle();
  if (readError) return json({ error: "Unable to read teacher information." }, 500);
  const record = existing ?? { teacher_id: teacherId, personal: {}, official: {}, service_records: [], ratings: [], version: 0 };
  if (action === "get") return json({ teacher, record, personnel_type: "teaching", can_manage: canManage });
  if (action !== "save") return json({ error: "Unknown action." }, 400);
  if (Number(body.version) !== record.version) return json({ error: "This profile was changed by another user. Reload it before saving." }, 409);
  if (!canManage && ["official", "service_records", "ratings", "source_data", "position"].some(key => key in body)) return json({ error: "Only Human Resources can edit official employment records and ratings." }, 403);
  let update: Record<string, unknown>;
  let selectedPosition = String(teacher.position ?? "").trim().toUpperCase();
  try {
    if (canManage && "position" in body) {
      const requestedPosition = String(body.position ?? "").trim().toUpperCase();
      if (!requestedPosition) throw new Error("Select a teaching position.");
      const currentPosition = String(teacher.position ?? "").trim().toUpperCase();
      if (!teachingPositions.has(requestedPosition) && requestedPosition !== currentPosition) {
        throw new Error("Select a valid DepEd teaching position.");
      }
      selectedPosition = requestedPosition;
    }
    const mergedPersonal = {
      ...record.personal,
      ...cleanDetails(body.personal ?? {}, personalFields),
    };
    const normalizedPersonal = normalizeGraduateProfile(
      normalizeTeacherNameFields(mergedPersonal as Record<string, string>)
    );
    const missingRequired = personnelProfileMissingFields(normalizedPersonal);
    if (missingRequired.length) {
      throw new Error(
        `Complete the required profile fields: ${missingRequired.join(", ")}.`
      );
    }
    update = {
      personal: normalizedPersonal,
      version: record.version + 1,
      updated_at: new Date().toISOString(),
      updated_by: caller.id,
    };
    if (canManage) {
      update.official = { ...record.official, ...cleanDetails(body.official ?? {}, officialFields) };
      update.service_records = cleanEntries(body.service_records ?? record.service_records, serviceFields);
      update.ratings = cleanEntries(body.ratings ?? record.ratings, ratingFields);
    }
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid details." }, 400); }
  const query = existing
    ? admin.from("teacher_information").update(update).eq("teacher_id", teacherId).eq("version", record.version)
    : admin.from("teacher_information").insert({ ...update, teacher_id: teacherId });
  const { data: saved, error } = await query.select().maybeSingle();
  if (error) return json({ error: error.code === "23505" ? "This profile changed. Reload it before saving." : "Unable to save teacher information." }, error.code === "23505" ? 409 : 500);
  if (!saved) return json({ error: "This profile changed. Reload it before saving." }, 409);

  const displayName = teacherDisplayName(
    saved.personal as Record<string, string>,
    teacher.full_name
  );
  let responseTeacher = teacher;

  if (displayName && displayName !== teacher.full_name) {
    const { data: renamedTeacher, error: renameError } = await admin
      .from("profiles")
      .update({ full_name: displayName, updated_at: new Date().toISOString() })
      .eq("id", teacherId)
      .select("id,full_name,email,position,account_status,role,requested_role")
      .single();

    if (renameError || !renamedTeacher) {
      return json({
        error: "Teacher information was saved, but the display name could not be updated.",
      }, 500);
    }

    responseTeacher = renamedTeacher;
  }

  if (canManage && "position" in body && selectedPosition !== String(teacher.position ?? "").trim().toUpperCase()) {
    const { data: updatedTeacher, error: positionError } = await admin
      .from("profiles")
      .update({ position: selectedPosition, updated_at: new Date().toISOString() })
      .eq("id", teacherId)
      .select("id,full_name,email,position,account_status,role,requested_role")
      .single();

    if (positionError || !updatedTeacher) {
      return json({ error: "Teacher information was saved, but the Position could not be updated." }, 500);
    }
    responseTeacher = updatedTeacher;
  }

  return json({ teacher: responseTeacher, record: saved, personnel_type: "teaching", can_manage: canManage });
});
