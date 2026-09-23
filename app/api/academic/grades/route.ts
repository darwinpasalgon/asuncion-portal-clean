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

async function getIdentity(request: NextRequest) {
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
    )}&select=id,full_name,role,account_status&limit=1`,
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

async function getActiveYear(token: string) {
  const rows = await getRows(
    "school_years?is_active=eq.true&select=id,name,start_year,end_year&limit=1",
    token
  );
  return rows?.[0] ?? null;
}

export async function GET(request: NextRequest) {
  const identity = await getIdentity(request);
  if (!identity) {
    return NextResponse.json(
      { error: "Student or Teacher access required." },
      { status: 403 }
    );
  }

  const { token, profile } = identity;

  try {
    const activeYear = await getActiveYear(token);
    if (!activeYear) {
      return NextResponse.json({
        role: profile.role,
        profile,
        activeYear: null,
        assignments: [],
        sections: [],
        subjects: [],
        enrollments: [],
        students: [],
        grades: [],
      });
    }

    const [assignments, sections, subjects, enrollments, students, grades] =
      await Promise.all([
        getRows(
          `teacher_assignments?school_year_id=eq.${encodeURIComponent(
            activeYear.id
          )}&is_active=eq.true&select=id,teacher_id,grade_level,section_id,subject_id&order=grade_level.asc`,
          token
        ),
        getRows(
          "sections?select=id,grade_level,name&order=grade_level.asc,name.asc",
          token
        ),
        getRows(
          "subjects?select=id,grade_level,name,code,is_active&order=grade_level.asc,name.asc",
          token
        ),
        getRows(
          `student_enrollments?school_year_id=eq.${encodeURIComponent(
            activeYear.id
          )}&enrollment_status=eq.active&select=id,student_id,grade_level,section_id`,
          token
        ),
        getRows(
          "profiles?select=id,full_name,lrn,role,account_status&order=full_name.asc",
          token
        ),
        getRows(
          `student_term_grades?school_year_id=eq.${encodeURIComponent(
            activeYear.id
          )}&select=id,student_id,teacher_assignment_id,school_year_id,term_no,term_grade,status,published_at,updated_at&order=term_no.asc`,
          token
        ),
      ]);

    return NextResponse.json({
      role: profile.role,
      profile,
      activeYear,
      assignments,
      sections,
      subjects,
      enrollments,
      students: (students ?? []).filter(
        (item: { role?: string; account_status?: string }) =>
          item.role === "student" && item.account_status === "active"
      ),
      grades,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load grade records." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const identity = await getIdentity(request);
  if (!identity || identity.profile.role !== "teacher") {
    return NextResponse.json({ error: "Teacher access required." }, { status: 403 });
  }

  const { token, userId } = identity;
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");

  if (action === "save_grade") {
    const assignmentId = String(body?.assignmentId ?? "");
    const studentId = String(body?.studentId ?? "");
    const termNo = Number(body?.termNo ?? 0);
    const termGrade = Number(body?.termGrade);

    if (!assignmentId || !studentId || ![1, 2, 3].includes(termNo)) {
      return NextResponse.json(
        { error: "Select a class, student, and term." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(termGrade) || termGrade < 0 || termGrade > 100) {
      return NextResponse.json(
        { error: "Enter a whole-number Term Grade from 0 to 100." },
        { status: 400 }
      );
    }

    const activeYear = await getActiveYear(token).catch(() => null);
    if (!activeYear) {
      return NextResponse.json(
        { error: "No active school year is configured." },
        { status: 409 }
      );
    }

    const assignments = await getRows(
      `teacher_assignments?id=eq.${encodeURIComponent(
        assignmentId
      )}&school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&is_active=eq.true&select=id,section_id&limit=1`,
      token
    ).catch(() => []);

    if (!assignments?.[0]) {
      return NextResponse.json(
        { error: "This class is not assigned to your Teacher account." },
        { status: 403 }
      );
    }

    const enrollments = await getRows(
      `student_enrollments?student_id=eq.${encodeURIComponent(
        studentId
      )}&school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&section_id=eq.${encodeURIComponent(
        assignments[0].section_id
      )}&enrollment_status=eq.active&select=id&limit=1`,
      token
    ).catch(() => []);

    if (!enrollments?.[0]) {
      return NextResponse.json(
        { error: "This student is not enrolled in the assigned section." },
        { status: 400 }
      );
    }

    const existing = await getRows(
      `student_term_grades?student_id=eq.${encodeURIComponent(
        studentId
      )}&teacher_assignment_id=eq.${encodeURIComponent(
        assignmentId
      )}&term_no=eq.${termNo}&select=id,status&limit=1`,
      token
    ).catch(() => []);

    if (existing?.[0]?.status === "published") {
      return NextResponse.json(
        { error: "Return this term to Draft before changing a published grade." },
        { status: 409 }
      );
    }

    const payload = {
      student_id: studentId,
      teacher_assignment_id: assignmentId,
      school_year_id: activeYear.id,
      term_no: termNo,
      term_grade: termGrade,
      encoded_by: userId,
      updated_at: new Date().toISOString(),
    };

    const response = await fetch(
      existing?.[0]?.id
        ? `${SUPABASE_URL}/rest/v1/student_term_grades?id=eq.${encodeURIComponent(
            existing[0].id
          )}`
        : `${SUPABASE_URL}/rest/v1/student_term_grades`,
      {
        method: existing?.[0]?.id ? "PATCH" : "POST",
        headers: { ...headers(token), Prefer: "return=representation" },
        body: JSON.stringify(
          existing?.[0]?.id ? payload : { ...payload, status: "draft" }
        ),
        cache: "no-store",
      }
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.[0]) {
      return NextResponse.json(
        { error: "Unable to save the Term Grade." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, grade: result[0] });
  }

  if (action === "publish_term" || action === "unpublish_term") {
    const assignmentId = String(body?.assignmentId ?? "");
    const termNo = Number(body?.termNo ?? 0);

    if (!assignmentId || ![1, 2, 3].includes(termNo)) {
      return NextResponse.json(
        { error: "Select a class and term." },
        { status: 400 }
      );
    }

    const activeYear = await getActiveYear(token).catch(() => null);
    if (!activeYear) {
      return NextResponse.json(
        { error: "No active school year is configured." },
        { status: 409 }
      );
    }

    const assignments = await getRows(
      `teacher_assignments?id=eq.${encodeURIComponent(
        assignmentId
      )}&school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&is_active=eq.true&select=id,section_id&limit=1`,
      token
    ).catch(() => []);

    if (!assignments?.[0]) {
      return NextResponse.json(
        { error: "This class is not assigned to your Teacher account." },
        { status: 403 }
      );
    }

    const enrollments = await getRows(
      `student_enrollments?school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&section_id=eq.${encodeURIComponent(
        assignments[0].section_id
      )}&enrollment_status=eq.active&select=student_id`,
      token
    ).catch(() => []);

    const grades = await getRows(
      `student_term_grades?teacher_assignment_id=eq.${encodeURIComponent(
        assignmentId
      )}&term_no=eq.${termNo}&select=id,student_id,status`,
      token
    ).catch(() => []);

    if (action === "publish_term") {
      const gradedStudents = new Set(
        (grades ?? []).map((item: { student_id: string }) => item.student_id)
      );
      const missing = (enrollments ?? []).filter(
        (item: { student_id: string }) => !gradedStudents.has(item.student_id)
      );

      if (!enrollments?.length) {
        return NextResponse.json(
          { error: "There are no active students in this section." },
          { status: 409 }
        );
      }

      if (missing.length > 0) {
        return NextResponse.json(
          {
            error: `Complete and save Term Grades for all enrolled students before publishing. Missing: ${missing.length}.`,
          },
          { status: 409 }
        );
      }
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/student_term_grades?teacher_assignment_id=eq.${encodeURIComponent(
        assignmentId
      )}&term_no=eq.${termNo}`,
      {
        method: "PATCH",
        headers: { ...headers(token), Prefer: "return=representation" },
        body: JSON.stringify({
          status: action === "publish_term" ? "published" : "draft",
          updated_at: new Date().toISOString(),
        }),
        cache: "no-store",
      }
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to update the term publication status." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: action === "publish_term" ? "published" : "draft",
      count: Array.isArray(result) ? result.length : 0,
    });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
