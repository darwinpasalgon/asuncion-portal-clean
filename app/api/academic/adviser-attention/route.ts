import { NextRequest, NextResponse } from "next/server";
import { isTechnicalVocationalEducation } from "@/lib/subject-config";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

type AdviserSection = {
  id: string;
  grade_level: number;
  name: string;
};

type Enrollment = {
  id: string;
  student_id: string;
  grade_level: number;
  section_id: string;
  tve_major: string | null;
};

type LearnerInfo = {
  student_id: string;
  last_name: string | null;
  first_name: string | null;
  sex: string | null;
  birth_date: string | null;
  address_barangay: string | null;
  address_municipality_city: string | null;
  guardian_name: string | null;
  guardian_contact_number: string | null;
};

type Subject = {
  id: string;
  grade_level: number;
  name: string;
};

type Assignment = {
  id: string;
  section_id: string;
  subject_id: string;
  major: string | null;
};

type GradeRow = {
  student_id: string;
  teacher_assignment_id: string;
  status: "draft" | "published";
};

type AttendanceRow = {
  student_id: string;
  section_id: string;
};

type AttentionAlert = {
  id: string;
  severity: "warning" | "info";
  title: string;
  detail: string;
  count: number;
  href: string | null;
  actionLabel: string | null;
  administratorAction: boolean;
};

function authHeaders(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function getRows(path: string, token: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Query failed.");
  return response.json();
}

async function identity(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) return null;

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!userResponse.ok) return null;

  const user = await userResponse.json().catch(() => null);
  const userId = String(user?.id ?? "");
  if (!userId) return null;

  const profiles = await getRows(
    `profiles?id=eq.${encodeURIComponent(
      userId
    )}&select=id,role,account_status&limit=1`,
    token
  ).catch(() => []);

  const profile = profiles?.[0];
  if (
    !profile ||
    profile.role !== "teacher" ||
    profile.account_status !== "active"
  ) {
    return null;
  }

  return { token, userId };
}

function manilaDateParts() {
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
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const weekday = new Date(`${date}T00:00:00+08:00`).getUTCDay();
  return { date, isSchoolWeekday: weekday >= 1 && weekday <= 5 };
}

function missing(value: unknown) {
  return String(value ?? "").trim() === "";
}

export async function GET(request: NextRequest) {
  const auth = await identity(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Active Teacher access required." },
      { status: 403 }
    );
  }

  const { token, userId } = auth;

  try {
    const years = await getRows(
      "school_years?is_active=eq.true&select=id,name&limit=1",
      token
    );
    const activeYear = years?.[0] ?? null;

    if (!activeYear) {
      return NextResponse.json({
        activeYear: null,
        sections: [],
        alerts: [],
        totalAlertTypes: 0,
      });
    }

    const adviserRows = await getRows(
      `section_advisers?school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&teacher_id=eq.${encodeURIComponent(
        userId
      )}&is_active=eq.true&select=section_id`,
      token
    );

    const sectionIds = Array.from(
      new Set(
        (adviserRows ?? []).map((item: { section_id: string }) =>
          String(item.section_id)
        )
      )
    );

    if (sectionIds.length === 0) {
      return NextResponse.json({
        activeYear,
        sections: [],
        alerts: [],
        totalAlertTypes: 0,
      });
    }

    const sectionFilter = `(${sectionIds.join(",")})`;

    const [
      sectionRows,
      enrollmentRows,
      learnerInfoRows,
      subjectRows,
      assignmentRows,
    ] = await Promise.all([
      getRows(
        `sections?id=in.${encodeURIComponent(
          sectionFilter
        )}&select=id,grade_level,name`,
        token
      ),
      getRows(
        `student_enrollments?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&section_id=in.${encodeURIComponent(
          sectionFilter
        )}&enrollment_status=eq.active&select=id,student_id,grade_level,section_id,tve_major`,
        token
      ),
      getRows(
        "learner_information?select=student_id,last_name,first_name,sex,birth_date,address_barangay,address_municipality_city,guardian_name,guardian_contact_number",
        token
      ),
      getRows(
        "subjects?is_active=eq.true&select=id,grade_level,name",
        token
      ),
      getRows(
        `teacher_assignments?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&section_id=in.${encodeURIComponent(
          sectionFilter
        )}&is_active=eq.true&select=id,section_id,subject_id,major`,
        token
      ),
    ]);

    const sections = (sectionRows ?? []) as AdviserSection[];
    const enrollments = (enrollmentRows ?? []) as Enrollment[];
    const learnerInformation = (learnerInfoRows ?? []) as LearnerInfo[];
    const subjects = (subjectRows ?? []) as Subject[];
    const assignments = (assignmentRows ?? []) as Assignment[];

    const studentIds = Array.from(
      new Set(enrollments.map((item) => item.student_id))
    );
    const assignmentIds = Array.from(
      new Set(assignments.map((item) => item.id))
    );

    const studentFilter = studentIds.length
      ? `(${studentIds.join(",")})`
      : "";
    const assignmentFilter = assignmentIds.length
      ? `(${assignmentIds.join(",")})`
      : "";

    const { date: schoolDate, isSchoolWeekday } = manilaDateParts();

    const [gradeRows, attendanceRows] = await Promise.all([
      assignmentIds.length
        ? getRows(
            `student_term_grades?school_year_id=eq.${encodeURIComponent(
              activeYear.id
            )}&teacher_assignment_id=in.${encodeURIComponent(
              assignmentFilter
            )}&select=student_id,teacher_assignment_id,status`,
            token
          )
        : Promise.resolve([]),
      isSchoolWeekday && studentIds.length
        ? getRows(
            `daily_attendance?school_year_id=eq.${encodeURIComponent(
              activeYear.id
            )}&attendance_date=eq.${schoolDate}&section_id=in.${encodeURIComponent(
              sectionFilter
            )}&student_id=in.${encodeURIComponent(
              studentFilter
            )}&select=student_id,section_id`,
            token
          )
        : Promise.resolve([]),
    ]);

    const grades = (gradeRows ?? []) as GradeRow[];
    const attendance = (attendanceRows ?? []) as AttendanceRow[];
    const learnerInfoMap = new Map(
      learnerInformation.map((item) => [item.student_id, item] as const)
    );

    const alerts: AttentionAlert[] = [];

    const missingProfileLearners = enrollments.filter((enrollment) => {
      const info = learnerInfoMap.get(enrollment.student_id);
      if (!info) return true;
      return [
        info.last_name,
        info.first_name,
        info.sex,
        info.birth_date,
        info.address_barangay,
        info.address_municipality_city,
        info.guardian_name,
        info.guardian_contact_number,
      ].some(missing);
    });

    if (missingProfileLearners.length > 0) {
      alerts.push({
        id: "learner-information",
        severity: "warning",
        title: "Incomplete Learner Information",
        detail:
          "Some learners are missing important profile, address, birth date, sex, or guardian information.",
        count: missingProfileLearners.length,
        href: "/portal/my-students",
        actionLabel: "Review My Students",
        administratorAction: false,
      });
    }

    const missingTveMajors = enrollments.filter(
      (enrollment) =>
        [8, 9, 10].includes(enrollment.grade_level) &&
        missing(enrollment.tve_major)
    );

    if (missingTveMajors.length > 0) {
      alerts.push({
        id: "tve-major",
        severity: "warning",
        title: "TVE Major Not Assigned",
        detail:
          "Assign each Grade 8–10 learner's TVE Major before TVE grades can be encoded correctly.",
        count: missingTveMajors.length,
        href: "/portal/my-students",
        actionLabel: "Assign TVE Majors",
        administratorAction: false,
      });
    }

    const missingSubjectSetup: Array<{
      section: AdviserSection;
      subject: Subject;
    }> = [];

    for (const section of sections) {
      const gradeSubjects = subjects.filter(
        (subject) => subject.grade_level === section.grade_level
      );
      const sectionAssignments = assignments.filter(
        (assignment) => assignment.section_id === section.id
      );

      for (const subject of gradeSubjects) {
        if (
          !sectionAssignments.some(
            (assignment) => assignment.subject_id === subject.id
          )
        ) {
          missingSubjectSetup.push({ section, subject });
        }
      }
    }

    if (missingSubjectSetup.length > 0) {
      const examples = missingSubjectSetup
        .slice(0, 3)
        .map(
          ({ section, subject }) =>
            `Grade ${section.grade_level} ${section.name}: ${subject.name}`
        )
        .join("; ");

      alerts.push({
        id: "subject-setup",
        severity: "warning",
        title: "Subjects Still Need Teacher Setup",
        detail: `Administrator action is needed before these subjects can appear in Grades. ${examples}${
          missingSubjectSetup.length > 3 ? "; and more." : "."
        }`,
        count: missingSubjectSetup.length,
        href: null,
        actionLabel: null,
        administratorAction: true,
      });
    }

    const tveSubjectByGrade = new Map<number, Subject>();
    for (const subject of subjects) {
      if (isTechnicalVocationalEducation(subject.name)) {
        tveSubjectByGrade.set(subject.grade_level, subject);
      }
    }

    const learnersWithoutMatchingTveTeacher = enrollments.filter((enrollment) => {
      if (
        ![8, 9, 10].includes(enrollment.grade_level) ||
        missing(enrollment.tve_major)
      ) {
        return false;
      }

      const tveSubject = tveSubjectByGrade.get(enrollment.grade_level);
      if (!tveSubject) return false;

      return !assignments.some(
        (assignment) =>
          assignment.section_id === enrollment.section_id &&
          assignment.subject_id === tveSubject.id &&
          String(assignment.major ?? "") === String(enrollment.tve_major ?? "")
      );
    });

    if (learnersWithoutMatchingTveTeacher.length > 0) {
      alerts.push({
        id: "tve-teacher",
        severity: "warning",
        title: "TVE Teacher Setup Missing",
        detail:
          "Some learners have a TVE Major, but the section has no matching active TVE Subject Teacher assignment for that major. Administrator action is needed.",
        count: learnersWithoutMatchingTveTeacher.length,
        href: null,
        actionLabel: null,
        administratorAction: true,
      });
    }

    if (isSchoolWeekday && enrollments.length > 0) {
      const attendedToday = new Set(
        attendance.map((item) => item.student_id)
      );
      const missingAttendance = enrollments.filter(
        (enrollment) => !attendedToday.has(enrollment.student_id)
      );

      if (missingAttendance.length > 0) {
        alerts.push({
          id: "attendance",
          severity: "warning",
          title: "Attendance Not Yet Tagged Today",
          detail:
            "These learners do not have an attendance status for today's school date.",
          count: missingAttendance.length,
          href: "/portal/attendance",
          actionLabel: "Open Attendance",
          administratorAction: false,
        });
      }
    }

    const draftGrades = grades.filter((grade) => grade.status === "draft");
    if (draftGrades.length > 0) {
      alerts.push({
        id: "draft-grades",
        severity: "warning",
        title: "Draft Grades Waiting to Publish",
        detail:
          "Saved Term Grades are still in Draft status and are not yet visible as official published grades.",
        count: draftGrades.length,
        href: "/portal/grades",
        actionLabel: "Review Grades",
        administratorAction: false,
      });
    }

    if (assignments.length > 0 && enrollments.length > 0) {
      const publishedStudents = new Set(
        grades
          .filter((grade) => grade.status === "published")
          .map((grade) => grade.student_id)
      );
      const learnersWithNoPublishedGrades = enrollments.filter(
        (enrollment) => !publishedStudents.has(enrollment.student_id)
      );

      if (learnersWithNoPublishedGrades.length > 0) {
        alerts.push({
          id: "no-published-grades",
          severity: "info",
          title: "Learners With No Published Grades Yet",
          detail:
            "These learners do not currently have any published Term Grade in the active school year.",
          count: learnersWithNoPublishedGrades.length,
          href: "/portal/grades",
          actionLabel: "Open Grades",
          administratorAction: false,
        });
      }
    }

    return NextResponse.json({
      activeYear,
      schoolDate,
      isSchoolWeekday,
      sections,
      alerts,
      totalAlertTypes: alerts.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to check Adviser attention items." },
      { status: 500 }
    );
  }
}
