import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

function headers(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function tokenFrom(request: NextRequest) {
  return request.cookies.get("anhs-access-token")?.value ?? "";
}

async function getUserId(token: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: headers(token),
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
    { headers: headers(token), cache: "no-store" }
  );
  if (!response.ok) return false;
  const rows = await response.json().catch(() => []);
  return rows?.[0]?.role === "administrator" && rows?.[0]?.account_status === "active";
}

async function getRows(path: string, token: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: headers(token),
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

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(request: NextRequest) {
  const token = tokenFrom(request);
  if (!token || !(await isAdmin(token))) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const date = request.nextUrl.searchParams.get("date") ?? "";

  try {
    const year = await activeYear(token);
    const [grades, sections, teachers, advisers, enrollments, students, attendance] =
      await Promise.all([
        getRows("grade_levels?select=grade_level,label,sort_order&order=sort_order.asc", token),
        getRows("sections?is_active=eq.true&select=id,grade_level,name&order=grade_level.asc,name.asc", token),
        getRows(
          "profiles?role=eq.teacher&account_status=eq.active&select=id,full_name,email&order=full_name.asc",
          token
        ),
        year
          ? getRows(
              `section_advisers?school_year_id=eq.${encodeURIComponent(
                year.id
              )}&is_active=eq.true&select=id,school_year_id,section_id,teacher_id,is_active&order=assigned_at.asc`,
              token
            )
          : Promise.resolve([]),
        year
          ? getRows(
              `student_enrollments?school_year_id=eq.${encodeURIComponent(
                year.id
              )}&enrollment_status=eq.active&select=id,student_id,grade_level,section_id`,
              token
            )
          : Promise.resolve([]),
        getRows(
          "profiles?role=eq.student&account_status=eq.active&select=id,full_name,lrn&order=full_name.asc",
          token
        ),
        year && validDate(date)
          ? getRows(
              `daily_attendance?school_year_id=eq.${encodeURIComponent(
                year.id
              )}&attendance_date=eq.${date}&select=id,student_id,section_id,attendance_date,status,note,recorded_by,updated_at&order=updated_at.asc`,
              token
            )
          : Promise.resolve([]),
      ]);

    return NextResponse.json({
      activeYear: year,
      grades,
      sections,
      teachers,
      advisers,
      enrollments,
      students,
      attendance,
      date: validDate(date) ? date : null,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load attendance administration." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const token = tokenFrom(request);
  if (!token || !(await isAdmin(token))) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");

  if (action === "set_adviser") {
    const sectionId = String(body?.sectionId ?? "");
    const teacherId = String(body?.teacherId ?? "");
    if (!sectionId || !teacherId) {
      return NextResponse.json(
        { error: "Select a section and an active Teacher." },
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

    const [sectionRows, teacherRows, existingRows] = await Promise.all([
      getRows(
        `sections?id=eq.${encodeURIComponent(sectionId)}&is_active=eq.true&select=id&limit=1`,
        token
      ),
      getRows(
        `profiles?id=eq.${encodeURIComponent(
          teacherId
        )}&role=eq.teacher&account_status=eq.active&select=id&limit=1`,
        token
      ),
      getRows(
        `section_advisers?school_year_id=eq.${encodeURIComponent(
          year.id
        )}&section_id=eq.${encodeURIComponent(
          sectionId
        )}&is_active=eq.true&select=id,teacher_id&limit=1`,
        token
      ),
    ]).catch(() => [[], [], []]);

    if (!sectionRows?.[0]) {
      return NextResponse.json({ error: "Select an active section." }, { status: 400 });
    }
    if (!teacherRows?.[0]) {
      return NextResponse.json({ error: "Select an active Teacher." }, { status: 400 });
    }

    const assignedBy = await getUserId(token);
    const existing = existingRows?.[0];

    const response = await fetch(
      existing?.id
        ? `${SUPABASE_URL}/rest/v1/section_advisers?id=eq.${encodeURIComponent(
            existing.id
          )}`
        : `${SUPABASE_URL}/rest/v1/section_advisers`,
      {
        method: existing?.id ? "PATCH" : "POST",
        headers: { ...headers(token), Prefer: "return=representation" },
        body: JSON.stringify(
          existing?.id
            ? {
                teacher_id: teacherId,
                assigned_by: assignedBy || null,
                assigned_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            : {
                school_year_id: year.id,
                section_id: sectionId,
                teacher_id: teacherId,
                assigned_by: assignedBy || null,
                is_active: true,
              }
        ),
        cache: "no-store",
      }
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.[0]) {
      return NextResponse.json(
        { error: "Unable to save the Attendance Teacher / Adviser." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, adviser: result[0] });
  }

  if (action === "remove_adviser") {
    const id = String(body?.id ?? "");
    if (!id) {
      return NextResponse.json({ error: "Adviser assignment is required." }, { status: 400 });
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/section_advisers?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { ...headers(token), Prefer: "return=representation" },
        body: JSON.stringify({
          is_active: false,
          updated_at: new Date().toISOString(),
        }),
        cache: "no-store",
      }
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.[0]) {
      return NextResponse.json({ error: "Unable to remove the adviser." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
