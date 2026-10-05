import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-access";
import {
  isTechnicalVocationalEducation,
  requiresTechnicalVocationalMajor,
} from "@/lib/subject-config";
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

async function getAllRows(path: string, token: string, pageSize = 1000) {
  const rows: unknown[] = [];
  let start = 0;

  while (true) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        ...headers(token),
        Range: `${start}-${start + pageSize - 1}`,
      },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Paged query failed.");

    const page = await response.json().catch(() => []);
    if (!Array.isArray(page)) break;
    rows.push(...page);
    if (page.length < pageSize) break;

    start += pageSize;
    if (start >= 100000) throw new Error("Setup query is too large.");
  }

  return rows;
}

type Section = {
  id: string;
  grade_level: number;
  name: string;
  is_active: boolean;
};

type Subject = {
  id: string;
  grade_level: number;
  name: string;
  is_active: boolean;
  is_graded: boolean;
};

type Enrollment = {
  student_id: string;
  grade_level: number;
  section_id: string;
  tve_major: string | null;
};

type Assignment = {
  id: string;
  teacher_id: string;
  grade_level: number;
  section_id: string;
  subject_id: string;
  major: string | null;
  is_active: boolean;
};

type Schedule = {
  teacher_assignment_id: string;
  is_active: boolean;
};

type Teacher = {
  id: string;
  full_name: string;
};

type SetupItem = {
  key: string;
  grade_level: number;
  section_id: string;
  section: string;
  subject_id: string;
  subject: string;
  major: string | null;
  teacher_id?: string;
  teacher_name?: string;
};

export async function GET(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const [canTeach, canSchedule] = await Promise.all([
    hasAdminPermission(token, "teaching.manage"),
    hasAdminPermission(token, "schedules.manage"),
  ]);

  if (!canTeach && !canSchedule) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  try {
    const years = await getRows(
      "school_years?is_active=eq.true&select=id,name&limit=1",
      token
    );
    const activeYear = years?.[0] ?? null;

    if (!activeYear) {
      return NextResponse.json({
        activeYear: null,
        unassigned: [],
        unscheduled: [],
        unassigned_count: 0,
        unscheduled_count: 0,
      });
    }

    const [
      sectionsRaw,
      subjectsRaw,
      enrollmentsRaw,
      assignmentsRaw,
      schedulesRaw,
      teachersRaw,
    ] = await Promise.all([
      getRows(
        "sections?is_active=eq.true&select=id,grade_level,name,is_active&order=grade_level.asc,name.asc",
        token
      ),
      getRows(
        "subjects?is_active=eq.true&select=id,grade_level,name,is_active,is_graded&order=grade_level.asc,name.asc",
        token
      ),
      getAllRows(
        `student_enrollments?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&enrollment_status=eq.active&select=student_id,grade_level,section_id,tve_major`,
        token
      ),
      getAllRows(
        `teacher_assignments?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&is_active=eq.true&select=id,teacher_id,grade_level,section_id,subject_id,major,is_active`,
        token
      ),
      getAllRows(
        "class_schedules?is_active=eq.true&select=teacher_assignment_id,is_active",
        token
      ),
      getRows(
        "profiles?account_status=eq.active&role=neq.student&select=id,full_name",
        token
      ),
    ]);

    const sections = sectionsRaw as Section[];
    const subjects = subjectsRaw as Subject[];
    const enrollments = enrollmentsRaw as Enrollment[];
    const assignments = assignmentsRaw as Assignment[];
    const schedules = schedulesRaw as Schedule[];
    const teachers = teachersRaw as Teacher[];

    const enrollmentSectionIds = new Set(
      enrollments.map((item) => item.section_id)
    );
    const activeSections = sections.filter((section) =>
      enrollmentSectionIds.has(section.id)
    );

    const subjectMap = new Map(subjects.map((item) => [item.id, item] as const));
    const sectionMap = new Map(sections.map((item) => [item.id, item] as const));
    const teacherMap = new Map(teachers.map((item) => [item.id, item.full_name] as const));
    const scheduledAssignmentIds = new Set(
      schedules.map((item) => item.teacher_assignment_id)
    );

    const unassigned: SetupItem[] = [];

    for (const section of activeSections) {
      const gradeSubjects = subjects.filter(
        (subject) => subject.grade_level === section.grade_level
      );
      const sectionAssignments = assignments.filter(
        (assignment) => assignment.section_id === section.id
      );
      for (const subject of gradeSubjects) {
        const needsMajor = requiresTechnicalVocationalMajor(
          section.grade_level,
          subject.name
        );

        if (needsMajor && isTechnicalVocationalEducation(subject.name)) {
          const sectionEnrollments = enrollments.filter(
            (enrollment) => enrollment.section_id === section.id
          );
          const expectedMajors = new Set(
            sectionEnrollments
              .map((item) => String(item.tve_major ?? "").trim())
              .filter(Boolean)
          );

          if (
            section.grade_level === 8 &&
            ["Almasiga", "Apitong"].includes(section.name)
          ) {
            expectedMajors.add("Computer Systems Servicing");
          }
          if (section.grade_level === 8 && section.name === "Dao") {
            expectedMajors.add("Agriculture Crop Production");
          }

          if (
            expectedMajors.size === 0 &&
            !sectionAssignments.some(
              (assignment) => assignment.subject_id === subject.id
            )
          ) {
            unassigned.push({
              key: `${section.id}:${subject.id}:no-major`,
              grade_level: section.grade_level,
              section_id: section.id,
              section: section.name,
              subject_id: subject.id,
              subject: subject.name,
              major: null,
            });
          } else {
            for (const major of expectedMajors) {
              const found = sectionAssignments.some(
                (assignment) =>
                  assignment.subject_id === subject.id &&
                  String(assignment.major ?? "") === major
              );
              if (!found) {
                unassigned.push({
                  key: `${section.id}:${subject.id}:${major}`,
                  grade_level: section.grade_level,
                  section_id: section.id,
                  section: section.name,
                  subject_id: subject.id,
                  subject: subject.name,
                  major,
                });
              }
            }
          }
          continue;
        }

        if (
          !sectionAssignments.some(
            (assignment) => assignment.subject_id === subject.id
          )
        ) {
          unassigned.push({
            key: `${section.id}:${subject.id}`,
            grade_level: section.grade_level,
            section_id: section.id,
            section: section.name,
            subject_id: subject.id,
            subject: subject.name,
            major: null,
          });
        }
      }
    }

    const unscheduled: SetupItem[] = assignments
      .filter((assignment) => !scheduledAssignmentIds.has(assignment.id))
      .map((assignment) => {
        const section = sectionMap.get(assignment.section_id);
        const subject = subjectMap.get(assignment.subject_id);
        return {
          key: assignment.id,
          grade_level: assignment.grade_level,
          section_id: assignment.section_id,
          section: section?.name ?? "Unknown Section",
          subject_id: assignment.subject_id,
          subject: subject?.name ?? "Unknown Subject",
          major: assignment.major ?? null,
          teacher_id: assignment.teacher_id,
          teacher_name: teacherMap.get(assignment.teacher_id) ?? "Assigned Teacher",
        };
      })
      .sort(
        (a, b) =>
          a.grade_level - b.grade_level ||
          a.section.localeCompare(b.section) ||
          a.subject.localeCompare(b.subject) ||
          String(a.major ?? "").localeCompare(String(b.major ?? ""))
      );

    for (const item of unassigned) {
      if (
        item.grade_level === 8 &&
        ["Yakal", "Gemelina"].includes(item.section) &&
        item.subject === "Araling Panlipunan"
      ) {
        item.teacher_name = "LEAH ENRIQUEZ ALUMBRO";
      }
      if (
        item.grade_level === 8 &&
        item.section === "Dao" &&
        item.subject === "Technical Vocational Education" &&
        item.major === "Agriculture Crop Production"
      ) {
        item.teacher_name = "JO-ANN DARUNDAY VILA";
      }
    }

    unassigned.sort(
      (a, b) =>
        a.grade_level - b.grade_level ||
        a.section.localeCompare(b.section) ||
        a.subject.localeCompare(b.subject) ||
        String(a.major ?? "").localeCompare(String(b.major ?? ""))
    );

    return NextResponse.json({
      activeYear,
      unassigned,
      unscheduled,
      unassigned_count: unassigned.length,
      unscheduled_count: unscheduled.length,
      can_teach: canTeach,
      can_schedule: canSchedule,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to check teaching and schedule setup." },
      { status: 500 }
    );
  }
}
