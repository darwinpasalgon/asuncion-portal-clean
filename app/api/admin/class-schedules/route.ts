import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-access";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";
import { findScheduleConflicts, type ProposedPeriod } from "@/lib/schedule-conflicts";

function manilaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function authHeaders(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function getToken(request: NextRequest) {
  return request.cookies.get("anhs-access-token")?.value ?? "";
}

async function getUserId(token: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) return "";
  const user = await response.json().catch(() => null);
  return String(user?.id ?? "");
}

async function isAdmin(token: string) {
  return hasAdminPermission(token, "schedules.manage");
}

async function getRows(path: string, token: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Query failed.");
  return response.json();
}

async function getAllRows<T>(path: string, token: string): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const separator = path.includes("?") ? "&" : "?";
    const page = (await getRows(
      `${path}${separator}limit=${pageSize}&offset=${offset}`,
      token
    )) as T[];

    rows.push(...page);

    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function activeYear(token: string) {
  const rows = await getRows(
    "school_years?is_active=eq.true&select=id,name&limit=1",
    token
  );
  return rows?.[0] ?? null;
}

function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

async function conflictResponse(token: string, assignmentId: string, periods: ProposedPeriod[]) {
  const error = "Schedule conflict: an existing class overlaps with the requested schedule.";
  try {
    const [assignment] = await getRows(
      `teacher_assignments?id=eq.${encodeURIComponent(assignmentId)}&select=id,school_year_id&limit=1`, token
    );
    if (!assignment) throw new Error("Assignment unavailable");
    const [assignments, schedules, teachers, sections, subjects] = await Promise.all([
      getRows(`teacher_assignments?school_year_id=eq.${encodeURIComponent(assignment.school_year_id)}&is_active=eq.true&select=id,teacher_id,section_id,subject_id,grade_level,major`, token),
      getRows(`class_schedules?is_active=eq.true&day_of_week=in.(${[...new Set(periods.map((item) => item.day_of_week))].join(",")})&select=id,teacher_assignment_id,day_of_week,start_time,end_time,room,is_active`, token),
      getRows("profiles?role=eq.teacher&select=id,full_name", token),
      getRows("sections?select=id,name", token),
      getRows("subjects?select=id,name", token),
    ]);
    const target = assignments.find((item: { id: string }) => item.id === assignmentId);
    const conflicts = target ? findScheduleConflicts(target, periods, { assignments, schedules, teachers, sections, subjects }) : [];
    return NextResponse.json({ error, code: "schedule_conflict", conflicts }, { status: 409 });
  } catch {
    return NextResponse.json({
      error: `${error} Refresh the schedules to review the latest entries.`,
      code: "schedule_conflict", conflicts: [],
    }, { status: 409 });
  }
}

export async function GET(request: NextRequest) {
  const token = getToken(request);
  if (!token || !(await isAdmin(token))) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  try {
    const year = await activeYear(token);
    const today = manilaDate();
    const [assignments, sections, subjects, teachers, schedules, scheduleBlocks, grade7TveRotations] = await Promise.all([
      year
        ? getRows(
            `teacher_assignments?school_year_id=eq.${encodeURIComponent(
              year.id
            )}&is_active=eq.true&select=id,teacher_id,grade_level,section_id,subject_id,major&order=grade_level.asc`,
            token
          )
        : Promise.resolve([]),
      getRows("sections?select=id,grade_level,name,is_active", token),
      getRows("subjects?select=id,grade_level,name,is_active", token),
      getRows(
        "profiles?role=eq.teacher&account_status=eq.active&select=id,full_name",
        token
      ),
      getAllRows<{
        id: string;
        teacher_assignment_id: string;
        day_of_week: number;
        start_time: string;
        end_time: string;
        room: string | null;
        is_active: boolean;
        created_at: string;
      }>(
        "class_schedules?select=id,teacher_assignment_id,day_of_week,start_time,end_time,room,is_active,created_at&order=day_of_week.asc,start_time.asc,id.asc",
        token
      ),
      year
        ? getRows(
            `schedule_blocks?school_year_id=eq.${encodeURIComponent(
              year.id
            )}&is_active=eq.true&select=id,school_year_id,grade_level,section_id,day_of_week,start_time,end_time,label,purpose,block_type,is_active&order=day_of_week.asc,start_time.asc`,
            token
          )
        : Promise.resolve([]),
      year
        ? getRows(
            `grade7_tve_rotations?school_year_id=eq.${encodeURIComponent(
              year.id
            )}&is_active=eq.true&starts_on=lte.${encodeURIComponent(
              today
            )}&ends_on=gte.${encodeURIComponent(
              today
            )}&select=id,rotation_block,group_label,section_id,phase_no,starts_on,ends_on,major_code,teacher_id,non_teaching_personnel_id,instructor_name,days_of_week,start_time,end_time&order=start_time.asc`,
            token
          )
        : Promise.resolve([]),
    ]);

    const activeAssignmentIds = new Set(
      (assignments ?? []).map((item: { id: string }) => item.id)
    );

    return NextResponse.json({
      activeYear: year,
      assignments,
      sections,
      subjects,
      teachers,
      schedules: (schedules ?? []).filter((item: { teacher_assignment_id: string }) =>
        activeAssignmentIds.has(item.teacher_assignment_id)
      ),
      scheduleBlocks: scheduleBlocks ?? [],
      grade7TveRotations: grade7TveRotations ?? [],
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load class schedules." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const token = getToken(request);
  if (!token || !(await isAdmin(token))) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");

  if (action === "save_schedule") {
    const id = String(body?.id ?? "");
    const assignmentId = String(body?.assignmentId ?? "");

    if (!assignmentId) {
      return NextResponse.json({ error: "Select a class assignment." }, { status: 400 });
    }

    const year = await activeYear(token).catch(() => null);
    if (!year) {
      return NextResponse.json(
        { error: "No active school year is configured." },
        { status: 409 }
      );
    }

    const assignmentRows = await getRows(
      `teacher_assignments?id=eq.${encodeURIComponent(
        assignmentId
      )}&school_year_id=eq.${encodeURIComponent(
        year.id
      )}&is_active=eq.true&select=id,section_id,grade_level&limit=1`,
      token
    ).catch(() => []);

    if (!assignmentRows?.[0]) {
      return NextResponse.json(
        { error: "Select an active Teacher assignment for the current school year." },
        { status: 400 }
      );
    }

    const createdBy = (await getUserId(token)) || null;

    const rawEntries = id
      ? [
          {
            dayOfWeek: body?.dayOfWeek,
            startTime: body?.startTime,
            endTime: body?.endTime,
            room: body?.room,
          },
        ]
      : Array.isArray(body?.entries)
        ? body.entries
        : [];

    if (!rawEntries.length) {
      return NextResponse.json(
        { error: "Select at least one day and enter its schedule." },
        { status: 400 }
      );
    }

    const seenDays = new Set<number>();
    const payloads: Array<{
      teacher_assignment_id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      room: string | null;
      is_active: boolean;
      updated_at: string;
      created_by?: string | null;
    }> = [];

    for (const entry of rawEntries) {
      const dayOfWeek = Number(entry?.dayOfWeek ?? 0);
      const startTime = String(entry?.startTime ?? "");
      const endTime = String(entry?.endTime ?? "");
      const roomRaw = String(entry?.room ?? "").trim().replace(/\s+/g, " ");
      const room = roomRaw || null;

      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
        return NextResponse.json({ error: "Select a valid day." }, { status: 400 });
      }
      if (seenDays.has(dayOfWeek)) {
        return NextResponse.json(
          { error: "Each selected day can appear only once in one submission." },
          { status: 400 }
        );
      }
      seenDays.add(dayOfWeek);

      if (!validTime(startTime) || !validTime(endTime) || startTime >= endTime) {
        return NextResponse.json(
          { error: "Enter a valid start and end time for every selected day." },
          { status: 400 }
        );
      }
      if (room && room.length > 80) {
        return NextResponse.json(
          { error: "Room or location must be 80 characters or fewer." },
          { status: 400 }
        );
      }

      payloads.push({
        teacher_assignment_id: assignmentId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        room,
        is_active: true,
        updated_at: new Date().toISOString(),
        ...(id ? {} : { created_by: createdBy }),
      });
    }

    const activeBlocks = await getRows(
      `schedule_blocks?school_year_id=eq.${encodeURIComponent(
        year.id
      )}&section_id=eq.${encodeURIComponent(
        assignmentRows[0].section_id
      )}&is_active=eq.true&select=id,day_of_week,start_time,end_time,label,purpose`,
      token
    ).catch(() => []);

    const blocked = payloads.flatMap((period) =>
      (activeBlocks ?? []).filter(
        (block: {
          day_of_week: number;
          start_time: string;
          end_time: string;
        }) =>
          Number(block.day_of_week) === period.day_of_week &&
          String(block.start_time).slice(0, 5) < period.end_time.slice(0, 5) &&
          String(block.end_time).slice(0, 5) > period.start_time.slice(0, 5)
      )
    );

    const grade7TveRotations =
      Number(assignmentRows[0].grade_level) === 7
        ? await getRows(
            `grade7_tve_rotations?school_year_id=eq.${encodeURIComponent(
              year.id
            )}&section_id=eq.${encodeURIComponent(
              assignmentRows[0].section_id
            )}&is_active=eq.true&select=id,days_of_week,start_time,end_time,major_code,instructor_name`,
            token
          ).catch(() => [])
        : [];

    const tveBlocked = payloads.flatMap((period) =>
      (grade7TveRotations ?? []).filter(
        (rotation: {
          days_of_week: number[];
          start_time: string;
          end_time: string;
        }) =>
          (rotation.days_of_week ?? []).map(Number).includes(period.day_of_week) &&
          String(rotation.start_time).slice(0, 5) < period.end_time.slice(0, 5) &&
          String(rotation.end_time).slice(0, 5) > period.start_time.slice(0, 5)
      )
    );

    if (tveBlocked.length) {
      const rotation = tveBlocked[0] as {
        major_code?: string;
        instructor_name?: string;
      };
      return NextResponse.json(
        {
          error: `This period is reserved for Grade 7 Exploratory TVE${rotation.major_code ? ` (${rotation.major_code})` : ""}${rotation.instructor_name ? ` with ${rotation.instructor_name}` : ""}. Choose another class time.`,
          code: "grade7_tve_rotation_conflict",
        },
        { status: 409 }
      );
    }

    if (blocked.length) {
      const block = blocked[0] as { label?: string; purpose?: string | null };
      return NextResponse.json(
        {
          error: `This period is reserved as ${block.label || "VACANT"}${block.purpose ? ` – ${block.purpose}` : ""}. Choose another class time.`,
          code: "schedule_block_conflict",
        },
        { status: 409 }
      );
    }

    const response = await fetch(
      id
        ? `${SUPABASE_URL}/rest/v1/class_schedules?id=eq.${encodeURIComponent(id)}`
        : `${SUPABASE_URL}/rest/v1/class_schedules`,
      {
        method: id ? "PATCH" : "POST",
        headers: { ...authHeaders(token), Prefer: "return=representation" },
        body: JSON.stringify(id ? payloads[0] : payloads),
        cache: "no-store",
      }
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.[0]) {
      const detail = String(
        result?.message ?? result?.details ?? result?.hint ?? ""
      ).toLowerCase();
      if (detail.includes("schedule conflicts")) {
        return conflictResponse(token, assignmentId, payloads.map((item) => ({ ...item, id: id || undefined })));
      }
      let message = "Unable to save the schedule.";
      if (detail.includes("teacher or section")) {
        message =
          "Schedule conflict: the Teacher or Section already has a class during one of the selected periods.";
      } else if (detail.includes("room")) {
        message =
          "Schedule conflict: a room or location is already being used during one of the selected periods.";
      } else if (detail.includes("end time")) {
        message = "The end time must be later than the start time.";
      }
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json({
      ok: true,
      schedule: result[0],
      schedules: result,
      count: result.length,
    });
  }

  if (action === "set_schedule_active") {
    const id = String(body?.id ?? "");
    const isActive = Boolean(body?.isActive);
    if (!id) {
      return NextResponse.json({ error: "Schedule is required." }, { status: 400 });
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/class_schedules?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { ...authHeaders(token), Prefer: "return=representation" },
        body: JSON.stringify({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        }),
        cache: "no-store",
      }
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.[0]) {
      const detail = String(result?.message ?? result?.details ?? "").toLowerCase();
      if (isActive && detail.includes("conflict")) {
        const [schedule] = await getRows(
          `class_schedules?id=eq.${encodeURIComponent(id)}&select=id,teacher_assignment_id,day_of_week,start_time,end_time,room&limit=1`, token
        ).catch(() => []);
        if (schedule) return conflictResponse(token, schedule.teacher_assignment_id, [schedule]);
      }
      return NextResponse.json(
        {
          error:
            isActive && detail.includes("conflict")
              ? "This schedule cannot be reactivated because it conflicts with another active schedule."
              : "Unable to update the schedule.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, schedule: result[0] });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
