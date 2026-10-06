import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

function grade7TveMajorLabel(code?: string | null) {
  switch (String(code ?? "")) {
    case "AGRI-CROP": return "Agriculture Crop Production";
    case "ANIMAL": return "Animal Production";
    case "CSS": return "Computer Systems Servicing";
    case "EIM": return "Electrical Installation and Maintenance";
    case "FOOD": return "Food Processing";
    default: return String(code ?? "");
  }
}

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
    )}&is_active=eq.true&select=id,grade_level,section_id,subject_id,major&order=grade_level.asc`,
    token
  );

  if (!assignments) {
    return NextResponse.json({ error: "Unable to load teaching assignments." }, { status: 500 });
  }

  const [sections, subjects, enrollments, grade7TveRotations] = await Promise.all([
    getRows("sections?select=id,name,grade_level", token),
    getRows("subjects?select=id,name,grade_level", token),
    getRows(
      `student_enrollments?school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&enrollment_status=eq.active&select=id,grade_level,section_id,tve_major`,
      token
    ),
    getRows(
      `grade7_tve_rotations?school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&teacher_id=eq.${encodeURIComponent(
        userId
      )}&is_active=eq.true&select=id,group_label,section_id,major_code,starts_on,ends_on`,
      token
    ).catch(() => []),
  ]);

  const sectionMap = new Map<string, string>(
    (sections ?? []).map(
      (item: { id: string; name: string }) => [item.id, item.name] as [string, string]
    )
  );
  const subjectMap = new Map<string, { name: string }>(
    (subjects ?? []).map(
      (item: { id: string; name: string }) =>
        [item.id, { name: item.name }] as [string, { name: string }]
    )
  );

  const result = assignments.map(
    (assignment: {
      id: string;
      grade_level: number;
      section_id: string;
      subject_id: string;
      major: string | null;
    }) => {
      const subject = subjectMap.get(assignment.subject_id);
      const studentCount = (enrollments ?? []).filter(
        (enrollment: { section_id: string | null; tve_major?: string | null }) =>
          enrollment.section_id === assignment.section_id &&
          (!assignment.major || enrollment.tve_major === assignment.major)
      ).length;

      return {
        id: assignment.id,
        grade_level: assignment.grade_level,
        section: sectionMap.get(assignment.section_id) ?? "Unknown section",
        subject: subject?.name ?? "Unknown subject",
        major: assignment.major ?? null,
        student_count: studentCount,
      };
    }
  );

  const grade7TveMap = new Map<string, {
    id: string;
    grade_level: number;
    section: string;
    subject: string;
    major: string | null;
    student_count: number;
  }>();

  for (const rotation of grade7TveRotations ?? []) {
    const sectionId = String(rotation.section_id ?? "");
    const groupLabel = String(rotation.group_label ?? "MIX");
    const majorCode = String(rotation.major_code ?? "");
    const key = `${sectionId || groupLabel}::${majorCode}`;
    if (grade7TveMap.has(key)) continue;

    const studentCount = sectionId
      ? (enrollments ?? []).filter(
          (enrollment: { section_id: string | null }) =>
            enrollment.section_id === sectionId
        ).length
      : 0;

    grade7TveMap.set(key, {
      id: `g7-tve-${rotation.id}`,
      grade_level: 7,
      section: sectionId
        ? sectionMap.get(sectionId) ?? groupLabel
        : `${groupLabel} Group`,
      subject: "Technical Vocational Education",
      major: grade7TveMajorLabel(majorCode),
      student_count: studentCount,
    });
  }

  return NextResponse.json({
    activeYear,
    assignments: [...result, ...grade7TveMap.values()].sort(
      (a, b) =>
        a.grade_level - b.grade_level ||
        a.section.localeCompare(b.section) ||
        a.subject.localeCompare(b.subject) ||
        String(a.major ?? "").localeCompare(String(b.major ?? ""))
    ),
  });
}
