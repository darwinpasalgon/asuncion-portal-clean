import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

function manilaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function grade7TveMajorLabel(code?: string | null) {
  switch (String(code ?? "")) {
    case "AGRI-CROP":
      return "Agriculture Crop Production";
    case "ANIMAL":
      return "Animal Production";
    case "CSS":
      return "Computer Systems Servicing";
    case "EIM":
      return "Electrical Installation and Maintenance";
    case "FOOD":
      return "Food Processing";
    default:
      return String(code ?? "");
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
    )}&is_active=eq.true&select=id,grade_level,section_id,subject_id,teacher_id,major`,
    token
  );

  if (!assignments) {
    return NextResponse.json({ error: "Unable to load class assignments." }, { status: 500 });
  }

  let visibleAssignments = assignments;
  let studentSectionId = "";
  if (profile.role === "teacher") {
    visibleAssignments = assignments.filter(
      (item: { teacher_id: string }) => item.teacher_id === userId
    );
  } else if (profile.role === "student") {
    const enrollmentRows = await getRows(
      `student_enrollments?student_id=eq.${encodeURIComponent(
        userId
      )}&school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&enrollment_status=eq.active&select=section_id,tve_major&limit=1`,
      token
    );
    const enrollment = enrollmentRows?.[0] ?? null;
    studentSectionId = String(enrollment?.section_id ?? "");
    visibleAssignments = enrollment
      ? assignments.filter(
          (item: { section_id: string; major?: string | null }) =>
            item.section_id === enrollment.section_id &&
            (!item.major || item.major === enrollment.tve_major)
        )
      : [];
  }

  const assignmentIds = new Set(
    visibleAssignments.map((item: { id: string }) => item.id)
  );

  const today = manilaDate();

  const [schedules, sections, subjects, scheduleBlocks, grade7TveRotations] = await Promise.all([
    getRows(
      "class_schedules?is_active=eq.true&select=id,teacher_assignment_id,day_of_week,start_time,end_time,room&order=day_of_week.asc,start_time.asc",
      token
    ),
    getRows("sections?select=id,name,grade_level", token),
    getRows("subjects?select=id,name,grade_level", token),
    profile.role === "student" && studentSectionId
      ? getRows(
          `schedule_blocks?school_year_id=eq.${encodeURIComponent(
            activeYear.id
          )}&section_id=eq.${encodeURIComponent(
            studentSectionId
          )}&is_active=eq.true&select=id,grade_level,section_id,day_of_week,start_time,end_time,label,purpose,block_type&order=day_of_week.asc,start_time.asc`,
          token
        )
      : Promise.resolve([]),
    getRows(
      `grade7_tve_rotations?school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&is_active=eq.true&starts_on=lte.${encodeURIComponent(
        today
      )}&ends_on=gte.${encodeURIComponent(
        today
      )}&select=id,rotation_block,group_label,section_id,phase_no,starts_on,ends_on,major_code,instructor_name,days_of_week,start_time,end_time&order=start_time.asc`,
      token
    ).catch(() => []),
  ]);

  const assignmentMap = new Map<
    string,
    {
      grade_level: number;
      section_id: string;
      subject_id: string;
      teacher_id: string;
      major: string | null;
    }
  >(
    visibleAssignments.map(
      (item: {
        id: string;
        grade_level: number;
        section_id: string;
        subject_id: string;
        teacher_id: string;
        major: string | null;
      }) =>
        [
          item.id,
          {
            grade_level: item.grade_level,
            section_id: item.section_id,
            subject_id: item.subject_id,
            teacher_id: item.teacher_id,
            major: item.major ?? null,
          },
        ] as [
          string,
          {
            grade_level: number;
            section_id: string;
            subject_id: string;
            teacher_id: string;
            major: string | null;
          }
        ]
    )
  );

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
          entry_type: "class",
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          room: schedule.room,
          grade_level: assignment?.grade_level ?? null,
          section: assignment
            ? sectionMap.get(assignment.section_id) ?? "Unknown section"
            : "Unknown section",
          subject: subject?.name ?? "Unknown subject",
          major: assignment?.major ?? null,
          purpose: null,
        };
      }
    );

  const grade7TveEntries = (grade7TveRotations ?? []).flatMap(
    (rotation: {
      id: string;
      group_label: string;
      section_id: string | null;
      major_code: string;
      instructor_name: string;
      days_of_week: number[];
      start_time: string;
      end_time: string;
      starts_on: string;
      ends_on: string;
    }) =>
      (rotation.days_of_week ?? []).map((day) => ({
        id: `g7-tve-${rotation.id}-${day}`,
        entry_type: "rotation",
        day_of_week: Number(day),
        start_time: rotation.start_time,
        end_time: rotation.end_time,
        room: null,
        grade_level: 7,
        section:
          rotation.section_id
            ? sectionMap.get(rotation.section_id) ?? rotation.group_label
            : rotation.group_label,
        subject: "Technical Vocational Education",
        major: grade7TveMajorLabel(rotation.major_code),
        purpose: `Exploratory rotation · ${rotation.starts_on} to ${rotation.ends_on}`,
        instructor: rotation.instructor_name,
      }))
  );

  const blocks = (scheduleBlocks ?? []).map(
    (block: {
      id: string;
      grade_level: number;
      section_id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      label: string;
      purpose: string | null;
      block_type: string;
    }) => ({
      id: `block-${block.id}`,
      entry_type: "block",
      day_of_week: block.day_of_week,
      start_time: block.start_time,
      end_time: block.end_time,
      room: null,
      grade_level: block.grade_level,
      section: sectionMap.get(block.section_id) ?? "Unknown section",
      subject: block.label,
      major: null,
      purpose: block.purpose,
      block_type: block.block_type,
    })
  );

  return NextResponse.json({
    activeYear,
    role: profile.role,
    schedules: [...result, ...grade7TveEntries, ...blocks].sort(
      (a, b) =>
        a.day_of_week - b.day_of_week ||
        String(a.start_time).localeCompare(String(b.start_time))
    ),
  });
}
