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

async function identity(request: NextRequest) {
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
    )}&select=id,full_name,lrn,role,account_status&limit=1`,
    token
  ).catch(() => []);

  const profile = profiles?.[0];
  if (
    !profile ||
    profile.account_status !== "active" ||
    !["student", "teacher"].includes(String(profile.role))
  ) {
    return null;
  }

  return { token, userId, profile };
}

async function activeYear(token: string) {
  const rows = await getRows(
    "school_years?is_active=eq.true&select=id,name&limit=1",
    token
  );
  return rows?.[0] ?? null;
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(request: NextRequest) {
  const auth = await identity(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Student or Teacher access required." },
      { status: 403 }
    );
  }

  const { token, userId, profile } = auth;
  const date = request.nextUrl.searchParams.get("date") ?? "";

  try {
    const year = await activeYear(token);
    if (!year) {
      return NextResponse.json({
        role: profile.role,
        profile,
        activeYear: null,
        advisers: [],
        sections: [],
        enrollments: [],
        students: [],
        attendance: [],
      });
    }

    if (profile.role === "teacher") {
      const advisers = await getRows(
        `section_advisers?school_year_id=eq.${encodeURIComponent(
          year.id
        )}&teacher_id=eq.${encodeURIComponent(
          userId
        )}&is_active=eq.true&select=id,section_id,teacher_id`,
        token
      );

      const sectionIds = new Set(
        (advisers ?? []).map((item: { section_id: string }) => item.section_id)
      );

      const [sections, enrollments, students, attendance] = await Promise.all([
        getRows("sections?select=id,grade_level,name&order=grade_level.asc,name.asc", token),
        getRows(
          `student_enrollments?school_year_id=eq.${encodeURIComponent(
            year.id
          )}&enrollment_status=eq.active&select=id,student_id,grade_level,section_id`,
          token
        ),
        getRows(
          "profiles?role=eq.student&account_status=eq.active&select=id,full_name,lrn&order=full_name.asc",
          token
        ),
        validDate(date)
          ? getRows(
              `daily_attendance?school_year_id=eq.${encodeURIComponent(
                year.id
              )}&attendance_date=eq.${date}&select=id,student_id,section_id,attendance_date,status,note,updated_at&order=updated_at.asc`,
              token
            )
          : Promise.resolve([]),
      ]);

      return NextResponse.json({
        role: profile.role,
        profile,
        activeYear: year,
        advisers,
        sections: (sections ?? []).filter((item: { id: string }) =>
          sectionIds.has(item.id)
        ),
        enrollments,
        students,
        attendance,
        date: validDate(date) ? date : null,
      });
    }

    const [enrollments, sections, attendance] = await Promise.all([
      getRows(
        `student_enrollments?student_id=eq.${encodeURIComponent(
          userId
        )}&school_year_id=eq.${encodeURIComponent(
          year.id
        )}&enrollment_status=eq.active&select=id,student_id,grade_level,section_id&limit=1`,
        token
      ),
      getRows("sections?select=id,grade_level,name", token),
      getRows(
        `daily_attendance?student_id=eq.${encodeURIComponent(
          userId
        )}&school_year_id=eq.${encodeURIComponent(
          year.id
        )}&select=id,attendance_date,status,note,section_id,updated_at&order=attendance_date.desc&limit=180`,
        token
      ),
    ]);

    return NextResponse.json({
      role: profile.role,
      profile,
      activeYear: year,
      enrollments,
      sections,
      attendance,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load attendance records." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await identity(request);
  if (!auth || auth.profile.role !== "teacher") {
    return NextResponse.json({ error: "Teacher access required." }, { status: 403 });
  }

  const { token, userId } = auth;
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");

  if (action !== "save_attendance") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const sectionId = String(body?.sectionId ?? "");
  const attendanceDate = String(body?.attendanceDate ?? "");
  const records = Array.isArray(body?.records) ? body.records : [];

  if (!sectionId || !validDate(attendanceDate) || records.length === 0) {
    return NextResponse.json(
      { error: "Select a section and date, then complete the attendance sheet." },
      { status: 400 }
    );
  }

  const year = await activeYear(token).catch(() => null);
  if (!year) {
    return NextResponse.json(
      { error: "No active school year is configured." },
      { status: 409 }
    );
  }

  const adviserRows = await getRows(
    `section_advisers?school_year_id=eq.${encodeURIComponent(
      year.id
    )}&section_id=eq.${encodeURIComponent(
      sectionId
    )}&teacher_id=eq.${encodeURIComponent(
      userId
    )}&is_active=eq.true&select=id&limit=1`,
    token
  ).catch(() => []);

  if (!adviserRows?.[0]) {
    return NextResponse.json(
      { error: "You are not the Attendance Teacher / Adviser for this section." },
      { status: 403 }
    );
  }

  const enrollments = await getRows(
    `student_enrollments?school_year_id=eq.${encodeURIComponent(
      year.id
    )}&section_id=eq.${encodeURIComponent(
      sectionId
    )}&enrollment_status=eq.active&select=student_id`,
    token
  ).catch(() => []);

  const allowedStudents = new Set(
    (enrollments ?? []).map((item: { student_id: string }) => item.student_id)
  );

  if (!allowedStudents.size) {
    return NextResponse.json(
      { error: "There are no active students in this section." },
      { status: 409 }
    );
  }

  if (records.length !== allowedStudents.size) {
    return NextResponse.json(
      { error: "Complete attendance for every active student before saving." },
      { status: 400 }
    );
  }

  const allowedStatuses = new Set(["present", "absent", "late", "excused"]);
  const payload: Array<{
    student_id: string;
    school_year_id: string;
    section_id: string;
    attendance_date: string;
    status: string;
    note: string | null;
    recorded_by: string;
    updated_at: string;
  }> = [];

  const seen = new Set<string>();
  for (const record of records) {
    const studentId = String(record?.studentId ?? "");
    const status = String(record?.status ?? "");
    const noteRaw = String(record?.note ?? "").trim();

    if (
      !studentId ||
      seen.has(studentId) ||
      !allowedStudents.has(studentId) ||
      !allowedStatuses.has(status)
    ) {
      return NextResponse.json(
        { error: "The attendance sheet contains an invalid student or status." },
        { status: 400 }
      );
    }
    seen.add(studentId);

    if (noteRaw.length > 300) {
      return NextResponse.json(
        { error: "Attendance notes must be 300 characters or fewer." },
        { status: 400 }
      );
    }

    payload.push({
      student_id: studentId,
      school_year_id: year.id,
      section_id: sectionId,
      attendance_date: attendanceDate,
      status,
      note: noteRaw || null,
      recorded_by: userId,
      updated_at: new Date().toISOString(),
    });
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/daily_attendance?on_conflict=student_id,school_year_id,attendance_date`,
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
  if (!response.ok || !Array.isArray(result)) {
    return NextResponse.json(
      { error: "Unable to save the attendance sheet." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, count: result.length, attendance: result });
}
