import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { cleanDetails, cleanEntries, personalFields, officialFields, serviceFields, ratingFields } from "../_shared/teacher-profile.ts";
import { parseTeacherWorkbook } from "../_shared/teacher-workbook.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

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
  if (!canManage && caller.role !== "teacher") return json({ error: "Teacher or Human Resources access required." }, 403);
  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid request." }, 400);
  const action = String(body.action ?? "get");

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
  const teacherId = String(body.teacher_id ?? caller.id);
  if (!canManage && teacherId !== caller.id) return json({ error: "You can only access your own teacher profile." }, 403);
  const { data: teacher } = await admin.from("profiles").select("id,full_name,email,position,account_status,role,requested_role").eq("id", teacherId).or("role.eq.teacher,requested_role.eq.teacher").maybeSingle();
  if (!teacher) return json({ error: "Teacher not found." }, 404);
  const { data: existing, error: readError } = await admin.from("teacher_information").select("*").eq("teacher_id", teacherId).maybeSingle();
  if (readError) return json({ error: "Unable to read teacher information." }, 500);
  const record = existing ?? { teacher_id: teacherId, personal: {}, official: {}, service_records: [], ratings: [], version: 0 };
  if (action === "get") return json({ teacher, record, can_manage: canManage });
  if (action !== "save") return json({ error: "Unknown action." }, 400);
  if (Number(body.version) !== record.version) return json({ error: "This profile was changed by another user. Reload it before saving." }, 409);
  if (!canManage && ["official", "service_records", "ratings", "source_data", "position"].some(key => key in body)) return json({ error: "Only Human Resources can edit official employment records and ratings." }, 403);
  let update: Record<string, unknown>;
  try {
    update = {
      personal: { ...record.personal, ...cleanDetails(body.personal ?? {}, personalFields) },
      version: record.version + 1, updated_at: new Date().toISOString(), updated_by: caller.id,
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
  return json({ teacher, record: saved, can_manage: canManage });
});
