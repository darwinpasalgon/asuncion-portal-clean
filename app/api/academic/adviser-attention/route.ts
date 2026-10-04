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
  mother_tongue: string | null;
  religion: string | null;
  learning_modality: string | null;
};

type StudentProfile = {
  id: string;
  full_name: string;
  lrn: string | null;
};

type AttentionLearnerDetail = {
  studentId: string;
  fullName: string;
  lrn: string | null;
  gradeLevel: number;
  section: string;
  missingFields: string[];
  href: string;
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
  learners?: AttentionLearnerDetail[];
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

function manilaDateFromTimestamp(value: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date(value));
}

function weekdayDates(start: string, end: string) {
  if (!start || !end || start > end) return [];
  const result: string[] = [];
  const current = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (current <= last) {
    const value = current.toISOString().slice(0, 10);
    const day = current.getUTCDay();
    if (day >= 1 && day <= 5) result.push(value);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return result;
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

    const adviserRows = (await getRows(
      `section_advisers?school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&teacher_id=eq.${encodeURIComponent(
        userId
      )}&is_active=eq.true&select=section_id,assigned_at`,
      token
    )) as Array<{ section_id: string; assigned_at: string }>;

    const sectionIds: string[] = Array.from(
      new Set<string>(
        (adviserRows ?? []).map((item) => String(item.section_id))
      )
    );

    const adviserStartBySection = new Map<string, string>(
      (adviserRows ?? []).map((item) => [
        String(item.section_id),
        manilaDateFromTimestamp(item.assigned_at),
      ])
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
      studentProfileRows,
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
        "learner_information?select=student_id,last_name,first_name,sex,birth_date,mother_tongue,religion,learning_modality",
        token
      ),
      getRows(
        "profiles?role=eq.student&account_status=eq.active&select=id,full_name,lrn",
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
    const studentProfiles = (studentProfileRows ?? []) as StudentProfile[];
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

    const earliestAttendanceStart = Array.from(
      adviserStartBySection.values()
    ).sort()[0];

    const [gradeRows, attendanceRows, exclusionRows] = await Promise.all([
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
      earliestAttendanceStart && studentIds.length
        ? getRows(
            `daily_attendance?school_year_id=eq.${encodeURIComponent(
              activeYear.id
            )}&attendance_date=gte.${earliestAttendanceStart}&attendance_date=lte.${schoolDate}&section_id=in.${encodeURIComponent(
              sectionFilter
            )}&student_id=in.${encodeURIComponent(
              studentFilter
            )}&select=student_id,section_id,attendance_date`,
            token
          )
        : Promise.resolve([]),
      earliestAttendanceStart
        ? getRows(
            `attendance_day_exclusions?school_year_id=eq.${encodeURIComponent(
              activeYear.id
            )}&attendance_date=gte.${earliestAttendanceStart}&attendance_date=lte.${schoolDate}&section_id=in.${encodeURIComponent(
              sectionFilter
            )}&select=section_id,attendance_date`,
            token
          )
        : Promise.resolve([]),
    ]);

    const grades = (gradeRows ?? []) as GradeRow[];
    const attendance = (attendanceRows ?? []) as Array<
      AttendanceRow & { attendance_date: string }
    >;
    const exclusions = (exclusionRows ?? []) as Array<{
      section_id: string;
      attendance_date: string;
    }>;
    const learnerInfoMap = new Map(
      learnerInformation.map((item) => [item.student_id, item] as const)
    );
    const studentProfileMap = new Map(
      studentProfiles.map((item) => [item.id, item] as const)
    );
    const sectionMap = new Map(
      sections.map((item) => [item.id, item] as const)
    );

    const alerts: AttentionAlert[] = [];

    const requiredLearnerFields = enrollments
      .map((enrollment) => {
        const info = learnerInfoMap.get(enrollment.student_id);
        const profile = studentProfileMap.get(enrollment.student_id);
        const section = sectionMap.get(enrollment.section_id);
        const missingFields: string[] = [];

        if (!info || missing(info.last_name)) missingFields.push("Last Name");
        if (!info || missing(info.first_name)) missingFields.push("First Name");
        if (!info || missing(info.sex)) missingFields.push("Sex");
        if (!info || missing(info.birth_date)) missingFields.push("Birth Date");
        if (!info || missing(info.mother_tongue)) {
          missingFields.push("Mother Tongue");
        }
        if (!info || missing(info.religion)) missingFields.push("Religion");
        if (!info || missing(info.learning_modality)) {
          missingFields.push("Learning Modality");
        }
        if (
          [8, 9, 10].includes(enrollment.grade_level) &&
          missing(enrollment.tve_major)
        ) {
          missingFields.push("TVE Major");
        }

        const fullName =
          profile?.full_name ||
          [info?.last_name, info?.first_name].filter(Boolean).join(", ") ||
          "Unnamed Learner";

        return {
          studentId: enrollment.student_id,
          fullName,
          lrn: profile?.lrn ?? null,
          gradeLevel: enrollment.grade_level,
          section: section?.name ?? "Section Not Found",
          missingFields,
          href: `/portal/my-students?student=${encodeURIComponent(
            enrollment.student_id
          )}`,
          sex: info?.sex ?? null,
          lastName: info?.last_name ?? fullName,
          firstName: info?.first_name ?? fullName,
        };
      })
      .filter((item) => item.missingFields.length > 0)
      .sort((a, b) => {
        const sexRank = (value: string | null) => {
          const normalized = String(value ?? "").trim().toLowerCase();
          if (normalized === "m" || normalized === "male") return 0;
          if (normalized === "f" || normalized === "female") return 1;
          return 2;
        };

        const bySex = sexRank(a.sex) - sexRank(b.sex);
        if (bySex !== 0) return bySex;

        const byLast = a.lastName.localeCompare(b.lastName, undefined, {
          sensitivity: "base",
        });
        if (byLast !== 0) return byLast;

        return a.firstName.localeCompare(b.firstName, undefined, {
          sensitivity: "base",
        });
      })
      .map(({ sex, lastName, firstName, ...item }) => item);

    if (requiredLearnerFields.length > 0) {
      alerts.push({
        id: "learner-information",
        severity: "warning",
        title: "Required Learner Information Missing",
        detail:
          "Review the learners below. The dashboard lists the exact required field(s) missing from each learner record.",
        count: requiredLearnerFields.length,
        href: "/portal/my-students",
        actionLabel: "Open My Students",
        administratorAction: false,
        learners: requiredLearnerFields,
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

    const expectedBySection = new Map<string, number>();
    for (const enrollment of enrollments) {
      expectedBySection.set(
        enrollment.section_id,
        (expectedBySection.get(enrollment.section_id) ?? 0) + 1
      );
    }

    const recordedBySectionDate = new Map<string, Set<string>>();
    for (const row of attendance) {
      const key = `${row.section_id}|${row.attendance_date}`;
      if (!recordedBySectionDate.has(key)) {
        recordedBySectionDate.set(key, new Set<string>());
      }
      recordedBySectionDate.get(key)?.add(row.student_id);
    }

    const excludedDateKeys = new Set(
      exclusions.map(
        (item) => `${item.section_id}|${item.attendance_date}`
      )
    );

    const pendingAttendanceDates: Array<{
      sectionId: string;
      date: string;
    }> = [];

    for (const sectionId of sectionIds) {
      const start = adviserStartBySection.get(sectionId);
      const expected = expectedBySection.get(sectionId) ?? 0;
      if (!start || expected === 0) continue;

      for (const attendanceDate of weekdayDates(start, schoolDate)) {
        const key = `${sectionId}|${attendanceDate}`;
        if (excludedDateKeys.has(key)) continue;
        const recorded = recordedBySectionDate.get(key)?.size ?? 0;
        if (recorded < expected) {
          pendingAttendanceDates.push({
            sectionId,
            date: attendanceDate,
          });
        }
      }
    }

    pendingAttendanceDates.sort((a, b) => b.date.localeCompare(a.date));

    if (pendingAttendanceDates.length > 0) {
      const latest = pendingAttendanceDates[0];
      alerts.push({
        id: "attendance",
        severity: "warning",
        title: "Attendance Needs Attention",
        detail:
          `${pendingAttendanceDates.length} weekday(s) still need complete attendance or a No Classes designation.`,
        count: pendingAttendanceDates.length,
        href: `/portal/attendance?date=${encodeURIComponent(
          latest.date
        )}&section=${encodeURIComponent(latest.sectionId)}`,
        actionLabel: "Review Attendance",
        administratorAction: false,
      });
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
