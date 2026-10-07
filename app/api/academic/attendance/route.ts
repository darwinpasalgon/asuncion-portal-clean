import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

type AdviserRow = {
  id: string;
  section_id: string;
  teacher_id: string;
  assigned_at: string;
};

type EnrollmentRow = {
  id: string;
  student_id: string;
  grade_level: number;
  section_id: string;
};

type AttendanceRow = {
  id?: string;
  student_id: string;
  section_id: string;
  attendance_date: string;
  status: string;
  note?: string | null;
  updated_at?: string;
};

type ExclusionRow = {
  id?: string;
  school_year_id: string;
  section_id: string;
  attendance_date: string;
  exclusion_type: string;
  reason: string | null;
  recorded_by?: string;
  created_at?: string;
  updated_at?: string;
};

type AttendanceAssistantRow = {
  id: string;
  school_year_id: string;
  section_id: string;
  student_id: string;
  assigned_by: string;
  is_active: boolean;
  assigned_at: string;
  updated_at: string;
};

type AssistantEntryRow = {
  id?: string;
  school_year_id: string;
  section_id: string;
  attendance_date: string;
  student_id: string;
  status: "present" | "absent";
  entered_by: string;
  updated_at?: string;
};

type AssistantRosterRow = {
  school_year_id: string;
  section_id: string;
  student_id: string;
  display_name: string;
  sex: string | null;
};

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

function manilaToday() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function manilaDateFromTimestamp(value: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date(value));
}

function isWeekday(value: string) {
  if (!validDate(value)) return false;
  const day = new Date(`${value}T12:00:00Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

function dateRange(start: string, end: string) {
  if (!validDate(start) || !validDate(end) || start > end) return [];
  const result: string[] = [];
  const current = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);

  while (current <= last) {
    const value = current.toISOString().slice(0, 10);
    result.push(value);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return result;
}

function sectionFilter(sectionIds: string[]) {
  return `(${sectionIds.join(",")})`;
}

async function verifyAdviser(
  token: string,
  userId: string,
  schoolYearId: string,
  sectionId: string
) {
  const rows = await getRows(
    `section_advisers?school_year_id=eq.${encodeURIComponent(
      schoolYearId
    )}&section_id=eq.${encodeURIComponent(
      sectionId
    )}&teacher_id=eq.${encodeURIComponent(
      userId
    )}&is_active=eq.true&select=id&limit=1`,
    token
  ).catch(() => []);

  return Boolean(rows?.[0]);
}

async function attendanceAssistantAssignment(
  token: string,
  userId: string,
  schoolYearId: string
) {
  const rows = await getRows(
    `attendance_assistants?school_year_id=eq.${encodeURIComponent(
      schoolYearId
    )}&student_id=eq.${encodeURIComponent(
      userId
    )}&is_active=eq.true&select=id,school_year_id,section_id,student_id,assigned_by,is_active,assigned_at,updated_at&limit=1`,
    token
  ).catch(() => []);

  return (rows?.[0] ?? null) as AttendanceAssistantRow | null;
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
        dateExclusions: [],
        pendingDates: [],
        attendanceAssistants: [],
        assistantEntries: [],
        assistantAssignment: null,
        assistantRoster: [],
      });
    }

    if (profile.role === "teacher") {
      const advisers = (await getRows(
        `section_advisers?school_year_id=eq.${encodeURIComponent(
          year.id
        )}&teacher_id=eq.${encodeURIComponent(
          userId
        )}&is_active=eq.true&select=id,section_id,teacher_id,assigned_at`,
        token
      )) as AdviserRow[];

      const sectionIds: string[] = Array.from(
        new Set<string>((advisers ?? []).map((item) => String(item.section_id)))
      );

      if (!sectionIds.length) {
        return NextResponse.json({
          role: profile.role,
          profile,
          activeYear: year,
          advisers,
          sections: [],
          enrollments: [],
          students: [],
          attendance: [],
          dateExclusions: [],
          pendingDates: [],
          attendanceAssistants: [],
          assistantEntries: [],
          date: validDate(date) ? date : null,
          isWeekday: validDate(date) ? isWeekday(date) : null,
        });
      }

      const filter = sectionFilter(sectionIds);
      const today = manilaToday();
      const monthStart = `${today.slice(0, 7)}-01`;

      const [
        sections,
        enrollmentRows,
        students,
        learnerInformation,
        attendance,
        selectedExclusions,
        attendanceRange,
        exclusionRange,
        attendanceAssistants,
        assistantEntries,
      ] = await Promise.all([
        getRows(
          `sections?id=in.${encodeURIComponent(
            filter
          )}&select=id,grade_level,name&order=grade_level.asc,name.asc`,
          token
        ),
        getRows(
          `student_enrollments?school_year_id=eq.${encodeURIComponent(
            year.id
          )}&section_id=in.${encodeURIComponent(
            filter
          )}&enrollment_status=eq.active&select=id,student_id,grade_level,section_id`,
          token
        ),
        getRows(
          "profiles?role=eq.student&account_status=eq.active&select=id,full_name,lrn",
          token
        ),
        getRows(
          "learner_information?select=student_id,last_name,first_name,middle_name,name_extension,sex",
          token
        ),
        validDate(date)
          ? getRows(
              `daily_attendance?school_year_id=eq.${encodeURIComponent(
                year.id
              )}&attendance_date=eq.${date}&section_id=in.${encodeURIComponent(
                filter
              )}&select=id,student_id,section_id,attendance_date,status,note,updated_at&order=updated_at.asc`,
              token
            )
          : Promise.resolve([]),
        validDate(date)
          ? getRows(
              `attendance_day_exclusions?school_year_id=eq.${encodeURIComponent(
                year.id
              )}&attendance_date=eq.${date}&section_id=in.${encodeURIComponent(
                filter
              )}&select=id,school_year_id,section_id,attendance_date,exclusion_type,reason,recorded_by,created_at,updated_at`,
              token
            )
          : Promise.resolve([]),
        monthStart <= today
          ? getRows(
              `daily_attendance?school_year_id=eq.${encodeURIComponent(
                year.id
              )}&attendance_date=gte.${monthStart}&attendance_date=lte.${today}&section_id=in.${encodeURIComponent(
                filter
              )}&select=student_id,section_id,attendance_date`,
              token
            )
          : Promise.resolve([]),
        monthStart <= today
          ? getRows(
              `attendance_day_exclusions?school_year_id=eq.${encodeURIComponent(
                year.id
              )}&attendance_date=gte.${monthStart}&attendance_date=lte.${today}&section_id=in.${encodeURIComponent(
                filter
              )}&select=section_id,attendance_date,exclusion_type,reason`,
              token
            )
          : Promise.resolve([]),
        getRows(
          `attendance_assistants?school_year_id=eq.${encodeURIComponent(
            year.id
          )}&section_id=in.${encodeURIComponent(
            filter
          )}&is_active=eq.true&select=id,school_year_id,section_id,student_id,assigned_by,is_active,assigned_at,updated_at&order=assigned_at.asc`,
          token
        ),
        validDate(date)
          ? getRows(
              `attendance_assistant_entries?school_year_id=eq.${encodeURIComponent(
                year.id
              )}&attendance_date=eq.${date}&section_id=in.${encodeURIComponent(
                filter
              )}&select=id,school_year_id,section_id,attendance_date,student_id,status,entered_by,updated_at&order=updated_at.asc`,
              token
            )
          : Promise.resolve([]),
      ]);

      const enrollments = (enrollmentRows ?? []) as EnrollmentRow[];

      type LearnerInfo = {
        student_id: string;
        last_name?: string | null;
        first_name?: string | null;
        middle_name?: string | null;
        name_extension?: string | null;
        sex?: string | null;
      };

      const learnerInfoMap = new Map<string, LearnerInfo>(
        ((learnerInformation ?? []) as LearnerInfo[]).map((item) => [
          item.student_id,
          item,
        ])
      );

      const attendanceStudents = (students ?? []).map(
        (student: { id: string; full_name: string; lrn?: string | null }) => {
          const info = learnerInfoMap.get(student.id);
          return {
            ...student,
            last_name: info?.last_name ?? null,
            first_name: info?.first_name ?? null,
            middle_name: info?.middle_name ?? null,
            name_extension: info?.name_extension ?? null,
            sex: info?.sex ?? null,
          };
        }
      );

      const expectedCountBySection = new Map<string, number>();
      for (const enrollment of enrollments) {
        const key = String(enrollment.section_id);
        expectedCountBySection.set(
          key,
          (expectedCountBySection.get(key) ?? 0) + 1
        );
      }

      const recordedBySectionDate = new Map<string, Set<string>>();
      for (const row of (attendanceRange ?? []) as AttendanceRow[]) {
        const key = `${row.section_id}|${row.attendance_date}`;
        if (!recordedBySectionDate.has(key)) {
          recordedBySectionDate.set(key, new Set<string>());
        }
        recordedBySectionDate.get(key)?.add(String(row.student_id));
      }

      const excludedKeys = new Set(
        ((exclusionRange ?? []) as ExclusionRow[]).map(
          (row) => `${row.section_id}|${row.attendance_date}`
        )
      );

      const sectionNameMap = new Map<
        string,
        { id: string; grade_level: number; name: string }
      >(
        ((sections ?? []) as Array<{
          id: string;
          grade_level: number;
          name: string;
        }>).map((item) => [String(item.id), item])
      );

      const pendingDates: Array<{
        section_id: string;
        grade_level: number;
        section: string;
        attendance_date: string;
        expected_count: number;
        recorded_count: number;
      }> = [];

      for (const sectionId of sectionIds) {
        const expected = expectedCountBySection.get(sectionId) ?? 0;
        const section = sectionNameMap.get(sectionId);
        if (!expected || !section) continue;

        for (const attendanceDate of dateRange(monthStart, today)) {
          if (!isWeekday(attendanceDate)) continue;
          const key = `${sectionId}|${attendanceDate}`;
          if (excludedKeys.has(key)) continue;

          const recorded = recordedBySectionDate.get(key)?.size ?? 0;
          if (recorded < expected) {
            pendingDates.push({
              section_id: sectionId,
              grade_level: Number(section.grade_level),
              section: String(section.name),
              attendance_date: attendanceDate,
              expected_count: expected,
              recorded_count: recorded,
            });
          }
        }
      }

      pendingDates.sort((a, b) =>
        b.attendance_date.localeCompare(a.attendance_date)
      );

      return NextResponse.json({
        role: profile.role,
        profile,
        activeYear: year,
        advisers,
        sections,
        enrollments,
        students: attendanceStudents,
        attendance,
        dateExclusions: selectedExclusions,
        pendingDates,
        attendanceAssistants: (attendanceAssistants ?? []) as AttendanceAssistantRow[],
        assistantEntries: (assistantEntries ?? []) as AssistantEntryRow[],
        date: validDate(date) ? date : null,
        isWeekday: validDate(date) ? isWeekday(date) : null,
        today,
        attendanceMonth: today.slice(0, 7),
      });
    }

    const enrollments = await getRows(
      `student_enrollments?student_id=eq.${encodeURIComponent(
        userId
      )}&school_year_id=eq.${encodeURIComponent(
        year.id
      )}&enrollment_status=eq.active&select=id,student_id,grade_level,section_id&limit=1`,
      token
    );

    const assignment = await attendanceAssistantAssignment(
      token,
      userId,
      year.id
    );
    const today = manilaToday();

    const [sections, attendance, assistantRoster, assistantEntries, assistantExclusions] =
      await Promise.all([
        getRows("sections?select=id,grade_level,name", token),
        getRows(
          `daily_attendance?student_id=eq.${encodeURIComponent(
            userId
          )}&school_year_id=eq.${encodeURIComponent(
            year.id
          )}&select=id,attendance_date,status,note,section_id,updated_at&order=attendance_date.desc&limit=180`,
          token
        ),
        assignment
          ? getRows(
              `attendance_section_roster?school_year_id=eq.${encodeURIComponent(
                year.id
              )}&section_id=eq.${encodeURIComponent(
                assignment.section_id
              )}&select=school_year_id,section_id,student_id,display_name,sex&order=display_name.asc`,
              token
            )
          : Promise.resolve([]),
        assignment
          ? getRows(
              `attendance_assistant_entries?school_year_id=eq.${encodeURIComponent(
                year.id
              )}&section_id=eq.${encodeURIComponent(
                assignment.section_id
              )}&attendance_date=eq.${today}&select=id,school_year_id,section_id,attendance_date,student_id,status,entered_by,updated_at&order=updated_at.asc`,
              token
            )
          : Promise.resolve([]),
        assignment
          ? getRows(
              `attendance_day_exclusions?school_year_id=eq.${encodeURIComponent(
                year.id
              )}&section_id=eq.${encodeURIComponent(
                assignment.section_id
              )}&attendance_date=eq.${today}&select=id,school_year_id,section_id,attendance_date,exclusion_type,reason&limit=1`,
              token
            )
          : Promise.resolve([]),
      ]);

    return NextResponse.json({
      role: profile.role,
      profile,
      activeYear: year,
      enrollments,
      sections,
      attendance,
      assistantAssignment: assignment,
      assistantRoster: (assistantRoster ?? []) as AssistantRosterRow[],
      assistantEntries: (assistantEntries ?? []) as AssistantEntryRow[],
      assistantExclusions: assistantExclusions ?? [],
      assistantDate: today,
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
    return NextResponse.json(
      { error: "Teacher access required." },
      { status: 403 }
    );
  }

  const { token, userId } = auth;
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");
  const sectionId = String(body?.sectionId ?? "");
  const attendanceDate = String(body?.attendanceDate ?? "");

  const year = await activeYear(token).catch(() => null);
  if (!year) {
    return NextResponse.json(
      { error: "No active school year is configured." },
      { status: 409 }
    );
  }

  if (!sectionId || !validDate(attendanceDate)) {
    return NextResponse.json(
      { error: "Select a valid section and date." },
      { status: 400 }
    );
  }

  if (!isWeekday(attendanceDate)) {
    return NextResponse.json(
      { error: "Attendance is recorded on weekdays only." },
      { status: 400 }
    );
  }

  if (attendanceDate > manilaToday()) {
    return NextResponse.json(
      { error: "Future attendance dates cannot be recorded yet." },
      { status: 400 }
    );
  }

  const adviserAllowed = await verifyAdviser(
    token,
    userId,
    year.id,
    sectionId
  );
  if (!adviserAllowed) {
    return NextResponse.json(
      { error: "You are not the Attendance Teacher / Adviser for this section." },
      { status: 403 }
    );
  }

  if (action === "mark_no_classes") {
    const exclusionType = String(body?.exclusionType ?? "");
    const reason = String(body?.reason ?? "").trim();
    const allowedTypes = new Set([
      "regular_holiday",
      "special_non_working_holiday",
      "class_suspension",
    ]);

    if (!allowedTypes.has(exclusionType)) {
      return NextResponse.json(
        { error: "Select a valid No Classes type." },
        { status: 400 }
      );
    }
    if (reason.length > 300) {
      return NextResponse.json(
        { error: "The optional reason must be 300 characters or fewer." },
        { status: 400 }
      );
    }

    const exclusionResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/attendance_day_exclusions?on_conflict=school_year_id,section_id,attendance_date`,
      {
        method: "POST",
        headers: {
          ...headers(token),
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify([
          {
            school_year_id: year.id,
            section_id: sectionId,
            attendance_date: attendanceDate,
            exclusion_type: exclusionType,
            reason: reason || null,
            recorded_by: userId,
            updated_at: new Date().toISOString(),
          },
        ]),
        cache: "no-store",
      }
    );

    const exclusion = await exclusionResponse.json().catch(() => []);
    if (!exclusionResponse.ok || !Array.isArray(exclusion)) {
      return NextResponse.json(
        { error: "Unable to mark this date as No Classes." },
        { status: 400 }
      );
    }

    const deleteResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/daily_attendance?school_year_id=eq.${encodeURIComponent(
        year.id
      )}&section_id=eq.${encodeURIComponent(
        sectionId
      )}&attendance_date=eq.${attendanceDate}`,
      {
        method: "DELETE",
        headers: {
          ...headers(token),
          Prefer: "return=representation",
        },
        cache: "no-store",
      }
    );

    if (!deleteResponse.ok) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/attendance_day_exclusions?school_year_id=eq.${encodeURIComponent(
          year.id
        )}&section_id=eq.${encodeURIComponent(
          sectionId
        )}&attendance_date=eq.${attendanceDate}`,
        {
          method: "DELETE",
          headers: headers(token),
          cache: "no-store",
        }
      );
      return NextResponse.json(
        { error: "Unable to clear attendance records for this No Classes date." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, exclusion: exclusion[0] ?? null });
  }

  if (action === "restore_school_day") {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/attendance_day_exclusions?school_year_id=eq.${encodeURIComponent(
        year.id
      )}&section_id=eq.${encodeURIComponent(
        sectionId
      )}&attendance_date=eq.${attendanceDate}`,
      {
        method: "DELETE",
        headers: {
          ...headers(token),
          Prefer: "return=representation",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to restore this date as a school day." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  if (action !== "save_attendance") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const records = Array.isArray(body?.records) ? body.records : [];

  if (records.length === 0) {
    return NextResponse.json(
      { error: "Complete the attendance sheet before saving." },
      { status: 400 }
    );
  }

  const existingExclusions = await getRows(
    `attendance_day_exclusions?school_year_id=eq.${encodeURIComponent(
      year.id
    )}&section_id=eq.${encodeURIComponent(
      sectionId
    )}&attendance_date=eq.${attendanceDate}&select=id&limit=1`,
    token
  ).catch(() => []);

  if (existingExclusions?.[0]) {
    return NextResponse.json(
      { error: "This date is marked as No Classes. Restore it first to record attendance." },
      { status: 409 }
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
      { error: "Tag attendance for every active learner before saving." },
      { status: 400 }
    );
  }

  const allowedStatuses = new Set([
    "present",
    "absent",
    "absent_morning",
    "cutting_classes",
    "transferred_in",
    "transferred_out",
    "dropped",
  ]);

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
    const status = String(record?.status ?? "").trim();
    const noteRaw = String(record?.note ?? "").trim();

    if (
      !studentId ||
      seen.has(studentId) ||
      !allowedStudents.has(studentId) ||
      !allowedStatuses.has(status)
    ) {
      return NextResponse.json(
        { error: "Every learner must have a valid attendance tag before saving." },
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
