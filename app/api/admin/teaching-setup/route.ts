import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-access";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";
import {
  TECHNICAL_VOCATIONAL_MAJORS,
  requiresTechnicalVocationalMajor,
} from "@/lib/subject-config";

function authHeaders(token: string) {
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
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) return "";
  const user = await response.json().catch(() => null);
  return String(user?.id ?? "");
}

async function isAdmin(token: string) {
  return hasAdminPermission(token, "teaching.manage");
}

async function getRows(path: string, token: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Query failed.");
  return response.json();
}

async function getActiveSchoolYear(token: string) {
  const rows = await getRows(
    "school_years?is_active=eq.true&select=id,name,start_year,end_year&limit=1",
    token
  );
  return rows?.[0] ?? null;
}

export async function GET(request: NextRequest) {
  const token = tokenFrom(request);
  if (!token || !(await isAdmin(token))) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  try {
    const activeYear = await getActiveSchoolYear(token);
    const [grades, sections, subjects, teachers, assignments, advisers] = await Promise.all([
      getRows("grade_levels?select=grade_level,label,sort_order&order=sort_order.asc", token),
      getRows("sections?select=id,grade_level,name,is_active&order=grade_level.asc,name.asc", token),
      getRows("subjects?select=id,grade_level,name,is_active&order=grade_level.asc,name.asc", token),
      getRows(
        "profiles?role=eq.teacher&account_status=eq.active&select=id,full_name,email&order=full_name.asc",
        token
      ),
      activeYear
        ? getRows(
            `teacher_assignments?school_year_id=eq.${encodeURIComponent(
              activeYear.id
            )}&select=id,teacher_id,school_year_id,grade_level,section_id,subject_id,major,is_active,assigned_at&order=grade_level.asc,assigned_at.asc`,
            token
          )
        : Promise.resolve([]),
      activeYear
        ? getRows(
            `section_advisers?school_year_id=eq.${encodeURIComponent(
              activeYear.id
            )}&select=id,teacher_id,school_year_id,section_id,is_active,assigned_at&order=assigned_at.asc`,
            token
          )
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      activeYear,
      grades,
      sections,
      subjects,
      teachers,
      assignments,
      advisers,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load subjects and teacher assignments." },
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

  if (action === "add_subject") {
    const gradeLevel = Number(body?.gradeLevel ?? 0);
    const name = String(body?.name ?? "").trim().replace(/\s+/g, " ");

    if (!Number.isInteger(gradeLevel) || gradeLevel < 7 || gradeLevel > 12) {
      return NextResponse.json({ error: "Select a valid grade level." }, { status: 400 });
    }
    if (name.length < 2 || name.length > 100) {
      return NextResponse.json(
        { error: "Subject name must contain 2 to 100 characters." },
        { status: 400 }
      );
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/subjects`, {
      method: "POST",
      headers: { ...authHeaders(token), Prefer: "return=representation" },
      body: JSON.stringify({
        grade_level: gradeLevel,
        name,
        code: null,
        is_active: true,
      }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = String(result?.message ?? result?.details ?? "").toLowerCase();
      return NextResponse.json(
        {
          error: detail.includes("duplicate")
            ? "That subject already exists for this grade level."
            : "Unable to add the subject.",
        },
        { status: response.status || 400 }
      );
    }

    return NextResponse.json({ ok: true, subject: result?.[0] ?? null });
  }

  if (action === "update_subject") {
    const id = String(body?.id ?? "");
    const name = String(body?.name ?? "").trim().replace(/\s+/g, " ");

    if (!id) {
      return NextResponse.json({ error: "Subject is required." }, { status: 400 });
    }
    if (name.length < 2 || name.length > 100) {
      return NextResponse.json(
        { error: "Subject name must contain 2 to 100 characters." },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/subjects?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { ...authHeaders(token), Prefer: "return=representation" },
        body: JSON.stringify({
          name,
          code: null,
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
          error: detail.includes("duplicate")
            ? "That subject already exists for this grade level."
            : "Unable to update the subject.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, subject: result[0] });
  }

  if (action === "remove_subject") {
    const id = String(body?.id ?? "");
    if (!id) {
      return NextResponse.json({ error: "Subject is required." }, { status: 400 });
    }

    const assignmentRows = await getRows(
      `teacher_assignments?subject_id=eq.${encodeURIComponent(id)}&select=id&limit=1`,
      token
    ).catch(() => []);

    if (assignmentRows?.[0]) {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/subjects?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { ...authHeaders(token), Prefer: "return=representation" },
          body: JSON.stringify({
            is_active: false,
            updated_at: new Date().toISOString(),
          }),
          cache: "no-store",
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.[0]) {
        return NextResponse.json({ error: "Unable to remove the subject." }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        deactivated: true,
        message: "This subject already has school records, so it was made inactive instead of being permanently deleted.",
      });
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/subjects?id=eq.${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: { ...authHeaders(token), Prefer: "return=representation" },
        cache: "no-store",
      }
    );
    const result = await response.json().catch(() => []);

    if (!response.ok) {
      return NextResponse.json({ error: "Unable to remove the subject." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, deleted: true, subject: result?.[0] ?? null });
  }

  if (action === "set_subject_active") {
    const id = String(body?.id ?? "");
    const isActive = Boolean(body?.isActive);
    if (!id) {
      return NextResponse.json({ error: "Subject is required." }, { status: 400 });
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/subjects?id=eq.${encodeURIComponent(id)}`,
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
      return NextResponse.json({ error: "Unable to update the subject." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, subject: result[0] });
  }

  if (action === "assign_adviser") {
    const teacherId = String(body?.teacherId ?? "");
    const sectionId = String(body?.sectionId ?? "");
    const gradeLevel = Number(body?.gradeLevel ?? 0);

    if (
      !teacherId ||
      !sectionId ||
      !Number.isInteger(gradeLevel) ||
      gradeLevel < 7 ||
      gradeLevel > 12
    ) {
      return NextResponse.json(
        { error: "Select the Grade Level, Section, and Adviser." },
        { status: 400 }
      );
    }

    const activeYear = await getActiveSchoolYear(token).catch(() => null);
    if (!activeYear) {
      return NextResponse.json(
        { error: "No active school year is configured." },
        { status: 409 }
      );
    }

    const [teacherRows, sectionRows] = await Promise.all([
      getRows(
        `profiles?id=eq.${encodeURIComponent(
          teacherId
        )}&role=eq.teacher&account_status=eq.active&select=id&limit=1`,
        token
      ),
      getRows(
        `sections?id=eq.${encodeURIComponent(
          sectionId
        )}&grade_level=eq.${gradeLevel}&is_active=eq.true&select=id&limit=1`,
        token
      ),
    ]).catch(() => [[], []]);

    if (!teacherRows?.[0]) {
      return NextResponse.json({ error: "Select an active Teacher account." }, { status: 400 });
    }
    if (!sectionRows?.[0]) {
      return NextResponse.json({ error: "Select an active section for this grade." }, { status: 400 });
    }

    const existingRows = await getRows(
      `section_advisers?school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&section_id=eq.${encodeURIComponent(
        sectionId
      )}&select=id,teacher_id,is_active`,
      token
    ).catch(() => []);

    const assignedBy = await getUserId(token);
    const sameTeacher = (existingRows ?? []).find(
      (item: { teacher_id?: string }) => item.teacher_id === teacherId
    );

    const deactivateResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/section_advisers?school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&section_id=eq.${encodeURIComponent(sectionId)}&is_active=eq.true`,
      {
        method: "PATCH",
        headers: { ...authHeaders(token), Prefer: "return=minimal" },
        body: JSON.stringify({
          is_active: false,
          updated_at: new Date().toISOString(),
        }),
        cache: "no-store",
      }
    );

    if (!deactivateResponse.ok) {
      return NextResponse.json({ error: "Unable to replace the current Section Adviser." }, { status: 400 });
    }

    if (sameTeacher?.id) {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/section_advisers?id=eq.${encodeURIComponent(
          sameTeacher.id
        )}`,
        {
          method: "PATCH",
          headers: { ...authHeaders(token), Prefer: "return=representation" },
          body: JSON.stringify({
            is_active: true,
            assigned_by: assignedBy || null,
            updated_at: new Date().toISOString(),
          }),
          cache: "no-store",
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.[0]) {
        return NextResponse.json({ error: "Unable to assign the Section Adviser." }, { status: 400 });
      }
      return NextResponse.json({ ok: true, adviser: result[0] });
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/section_advisers`, {
      method: "POST",
      headers: { ...authHeaders(token), Prefer: "return=representation" },
      body: JSON.stringify({
        teacher_id: teacherId,
        school_year_id: activeYear.id,
        section_id: sectionId,
        assigned_by: assignedBy || null,
        is_active: true,
      }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result?.[0]) {
      return NextResponse.json({ error: "Unable to assign the Section Adviser." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, adviser: result[0] });
  }

  if (action === "remove_adviser") {
    const id = String(body?.id ?? "");
    if (!id) {
      return NextResponse.json({ error: "Section Adviser assignment is required." }, { status: 400 });
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/section_advisers?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { ...authHeaders(token), Prefer: "return=representation" },
        body: JSON.stringify({
          is_active: false,
          updated_at: new Date().toISOString(),
        }),
        cache: "no-store",
      }
    );
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result?.[0]) {
      return NextResponse.json({ error: "Unable to remove the Section Adviser." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, adviser: result[0] });
  }

  if (action === "assign_teacher") {
    const teacherId = String(body?.teacherId ?? "");
    const gradeLevel = Number(body?.gradeLevel ?? 0);
    const sectionId = String(body?.sectionId ?? "");
    const subjectId = String(body?.subjectId ?? "");

    if (
      !teacherId ||
      !sectionId ||
      !subjectId ||
      !Number.isInteger(gradeLevel) ||
      gradeLevel < 7 ||
      gradeLevel > 12
    ) {
      return NextResponse.json(
        { error: "Complete the teacher, grade, section, and subject." },
        { status: 400 }
      );
    }

    const activeYear = await getActiveSchoolYear(token).catch(() => null);
    if (!activeYear) {
      return NextResponse.json(
        { error: "No active school year is configured." },
        { status: 409 }
      );
    }

    const [teacherRows, sectionRows, subjectRows] = await Promise.all([
      getRows(
        `profiles?id=eq.${encodeURIComponent(
          teacherId
        )}&role=eq.teacher&account_status=eq.active&select=id&limit=1`,
        token
      ),
      getRows(
        `sections?id=eq.${encodeURIComponent(
          sectionId
        )}&grade_level=eq.${gradeLevel}&is_active=eq.true&select=id&limit=1`,
        token
      ),
      getRows(
        `subjects?id=eq.${encodeURIComponent(
          subjectId
        )}&grade_level=eq.${gradeLevel}&is_active=eq.true&select=id,name&limit=1`,
        token
      ),
    ]).catch(() => [[], [], []]);

    if (!teacherRows?.[0]) {
      return NextResponse.json({ error: "Select an active Teacher account." }, { status: 400 });
    }
    if (!sectionRows?.[0]) {
      return NextResponse.json({ error: "Select an active section for this grade." }, { status: 400 });
    }
    if (!subjectRows?.[0]) {
      return NextResponse.json({ error: "Select an active subject for this grade." }, { status: 400 });
    }

    const requiresMajor = requiresTechnicalVocationalMajor(
      gradeLevel,
      String(subjectRows[0].name ?? "")
    );
    const majorRaw = String(body?.major ?? "").trim();
    const major = requiresMajor ? majorRaw : null;

    if (
      requiresMajor &&
      !TECHNICAL_VOCATIONAL_MAJORS.includes(
        majorRaw as (typeof TECHNICAL_VOCATIONAL_MAJORS)[number]
      )
    ) {
      return NextResponse.json(
        { error: "Select the Technical Vocational Education major." },
        { status: 400 }
      );
    }

    const majorFilter = major
      ? `major=eq.${encodeURIComponent(major)}`
      : "major=is.null";
    const existing = await getRows(
      `teacher_assignments?school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&section_id=eq.${encodeURIComponent(
        sectionId
      )}&subject_id=eq.${encodeURIComponent(subjectId)}&${majorFilter}&select=id&limit=1`,
      token
    ).catch(() => []);

    if (existing?.[0]?.id) {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/teacher_assignments?id=eq.${encodeURIComponent(
          existing[0].id
        )}`,
        {
          method: "PATCH",
          headers: { ...authHeaders(token), Prefer: "return=representation" },
          body: JSON.stringify({
            teacher_id: teacherId,
            grade_level: gradeLevel,
            major,
            is_active: true,
            updated_at: new Date().toISOString(),
          }),
          cache: "no-store",
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.[0]) {
        return NextResponse.json({ error: "Unable to update the teacher assignment." }, { status: 400 });
      }
      return NextResponse.json({ ok: true, assignment: result[0] });
    }

    const assignedBy = await getUserId(token);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/teacher_assignments`, {
      method: "POST",
      headers: { ...authHeaders(token), Prefer: "return=representation" },
      body: JSON.stringify({
        teacher_id: teacherId,
        school_year_id: activeYear.id,
        grade_level: gradeLevel,
        section_id: sectionId,
        subject_id: subjectId,
        major,
        assigned_by: assignedBy || null,
        is_active: true,
      }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to create the teacher assignment." },
        { status: response.status || 400 }
      );
    }

    return NextResponse.json({ ok: true, assignment: result?.[0] ?? null });
  }

  if (action === "set_assignment_active") {
    const id = String(body?.id ?? "");
    const isActive = Boolean(body?.isActive);
    if (!id) {
      return NextResponse.json({ error: "Teacher assignment is required." }, { status: 400 });
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/teacher_assignments?id=eq.${encodeURIComponent(id)}`,
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
      return NextResponse.json(
        {
          error: isActive
            ? "Unable to reactivate the assignment. Make sure the section and subject are active."
            : "Unable to deactivate the assignment.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, assignment: result[0] });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
