import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-access";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

// Read-only, administrator-scoped counts. This service never creates
// attendance, learner majors, grade entries or teaching assignments.
type Item = Record<string, unknown>;
const MAX_ROWS = 100000;
const PAGE_SIZE = 1000;
function authHeaders(token: string) {
  return { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: "Bearer " + token };
}
async function pagedRows(path: string, token: string): Promise<Item[]> {
  const records: Item[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const response = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
      headers: { ...authHeaders(token), Range: String(offset) + "-" + String(offset + PAGE_SIZE - 1) },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Unable to load a JHS readiness data source.");
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error("Invalid JHS readiness response.");
    records.push(...page);
    if (page.length < PAGE_SIZE) return records;
  }
  throw new Error("JHS readiness data source exceeds safe report limit.");
}
const text = (value: unknown) => String(value ?? "").trim();
function monthStartManila() {
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Manila",
  }).format(new Date());
  return today.slice(0, 7) + "-01";
}
export async function GET(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token || !(await hasAdminPermission(token, "school_setup.manage") ||
                  await hasAdminPermission(token, "teaching.manage") ||
                  await hasAdminPermission(token, "reports.view"))) {
    return NextResponse.json({ error: "Administrator permission required." }, { status: 403 });
  }
  try {
    const years = await pagedRows("school_years?is_active=eq.true&select=id,name&limit=1", token);
    const year = years[0];
    if (!year) return NextResponse.json({ year: null, sections: [], month: null });
    const yearId = encodeURIComponent(text(year.id));
    const month = monthStartManila();
    const [sections, enrollments, assignments, subjects, attendance, grades, schedules, rotations] =
      await Promise.all([
        pagedRows("sections?is_active=eq.true&grade_level=gte.7&grade_level=lte.10&select=id,grade_level,name&order=grade_level.asc,name.asc", token),
        pagedRows("student_enrollments?school_year_id=eq." + yearId +
          "&grade_level=gte.7&grade_level=lte.10&enrollment_status=eq.active&select=student_id,section_id,grade_level,tve_major", token),
        pagedRows("teacher_assignments?school_year_id=eq." + yearId +
          "&grade_level=gte.7&grade_level=lte.10&is_active=eq.true&select=id,section_id,subject_id,major", token),
        pagedRows("subjects?grade_level=gte.7&grade_level=lte.10&is_active=eq.true&select=id,grade_level,name,is_graded", token),
        pagedRows("daily_attendance?school_year_id=eq." + yearId + "&attendance_date=gte." + month +
          "&select=section_id,student_id,attendance_date", token),
        pagedRows("student_term_grades?school_year_id=eq." + yearId +
          "&select=student_id,teacher_assignment_id,term_no,status", token),
        pagedRows("class_schedules?is_active=eq.true&select=teacher_assignment_id", token),
        pagedRows("grade7_tve_rotations?school_year_id=eq." + yearId +
          "&is_active=eq.true&section_id=not.is.null&select=section_id,phase_no,major_code", token),
      ]);
    const assnsBySection = new Map<string, Item[]>();
    const assnById = new Map(assignments.map((row) => [text(row.id), row] as const));
    const scheduledIds = new Set(schedules.map((row) => text(row.teacher_assignment_id)));
    const enrollmentsBySection = new Map<string, Item[]>();
    const attendanceBySection = new Map<string, Item[]>();
    const gradesBySection = new Map<string, Item[]>();
    const rotationsBySection = new Map<string, Item[]>();
    for (const item of assignments) {
      const key = text(item.section_id);
      assnsBySection.set(key, [...(assnsBySection.get(key) ?? []), item]);
    }
    for (const item of enrollments) {
      const key = text(item.section_id);
      enrollmentsBySection.set(key, [...(enrollmentsBySection.get(key) ?? []), item]);
    }
    for (const item of attendance) {
      const key = text(item.section_id);
      attendanceBySection.set(key, [...(attendanceBySection.get(key) ?? []), item]);
    }
    for (const item of rotations) {
      const key = text(item.section_id);
      rotationsBySection.set(key, [...(rotationsBySection.get(key) ?? []), item]);
    }
    for (const item of grades) {
      const assignment = assnById.get(text(item.teacher_assignment_id));
      if (!assignment) continue;
      const key = text(assignment.section_id);
      gradesBySection.set(key, [...(gradesBySection.get(key) ?? []), item]);
    }
    const catalog = new Map<string, Item[]>();
    for (const subject of subjects) {
      const key = text(subject.grade_level);
      catalog.set(key, [...(catalog.get(key) ?? []), subject]);
    }
    const result = sections.map((section) => {
      const sectionId = text(section.id);
      const gradeLevel = Number(section.grade_level);
      const learners = enrollmentsBySection.get(sectionId) ?? [];
      const teacherRows = assnsBySection.get(sectionId) ?? [];
      const subjectRows = catalog.get(String(gradeLevel)) ?? [];
      const tveSubject = subjectRows.find((subject) => text(subject.name) === "Technical Vocational Education");
      const missingTve = gradeLevel === 7 ? 0 : learners.filter((row) => !text(row.tve_major)).length;
      const unmatchedTve = gradeLevel === 7 || !tveSubject ? 0 : learners.filter((row) =>
        text(row.tve_major) && !teacherRows.some((assignment) =>
          text(assignment.subject_id) === text(tveSubject.id) &&
          text(assignment.major) === text(row.tve_major)
        )
      ).length;
      // Exploratory Grade 7 uses separate rotation catalog, not individual TVE majors.
      const standardSubjects = subjectRows.filter((subject) =>
        gradeLevel !== 7 || text(subject.name) !== "Technical Vocational Education"
      );
      const missingSubjects = standardSubjects.filter((subject) =>
        !teacherRows.some((assignment) => text(assignment.subject_id) === text(subject.id))
      ).map((subject) => text(subject.name));
      const sectionAttendance = attendanceBySection.get(sectionId) ?? [];
      const enrolledIds = new Set(learners.map((row) => text(row.student_id)));
      const activeAttendance = sectionAttendance.filter((row) => enrolledIds.has(text(row.student_id)));
      const sectionGrades = (gradesBySection.get(sectionId) ?? []).filter((row) =>
        enrolledIds.has(text(row.student_id))
      );
      const rotationsRows = rotationsBySection.get(sectionId) ?? [];
      const grade7RotationsComplete = gradeLevel !== 7 ? null :
        new Set(rotationsRows.map((row) => text(row.phase_no))).size >= 5 &&
        new Set(rotationsRows.map((row) => text(row.major_code))).size >= 5;
      return {
        id: sectionId,
        gradeLevel,
        name: text(section.name),
        learners: learners.length,
        missingTve,
        unmatchedTve,
        missingSubjects,
        teachingAssignments: teacherRows.length,
        unscheduledAssignments: teacherRows.filter((row) => !scheduledIds.has(text(row.id))).length,
        attendanceDays: new Set(activeAttendance.map((row) => text(row.attendance_date))).size,
        learnersWithAttendance: new Set(activeAttendance.map((row) => text(row.student_id))).size,
        draftGradeLearners: new Set(sectionGrades.filter((row) => row.status === "draft").map((row) => text(row.student_id))).size,
        publishedGradeLearners: new Set(sectionGrades.filter((row) => row.status === "published").map((row) => text(row.student_id))).size,
        grade7RotationsComplete,
      };
    });
    return NextResponse.json({
      year: { id: year.id, name: year.name },
      month,
      generatedAt: new Date().toISOString(),
      sections: result,
      note: "Attendance days indicate days with entries, not certified complete attendance. Missing dates may include suspensions; verify each school's No Classes entries.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load JHS readiness. No records were changed." }, { status: 500 });
  }
}
