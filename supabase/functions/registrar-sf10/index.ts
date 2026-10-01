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

async function authorize(admin: ReturnType<typeof createClient>, token: string) {
  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  const userId = userResult?.user?.id ?? "";
  if (userError || !userId) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("id,role,account_status,admin_role")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || profile.account_status !== "active") return null;

  if (
    profile.role === "administrator" &&
    profile.admin_role === "super_administrator"
  ) {
    return { userId, profile };
  }

  if (profile.role !== "staff_administrator") return null;

  const { data: permission } = await admin
    .from("administrator_permissions")
    .select("permission")
    .eq("administrator_id", userId)
    .eq("permission", "sf10.manage")
    .limit(1)
    .maybeSingle();

  return permission ? { userId, profile } : null;
}

function profileComplete(record: Record<string, unknown> | null) {
  return Boolean(
    record?.last_name &&
      record?.first_name &&
      record?.birth_date &&
      record?.sex
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) {
    return json({ error: "SF10 service unavailable." }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "Unauthorized." }, 401);

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const caller = await authorize(admin, token);
  if (!caller) {
    return json(
      { error: "Registrar or Super Administrator access required." },
      403
    );
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "list");
  const studentId = String(body.student_id ?? "");

  if (action === "list") {
    const [{ data: students, error: studentError }, { data: permanentRows }] =
      await Promise.all([
        admin
          .from("profiles")
          .select("id,full_name,lrn,grade_level,section")
          .eq("role", "student")
          .eq("account_status", "active")
          .order("full_name"),
        admin
          .from("learner_permanent_records")
          .select("student_id,last_name,first_name,birth_date,sex"),
      ]);

    if (studentError) return json({ error: "Unable to load learners." }, 500);

    const records = new Map(
      (permanentRows ?? []).map((item) => [String(item.student_id), item])
    );

    return json({
      ok: true,
      students: (students ?? []).map((student) => ({
        ...student,
        sf10_profile_complete: profileComplete(
          (records.get(String(student.id)) ?? null) as Record<string, unknown> | null
        ),
      })),
    });
  }

  if (!studentId) return json({ error: "Select a learner." }, 400);

  if (action === "detail") {
    const { data: student } = await admin
      .from("profiles")
      .select("id,full_name,lrn,grade_level,section")
      .eq("id", studentId)
      .eq("role", "student")
      .maybeSingle();

    if (!student) return json({ error: "Learner not found." }, 404);

    const [
      permanentResult,
      schoolInfoResult,
      enrollmentsResult,
      schoolYearsResult,
      sectionsResult,
      assignmentsResult,
      subjectsResult,
      gradesResult,
      advisersResult,
      teachersResult,
    ] = await Promise.all([
      admin
        .from("learner_permanent_records")
        .select("*")
        .eq("student_id", studentId)
        .maybeSingle(),
      admin.from("school_information").select("*").limit(1).maybeSingle(),
      admin
        .from("student_enrollments")
        .select("id,school_year_id,grade_level,section_id,enrollment_status")
        .eq("student_id", studentId)
        .order("grade_level"),
      admin
        .from("school_years")
        .select("id,name,start_year,end_year")
        .order("start_year"),
      admin
        .from("sections")
        .select("id,grade_level,name")
        .order("grade_level")
        .order("name"),
      admin
        .from("teacher_assignments")
        .select("id,teacher_id,school_year_id,grade_level,section_id,subject_id,is_active"),
      admin
        .from("subjects")
        .select("id,grade_level,name,code")
        .order("grade_level")
        .order("name"),
      admin
        .from("student_term_grades")
        .select("id,teacher_assignment_id,school_year_id,term_no,term_grade,status")
        .eq("student_id", studentId)
        .eq("status", "published"),
      admin
        .from("section_advisers")
        .select("id,teacher_id,school_year_id,section_id")
        .eq("is_active", true),
      admin
        .from("profiles")
        .select("id,full_name")
        .eq("role", "teacher")
        .eq("account_status", "active"),
    ]);

    const enrollments = enrollmentsResult.data ?? [];
    const schoolYears = schoolYearsResult.data ?? [];
    const sections = sectionsResult.data ?? [];
    const assignments = assignmentsResult.data ?? [];
    const subjects = subjectsResult.data ?? [];
    const grades = gradesResult.data ?? [];
    const advisers = advisersResult.data ?? [];
    const teachers = teachersResult.data ?? [];

    const scholasticRecords = enrollments.map((enrollment) => {
      const schoolYear = schoolYears.find(
        (item) => item.id === enrollment.school_year_id
      );
      const section = sections.find((item) => item.id === enrollment.section_id);
      const adviserAssignment = advisers.find(
        (item) =>
          item.school_year_id === enrollment.school_year_id &&
          item.section_id === enrollment.section_id
      );
      const adviser = adviserAssignment
        ? teachers.find((item) => item.id === adviserAssignment.teacher_id)
        : null;

      const classAssignments = assignments.filter(
        (assignment) =>
          assignment.school_year_id === enrollment.school_year_id &&
          assignment.section_id === enrollment.section_id &&
          assignment.is_active === true
      );

      const subjectRecords = classAssignments.map((assignment) => {
        const subject = subjects.find(
          (item) => item.id === assignment.subject_id
        );
        const terms = [1, 2, 3].map((termNo) => {
          const grade = grades.find(
            (item) =>
              item.teacher_assignment_id === assignment.id &&
              Number(item.term_no) === termNo
          );
          return grade ? Number(grade.term_grade) : null;
        });

        const complete = terms.every((value) => value !== null);
        const finalRating = complete
          ? Math.round(
              terms.reduce(
                (sum, value) => sum + Number(value ?? 0),
                0
              ) / 3
            )
          : null;

        return {
          assignment_id: assignment.id,
          subject: subject?.name ?? "Subject",
          subject_code: subject?.code ?? null,
          terms,
          final_rating: finalRating,
          remarks:
            finalRating === null
              ? "Incomplete"
              : finalRating >= 75
                ? "Passed"
                : "Failed",
        };
      });

      const completedRatings = subjectRecords
        .map((item) => item.final_rating)
        .filter((value): value is number => value !== null);

      const generalAverage =
        subjectRecords.length > 0 &&
        completedRatings.length === subjectRecords.length
          ? Math.round(
              completedRatings.reduce((sum, value) => sum + value, 0) /
                completedRatings.length
            )
          : null;

      return {
        school_year: schoolYear?.name ?? "",
        grade_level: enrollment.grade_level,
        section: section?.name ?? "",
        adviser_name: adviser?.full_name ?? "",
        subjects: subjectRecords,
        general_average: generalAverage,
      };
    });

    return json({
      ok: true,
      student,
      permanent_record: permanentResult.data ?? null,
      school_information: schoolInfoResult.data ?? null,
      scholastic_records: scholasticRecords,
      form_type: Number(student.grade_level ?? 0) <= 10 ? "JHS" : "SHS",
    });
  }

  if (action === "save_profile") {
    const averageText = String(body.elementary_general_average ?? "").trim();
    const payload = {
      student_id: studentId,
      last_name: String(body.last_name ?? "").trim() || null,
      first_name: String(body.first_name ?? "").trim() || null,
      middle_name: String(body.middle_name ?? "").trim() || null,
      name_extension: String(body.name_extension ?? "").trim() || null,
      birth_date: String(body.birth_date ?? "").trim() || null,
      sex: ["Male", "Female"].includes(String(body.sex ?? ""))
        ? String(body.sex)
        : null,
      elementary_school_name:
        String(body.elementary_school_name ?? "").trim() || null,
      elementary_school_id:
        String(body.elementary_school_id ?? "").trim() || null,
      elementary_school_address:
        String(body.elementary_school_address ?? "").trim() || null,
      elementary_general_average:
        averageText === "" ? null : Number(averageText),
      elementary_citation:
        String(body.elementary_citation ?? "").trim() || null,
      eligibility_type: "elementary_completer",
      eligibility_rating: null,
      eligibility_other: null,
      assessment_date: null,
      testing_center: null,
      updated_by: caller.userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("learner_permanent_records")
      .upsert(payload, { onConflict: "student_id" })
      .select("*")
      .single();

    if (error) {
      return json(
        { error: "Unable to save learner permanent-record information." },
        400
      );
    }

    return json({ ok: true, record: data });
  }

  if (action === "log_print") {
    const formType = body.form_type === "SHS" ? "SHS" : "JHS";
    const { error } = await admin.from("sf10_print_log").insert({
      student_id: studentId,
      form_type: formType,
      printed_by: caller.userId,
    });

    if (error) return json({ error: "Unable to record the SF10 print action." }, 400);
    return json({ ok: true });
  }

  return json({ error: "Invalid SF10 action." }, 400);
});
