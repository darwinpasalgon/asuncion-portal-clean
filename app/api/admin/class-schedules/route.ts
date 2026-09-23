import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

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
  const userId = await getUserId(token);
  if (!userId) return false;
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(
      userId
    )}&select=role,account_status&limit=1`,
    { headers: authHeaders(token), cache: "no-store" }
  );
  if (!response.ok) return false;
  const rows = await response.json().catch(() => []);
  return rows?.[0]?.role === "administrator" && rows?.[0]?.account_status === "active";
}

async function getRows(path: string, token: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Query failed.");
  return response.json();
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

export async function GET(request: NextRequest) {
  const token = getToken(request);
  if (!token || !(await isAdmin(token))) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  try {
    const year = await activeYear(token);
    const [assignments, sections, subjects, teachers, schedules] = await Promise.all([
      year
        ? getRows(
            `teacher_assignments?school_year_id=eq.${encodeURIComponent(
              year.id
            )}&is_active=eq.true&select=id,teacher_id,grade_level,section_id,subject_id&order=grade_level.asc`,
            token
          )
        : Promise.resolve([]),
      getRows("sections?select=id,grade_level,name,is_active", token),
      getRows("subjects?select=id,grade_level,name,code,is_active", token),
      getRows(
        "profiles?role=eq.teacher&account_status=eq.active&select=id,full_name",
        token
      ),
      getRows(
        "class_schedules?select=id,teacher_assignment_id,day_of_week,start_time,end_time,room,is_active,created_at&order=day_of_week.asc,start_time.asc",
        token
      ),
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
      )}&is_active=eq.true&select=id&limit=1`,
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
