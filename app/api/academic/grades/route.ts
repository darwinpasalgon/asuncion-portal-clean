import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";
import { isTechnicalVocationalEducation } from "@/lib/subject-config";

function isMapeh(name?: string | null) {
  return String(name ?? "").trim().toLowerCase() === "mapeh";
}

function wholeGrade(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 100
    ? number
    : null;
}

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

async function teacherAdvisesSection(
  token: string,
  userId: string,
  schoolYearId: string,
  sectionId: string
) {
  const rows = await getRows(
    `section_advisers?teacher_id=eq.${encodeURIComponent(
      userId
    )}&school_year_id=eq.${encodeURIComponent(
      schoolYearId
    )}&section_id=eq.${encodeURIComponent(
      sectionId
    )}&is_active=eq.true&select=id&limit=1`,
    token
  ).catch(() => []);
  return Boolean(rows?.[0]);
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

    const [
      assignments,
      sections,
      subjects,
      enrollments,
      students,
      learnerInformation,
      grades,
      advisers,
    ] = await Promise.all([
        getRows(
          `teacher_assignments?school_year_id=eq.${encodeURIComponent(
            activeYear.id
          )}&is_active=eq.true&select=id,teacher_id,grade_level,section_id,subject_id,major&order=grade_level.asc`,
          token
        ),
        getRows(
          "sections?select=id,grade_level,name&order=grade_level.asc,name.asc",
          token
        ),
        getRows(
          "subjects?select=id,grade_level,name,is_active,is_graded,include_in_school_forms&order=grade_level.asc,name.asc",
          token
        ),
        getRows(
          `student_enrollments?school_year_id=eq.${encodeURIComponent(
            activeYear.id
          )}&enrollment_status=eq.active&select=id,student_id,grade_level,section_id,tve_major`,
          token
        ),
        getRows(
          "profiles?select=id,full_name,lrn,role,account_status",
          token
        ),
        getRows(
          "learner_information?select=student_id,last_name,first_name,middle_name,name_extension,sex",
          token
        ),
        getRows(
          `student_term_grades?school_year_id=eq.${encodeURIComponent(
            activeYear.id
          )}&select=id,student_id,teacher_assignment_id,school_year_id,term_no,term_grade,status,published_at,updated_at&order=term_no.asc`,
          token
        ),
        profile.role === "teacher"
          ? getRows(
              `section_advisers?teacher_id=eq.${encodeURIComponent(
                identity.userId
              )}&school_year_id=eq.${encodeURIComponent(
                activeYear.id
              )}&is_active=eq.true&select=id,section_id`,
              token
            )
          : Promise.resolve([]),
      ]);

    const advisedSections = new Set(
      (advisers ?? []).map((item: { section_id: string }) => item.section_id)
    );
    type LearnerInfo = {
      student_id: string;
      last_name?: string | null;
      first_name?: string | null;
      middle_name?: string | null;
      name_extension?: string | null;
      sex?: string | null;
    };

    const learnerInfoMap = new Map<string, LearnerInfo>(
      ((learnerInformation ?? []) as LearnerInfo[]).map((item) => [
        item.student_id,
        item,
      ])
    );

    const gradeStudents = (students ?? [])
      .filter(
        (item: { role?: string; account_status?: string }) =>
          item.role === "student" && item.account_status === "active"
      )
      .map(
        (student: {
          id: string;
          full_name: string;
          lrn?: string | null;
          role?: string;
          account_status?: string;
        }) => {
          const info = learnerInfoMap.get(student.id);
          return {
            id: student.id,
            full_name: student.full_name,
            lrn: student.lrn ?? null,
            last_name: info?.last_name ?? null,
            first_name: info?.first_name ?? null,
            middle_name: info?.middle_name ?? null,
            name_extension: info?.name_extension ?? null,
            sex: info?.sex ?? null,
          };
        }
      );

    const ownEnrollment =
      profile.role === "student"
        ? (enrollments ?? []).find(
            (item: { student_id: string }) => item.student_id === identity.userId
          ) ?? null
        : null;

    const adviserSectionDetails =
      profile.role === "teacher"
        ? (sections ?? []).filter((item: { id: string }) =>
            advisedSections.has(item.id)
          )
        : [];

    const gradedSubjectIds = new Set(
      (subjects ?? [])
        .filter((item: { id: string; is_graded?: boolean }) => item.is_graded !== false)
        .map((item: { id: string }) => item.id)
    );
    const gradedAssignments = (assignments ?? []).filter(
      (item: { subject_id: string }) => gradedSubjectIds.has(item.subject_id)
    );
    const gradedAssignmentIds = new Set(
      gradedAssignments.map((item: { id: string }) => item.id)
    );
    const visibleGrades = (grades ?? []).filter(
      (item: { teacher_assignment_id: string }) =>
        gradedAssignmentIds.has(item.teacher_assignment_id)
    );

    const gradeAssignments =
      profile.role === "teacher"
        ? gradedAssignments.filter(
            (item: { section_id: string }) => advisedSections.has(item.section_id)
          )
        : profile.role === "student" && ownEnrollment
          ? gradedAssignments.filter(
              (item: { section_id: string; major?: string | null }) =>
                item.section_id === ownEnrollment.section_id &&
                (!item.major || item.major === ownEnrollment.tve_major)
            )
          : [];

    return NextResponse.json({
      role: profile.role,
      profile,
      activeYear,
      isSectionAdviser: profile.role === "teacher" && advisedSections.size > 0,
      adviserSections: adviserSectionDetails,
      assignments: gradeAssignments,
      sections,
      subjects: (subjects ?? []).filter(
        (item: { is_graded?: boolean }) => item.is_graded !== false
      ),
      enrollments,
      students: gradeStudents,
      grades: visibleGrades,
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

    if (!assignmentId || !studentId || ![1, 2, 3].includes(termNo)) {
      return NextResponse.json(
        { error: "Select a class, student, and term." },
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
      )}&is_active=eq.true&select=id,section_id,subject_id,grade_level,major&limit=1`,
      token
    ).catch(() => []);

    if (!assignments?.[0]) {
      return NextResponse.json(
        { error: "This class is not available to your Teacher account." },
        { status: 403 }
      );
    }

    const selectedAssignment = assignments[0];

    const canGrade = await teacherAdvisesSection(
      token,
      userId,
      activeYear.id,
      selectedAssignment.section_id
    );
    if (!canGrade) {
      return NextResponse.json(
        { error: "Only the active Section Adviser can encode grades for this section." },
        { status: 403 }
      );
    }

    const subjectRows = await getRows(
      `subjects?id=eq.${encodeURIComponent(
        selectedAssignment.subject_id
      )}&select=id,name,is_graded&limit=1`,
      token
    ).catch(() => []);
    const subjectName = String(subjectRows?.[0]?.name ?? "");
    if (subjectRows?.[0]?.is_graded === false) {
      return NextResponse.json(
        { error: "This subject is for schedule/teaching load only and does not accept grades." },
        { status: 409 }
      );
    }
    const isTveSubject = isTechnicalVocationalEducation(subjectName);
    const isMapehSubject = isMapeh(subjectName);

    const enrollments = await getRows(
      `student_enrollments?student_id=eq.${encodeURIComponent(
        studentId
      )}&school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&section_id=eq.${encodeURIComponent(
        selectedAssignment.section_id
      )}&enrollment_status=eq.active&select=id,tve_major&limit=1`,
      token
    ).catch(() => []);

    if (!enrollments?.[0]) {
      return NextResponse.json(
        { error: "This student is not enrolled in the assigned section." },
        { status: 400 }
      );
    }

    let targetAssignment = selectedAssignment;

    if (isTveSubject) {
      const learnerMajor = String(enrollments[0].tve_major ?? "").trim();
      if (!learnerMajor) {
        return NextResponse.json(
          { error: "Assign this learner's TVE Major in My Students before encoding the TVE grade." },
          { status: 409 }
        );
      }

      const matchingAssignments = await getRows(
        `teacher_assignments?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&section_id=eq.${encodeURIComponent(
          selectedAssignment.section_id
        )}&subject_id=eq.${encodeURIComponent(
          selectedAssignment.subject_id
        )}&major=eq.${encodeURIComponent(
          learnerMajor
        )}&is_active=eq.true&select=id,section_id,subject_id,grade_level,major&limit=1`,
        token
      ).catch(() => []);

      if (!matchingAssignments?.[0]) {
        return NextResponse.json(
          {
            error:
              "No active TVE Subject Teacher assignment matches this learner's TVE Major.",
          },
          { status: 409 }
        );
      }
      targetAssignment = matchingAssignments[0];
    }

    let termGrade: number;
    let componentPayload: Record<string, number | null> = {
      music_grade: null,
      arts_grade: null,
      physical_education_grade: null,
      health_grade: null,
    };

    if (isMapehSubject) {
      const music = wholeGrade(body?.components?.music);
      const arts = wholeGrade(body?.components?.arts);
      const physicalEducation = wholeGrade(body?.components?.physicalEducation);
      const health = wholeGrade(body?.components?.health);

      if (
        music === null ||
        arts === null ||
        physicalEducation === null ||
        health === null
      ) {
        return NextResponse.json(
          {
            error:
              "Enter whole-number grades from 0 to 100 for Music, Arts, Physical Education, and Health.",
          },
          { status: 400 }
        );
      }

      termGrade = Math.round((music + arts + physicalEducation + health) / 4);
      componentPayload = {
        music_grade: music,
        arts_grade: arts,
        physical_education_grade: physicalEducation,
        health_grade: health,
      };
    } else {
      const directGrade = wholeGrade(body?.termGrade);
      if (directGrade === null) {
        return NextResponse.json(
          { error: "Enter a whole-number Term Grade from 0 to 100." },
          { status: 400 }
        );
      }
      termGrade = directGrade;
    }

    const existing = await getRows(
      `student_term_grades?student_id=eq.${encodeURIComponent(
        studentId
      )}&teacher_assignment_id=eq.${encodeURIComponent(
        targetAssignment.id
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
      teacher_assignment_id: targetAssignment.id,
      school_year_id: activeYear.id,
      term_no: termNo,
      term_grade: termGrade,
      ...componentPayload,
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
      )}&is_active=eq.true&select=id,section_id,subject_id,grade_level,major&limit=1`,
      token
    ).catch(() => []);

    if (!assignments?.[0]) {
      return NextResponse.json(
        { error: "This class is not available to your Teacher account." },
        { status: 403 }
      );
    }

    const selectedAssignment = assignments[0];

    const canGrade = await teacherAdvisesSection(
      token,
      userId,
      activeYear.id,
      selectedAssignment.section_id
    );
    if (!canGrade) {
      return NextResponse.json(
        { error: "Only the active Section Adviser can publish grades for this section." },
        { status: 403 }
      );
    }

    const subjectRows = await getRows(
      `subjects?id=eq.${encodeURIComponent(
        selectedAssignment.subject_id
      )}&select=id,name,is_graded&limit=1`,
      token
    ).catch(() => []);
    const subjectName = String(subjectRows?.[0]?.name ?? "");
    if (subjectRows?.[0]?.is_graded === false) {
      return NextResponse.json(
        { error: "This subject is for schedule/teaching load only and does not accept grades." },
        { status: 409 }
      );
    }
    const isTveSubject = isTechnicalVocationalEducation(subjectName);
    const isMapehSubject = isMapeh(subjectName);

    let targetAssignments = [selectedAssignment];
    if (isTveSubject) {
      targetAssignments = await getRows(
        `teacher_assignments?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&section_id=eq.${encodeURIComponent(
          selectedAssignment.section_id
        )}&subject_id=eq.${encodeURIComponent(
          selectedAssignment.subject_id
        )}&is_active=eq.true&select=id,section_id,subject_id,grade_level,major`,
        token
      ).catch(() => []);

      if (!targetAssignments.length) {
        return NextResponse.json(
          { error: "No active TVE assignments are configured for this section." },
          { status: 409 }
        );
      }
    }

    const enrollments = await getRows(
      `student_enrollments?school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&section_id=eq.${encodeURIComponent(
        selectedAssignment.section_id
      )}&enrollment_status=eq.active&select=student_id,tve_major`,
      token
    ).catch(() => []);

    const targetIds = targetAssignments.map((item: { id: string }) => item.id);
    const inFilter = `(${targetIds.join(",")})`;
    const grades = await getRows(
      `student_term_grades?teacher_assignment_id=in.${encodeURIComponent(
        inFilter
      )}&term_no=eq.${termNo}&select=id,student_id,teacher_assignment_id,status,music_grade,arts_grade,physical_education_grade,health_grade`,
      token
    ).catch(() => []);

    if (action === "publish_term") {
      if (!enrollments?.length) {
        return NextResponse.json(
          { error: "There are no active students in this section." },
          { status: 409 }
        );
      }

      const assignmentByMajor = new Map(
        targetAssignments
          .filter((item: { major?: string | null }) => Boolean(item.major))
          .map((item: { id: string; major?: string | null }) => [
            String(item.major),
            item.id,
          ])
      );

      const missing = (enrollments ?? []).filter(
        (enrollment: { student_id: string; tve_major?: string | null }) => {
          const expectedAssignmentId = isTveSubject
            ? assignmentByMajor.get(String(enrollment.tve_major ?? ""))
            : selectedAssignment.id;

          if (!expectedAssignmentId) return true;

          const grade = (grades ?? []).find(
            (item: {
              student_id: string;
              teacher_assignment_id: string;
              music_grade?: number | null;
              arts_grade?: number | null;
              physical_education_grade?: number | null;
              health_grade?: number | null;
            }) =>
              item.student_id === enrollment.student_id &&
              item.teacher_assignment_id === expectedAssignmentId
          );

          if (!grade) return true;

          if (isMapehSubject) {
            return [
              grade.music_grade,
              grade.arts_grade,
              grade.physical_education_grade,
              grade.health_grade,
            ].some((value) => value === null || value === undefined);
          }

          return false;
        }
      );

      if (missing.length > 0) {
        return NextResponse.json(
          {
            error: `Complete and save ${isMapehSubject ? "all four MAPEH components" : "Term Grades"} for all enrolled students before publishing. Missing: ${missing.length}.`,
          },
          { status: 409 }
        );
      }
    }

    let updatedCount = 0;
    for (const target of targetAssignments) {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/student_term_grades?teacher_assignment_id=eq.${encodeURIComponent(
          target.id
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
      updatedCount += Array.isArray(result) ? result.length : 0;
    }

    return NextResponse.json({
      ok: true,
      status: action === "publish_term" ? "published" : "draft",
      count: updatedCount,
    });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
