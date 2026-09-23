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

  if (
    !profile ||
    profile.account_status !== "active" ||
    !["student", "teacher"].includes(String(profile.role))
  ) {
    return NextResponse.json(
      { error: "Student or Teacher access required." },
      { status: 403 }
    );
  }

  const years = await getRows(
    "school_years?is_active=eq.true&select=id,name&limit=1",
    token
  );
  const activeYear = years?.[0] ?? null;
  if (!activeYear) {
    return NextResponse.json({ activeYear: null, schedules: [] });
  }

  const assignments = await getRows(
    `teacher_assignments?school_year_id=eq.${encodeURIComponent(
      activeYear.id
    )}&is_active=eq.true&select=id,grade_level,section_id,subject_id,teacher_id`,
    token
  );

  if (!assignments) {
    return NextResponse.json({ error: "Unable to load class assignments." }, { status: 500 });
  }

  const assignmentIds = new Set(
    assignments.map((item: { id: string }) => item.id)
  );

  const [schedules, sections, subjects] = await Promise.all([
    getRows(
      "class_schedules?is_active=eq.true&select=id,teacher_assignment_id,day_of_week,start_time,end_time,room&order=day_of_week.asc,start_time.asc",
      token
    ),
    getRows("sections?select=id,name,grade_level", token),
    getRows("subjects?select=id,name,code,grade_level", token),
  ]);

  const assignmentMap = new Map<
    string,
    {
      grade_level: number;
      section_id: string;
      subject_id: string;
      teacher_id: string;
    }
  >(
    assignments.map(
      (item: {
        id: string;
        grade_level: number;
        section_id: string;
        subject_id: string;
        teacher_id: string;
      }) =>
        [
          item.id,
          {
            grade_level: item.grade_level,
            section_id: item.section_id,
            subject_id: item.subject_id,
            teacher_id: item.teacher_id,
          },
        ] as [
          string,
          {
            grade_level: number;
            section_id: string;
            subject_id: string;
            teacher_id: string;
          }
        ]
    )
  );

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

  const result = (schedules ?? [])
    .filter((schedule: { teacher_assignment_id: string }) =>
      assignmentIds.has(schedule.teacher_assignment_id)
    )
    .map(
      (schedule: {
        id: string;
        teacher_assignment_id: string;
        day_of_week: number;
        start_time: string;
        end_time: string;
        room: string | null;
      }) => {
        const assignment = assignmentMap.get(schedule.teacher_assignment_id);
        const subject = assignment
          ? subjectMap.get(assignment.subject_id)
          : null;

        return {
          id: schedule.id,
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          room: schedule.room,
          grade_level: assignment?.grade_level ?? null,
          section: assignment
            ? sectionMap.get(assignment.section_id) ?? "Unknown section"
            : "Unknown section",
          subject: subject?.name ?? "Unknown subject",
          subject_code: subject?.code ?? null,
        };
      }
    );

  return NextResponse.json({
    activeYear,
    role: profile.role,
    schedules: result,
  });
}
