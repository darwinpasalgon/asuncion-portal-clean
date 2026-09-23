import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

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

async function getAllRows(path: string, token: string, pageSize = 1000) {
  const rows: unknown[] = [];
  let start = 0;

  while (true) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        ...authHeaders(token),
        Range: `${start}-${start + pageSize - 1}`,
      },
      cache: "no-store",
    });

    if (!response.ok) throw new Error("Paged query failed.");
    const page = await response.json().catch(() => []);
    rows.push(...page);

    if (!Array.isArray(page) || page.length < pageSize) break;
    start += pageSize;

    if (start >= 500000) {
      throw new Error("Report is too large. Apply more filters.");
    }
  }

  return rows;
}

async function activeYear(token: string) {
  const rows = await getRows(
    "school_years?is_active=eq.true&select=id,name,start_year,end_year&limit=1",
    token
  );
  return rows?.[0] ?? null;
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.floor((end - start) / 86400000);
}

type Assignment = {
  id: string;
  teacher_id: string;
  grade_level: number;
  section_id: string;
  subject_id: string;
  is_active: boolean;
};

type Enrollment = {
  student_id: string;
  grade_level: number;
  section_id: string | null;
};

type GradeRow = {
  student_id: string;
  teacher_assignment_id: string;
  term_no: number;
  term_grade: number;
  status: "draft" | "published";
};

type AttendanceRow = {
  student_id: string;
  section_id: string;
  attendance_date: string;
  status: "present" | "absent" | "late" | "excused";
};

export async function GET(request: NextRequest) {
  const token = tokenFrom(request);
  if (!token || !(await isAdmin(token))) {
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  const gradeParam = request.nextUrl.searchParams.get("grade") ?? "";
  const sectionParam = request.nextUrl.searchParams.get("section") ?? "";
  const teacherParam = request.nextUrl.searchParams.get("teacher") ?? "";
  const subjectParam = request.nextUrl.searchParams.get("subject") ?? "";
  const from = request.nextUrl.searchParams.get("from") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? "";

  const gradeLevel = gradeParam ? Number(gradeParam) : null;

  if (
    gradeLevel !== null &&
    (!Number.isInteger(gradeLevel) || gradeLevel < 7 || gradeLevel > 12)
  ) {
    return NextResponse.json({ error: "Invalid grade filter." }, { status: 400 });
  }

  if ((from && !validDate(from)) || (to && !validDate(to))) {
    return NextResponse.json({ error: "Invalid attendance date range." }, { status: 400 });
  }

  if (from && to && daysBetween(from, to) < 0) {
    return NextResponse.json(
      { error: "Attendance end date must be on or after the start date." },
      { status: 400 }
    );
  }

  if (from && to && daysBetween(from, to) > 366) {
    return NextResponse.json(
      { error: "Attendance report date range cannot exceed 366 days." },
      { status: 400 }
    );
  }

  try {
    const year = await activeYear(token);

    if (!year) {
      return NextResponse.json({
        activeYear: null,
        grades: [],
        sections: [],
        subjects: [],
        teachers: [],
        assignments: [],
        students: [],
        gradeRows: [],
        attendanceRows: [],
        counts: {},
      });
    }

    const [gradeLevels, sections, subjects, teachers, assignmentRows] =
      await Promise.all([
        getRows(
          "grade_levels?select=grade_level,label,sort_order&order=sort_order.asc",
          token
        ),
        getRows(
          "sections?select=id,grade_level,name,is_active&order=grade_level.asc,name.asc",
          token
        ),
        getRows(
          "subjects?select=id,grade_level,name,code,is_active&order=grade_level.asc,name.asc",
          token
        ),
        getRows(
          "profiles?role=eq.teacher&account_status=eq.active&select=id,full_name,email&order=full_name.asc",
          token
        ),
        getAllRows(
          `teacher_assignments?school_year_id=eq.${encodeURIComponent(
            year.id
          )}&select=id,teacher_id,grade_level,section_id,subject_id,is_active`,
          token
        ),
      ]);

    const allAssignments = assignmentRows as Assignment[];
    const filteredAssignments = allAssignments.filter((assignment) => {
      if (gradeLevel !== null && assignment.grade_level !== gradeLevel) return false;
      if (sectionParam && assignment.section_id !== sectionParam) return false;
      if (teacherParam && assignment.teacher_id !== teacherParam) return false;
      if (subjectParam && assignment.subject_id !== subjectParam) return false;
      return true;
    });

    const assignmentIds = new Set(filteredAssignments.map((item) => item.id));
    const assignmentSectionIds = new Set(
      filteredAssignments.map((item) => item.section_id)
    );

    const enrollmentRows = (await getAllRows(
      `student_enrollments?school_year_id=eq.${encodeURIComponent(
        year.id
      )}&enrollment_status=eq.active&select=student_id,grade_level,section_id`,
      token
    )) as Enrollment[];

    const hasAssignmentFilters = Boolean(teacherParam || subjectParam);
    const filteredEnrollments = enrollmentRows.filter((enrollment) => {
      if (gradeLevel !== null && enrollment.grade_level !== gradeLevel) return false;
      if (sectionParam && enrollment.section_id !== sectionParam) return false;
      if (
        hasAssignmentFilters &&
        (!enrollment.section_id || !assignmentSectionIds.has(enrollment.section_id))
      ) {
        return false;
      }
      return true;
    });

    const studentIds = new Set(filteredEnrollments.map((item) => item.student_id));

    const profileRows = await getAllRows(
      "profiles?role=eq.student&account_status=eq.active&select=id,full_name,lrn",
      token
    );

    const sectionMap = new Map(
      (sections ?? []).map((item: { id: string; name: string; grade_level: number }) => [
        item.id,
        item,
      ])
    );

    const enrollmentMap = new Map(
      filteredEnrollments.map((item) => [item.student_id, item])
    );

    const students = (profileRows as Array<{
      id: string;
      full_name: string;
      lrn: string | null;
    }>)
      .filter((student) => studentIds.has(student.id))
      .map((student) => {
        const enrollment = enrollmentMap.get(student.id);
        const section = enrollment?.section_id
          ? sectionMap.get(enrollment.section_id)
          : null;

        return {
          student_id: student.id,
          full_name: student.full_name,
          lrn: student.lrn,
          grade_level: enrollment?.grade_level ?? null,
          section_id: enrollment?.section_id ?? null,
          section_name: section?.name ?? null,
        };
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

    const rawGrades = (await getAllRows(
      `student_term_grades?school_year_id=eq.${encodeURIComponent(
        year.id
      )}&select=student_id,teacher_assignment_id,term_no,term_grade,status`,
      token
    )) as GradeRow[];

    const filteredGrades = rawGrades.filter(
      (grade) =>
        studentIds.has(grade.student_id) &&
        assignmentIds.has(grade.teacher_assignment_id)
    );

    let attendancePath = `daily_attendance?school_year_id=eq.${encodeURIComponent(
      year.id
    )}&select=student_id,section_id,attendance_date,status`;

    if (from) attendancePath += `&attendance_date=gte.${from}`;
    if (to) attendancePath += `&attendance_date=lte.${to}`;

    const rawAttendance = (await getAllRows(
      attendancePath,
      token
    )) as AttendanceRow[];

    const filteredAttendance = rawAttendance.filter((row) => {
      if (!studentIds.has(row.student_id)) return false;
      if (sectionParam && row.section_id !== sectionParam) return false;
      if (hasAssignmentFilters && !assignmentSectionIds.has(row.section_id)) return false;
      return true;
    });

    const publishedGrades = filteredGrades.filter(
      (grade) => grade.status === "published"
    );

    const studentGradeMap = new Map<
      string,
      Map<string, { 1?: number; 2?: number; 3?: number }>
    >();

    for (const grade of publishedGrades) {
      if (!studentGradeMap.has(grade.student_id)) {
        studentGradeMap.set(grade.student_id, new Map());
      }
      const perAssignment = studentGradeMap.get(grade.student_id)!;
      if (!perAssignment.has(grade.teacher_assignment_id)) {
        perAssignment.set(grade.teacher_assignment_id, {});
      }
      const terms = perAssignment.get(grade.teacher_assignment_id)!;
      if (grade.term_no === 1 || grade.term_no === 2 || grade.term_no === 3) {
        terms[grade.term_no] = Number(grade.term_grade);
      }
    }

    const teacherMap = new Map(
      (teachers ?? []).map((item: { id: string; full_name: string }) => [
        item.id,
        item.full_name,
      ])
    );
    const subjectMap = new Map(
      (subjects ?? []).map(
        (item: { id: string; name: string; code: string | null }) => [item.id, item]
      )
    );
    const assignmentMap = new Map(
      filteredAssignments.map((item) => [item.id, item])
    );
    const studentMap = new Map(students.map((item) => [item.student_id, item]));

    const gradeReportRows: Array<{
      student_id: string;
      full_name: string;
      lrn: string | null;
      grade_level: number;
      section_id: string;
      section_name: string;
      assignment_id: string;
      subject_id: string;
      subject_name: string;
      subject_code: string | null;
      teacher_id: string;
      teacher_name: string;
      term1: number | null;
      term2: number | null;
      term3: number | null;
      final_grade: number | null;
      final_remark: "Passed" | "Failed" | null;
    }> = [];

    for (const [studentId, perAssignment] of studentGradeMap.entries()) {
      const student = studentMap.get(studentId);
      if (!student) continue;

      for (const [assignmentId, terms] of perAssignment.entries()) {
        const assignment = assignmentMap.get(assignmentId);
        if (!assignment) continue;

        const subject = subjectMap.get(assignment.subject_id);
        const t1 = terms[1] ?? null;
        const t2 = terms[2] ?? null;
        const t3 = terms[3] ?? null;
        const complete = t1 !== null && t2 !== null && t3 !== null;
        const finalGrade = complete
          ? Math.round((Number(t1) + Number(t2) + Number(t3)) / 3)
          : null;

        gradeReportRows.push({
          student_id: studentId,
          full_name: student.full_name,
          lrn: student.lrn,
          grade_level: assignment.grade_level,
          section_id: assignment.section_id,
          section_name: sectionMap.get(assignment.section_id)?.name ?? "",
          assignment_id: assignmentId,
          subject_id: assignment.subject_id,
          subject_name: subject?.name ?? "Subject",
          subject_code: subject?.code ?? null,
          teacher_id: assignment.teacher_id,
          teacher_name: teacherMap.get(assignment.teacher_id) ?? "Teacher",
          term1: t1,
          term2: t2,
          term3: t3,
          final_grade: finalGrade,
          final_remark:
            finalGrade === null ? null : finalGrade >= 75 ? "Passed" : "Failed",
        });
      }
    }

    const attendanceByStudent = new Map<
      string,
      {
        present: number;
        absent: number;
        late: number;
        excused: number;
        total: number;
      }
    >();

    for (const row of filteredAttendance) {
      if (!attendanceByStudent.has(row.student_id)) {
        attendanceByStudent.set(row.student_id, {
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          total: 0,
        });
      }

      const summary = attendanceByStudent.get(row.student_id)!;
      summary.total += 1;
      summary[row.status] += 1;
    }

    const attendanceRows = students.map((student) => {
      const summary =
        attendanceByStudent.get(student.student_id) ?? {
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          total: 0,
        };
      const attended = summary.present + summary.late;
      return {
        ...student,
        ...summary,
        attendance_rate:
          summary.total > 0 ? Math.round((attended / summary.total) * 100) : null,
      };
    });

    const gradeDistribution = {
      advancing: publishedGrades.filter((item) => item.term_grade >= 90).length,
      benchmarking: publishedGrades.filter(
        (item) => item.term_grade >= 80 && item.term_grade <= 89
      ).length,
      connecting: publishedGrades.filter(
        (item) => item.term_grade >= 75 && item.term_grade <= 79
      ).length,
      developing: publishedGrades.filter(
        (item) => item.term_grade >= 65 && item.term_grade <= 74
      ).length,
      emerging: publishedGrades.filter((item) => item.term_grade <= 64).length,
    };

    const attendanceTotals = filteredAttendance.reduce(
      (acc, row) => {
        acc.total += 1;
        acc[row.status] += 1;
        return acc;
      },
      { present: 0, absent: 0, late: 0, excused: 0, total: 0 }
    );

    return NextResponse.json({
      activeYear: year,
      filters: {
        grade: gradeLevel,
        section: sectionParam || null,
        teacher: teacherParam || null,
        subject: subjectParam || null,
        from: from || null,
        to: to || null,
      },
      gradeLevels,
      sections,
      subjects,
      teachers,
      assignments: filteredAssignments,
      students,
      gradeRows: gradeReportRows,
      attendanceRows,
      counts: {
        enrolled_students: students.length,
        active_assignments: filteredAssignments.filter((item) => item.is_active).length,
        published_term_grades: publishedGrades.length,
        draft_term_grades: filteredGrades.filter((item) => item.status === "draft").length,
        complete_final_grades: gradeReportRows.filter(
          (item) => item.final_grade !== null
        ).length,
        final_passed: gradeReportRows.filter(
          (item) => item.final_remark === "Passed"
        ).length,
        final_failed: gradeReportRows.filter(
          (item) => item.final_remark === "Failed"
        ).length,
      },
      gradeDistribution,
      attendanceTotals,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("too large")
        ? error.message
        : "Unable to load reports and analytics.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
