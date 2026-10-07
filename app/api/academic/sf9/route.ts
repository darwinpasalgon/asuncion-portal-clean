import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

type JsonRow = Record<string, any>;

const MONTHS = [
  { key: "Jun", month: 6 },
  { key: "Jul", month: 7 },
  { key: "Aug", month: 8 },
  { key: "Sep", month: 9 },
  { key: "Oct", month: 10 },
  { key: "Nov", month: 11 },
  { key: "Dec", month: 12 },
  { key: "Jan", month: 1 },
  { key: "Feb", month: 2 },
  { key: "Mar", month: 3 },
  { key: "Apr", month: 4 },
];

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
  if (!response.ok) throw new Error(`Query failed: ${response.status}`);
  return response.json();
}

async function getIdentity(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) return null;

  const auth = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: headers(token),
    cache: "no-store",
  });
  if (!auth.ok) return null;

  const user = await auth.json().catch(() => null);
  const userId = String(user?.id ?? "");
  if (!userId) return null;

  const profiles = await getRows(
    `profiles?id=eq.${encodeURIComponent(
      userId
    )}&select=id,full_name,role,account_status,admin_role&limit=1`,
    token
  ).catch(() => []);

  const profile = profiles?.[0];
  if (!profile || profile.account_status !== "active") return null;
  return { token, userId, profile };
}

function inFilter(ids: string[]) {
  return `(${ids.join(",")})`;
}

function ageOnToday(birthDate?: string | null) {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() &&
      today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

function roundAverage(values: Array<number | null | undefined>) {
  const numbers = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value)
  );
  if (!numbers.length) return null;
  return Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length);
}

function normalizedSubjectName(name: string) {
  return name.trim().toLowerCase();
}

function subjectLabel(name: string, major?: string | null) {
  const normalized = normalizedSubjectName(name);
  if (normalized === "araling panlipunan") return "Araling Panlipunan (AP)";
  if (normalized === "edukasyon sa pagpapakatao") return "Values Education";
  if (normalized === "technical vocational education") {
    return `TVE  - ${String(major ?? "").trim()}`.trimEnd();
  }
  return name;
}

function subjectRank(name: string) {
  const normalized = normalizedSubjectName(name);
  const ranks: Record<string, number> = {
    filipino: 10,
    english: 20,
    mathematics: 30,
    science: 40,
    "araling panlipunan": 50,
    "edukasyon sa pagpapakatao": 60,
    "technical vocational education": 70,
    mapeh: 80,
    "technical drawing": 110,
    entrepreneurship: 120,
  };
  return ranks[normalized] ?? 100;
}

function attendancePresence(status?: string | null) {
  const value = String(status ?? "").trim().toLowerCase();
  if (value === "present") return 1;
  if (value === "absent_morning") return 0.5;
  return 0;
}

function monthKey(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return MONTHS.find((item) => item.month === parsed.getMonth() + 1)?.key ?? null;
}

export async function GET(request: NextRequest) {
  const identity = await getIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { token, userId, profile } = identity;
  const isAdmin = profile.role === "administrator";
  const isTeacher = profile.role === "teacher";

  if (!isAdmin && !isTeacher) {
    return NextResponse.json(
      { error: "SF9 printing is available only to Administrators and Section Advisers." },
      { status: 403 }
    );
  }

  try {
    const years = await getRows(
      "school_years?is_active=eq.true&select=id,name,start_year,end_year&limit=1",
      token
    );
    const activeYear = years?.[0] ?? null;
    if (!activeYear) {
      return NextResponse.json({
        activeYear: null,
        sections: [],
        students: [],
      });
    }

    let adviserRows: JsonRow[] = [];
    if (isTeacher) {
      adviserRows = await getRows(
        `section_advisers?teacher_id=eq.${encodeURIComponent(
          userId
        )}&school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&is_active=eq.true&select=id,section_id,teacher_id`,
        token
      ).catch(() => []);

      if (!adviserRows.length) {
        return NextResponse.json(
          { error: "Only active Section Advisers can print SF9." },
          { status: 403 }
        );
      }
    }

    const sectionId = request.nextUrl.searchParams.get("sectionId") ?? "";
    const studentIdsRaw = request.nextUrl.searchParams.get("studentIds") ?? "";
    const requestedStudentIds = studentIdsRaw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 2);

    const allSections = await getRows(
      "sections?is_active=eq.true&grade_level=gte.7&grade_level=lte.10&select=id,grade_level,name&order=grade_level.asc,name.asc",
      token
    );

    const allowedSectionIds = isAdmin
      ? new Set((allSections ?? []).map((row: JsonRow) => String(row.id)))
      : new Set(adviserRows.map((row) => String(row.section_id)));

    const sections = (allSections ?? []).filter((row: JsonRow) =>
      allowedSectionIds.has(String(row.id))
    );

    if (sectionId && !allowedSectionIds.has(sectionId)) {
      return NextResponse.json(
        { error: "You do not have access to this section's SF9 records." },
        { status: 403 }
      );
    }

    if (!sectionId || requestedStudentIds.length === 0) {
      const targetSectionIds = sectionId
        ? [sectionId]
        : sections.map((row: JsonRow) => String(row.id));

      if (!targetSectionIds.length) {
        return NextResponse.json({
          activeYear,
          sections,
          students: [],
          accessMode: isAdmin ? "admin" : "adviser",
        });
      }

      const enrollments = await getRows(
        `student_enrollments?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&section_id=in.${encodeURIComponent(
          inFilter(targetSectionIds)
        )}&enrollment_status=eq.active&select=student_id,grade_level,section_id,tve_major`,
        token
      ).catch(() => []);

      const studentIds = (enrollments ?? []).map((row: JsonRow) =>
        String(row.student_id)
      );
      const profiles = studentIds.length
        ? await getRows(
            `profiles?id=in.${encodeURIComponent(
              inFilter(studentIds)
            )}&role=eq.student&account_status=eq.active&select=id,full_name,lrn`,
            token
          ).catch(() => [])
        : [];

      const profileMap = new Map(
        (profiles ?? []).map((row: JsonRow) => [String(row.id), row])
      );
      const sectionMap = new Map(
        sections.map((row: JsonRow) => [String(row.id), row])
      );

      const students = (enrollments ?? [])
        .map((row: JsonRow) => {
          const student = profileMap.get(String(row.student_id));
          const section = sectionMap.get(String(row.section_id));
          if (!student || !section) return null;
          return {
            id: student.id,
            full_name: student.full_name,
            lrn: student.lrn ?? null,
            grade_level: row.grade_level,
            section_id: row.section_id,
            section: section.name,
            tve_major: row.tve_major ?? null,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) =>
          String(a.full_name).localeCompare(String(b.full_name), undefined, {
            sensitivity: "base",
          })
        );

      return NextResponse.json({
        activeYear,
        sections,
        students,
        accessMode: isAdmin ? "admin" : "adviser",
      });
    }

    if (requestedStudentIds.length > 2) {
      return NextResponse.json(
        { error: "Select a maximum of two learners per A4 sheet." },
        { status: 400 }
      );
    }

    const enrollmentRows = await getRows(
      `student_enrollments?school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&section_id=eq.${encodeURIComponent(
        sectionId
      )}&student_id=in.${encodeURIComponent(
        inFilter(requestedStudentIds)
      )}&enrollment_status=eq.active&select=student_id,grade_level,section_id,tve_major`,
      token
    ).catch(() => []);

    if (enrollmentRows.length !== requestedStudentIds.length) {
      return NextResponse.json(
        { error: "Every selected learner must be actively enrolled in this section." },
        { status: 400 }
      );
    }

    const selectedSection = sections.find(
      (row: JsonRow) => String(row.id) === sectionId
    );
    if (!selectedSection) {
      return NextResponse.json({ error: "Section not found." }, { status: 404 });
    }

    const [
      selectedProfiles,
      learnerInformation,
      sectionAdviser,
      teacherAssignments,
      subjects,
      schoolInformation,
      sectionAttendance,
      studentAttendance,
    ] = await Promise.all([
      getRows(
        `profiles?id=in.${encodeURIComponent(
          inFilter(requestedStudentIds)
        )}&select=id,full_name,lrn,role,account_status`,
        token
      ),
      getRows(
        `learner_information?student_id=in.${encodeURIComponent(
          inFilter(requestedStudentIds)
        )}&select=student_id,last_name,first_name,middle_name,name_extension,sex,birth_date`,
        token
      ).catch(() => []),
      getRows(
        `section_advisers?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&section_id=eq.${encodeURIComponent(
          sectionId
        )}&is_active=eq.true&select=teacher_id&limit=1`,
        token
      ).catch(() => []),
      getRows(
        `teacher_assignments?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&section_id=eq.${encodeURIComponent(
          sectionId
        )}&is_active=eq.true&select=id,subject_id,major,teacher_id,grade_level`,
        token
      ).catch(() => []),
      getRows(
        `subjects?grade_level=eq.${encodeURIComponent(
          String(selectedSection.grade_level)
        )}&is_active=eq.true&select=id,name,is_graded,include_in_school_forms`,
        token
      ).catch(() => []),
      getRows(
        "school_information?select=school_name,school_id,district,division,region,school_address,school_head_name,school_head_designation&limit=1",
        token
      ).catch(() => []),
      getRows(
        `daily_attendance?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&section_id=eq.${encodeURIComponent(
          sectionId
        )}&select=attendance_date,status`,
        token
      ).catch(() => []),
      getRows(
        `daily_attendance?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&section_id=eq.${encodeURIComponent(
          sectionId
        )}&student_id=in.${encodeURIComponent(
          inFilter(requestedStudentIds)
        )}&select=student_id,attendance_date,status`,
        token
      ).catch(() => []),
    ]);

    const adviserId = String(sectionAdviser?.[0]?.teacher_id ?? "");
    const adviserProfile = adviserId
      ? (
          await getRows(
            `profiles?id=eq.${encodeURIComponent(
              adviserId
            )}&select=id,full_name&limit=1`,
            token
          ).catch(() => [])
        )?.[0] ?? null
      : null;

    const assignmentIds = (teacherAssignments ?? []).map((row: JsonRow) =>
      String(row.id)
    );
    const grades =
      assignmentIds.length > 0
        ? await getRows(
            `student_term_grades?school_year_id=eq.${encodeURIComponent(
              activeYear.id
            )}&student_id=in.${encodeURIComponent(
              inFilter(requestedStudentIds)
            )}&teacher_assignment_id=in.${encodeURIComponent(
              inFilter(assignmentIds)
            )}&status=eq.published&select=student_id,teacher_assignment_id,term_no,term_grade,music_grade,arts_grade,physical_education_grade,health_grade,status`,
            token
          ).catch(() => [])
        : [];

    const profileMap = new Map(
      (selectedProfiles ?? []).map((row: JsonRow) => [String(row.id), row])
    );
    const infoMap = new Map(
      (learnerInformation ?? []).map((row: JsonRow) => [
        String(row.student_id),
        row,
      ])
    );
    const enrollmentMap = new Map(
      enrollmentRows.map((row: JsonRow) => [String(row.student_id), row])
    );
    const subjectMap = new Map(
      (subjects ?? []).map((row: JsonRow) => [String(row.id), row])
    );

    const visibleAssignments = (teacherAssignments ?? [])
      .filter((assignment: JsonRow) => {
        const subject = subjectMap.get(String(assignment.subject_id));
        return (
          subject &&
          subject.is_graded !== false &&
          subject.include_in_school_forms !== false
        );
      })
      .sort((a: JsonRow, b: JsonRow) => {
        const aSubject = subjectMap.get(String(a.subject_id));
        const bSubject = subjectMap.get(String(b.subject_id));
        return subjectRank(String(aSubject?.name ?? "")) -
          subjectRank(String(bSubject?.name ?? ""));
      });

    const classDates = new Set<string>();
    for (const row of sectionAttendance ?? []) {
      const date = String(row.attendance_date ?? "");
      if (date) classDates.add(date);
    }

    const school = schoolInformation?.[0] ?? {};

    function gradeRecord(
      studentId: string,
      assignmentId: string,
      termNo: number
    ) {
      return (grades ?? []).find(
        (grade: JsonRow) =>
          String(grade.student_id) === studentId &&
          String(grade.teacher_assignment_id) === assignmentId &&
          Number(grade.term_no) === termNo
      );
    }

    function buildGradeRows(studentId: string, tveMajor: string | null) {
      const assignmentsBySubject = new Map<string, JsonRow[]>();
      for (const assignment of visibleAssignments) {
        const subjectId = String(assignment.subject_id);
        if (!assignmentsBySubject.has(subjectId)) {
          assignmentsBySubject.set(subjectId, []);
        }
        assignmentsBySubject.get(subjectId)!.push(assignment);
      }

      const rows: any[] = [];
      const uniqueSubjects = Array.from(assignmentsBySubject.entries())
        .map(([subjectId, assignments]) => ({
          subject: subjectMap.get(subjectId),
          assignments,
        }))
        .filter((item) => Boolean(item.subject))
        .sort(
          (a, b) =>
            subjectRank(String(a.subject?.name ?? "")) -
            subjectRank(String(b.subject?.name ?? ""))
        );

      for (const item of uniqueSubjects) {
        const subject = item.subject as JsonRow;
        const normalized = normalizedSubjectName(String(subject.name ?? ""));
        let assignment = item.assignments[0];

        if (normalized === "technical vocational education") {
          assignment =
            item.assignments.find(
              (candidate) =>
                String(candidate.major ?? "").trim() ===
                String(tveMajor ?? "").trim()
            ) ?? assignment;
        }

        const termRecords = [1, 2, 3].map((termNo) =>
          gradeRecord(studentId, String(assignment.id), termNo)
        );
        const termGrades = termRecords.map((record) =>
          record ? Number(record.term_grade) : null
        );
        const finalGrade = termGrades.every((value) => value !== null)
          ? roundAverage(termGrades)
          : null;

        rows.push({
          key: String(subject.id),
          label: subjectLabel(String(subject.name ?? ""), assignment.major),
          subject_name: subject.name,
          terms: termGrades,
          final_grade: finalGrade,
          remarks:
            finalGrade === null ? "" : finalGrade >= 75 ? "Passed" : "Failed",
          component: false,
          include_in_general_average: true,
        });

        if (normalized === "mapeh") {
          const musicArts = termRecords.map((record) =>
            record &&
            record.music_grade !== null &&
            record.music_grade !== undefined &&
            record.arts_grade !== null &&
            record.arts_grade !== undefined
              ? roundAverage([
                  Number(record.music_grade),
                  Number(record.arts_grade),
                ])
              : null
          );
          const peHealth = termRecords.map((record) =>
            record &&
            record.physical_education_grade !== null &&
            record.physical_education_grade !== undefined &&
            record.health_grade !== null &&
            record.health_grade !== undefined
              ? roundAverage([
                  Number(record.physical_education_grade),
                  Number(record.health_grade),
                ])
              : null
          );

          rows.push({
            key: `${subject.id}-music-arts`,
            label: "Music and Arts",
            terms: musicArts,
            final_grade: musicArts.every((value) => value !== null)
              ? roundAverage(musicArts)
              : null,
            remarks: "",
            component: true,
            include_in_general_average: false,
          });
          rows.push({
            key: `${subject.id}-pe-health`,
            label: "Physical Education and Health",
            terms: peHealth,
            final_grade: peHealth.every((value) => value !== null)
              ? roundAverage(peHealth)
              : null,
            remarks: "",
            component: true,
            include_in_general_average: false,
          });
        }
      }

      const mainRows = rows.filter(
        (row) => row.include_in_general_average === true
      );
      const completeFinals = mainRows
        .map((row) => row.final_grade)
        .filter((value): value is number => typeof value === "number");
      const generalAverage =
        mainRows.length > 0 && completeFinals.length === mainRows.length
          ? roundAverage(completeFinals)
          : null;

      return { rows, generalAverage };
    }

    function buildAttendance(studentId: string) {
      const classDaysByMonth = Object.fromEntries(
        MONTHS.map((item) => [item.key, 0])
      ) as Record<string, number>;
      const presentByMonth = Object.fromEntries(
        MONTHS.map((item) => [item.key, 0])
      ) as Record<string, number>;

      for (const date of classDates) {
        const key = monthKey(date);
        if (key) classDaysByMonth[key] += 1;
      }

      for (const row of studentAttendance ?? []) {
        if (String(row.student_id) !== studentId) continue;
        const key = monthKey(String(row.attendance_date ?? ""));
        if (!key) continue;
        presentByMonth[key] += attendancePresence(row.status);
      }

      const absentByMonth = Object.fromEntries(
        MONTHS.map((item) => [
          item.key,
          Math.max(0, classDaysByMonth[item.key] - presentByMonth[item.key]),
        ])
      ) as Record<string, number>;

      const totalClassDays = Object.values(classDaysByMonth).reduce(
        (sum, value) => sum + value,
        0
      );
      const totalPresent = Object.values(presentByMonth).reduce(
        (sum, value) => sum + value,
        0
      );

      return {
        months: MONTHS.map((item) => item.key),
        class_days: classDaysByMonth,
        days_present: presentByMonth,
        days_absent: absentByMonth,
        total_class_days: totalClassDays,
        total_present: totalPresent,
        total_absent: Math.max(0, totalClassDays - totalPresent),
      };
    }

    const cards = requestedStudentIds.map((studentId) => {
      const student = profileMap.get(studentId) ?? {};
      const info = infoMap.get(studentId) ?? {};
      const enrollment = enrollmentMap.get(studentId) ?? {};
      const gradesBuilt = buildGradeRows(
        studentId,
        String(enrollment.tve_major ?? "") || null
      );

      return {
        id: studentId,
        full_name: student.full_name ?? "",
        lrn: student.lrn ?? "",
        last_name: info.last_name ?? "",
        first_name: info.first_name ?? "",
        middle_name: info.middle_name ?? "",
        name_extension: info.name_extension ?? "",
        sex: info.sex ?? "",
        birth_date: info.birth_date ?? null,
        age: ageOnToday(info.birth_date),
        grade_level: enrollment.grade_level ?? selectedSection.grade_level,
        section: selectedSection.name,
        section_id: sectionId,
        track: "",
        tve_major: enrollment.tve_major ?? null,
        grade_rows: gradesBuilt.rows,
        general_average: gradesBuilt.generalAverage,
        attendance: buildAttendance(studentId),
        comments: ["", "", ""],
      };
    });

    return NextResponse.json({
      activeYear,
      section: selectedSection,
      schoolInformation: {
        school_name: school.school_name || "ASUNCION NATIONAL HIGH SCHOOL",
        school_id: school.school_id || "304217",
        district: school.district || "Asuncion District",
        division: school.division || "SCHOOLS DIVISION OF DAVAO DEL NORTE",
        region: school.region || "REGION XI",
        school_address: school.school_address || "Asuncion, Davao del Norte",
        school_head_name: school.school_head_name || "ALAN JR. J. PAGLINAWAN",
        school_head_designation:
          school.school_head_designation || "School Head",
      },
      adviser: {
        id: adviserProfile?.id ?? adviserId,
        full_name: adviserProfile?.full_name ?? "",
      },
      cards,
      accessMode: isAdmin ? "admin" : "adviser",
    });
  } catch (error) {
    console.error("SF9 load failed", error);
    return NextResponse.json(
      { error: "Unable to load SF9 report-card data." },
      { status: 500 }
    );
  }
}
