import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

function headers(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function getRows(path: string, token: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: headers(token),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Query failed.");
  return response.json();
}

async function authorize(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) return null;

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: headers(token),
    cache: "no-store",
  });
  if (!userResponse.ok) return null;

  const user = await userResponse.json().catch(() => null);
  const userId = String(user?.id ?? "");
  if (!userId) return null;

  const profiles = await getRows(
    `profiles?id=eq.${encodeURIComponent(
      userId
    )}&select=id,role,account_status,admin_role&limit=1`,
    token
  ).catch(() => []);

  const profile = profiles?.[0];
  if (!profile || profile.account_status !== "active") return null;

  if (profile.role === "administrator" && profile.admin_role === "super_administrator") {
    return { token, userId, profile };
  }

  if (profile.role !== "staff_administrator") return null;

  const permissions = await getRows(
    `administrator_permissions?administrator_id=eq.${encodeURIComponent(
      userId
    )}&permission=eq.sf10.manage&select=permission&limit=1`,
    token
  ).catch(() => []);

  return permissions?.[0] ? { token, userId, profile } : null;
}

export async function GET(request: NextRequest) {
  const identity = await authorize(request);
  if (!identity) {
    return NextResponse.json({ error: "Registrar or Super Administrator access required." }, { status: 403 });
  }

  const { token } = identity;
  const studentId = request.nextUrl.searchParams.get("studentId") ?? "";

  try {
    if (!studentId) {
      const [students, permanentRows] = await Promise.all([
        getRows(
          "profiles?role=eq.student&account_status=eq.active&select=id,full_name,lrn,grade_level,section&order=full_name.asc",
          token
        ),
        getRows(
          "learner_permanent_records?select=student_id,last_name,first_name,birth_date,sex",
          token
        ),
      ]);

      const permanentMap = new Map(
        (permanentRows ?? []).map((item: { student_id: string }) => [item.student_id, item])
      );

      return NextResponse.json({
        students: (students ?? []).map((student: Record<string, unknown>) => {
          const record = permanentMap.get(String(student.id)) as Record<string, unknown> | undefined;
          return {
            ...student,
            sf10_profile_complete: Boolean(
              record?.last_name &&
              record?.first_name &&
              record?.birth_date &&
              record?.sex
            ),
          };
        }),
      });
    }

    const students = await getRows(
      `profiles?id=eq.${encodeURIComponent(
        studentId
      )}&role=eq.student&select=id,full_name,lrn,grade_level,section&limit=1`,
      token
    );
    const student = students?.[0];
    if (!student) {
      return NextResponse.json({ error: "Learner not found." }, { status: 404 });
    }

    const [
      permanentRows,
      schoolInfoRows,
      enrollments,
      schoolYears,
      sections,
      assignments,
      subjects,
      grades,
      adviserAssignments,
      teacherProfiles,
    ] = await Promise.all([
      getRows(
        `learner_permanent_records?student_id=eq.${encodeURIComponent(studentId)}&select=*&limit=1`,
        token
      ),
      getRows("school_information?select=*&limit=1", token),
      getRows(
        `student_enrollments?student_id=eq.${encodeURIComponent(
          studentId
        )}&select=id,school_year_id,grade_level,section_id,enrollment_status&order=grade_level.asc`,
        token
      ),
      getRows("school_years?select=id,name,start_year,end_year&order=start_year.asc", token),
      getRows("sections?select=id,grade_level,name&order=grade_level.asc,name.asc", token),
      getRows(
        "teacher_assignments?select=id,teacher_id,school_year_id,grade_level,section_id,subject_id,is_active",
        token
      ),
      getRows("subjects?select=id,grade_level,name,code&order=grade_level.asc,name.asc", token),
      getRows(
        `student_term_grades?student_id=eq.${encodeURIComponent(
          studentId
        )}&status=eq.published&select=id,teacher_assignment_id,school_year_id,term_no,term_grade,status`,
        token
      ),
      getRows(
        "section_advisers?is_active=eq.true&select=id,teacher_id,school_year_id,section_id",
        token
      ),
      getRows(
        "profiles?role=eq.teacher&account_status=eq.active&select=id,full_name",
        token
      ),
    ]);

    const years = new Map((schoolYears ?? []).map((item: any) => [item.id, item]));
    const sectionMap = new Map((sections ?? []).map((item: any) => [item.id, item]));
    const subjectMap = new Map((subjects ?? []).map((item: any) => [item.id, item]));
    const teacherMap = new Map((teacherProfiles ?? []).map((item: any) => [item.id, item.full_name]));

    const scholasticRecords = (enrollments ?? []).map((enrollment: any) => {
      const classAssignments = (assignments ?? []).filter(
        (assignment: any) =>
          assignment.school_year_id === enrollment.school_year_id &&
          assignment.section_id === enrollment.section_id &&
          assignment.is_active
      );

      const subjectRecords = classAssignments.map((assignment: any) => {
        const termGrades = [1, 2, 3].map((termNo) => {
          const grade = (grades ?? []).find(
            (item: any) =>
              item.teacher_assignment_id === assignment.id &&
              Number(item.term_no) === termNo
          );
          return grade ? Number(grade.term_grade) : null;
        });

        const complete = termGrades.every((value) => value !== null);
        const finalRating = complete
          ? Math.round(
              termGrades.reduce((sum: number, value: number | null) => sum + Number(value ?? 0), 0) / 3
            )
          : null;

        return {
          assignment_id: assignment.id,
          subject: subjectMap.get(assignment.subject_id)?.name ?? "Subject",
          subject_code: subjectMap.get(assignment.subject_id)?.code ?? null,
          terms: termGrades,
          final_rating: finalRating,
          remarks: finalRating === null ? "Incomplete" : finalRating >= 75 ? "Passed" : "Failed",
        };
      });

      const adviser = (adviserAssignments ?? []).find(
        (item: any) =>
          item.school_year_id === enrollment.school_year_id &&
          item.section_id === enrollment.section_id
      );

      const completedRatings = subjectRecords
        .map((item: any) => item.final_rating)
        .filter((value: number | null) => value !== null);

      return {
        school_year: years.get(enrollment.school_year_id)?.name ?? "",
        grade_level: enrollment.grade_level,
        section: sectionMap.get(enrollment.section_id)?.name ?? "",
        adviser_name: adviser ? teacherMap.get(adviser.teacher_id) ?? "" : "",
        subjects: subjectRecords,
        general_average:
          completedRatings.length === subjectRecords.length && completedRatings.length > 0
            ? Math.round(
                completedRatings.reduce((sum: number, value: number) => sum + value, 0) /
                  completedRatings.length
              )
            : null,
      };
    });

    return NextResponse.json({
      student,
      permanentRecord: permanentRows?.[0] ?? null,
      schoolInformation: schoolInfoRows?.[0] ?? null,
      scholasticRecords,
      formType: Number(student.grade_level ?? 0) <= 10 ? "JHS" : "SHS",
    });
  } catch {
    return NextResponse.json({ error: "Unable to load SF10 records." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const identity = await authorize(request);
  if (!identity) {
    return NextResponse.json({ error: "Registrar or Super Administrator access required." }, { status: 403 });
  }

  const { token, userId } = identity;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const studentId = String(body.studentId ?? "");

  if (!studentId) {
    return NextResponse.json({ error: "Select a learner." }, { status: 400 });
  }

  if (action === "save_profile") {
    const payload = {
      student_id: studentId,
      last_name: String(body.last_name ?? "").trim() || null,
      first_name: String(body.first_name ?? "").trim() || null,
      middle_name: String(body.middle_name ?? "").trim() || null,
      name_extension: String(body.name_extension ?? "").trim() || null,
      birth_date: String(body.birth_date ?? "").trim() || null,
      sex: ["Male", "Female"].includes(String(body.sex ?? "")) ? String(body.sex) : null,
      elementary_school_name: String(body.elementary_school_name ?? "").trim() || null,
      elementary_school_id: String(body.elementary_school_id ?? "").trim() || null,
      elementary_school_address: String(body.elementary_school_address ?? "").trim() || null,
      elementary_general_average:
        String(body.elementary_general_average ?? "").trim() === ""
          ? null
          : Number(body.elementary_general_average),
      elementary_citation: String(body.elementary_citation ?? "").trim() || null,
      eligibility_type: ["elementary_completer", "pept", "a_and_e", "other"].includes(
        String(body.eligibility_type ?? "")
      )
        ? String(body.eligibility_type)
        : "elementary_completer",
      eligibility_rating: String(body.eligibility_rating ?? "").trim() || null,
      eligibility_other: String(body.eligibility_other ?? "").trim() || null,
      assessment_date: String(body.assessment_date ?? "").trim() || null,
      testing_center: String(body.testing_center ?? "").trim() || null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/learner_permanent_records?on_conflict=student_id`,
      {
        method: "POST",
        headers: {
          ...headers(token),
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ error: "Unable to save learner permanent-record information." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, record: result?.[0] ?? null });
  }

  if (action === "log_print") {
    const formType = body.formType === "SHS" ? "SHS" : "JHS";
    const response = await fetch(`${SUPABASE_URL}/rest/v1/sf10_print_log`, {
      method: "POST",
      headers: { ...headers(token), Prefer: "return=minimal" },
      body: JSON.stringify({
        student_id: studentId,
        form_type: formType,
        printed_by: userId,
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Unable to record the SF10 print action." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid SF10 action." }, { status: 400 });
}
