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

function isSupportedAcademicLevel(gradeLevel: number) {
  return Number.isInteger(gradeLevel) && (
    gradeLevel === 0 ||
    (gradeLevel >= 7 && gradeLevel <= 12)
  );
}

function academicLevelLabel(gradeLevel: number) {
  return gradeLevel === 0 ? "ALS A&E" : `Grade ${gradeLevel}`;
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

function subjectTeacherEligible(profile: {
  role?: string | null;
  position?: string | null;
}) {
  if (profile.role === "teacher") return true;
  return /^HEAD TEACHER\b/i.test(String(profile.position ?? "").trim());
}

async function headTeacherService(
  token: string,
  payload: Record<string, unknown>
) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/admin-head-teacher-provision`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(payload),
      cache: "no-store",
    }
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(result?.error ?? "Unable to process Head Teacher."));
  }
  return result;
}

async function resolveSubjectTeacherId(
  token: string,
  rawTeacherId: string
) {
  if (!rawTeacherId.startsWith("head:")) return rawTeacherId;
  const personnelId = rawTeacherId.slice("head:".length);
  const result = await headTeacherService(token, {
    action: "provision",
    personnel_id: personnelId,
  });
  const userId = String(result?.user_id ?? "");
  if (!userId) throw new Error("Unable to link the Head Teacher portal account.");
  return userId;
}

export async function GET(request: NextRequest) {
  const token = tokenFrom(request);
  if (!token || !(await isAdmin(token))) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  try {
    const activeYear = await getActiveSchoolYear(token);
    const [
      grades,
      sections,
      subjects,
      profileRows,
      assignments,
      advisers,
      headTeacherResult,
    ] = await Promise.all([
      getRows("grade_levels?select=grade_level,label,sort_order&order=sort_order.asc", token),
      getRows("sections?select=id,grade_level,name,is_active&order=grade_level.asc,name.asc", token),
      getRows("subjects?select=id,grade_level,name,is_active&order=grade_level.asc,name.asc", token),
      getRows(
        "profiles?account_status=eq.active&role=neq.student&select=id,full_name,email,role,position&order=full_name.asc",
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
      headTeacherService(token, { action: "list" }).catch(() => ({
        head_teachers: [],
      })),
    ]);

    const teachers = (profileRows ?? []).filter(
      (item: { role?: string | null }) => item.role === "teacher"
    );

    const subjectTeachers: Array<Record<string, unknown>> = [
      ...teachers.map((item: Record<string, unknown>) => ({
        ...item,
        is_head_teacher: /^HEAD TEACHER\b/i.test(String(item.position ?? "")),
        linked: true,
      })),
    ];

    const knownIds = new Set(subjectTeachers.map((item) => String(item.id)));
    for (const head of headTeacherResult?.head_teachers ?? []) {
      const linkedId = String(head.portal_user_id ?? "");
      if (linkedId && knownIds.has(linkedId)) continue;

      subjectTeachers.push({
        id: linkedId || `head:${head.id}`,
        personnel_id: head.id,
        full_name: head.full_name,
        email: head.email,
        position: head.position,
        role: linkedId ? "teacher" : "head_teacher",
        is_head_teacher: true,
        linked: Boolean(linkedId),
      });
    }

    return NextResponse.json({
      activeYear,
      grades,
      sections,
      subjects,
      teachers,
      subjectTeachers,
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

    if (!isSupportedAcademicLevel(gradeLevel)) {
      return NextResponse.json({ error: "Select a valid Grade Level or ALS A&E program." }, { status: 400 });
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

  if (action === "save_section_setup") {
    const gradeLevel = Number(body?.gradeLevel ?? 0);
    const sectionId = String(body?.sectionId ?? "");
    const adviserTeacherId = String(body?.adviserTeacherId ?? "");
    const requestedAssignments = Array.isArray(body?.assignments)
      ? body.assignments
      : [];

    if (
      !sectionId ||
      !isSupportedAcademicLevel(gradeLevel)
    ) {
      return NextResponse.json(
        { error: "Select a valid Grade Level / Program and Section." },
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

    const [sectionRows, subjectRows, profileRows] = await Promise.all([
      getRows(
        `sections?id=eq.${encodeURIComponent(
          sectionId
        )}&grade_level=eq.${gradeLevel}&is_active=eq.true&select=id,name&limit=1`,
        token
      ),
      getRows(
        `subjects?grade_level=eq.${gradeLevel}&is_active=eq.true&select=id,name,grade_level`,
        token
      ),
      getRows(
        "profiles?account_status=eq.active&role=neq.student&select=id,role,position",
        token
      ),
    ]).catch(() => [[], [], []]);

    if (!sectionRows?.[0]) {
      return NextResponse.json(
        { error: "Select an active Section for this Grade Level." },
        { status: 400 }
      );
    }

    const subjectById = new Map<
      string,
      { id: string; name: string; grade_level: number }
    >(
      ((subjectRows ?? []) as Array<{
        id: string;
        name: string;
        grade_level: number;
      }>).map((item) => [String(item.id), item])
    );
    const validAdviserIds = new Set(
      (profileRows ?? [])
        .filter((item: { role?: string | null }) => item.role === "teacher")
        .map((item: { id: string }) => String(item.id))
    );
    const validSubjectTeacherIds = new Set(
      (profileRows ?? [])
        .filter(subjectTeacherEligible)
        .map((item: { id: string }) => String(item.id))
    );

    if (adviserTeacherId && !validAdviserIds.has(adviserTeacherId)) {
      return NextResponse.json(
        { error: "Select an active Teacher account for the Section Adviser." },
        { status: 400 }
      );
    }

    const normalizedAssignments: Array<{
      subjectId: string;
      major: string | null;
      teacherId: string;
    }> = [];
    const seen = new Set<string>();

    for (const item of requestedAssignments) {
      const subjectId = String(item?.subjectId ?? "");
      const requestedTeacherId = String(item?.teacherId ?? "");
      let teacherId = requestedTeacherId;
      if (requestedTeacherId.startsWith("head:")) {
        try {
          teacherId = await resolveSubjectTeacherId(token, requestedTeacherId);
          validSubjectTeacherIds.add(teacherId);
        } catch (error) {
          return NextResponse.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Unable to link the selected Head Teacher.",
            },
            { status: 400 }
          );
        }
      }
      const subject = subjectById.get(subjectId);

      if (!subject) {
        return NextResponse.json(
          { error: "One of the selected subjects is not active for this Grade Level." },
          { status: 400 }
        );
      }

      const needsMajor = requiresTechnicalVocationalMajor(
        gradeLevel,
        String(subject.name ?? "")
      );
      const requestedMajor = String(item?.major ?? "").trim();
      const major = needsMajor ? requestedMajor : null;

      if (
        needsMajor &&
        !TECHNICAL_VOCATIONAL_MAJORS.includes(
          requestedMajor as (typeof TECHNICAL_VOCATIONAL_MAJORS)[number]
        )
      ) {
        return NextResponse.json(
          { error: `Select a valid TVE Major for ${subject.name}.` },
          { status: 400 }
        );
      }

      if (teacherId && !validSubjectTeacherIds.has(teacherId)) {
        return NextResponse.json(
          { error: "One of the selected Subject Teachers is not an active teaching-capable account." },
          { status: 400 }
        );
      }

      const key = `${subjectId}::${major ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normalizedAssignments.push({ subjectId, major, teacherId });
    }

    const assignedBy = await getUserId(token);

    const existingAdvisers = await getRows(
      `section_advisers?school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&section_id=eq.${encodeURIComponent(
        sectionId
      )}&select=id,teacher_id,is_active`,
      token
    ).catch(() => []);

    const activeAdviser = (existingAdvisers ?? []).find(
      (item: { is_active?: boolean }) => item.is_active === true
    );

    if (!adviserTeacherId) {
      if (activeAdviser?.id) {
        const response = await fetch(
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
        if (!response.ok) {
          return NextResponse.json(
            { error: "Unable to remove the current Section Adviser." },
            { status: 400 }
          );
        }
      }
    } else if (activeAdviser?.teacher_id !== adviserTeacherId) {
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
        return NextResponse.json(
          { error: "Unable to replace the current Section Adviser." },
          { status: 400 }
        );
      }

      const sameTeacher = (existingAdvisers ?? []).find(
        (item: { teacher_id?: string }) => item.teacher_id === adviserTeacherId
      );

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
        if (!response.ok) {
          return NextResponse.json(
            { error: "Unable to save the Section Adviser." },
            { status: 400 }
          );
        }
      } else {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/section_advisers`,
          {
            method: "POST",
            headers: { ...authHeaders(token), Prefer: "return=representation" },
            body: JSON.stringify({
              teacher_id: adviserTeacherId,
              school_year_id: activeYear.id,
              section_id: sectionId,
              assigned_by: assignedBy || null,
              is_active: true,
            }),
            cache: "no-store",
          }
        );
        if (!response.ok) {
          return NextResponse.json(
            { error: "Unable to save the Section Adviser." },
            { status: 400 }
          );
        }
      }
    }

    const existingAssignments = await getRows(
      `teacher_assignments?school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&section_id=eq.${encodeURIComponent(
        sectionId
      )}&select=id,teacher_id,subject_id,major,is_active`,
      token
    ).catch(() => []);

    for (const item of normalizedAssignments) {
      const existing = (existingAssignments ?? []).find(
        (assignment: { subject_id?: string; major?: string | null }) =>
          assignment.subject_id === item.subjectId &&
          (assignment.major ?? null) === item.major
      );

      if (!item.teacherId) {
        if (existing?.id && existing.is_active) {
          const response = await fetch(
            `${SUPABASE_URL}/rest/v1/teacher_assignments?id=eq.${encodeURIComponent(
              existing.id
            )}`,
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
          if (!response.ok) {
            return NextResponse.json(
              { error: "Unable to deactivate one of the cleared Subject Teacher assignments." },
              { status: 400 }
            );
          }
        }
        continue;
      }

      if (existing?.id) {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/teacher_assignments?id=eq.${encodeURIComponent(
            existing.id
          )}`,
          {
            method: "PATCH",
            headers: { ...authHeaders(token), Prefer: "return=minimal" },
            body: JSON.stringify({
              teacher_id: item.teacherId,
              grade_level: gradeLevel,
              major: item.major,
              is_active: true,
              assigned_by: assignedBy || null,
              updated_at: new Date().toISOString(),
            }),
            cache: "no-store",
          }
        );
        if (!response.ok) {
          return NextResponse.json(
            { error: "Unable to update one of the Subject Teacher assignments." },
            { status: 400 }
          );
        }
      } else {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/teacher_assignments`,
          {
            method: "POST",
            headers: { ...authHeaders(token), Prefer: "return=minimal" },
            body: JSON.stringify({
              teacher_id: item.teacherId,
              school_year_id: activeYear.id,
              grade_level: gradeLevel,
              section_id: sectionId,
              subject_id: item.subjectId,
              major: item.major,
              assigned_by: assignedBy || null,
              is_active: true,
            }),
            cache: "no-store",
          }
        );
        if (!response.ok) {
          return NextResponse.json(
            { error: "Unable to create one of the Subject Teacher assignments." },
            { status: 400 }
          );
        }
      }
    }

    const activeRows = await getRows(
      `teacher_assignments?school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&section_id=eq.${encodeURIComponent(
        sectionId
      )}&is_active=eq.true&select=id`,
      token
    ).catch(() => []);

    return NextResponse.json({
      ok: true,
      sectionId,
      activeAssignments: activeRows?.length ?? 0,
    });
  }

  if (action === "assign_adviser") {
    const teacherId = String(body?.teacherId ?? "");
    const sectionId = String(body?.sectionId ?? "");
    const gradeLevel = Number(body?.gradeLevel ?? 0);

    if (
      !teacherId ||
      !sectionId ||
      !isSupportedAcademicLevel(gradeLevel)
    ) {
      return NextResponse.json(
        { error: "Select the Grade Level / Program, Section, and Adviser." },
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
      return NextResponse.json(
        { error: "Select an active Teacher account for the Section Adviser." },
        { status: 400 }
      );
    }
    if (!sectionRows?.[0]) {
      return NextResponse.json({ error: "Select an active section for this Grade Level / Program." }, { status: 400 });
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
    const requestedTeacherId = String(body?.teacherId ?? "");
    let teacherId = requestedTeacherId;

    if (requestedTeacherId.startsWith("head:")) {
      try {
        teacherId = await resolveSubjectTeacherId(token, requestedTeacherId);
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Unable to link the selected Head Teacher.",
          },
          { status: 400 }
        );
      }
    }
    const gradeLevel = Number(body?.gradeLevel ?? 0);
    const sectionId = String(body?.sectionId ?? "");
    const subjectId = String(body?.subjectId ?? "");

    if (
      !teacherId ||
      !sectionId ||
      !subjectId ||
      !isSupportedAcademicLevel(gradeLevel)
    ) {
      return NextResponse.json(
        { error: "Complete the Teacher, Grade Level / Program, Section, and Subject." },
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
        )}&account_status=eq.active&select=id,role,position&limit=1`,
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

    if (!teacherRows?.[0] || !subjectTeacherEligible(teacherRows[0])) {
      return NextResponse.json(
        { error: "Select an active Teacher or Head Teacher account." },
        { status: 400 }
      );
    }
    if (!sectionRows?.[0]) {
      return NextResponse.json({ error: "Select an active section for this Grade Level / Program." }, { status: 400 });
    }
    if (!subjectRows?.[0]) {
      return NextResponse.json({ error: "Select an active subject for this Grade Level / Program." }, { status: 400 });
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
