import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

function authHeaders(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
  };
}

async function getRows(path: string, token: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json().catch(() => []);
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!userResponse.ok) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = await userResponse.json().catch(() => null);
  const userId = String(user?.id ?? "");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const profiles = await getRows(
    `profiles?id=eq.${encodeURIComponent(
      userId
    )}&select=id,role,account_status&limit=1`,
    token
  );
  const profile = profiles?.[0];

  if (!profile || profile.role !== "teacher" || profile.account_status !== "active") {
    return NextResponse.json({ error: "Teacher access required." }, { status: 403 });
  }

  const schoolYears = await getRows(
    "school_years?is_active=eq.true&select=id,name&limit=1",
    token
  );
  const activeYear = schoolYears?.[0] ?? null;

  if (!activeYear) {
    return NextResponse.json({ activeYear: null, assignments: [] });
  }

  const assignments = await getRows(
    `teacher_assignments?teacher_id=eq.${encodeURIComponent(
      userId
    )}&school_year_id=eq.${encodeURIComponent(
      activeYear.id
    )}&is_active=eq.true&select=id,grade_level,section_id,subject_id&order=grade_level.asc`,
    token
  );

  if (!assignments) {
    return NextResponse.json({ error: "Unable to load teaching assignments." }, { status: 500 });
  }

  const [sections, subjects, enrollments] = await Promise.all([
    getRows("sections?select=id,name,grade_level", token),
    getRows("subjects?select=id,name,code,grade_level", token),
    getRows(
      `student_enrollments?school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&enrollment_status=eq.active&select=id,grade_level,section_id`,
      token
    ),
  ]);

  const sectionMap = new Map<string, string>(
    (sections ?? []).map(
      (item: { id: string; name: string }) => [item.id, item.name] as [string, string]
    )
  );
  const subjectMap = new Map<string, { name: string; code: string | null }>(
    (subjects ?? []).map(
      (item: { id: string; name: string; code: string | null }) =>
        [item.id, { name: item.name, code: item.code }] as [
          string,
          { name: string; code: string | null }
        ]
    )
  );

  const result = assignments.map(
    (assignment: {
      id: string;
      grade_level: number;
      section_id: string;
      subject_id: string;
    }) => {
      const subject = subjectMap.get(assignment.subject_id);
      const studentCount = (enrollments ?? []).filter(
        (enrollment: { section_id: string | null }) =>
          enrollment.section_id === assignment.section_id
      ).length;

      return {
        id: assignment.id,
        grade_level: assignment.grade_level,
        section: sectionMap.get(assignment.section_id) ?? "Unknown section",
        subject: subject?.name ?? "Unknown subject",
        subject_code: subject?.code ?? null,
        student_count: studentCount,
      };
    }
  );

  return NextResponse.json({
    activeYear,
    assignments: result,
  });
}
