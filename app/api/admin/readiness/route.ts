import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-access";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

const REQUIRED_LEARNER_FIELDS = [
  ["last_name", "Last Name"],
  ["first_name", "First Name"],
  ["sex", "Sex"],
  ["birth_date", "Birth Date"],
  ["mother_tongue", "Mother Tongue"],
  ["religion", "Religion"],
  ["address_barangay", "Current Barangay"],
  ["address_municipality_city", "Current City / Municipality"],
  ["address_province", "Current Province"],
  ["guardian_name", "Guardian Name"],
  ["guardian_relationship", "Guardian Relationship"],
  ["guardian_contact_number", "Guardian Contact Number"],
  ["citizenship", "Citizenship"],
  ["is_indigenous_peoples", "Indigenous Peoples Response"],
  ["cct_recipient", "4Ps / CCT Response"],
  ["has_special_educational_needs", "Special Educational Needs Response"],
  ["permanent_same_as_current", "Permanent Address Response"],
  ["learning_modality", "Actual Modality"],
] as const;

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
      headers: { ...headers(token), Range: `${start}-${start + pageSize - 1}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Paged query failed.");
    const page = await response.json().catch(() => []);
    if (!Array.isArray(page)) break;
    rows.push(...page);
    if (page.length < pageSize) break;
    start += pageSize;
    if (start >= 100000) throw new Error("Readiness query is too large.");
  }
  return rows;
}

function manilaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function manilaWeekday() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
  }).format(new Date());
}

function blank(value: unknown) {
  return !String(value ?? "").trim();
}

type Enrollment = {
  student_id: string;
  grade_level: number;
  section_id: string;
  tve_major: string | null;
};

type Section = {
  id: string;
  grade_level: number;
  name: string;
};

type LearnerInfo = {
  student_id: string;
  last_name: string | null;
  first_name: string | null;
  sex: string | null;
  birth_date: string | null;
  mother_tongue: string | null;
  religion: string | null;
  address_barangay: string | null;
  address_municipality_city: string | null;
  address_province: string | null;
  guardian_name: string | null;
  guardian_relationship: string | null;
  guardian_contact_number: string | null;
  citizenship: string | null;
  is_indigenous_peoples: boolean | null;
  ethnic_group: string | null;
  cct_recipient: boolean | null;
  cct_household_id: string | null;
  has_special_educational_needs: boolean | null;
  lsen_type: string | null;
  permanent_same_as_current: boolean | null;
  permanent_address_barangay: string | null;
  permanent_address_municipality_city: string | null;
  permanent_address_province: string | null;
  learning_modality: string | null;
};

type Student = {
  id: string;
  full_name: string;
  lrn: string | null;
};

async function profileAttention(token: string, allowed: boolean) {
  if (!allowed) return null;
  const response = await fetch(`${SUPABASE_URL}/functions/v1/teacher-profiles`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ action: "profile_attention" }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const result = await response.json().catch(() => null);
  if (!result) return null;
  return {
    teaching_count: Number(result.teaching_count ?? 0),
    non_teaching_count: Number(result.non_teaching_count ?? 0),
    total_incomplete: Number(result.total_incomplete ?? 0),
  };
}

async function passwordResetAttention(token: string, allowed: boolean) {
  if (!allowed) return null;
  const response = await fetch(`${SUPABASE_URL}/functions/v1/password-reset-admin`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ action: "list" }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const result = await response.json().catch(() => ({}));
  return { pending_count: Array.isArray(result.requests) ? result.requests.length : 0 };
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const permissionNames = [
    "users.manage",
    "teaching.manage",
    "schedules.manage",
    "attendance.manage",
    "reports.view",
    "password_resets.manage",
    "hr.manage",
  ] as const;

  const permissionValues = await Promise.all(
    permissionNames.map((permission) => hasAdminPermission(token, permission))
  );
  const permissions = Object.fromEntries(
    permissionNames.map((permission, index) => [permission, permissionValues[index]])
  ) as Record<(typeof permissionNames)[number], boolean>;

  if (!permissionValues.every(Boolean)) {
    return NextResponse.json(
      { error: "Full Administrator access is required for school-wide readiness data." },
      { status: 403 }
    );
  }

  try {
    const years = await getRows(
      "school_years?is_active=eq.true&select=id,name&limit=1",
      token
    );
    const activeYear = years?.[0] ?? null;
    const today = manilaDate();
    const weekday = manilaWeekday();
    const isSchoolDay = !["Sat", "Sun"].includes(weekday);

    if (!activeYear) {
      return NextResponse.json({
        activeYear: null,
        today,
        isSchoolDay,
        permissions,
        totalLearners: 0,
        gradeCounts: [],
        missingTve: { count: 0, byGrade: [] },
        incompleteLearners: { count: 0, samples: [] },
        sectionsWithoutAdviser: [],
        attendanceGaps: [],
        emptyGradeLevels: [],
        pendingGradeLevelHeads: [],
        grades: { total: 0, published: 0, byTerm: [] },
        personnel: null,
        passwordResets: null,
      });
    }

    const [
      sectionsRaw,
      enrollmentsRaw,
      adviserRows,
      learnerInfoRaw,
      studentsRaw,
      attendanceRaw,
      exclusionsRaw,
      gradeHeadRows,
      gradeRows,
      personnel,
      passwordResets,
    ] = await Promise.all([
      getRows(
        "sections?is_active=eq.true&grade_level=gte.7&grade_level=lte.12&select=id,grade_level,name&order=grade_level.asc,name.asc",
        token
      ),
      getAllRows(
        `student_enrollments?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&enrollment_status=eq.active&grade_level=gte.7&grade_level=lte.12&select=student_id,grade_level,section_id,tve_major`,
        token
      ),
      getRows(
        `section_advisers?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&is_active=eq.true&select=section_id,teacher_id`,
        token
      ),
      getAllRows(
        "learner_information?select=student_id,last_name,first_name,sex,birth_date,mother_tongue,religion,address_barangay,address_municipality_city,address_province,guardian_name,guardian_relationship,guardian_contact_number,citizenship,is_indigenous_peoples,ethnic_group,cct_recipient,cct_household_id,has_special_educational_needs,lsen_type,permanent_same_as_current,permanent_address_barangay,permanent_address_municipality_city,permanent_address_province,learning_modality",
        token
      ),
      getAllRows(
        "profiles?role=eq.student&account_status=eq.active&select=id,full_name,lrn",
        token
      ),
      isSchoolDay && permissions["attendance.manage"]
        ? getAllRows(
            `daily_attendance?school_year_id=eq.${encodeURIComponent(
              activeYear.id
            )}&attendance_date=eq.${today}&select=student_id,section_id,status`,
            token
          )
        : Promise.resolve([]),
      isSchoolDay && permissions["attendance.manage"]
        ? getRows(
            `attendance_day_exclusions?school_year_id=eq.${encodeURIComponent(
              activeYear.id
            )}&attendance_date=eq.${today}&select=section_id,exclusion_type,reason`,
            token
          )
        : Promise.resolve([]),
      getRows(
        "grade_level_heads?is_active=eq.true&select=grade_level,display_name,profile_id&order=grade_level.asc",
        token
      ).catch(() => []),
      permissions["reports.view"]
        ? getAllRows(
            `student_term_grades?school_year_id=eq.${encodeURIComponent(
              activeYear.id
            )}&select=id,term_no,status,published_at`,
            token
          )
        : Promise.resolve([]),
      profileAttention(token, permissions["hr.manage"]),
      passwordResetAttention(token, permissions["password_resets.manage"]),
    ]);

    const sections = sectionsRaw as Section[];
    const enrollments = enrollmentsRaw as Enrollment[];
    const learnerInfo = learnerInfoRaw as LearnerInfo[];
    const students = studentsRaw as Student[];
    const adviserSectionIds = new Set(
      (adviserRows as Array<{ section_id: string }>).map((row) => row.section_id)
    );
    const sectionMap = new Map(sections.map((section) => [section.id, section] as const));
    const infoMap = new Map(learnerInfo.map((info) => [info.student_id, info] as const));
    const studentMap = new Map(students.map((student) => [student.id, student] as const));

    const gradeCounts = Array.from({ length: 6 }, (_, index) => index + 7).map(
      (gradeLevel) => ({
        grade_level: gradeLevel,
        count: enrollments.filter((enrollment) => enrollment.grade_level === gradeLevel).length,
      })
    );

    const emptyGradeLevels = gradeCounts
      .filter(
        (item) =>
          item.count === 0 &&
          sections.some((section) => section.grade_level === item.grade_level)
      )
      .map((item) => item.grade_level);

    const missingTveRows = enrollments.filter(
      (enrollment) =>
        enrollment.grade_level >= 8 &&
        enrollment.grade_level <= 10 &&
        blank(enrollment.tve_major)
    );
    const missingTveByGrade = [8, 9, 10].map((gradeLevel) => ({
      grade_level: gradeLevel,
      count: missingTveRows.filter((row) => row.grade_level === gradeLevel).length,
    }));

    const incompleteLearnerSamples: Array<Record<string, unknown>> = [];
    let incompleteLearnerCount = 0;
    for (const enrollment of enrollments) {
      const info = infoMap.get(enrollment.student_id);
      const missing = REQUIRED_LEARNER_FIELDS
        .filter(([field]) => blank(info?.[field]))
        .map(([, label]) => label);

      if (info?.is_indigenous_peoples === true && blank(info.ethnic_group)) {
        missing.push("Primary Ethnicity");
      }
      if (info?.cct_recipient === true && blank(info.cct_household_id)) {
        missing.push("4Ps Household ID");
      }
      if (
        info?.has_special_educational_needs === true &&
        blank(info.lsen_type)
      ) {
        missing.push("LSEN Type");
      }
      if (info?.permanent_same_as_current === false) {
        if (blank(info.permanent_address_barangay)) {
          missing.push("Permanent Barangay");
        }
        if (blank(info.permanent_address_municipality_city)) {
          missing.push("Permanent City / Municipality");
        }
        if (blank(info.permanent_address_province)) {
          missing.push("Permanent Province");
        }
      }

      if (!missing.length) continue;
      incompleteLearnerCount += 1;
      if (incompleteLearnerSamples.length < 25) {
        const student = studentMap.get(enrollment.student_id);
        const section = sectionMap.get(enrollment.section_id);
        incompleteLearnerSamples.push({
          student_id: enrollment.student_id,
          full_name: student?.full_name ?? "Learner",
          lrn: student?.lrn ?? null,
          grade_level: enrollment.grade_level,
          section: section?.name ?? "Unknown Section",
          missing_fields: missing,
        });
      }
    }

    const activeSectionIds = new Set(enrollments.map((enrollment) => enrollment.section_id));
    const sectionsWithoutAdviser = sections
      .filter(
        (section) =>
          activeSectionIds.has(section.id) && !adviserSectionIds.has(section.id)
      )
      .map((section) => ({
        id: section.id,
        grade_level: section.grade_level,
        name: section.name,
      }));

    const attendanceGaps: Array<Record<string, unknown>> = [];
    if (isSchoolDay && permissions["attendance.manage"]) {
      const excludedSections = new Set(
        (exclusionsRaw as Array<{ section_id: string }>).map((row) => row.section_id)
      );
      const attendanceBySection = new Map<string, Set<string>>();
      for (const row of attendanceRaw as Array<{ student_id: string; section_id: string }>) {
        if (!attendanceBySection.has(row.section_id)) {
          attendanceBySection.set(row.section_id, new Set());
        }
        attendanceBySection.get(row.section_id)!.add(row.student_id);
      }

      for (const section of sections) {
        if (!activeSectionIds.has(section.id) || excludedSections.has(section.id)) continue;
        const sectionEnrollments = enrollments.filter(
          (enrollment) => enrollment.section_id === section.id
        );
        const recorded = attendanceBySection.get(section.id)?.size ?? 0;
        const missing = Math.max(0, sectionEnrollments.length - recorded);
        if (missing > 0) {
          attendanceGaps.push({
            section_id: section.id,
            grade_level: section.grade_level,
            section: section.name,
            total: sectionEnrollments.length,
            recorded,
            missing,
          });
        }
      }
    }

    const pendingGradeLevelHeads = (
      gradeHeadRows as Array<{
        grade_level: number;
        display_name: string;
        profile_id: string | null;
      }>
    )
      .filter((row) => !row.profile_id)
      .map((row) => ({
        grade_level: row.grade_level,
        display_name: row.display_name,
      }));

    const gradeRowsTyped = gradeRows as Array<{
      term_no: number;
      status: string | null;
      published_at: string | null;
    }>;
    const gradesByTerm = [1, 2, 3].map((termNo) => {
      const rows = gradeRowsTyped.filter((row) => Number(row.term_no) === termNo);
      return {
        term_no: termNo,
        total: rows.length,
        published: rows.filter(
          (row) => row.status === "published" || Boolean(row.published_at)
        ).length,
      };
    });

    return NextResponse.json({
      activeYear,
      today,
      isSchoolDay,
      permissions,
      totalLearners: enrollments.length,
      gradeCounts,
      missingTve: {
        count: missingTveRows.length,
        byGrade: missingTveByGrade,
      },
      incompleteLearners: {
        count: incompleteLearnerCount,
        samples: incompleteLearnerSamples,
      },
      sectionsWithoutAdviser,
      attendanceGaps,
      emptyGradeLevels,
      pendingGradeLevelHeads,
      grades: {
        total: gradeRowsTyped.length,
        published: gradeRowsTyped.filter(
          (row) => row.status === "published" || Boolean(row.published_at)
        ).length,
        byTerm: gradesByTerm,
      },
      personnel,
      passwordResets,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load the school readiness dashboard." },
      { status: 500 }
    );
  }
}
