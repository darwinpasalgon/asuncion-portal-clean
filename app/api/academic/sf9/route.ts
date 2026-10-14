import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";
import { generateSf9Remark, type Sf9RemarkSignal } from "@/lib/sf9-remarks";

type JsonRow = Record<string, any>;

function learnerSexRank(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "M" || normalized === "MALE") return 0;
  if (normalized === "F" || normalized === "FEMALE") return 1;
  return 2;
}

function compareLearnerRoster(
  a: { full_name?: unknown; last_name?: unknown; first_name?: unknown; sex?: unknown },
  b: { full_name?: unknown; last_name?: unknown; first_name?: unknown; sex?: unknown }
) {
  const bySex = learnerSexRank(a.sex) - learnerSexRank(b.sex);
  if (bySex !== 0) return bySex;

  const aLast = String(a.last_name ?? "").trim() || String(a.full_name ?? "").trim();
  const bLast = String(b.last_name ?? "").trim() || String(b.full_name ?? "").trim();
  const byLast = aLast.localeCompare(bLast, undefined, { sensitivity: "base" });
  if (byLast !== 0) return byLast;

  const aFirst = String(a.first_name ?? "").trim() || String(a.full_name ?? "").trim();
  const bFirst = String(b.first_name ?? "").trim() || String(b.full_name ?? "").trim();
  return aFirst.localeCompare(bFirst, undefined, { sensitivity: "base" });
}

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

type Sf9FontFamily = "bookman" | "arial" | "times" | "calibri" | "georgia";

type Sf9BlockId =
  | "header"
  | "reportTitle"
  | "schoolYear"
  | "learnerInfo"
  | "parentNote"
  | "frontSignatures"
  | "progressTitle"
  | "gradeTable"
  | "descriptorTitle"
  | "descriptorTable"
  | "attendanceTable"
  | "comments"
  | "guardianSignatures"
  | "transfer"
  | "cancellation";

type Sf9BlockStyle = {
  fontFamily?: Sf9FontFamily;
  fontPt?: number;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  offsetXMm?: number;
  offsetYMm?: number;
};

type Sf9LayoutSettings = {
  paper: "A4";
  orientation: "landscape";
  pageHorizontalMarginMm: number;
  leftCardWidthMm: number;
  rightCardWidthMm: number;
  topMm: number;
  bottomMm: number;
  leftCardOuterMm: number;
  leftCardInnerMm: number;
  rightCardInnerMm: number;
  rightCardOuterMm: number;
  centerLineMm: number;
  headerHeightMm: number;
  headerGapMm: number;
  logoSizeMm: number;
  frontFontPt: number;
  backFontPt: number;
  lineHeight: number;
  blockStyles: Partial<Record<Sf9BlockId, Sf9BlockStyle>>;
};

const DEFAULT_SF9_LAYOUT: Sf9LayoutSettings = {
  paper: "A4",
  orientation: "landscape",
  pageHorizontalMarginMm: 12.92,
  leftCardWidthMm: 140.58,
  rightCardWidthMm: 130.25,
  topMm: 5.5,
  bottomMm: 4.5,
  leftCardOuterMm: 5.25,
  leftCardInnerMm: 10.33,
  rightCardInnerMm: 5.25,
  rightCardOuterMm: 0,
  centerLineMm: 0.33,
  headerHeightMm: 25.4,
  headerGapMm: 3.83,
  logoSizeMm: 22.3,
  frontFontPt: 7.44,
  backFontPt: 6.84,
  lineHeight: 1.02,
  blockStyles: {},
};

const SF9_BLOCK_IDS: Sf9BlockId[] = [
  "header",
  "reportTitle",
  "schoolYear",
  "learnerInfo",
  "parentNote",
  "frontSignatures",
  "progressTitle",
  "gradeTable",
  "descriptorTitle",
  "descriptorTable",
  "attendanceTable",
  "comments",
  "guardianSignatures",
  "transfer",
  "cancellation",
];

const SF9_FONT_FAMILIES = new Set<Sf9FontFamily>([
  "bookman",
  "arial",
  "times",
  "calibri",
  "georgia",
]);

function boundedNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, numberValue));
}

function sanitizeBlockStyles(input: unknown) {
  const source =
    input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const result: Partial<Record<Sf9BlockId, Sf9BlockStyle>> = {};

  for (const blockId of SF9_BLOCK_IDS) {
    const raw =
      source[blockId] && typeof source[blockId] === "object"
        ? (source[blockId] as Record<string, unknown>)
        : null;
    if (!raw) continue;

    const style: Sf9BlockStyle = {};
    if (
      typeof raw.fontFamily === "string" &&
      SF9_FONT_FAMILIES.has(raw.fontFamily as Sf9FontFamily)
    ) {
      style.fontFamily = raw.fontFamily as Sf9FontFamily;
    }
    if (raw.fontPt !== undefined) {
      style.fontPt = boundedNumber(raw.fontPt, 7.44, 5, 16);
    }
    if (typeof raw.bold === "boolean") style.bold = raw.bold;
    if (typeof raw.italic === "boolean") style.italic = raw.italic;
    if (
      raw.align === "left" ||
      raw.align === "center" ||
      raw.align === "right"
    ) {
      style.align = raw.align;
    }
    if (raw.lineHeight !== undefined) {
      style.lineHeight = boundedNumber(raw.lineHeight, 1.02, 0.8, 2);
    }
    if (raw.offsetXMm !== undefined) {
      style.offsetXMm = boundedNumber(raw.offsetXMm, 0, -30, 30);
    }
    if (raw.offsetYMm !== undefined) {
      style.offsetYMm = boundedNumber(raw.offsetYMm, 0, -30, 30);
    }

    if (Object.keys(style).length > 0) result[blockId] = style;
  }

  return result;
}

function sanitizeLayoutSettings(input: unknown): Sf9LayoutSettings {
  const source =
    input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  return {
    paper: "A4",
    orientation: "landscape",
    pageHorizontalMarginMm: boundedNumber(
      source.pageHorizontalMarginMm,
      DEFAULT_SF9_LAYOUT.pageHorizontalMarginMm,
      0,
      30
    ),
    leftCardWidthMm: boundedNumber(
      source.leftCardWidthMm,
      DEFAULT_SF9_LAYOUT.leftCardWidthMm,
      110,
      150
    ),
    rightCardWidthMm: boundedNumber(
      source.rightCardWidthMm,
      DEFAULT_SF9_LAYOUT.rightCardWidthMm,
      110,
      150
    ),
    topMm: boundedNumber(source.topMm, DEFAULT_SF9_LAYOUT.topMm, 0, 20),
    bottomMm: boundedNumber(
      source.bottomMm,
      DEFAULT_SF9_LAYOUT.bottomMm,
      0,
      20
    ),
    leftCardOuterMm: boundedNumber(
      source.leftCardOuterMm,
      DEFAULT_SF9_LAYOUT.leftCardOuterMm,
      0,
      25
    ),
    leftCardInnerMm: boundedNumber(
      source.leftCardInnerMm,
      DEFAULT_SF9_LAYOUT.leftCardInnerMm,
      0,
      25
    ),
    rightCardInnerMm: boundedNumber(
      source.rightCardInnerMm,
      DEFAULT_SF9_LAYOUT.rightCardInnerMm,
      0,
      25
    ),
    rightCardOuterMm: boundedNumber(
      source.rightCardOuterMm,
      DEFAULT_SF9_LAYOUT.rightCardOuterMm,
      0,
      25
    ),
    centerLineMm: boundedNumber(
      source.centerLineMm,
      DEFAULT_SF9_LAYOUT.centerLineMm,
      0.1,
      1.5
    ),
    headerHeightMm: boundedNumber(
      source.headerHeightMm,
      DEFAULT_SF9_LAYOUT.headerHeightMm,
      16,
      40
    ),
    headerGapMm: boundedNumber(
      source.headerGapMm,
      DEFAULT_SF9_LAYOUT.headerGapMm,
      0,
      15
    ),
    logoSizeMm: boundedNumber(
      source.logoSizeMm,
      DEFAULT_SF9_LAYOUT.logoSizeMm,
      12,
      30
    ),
    frontFontPt: boundedNumber(
      source.frontFontPt,
      DEFAULT_SF9_LAYOUT.frontFontPt,
      5,
      11
    ),
    backFontPt: boundedNumber(
      source.backFontPt,
      DEFAULT_SF9_LAYOUT.backFontPt,
      5,
      11
    ),
    lineHeight: boundedNumber(
      source.lineHeight,
      DEFAULT_SF9_LAYOUT.lineHeight,
      0.9,
      1.5
    ),
    blockStyles: sanitizeBlockStyles(source.blockStyles),
  };
}

async function getLayoutSettings(token: string) {
  const rows = await getRows(
    "sf9_layout_settings?id=eq.true&select=settings&limit=1",
    token
  ).catch(() => []);
  return sanitizeLayoutSettings(rows?.[0]?.settings ?? DEFAULT_SF9_LAYOUT);
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
    "values education": 60,
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

function dateOnly(value: unknown) {
  const text = String(value ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}

function nextDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : null;
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
    const layoutSettings = await getLayoutSettings(token);
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
        accessMode: isAdmin ? "admin" : "adviser",
        layoutSettings,
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

    if (!sectionId) {
      return NextResponse.json({
        activeYear,
        sections,
        students: [],
        accessMode: isAdmin ? "admin" : "adviser",
        layoutSettings,
      });
    }

    if (requestedStudentIds.length === 0) {
      const enrollments = await getRows(
        `student_enrollments?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&section_id=eq.${encodeURIComponent(
          sectionId
        )}&enrollment_status=eq.active&select=student_id,grade_level,section_id,tve_major`,
        token
      ).catch(() => []);

      const studentIds = (enrollments ?? []).map((row: JsonRow) =>
        String(row.student_id)
      );
      const [profiles, learnerInformation] = studentIds.length
        ? await Promise.all([
            getRows(
              `profiles?id=in.${encodeURIComponent(
                inFilter(studentIds)
              )}&role=eq.student&account_status=eq.active&select=id,full_name,lrn`,
              token
            ).catch(() => []),
            getRows(
              `learner_information?student_id=in.${encodeURIComponent(
                inFilter(studentIds)
              )}&select=student_id,last_name,first_name,sex`,
              token
            ).catch(() => []),
          ])
        : [[], []];

    const profileMap = new Map<string, JsonRow>(
        (profiles ?? []).map((row: JsonRow) => [String(row.id), row])
      );
      const learnerInfoMap = new Map<string, JsonRow>(
        (learnerInformation ?? []).map((row: JsonRow) => [
          String(row.student_id),
          row,
        ])
      );
      const sectionMap = new Map<string, JsonRow>(
        sections.map((row: JsonRow) => [String(row.id), row])
      );

      const students = (enrollments ?? [])
        .map((row: JsonRow) => {
          const student = profileMap.get(String(row.student_id));
          const section = sectionMap.get(String(row.section_id));
          if (!student || !section) return null;
          const info = learnerInfoMap.get(String(row.student_id)) ?? {};
          return {
            id: student.id,
            full_name: student.full_name,
            lrn: student.lrn ?? null,
            last_name: info.last_name ?? null,
            first_name: info.first_name ?? null,
            sex: info.sex ?? null,
            grade_level: row.grade_level,
            section_id: row.section_id,
            section: section.name,
            tve_major: row.tve_major ?? null,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => compareLearnerRoster(a, b));

      return NextResponse.json({
        activeYear,
        sections,
        students,
        accessMode: isAdmin ? "admin" : "adviser",
        layoutSettings,
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
            )}&status=eq.published&select=student_id,teacher_assignment_id,term_no,term_grade,music_arts_grade,pe_health_grade,music_grade,arts_grade,physical_education_grade,health_grade,status`,
            token
          )
        : [];

    const savedRemarks = requestedStudentIds.length
      ? await getRows(
          `sf9_teacher_remarks?school_year_id=eq.${encodeURIComponent(
            activeYear.id
          )}&student_id=in.${encodeURIComponent(
            inFilter(requestedStudentIds)
          )}&select=student_id,term_no,remark,source,updated_at`,
          token
        ).catch(() => [])
      : [];

    const savedRemarkMap = new Map<string, JsonRow>(
      (savedRemarks ?? []).map((row: JsonRow) => [
        `${String(row.student_id)}|${Number(row.term_no)}`,
        row,
      ])
    );

    const profileMap = new Map<string, JsonRow>(
      (selectedProfiles ?? []).map((row: JsonRow) => [String(row.id), row])
    );
    const infoMap = new Map<string, JsonRow>(
      (learnerInformation ?? []).map((row: JsonRow) => [
        String(row.student_id),
        row,
      ])
    );
    const enrollmentMap = new Map<string, JsonRow>(
      enrollmentRows.map((row: JsonRow) => [String(row.student_id), row])
    );
    const subjectMap = new Map<string, JsonRow>(
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
          const musicArts = termRecords.map((record) => {
            if (!record) return null;
            if (record.music_arts_grade !== null && record.music_arts_grade !== undefined) {
              return Number(record.music_arts_grade);
            }
            return record.music_grade != null && record.arts_grade != null
              ? roundAverage([Number(record.music_grade), Number(record.arts_grade)])
              : null;
          });
          const peHealth = termRecords.map((record) => {
            if (!record) return null;
            if (record.pe_health_grade !== null && record.pe_health_grade !== undefined) {
              return Number(record.pe_health_grade);
            }
            return record.physical_education_grade != null && record.health_grade != null
              ? roundAverage([Number(record.physical_education_grade), Number(record.health_grade)])
              : null;
          });

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

      const termAverages = [0, 1, 2].map((termIndex) => {
        const values = mainRows.map((row) => row.terms?.[termIndex]);
        return mainRows.length > 0 &&
          values.every((value) => typeof value === "number" && Number.isFinite(value))
          ? roundAverage(values as number[])
          : null;
      });

      return { rows, generalAverage, termAverages };
    }

    function buildTermRemarkSignal(
      studentId: string,
      rows: any[],
      termNo: number
    ): Sf9RemarkSignal & { cutoff: string | null } {
      const mainRows = rows.filter(
        (row) => row.include_in_general_average === true
      );
      const gradesForTerm = mainRows
        .map((row) => ({
          label: String(row.label ?? ""),
          grade: row.terms?.[termNo - 1],
        }))
        .filter(
          (row): row is { label: string; grade: number } =>
            typeof row.grade === "number" && Number.isFinite(row.grade)
        );

      const gradeComplete =
        mainRows.length > 0 && gradesForTerm.length === mainRows.length;
      const termAverage = gradeComplete
        ? roundAverage(gradesForTerm.map((row) => row.grade))
        : null;

      const lowest = gradesForTerm.length
        ? gradesForTerm.reduce((current, row) =>
            row.grade < current.grade ? row : current
          )
        : null;

      const studentTermGrades = (grades ?? []).filter(
        (grade: JsonRow) =>
          String(grade.student_id) === studentId &&
          Number(grade.term_no) === termNo &&
          dateOnly(grade.published_at)
      );
      const cutoff =
        studentTermGrades
          .map((grade: JsonRow) => dateOnly(grade.published_at))
          .filter((value: string | null): value is string => Boolean(value))
          .sort()
          .pop() ?? null;

      if (!cutoff) {
        return {
          termAverage,
          gradeComplete,
          subjectCount: mainRows.length,
          attendanceRate: null,
          classDays: 0,
          lowestSubject: lowest?.label ?? null,
          lowestGrade: lowest?.grade ?? null,
          subjectGrades: gradesForTerm,
          variantSeed: studentId + ':' + termNo,
          cutoff: null,
        };
      }

      let start = `${activeYear.start_year}-06-01`;
      if (termNo > 1) {
        const previousCutoffs = (grades ?? [])
          .filter(
            (grade: JsonRow) =>
              String(grade.student_id) === studentId &&
              Number(grade.term_no) === termNo - 1 &&
              dateOnly(grade.published_at)
          )
          .map((grade: JsonRow) => dateOnly(grade.published_at))
          .filter((value: string | null): value is string => Boolean(value))
          .sort();
        const previousCutoff = previousCutoffs.pop() ?? null;
        if (previousCutoff) start = nextDate(previousCutoff);
      }

      const termClassDates = Array.from(classDates)
        .filter((date) => date >= start && date <= cutoff)
        .sort();
      const studentRows = (studentAttendance ?? []).filter(
        (row: JsonRow) =>
          String(row.student_id) === studentId &&
          String(row.attendance_date ?? "") >= start &&
          String(row.attendance_date ?? "") <= cutoff
      );
      const presenceByDate = new Map<string, number>();
      for (const row of studentRows) {
        presenceByDate.set(
          String(row.attendance_date),
          attendancePresence(row.status)
        );
      }
      const totalPresence = termClassDates.reduce(
        (sum, date) => sum + (presenceByDate.get(date) ?? 0),
        0
      );

      return {
        termAverage,
        gradeComplete,
        subjectCount: mainRows.length,
        attendanceRate: percent(totalPresence, termClassDates.length),
        classDays: termClassDates.length,
        lowestSubject: lowest?.label ?? null,
        lowestGrade: lowest?.grade ?? null,
        subjectGrades: gradesForTerm,
        variantSeed: studentId + ':' + termNo,
        cutoff,
      };
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
      const student: JsonRow = profileMap.get(studentId) ?? {};
      const info: JsonRow = infoMap.get(studentId) ?? {};
      const enrollment: JsonRow = enrollmentMap.get(studentId) ?? {};
      const gradesBuilt = buildGradeRows(
        studentId,
        String(enrollment.tve_major ?? "") || null
      );

      const remarkDetails = [1, 2, 3].map((termNo) => {
        const signal = buildTermRemarkSignal(
          studentId,
          gradesBuilt.rows,
          termNo
        );
        const suggestion = generateSf9Remark(signal);
        const saved = savedRemarkMap.get(`${studentId}|${termNo}`) ?? null;
        return {
          term_no: termNo,
          text: saved?.remark ? String(saved.remark) : suggestion,
          suggestion,
          source: saved?.source ? String(saved.source) : suggestion ? "automatic" : "pending",
          saved: Boolean(saved?.remark),
          grade_average: signal.termAverage,
          grade_complete: signal.gradeComplete,
          subject_count: signal.subjectCount,
          attendance_rate: signal.attendanceRate,
          class_days: signal.classDays,
          cutoff: signal.cutoff,
          lowest_subject: signal.lowestSubject,
          lowest_grade: signal.lowestGrade,
          subject_grades: signal.subjectGrades ?? [],
        };
      });

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
        general_averages_by_term: gradesBuilt.termAverages,
        attendance: buildAttendance(studentId),
        comments: remarkDetails.map((item) => item.text),
        comment_details: remarkDetails,
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
      layoutSettings,
    });
  } catch (error) {
    console.error("SF9 load failed", error);
    return NextResponse.json(
      { error: "Unable to load SF9 report-card data." },
      { status: 500 }
    );
  }
}


export async function POST(request: NextRequest) {
  const identity = await getIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { token, userId, profile } = identity;
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");

  if (action === "save_layout") {
    if (profile.role !== "administrator") {
      return NextResponse.json(
        { error: "Only the full Administrator can edit the SF9 layout." },
        { status: 403 }
      );
    }

    const settings = sanitizeLayoutSettings(body?.settings);
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/sf9_layout_settings?on_conflict=id`,
      {
        method: "POST",
        headers: {
          ...headers(token),
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify([
          {
            id: true,
            settings,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          },
        ]),
        cache: "no-store",
      }
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(result) || !result[0]) {
      return NextResponse.json(
        { error: "Unable to save the SF9 layout settings." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      settings: sanitizeLayoutSettings(result[0].settings),
    });
  }

  if (action === "save_remarks") {
    if (!["administrator", "teacher"].includes(String(profile.role))) {
      return NextResponse.json(
        { error: "Only Administrators and Section Advisers can save SF9 remarks." },
        { status: 403 }
      );
    }

    const sectionId = String(body?.sectionId ?? "").trim();
    const studentId = String(body?.studentId ?? "").trim();
    const remarks = Array.isArray(body?.remarks) ? body.remarks.slice(0, 3) : [];

    if (!sectionId || !studentId || remarks.length === 0) {
      return NextResponse.json(
        { error: "Learner, section, and remarks are required." },
        { status: 400 }
      );
    }

    const years = await getRows(
      "school_years?is_active=eq.true&select=id&limit=1",
      token
    ).catch(() => []);
    const activeYear = years?.[0];
    if (!activeYear?.id) {
      return NextResponse.json(
        { error: "No active school year is configured." },
        { status: 400 }
      );
    }

    const enrollments = await getRows(
      `student_enrollments?school_year_id=eq.${encodeURIComponent(
        activeYear.id
      )}&section_id=eq.${encodeURIComponent(
        sectionId
      )}&student_id=eq.${encodeURIComponent(
        studentId
      )}&enrollment_status=eq.active&select=student_id&limit=1`,
      token
    ).catch(() => []);

    if (!enrollments?.length) {
      return NextResponse.json(
        { error: "The learner is not actively enrolled in this section." },
        { status: 400 }
      );
    }

    if (profile.role === "teacher") {
      const adviserRows = await getRows(
        `section_advisers?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&section_id=eq.${encodeURIComponent(
          sectionId
        )}&teacher_id=eq.${encodeURIComponent(
          userId
        )}&is_active=eq.true&select=id&limit=1`,
        token
      ).catch(() => []);

      if (!adviserRows?.length) {
        return NextResponse.json(
          { error: "Only the assigned Section Adviser can save these SF9 remarks." },
          { status: 403 }
        );
      }
    }

    const normalized: Array<{
      termNo: number;
      remark: string;
      source: "automatic" | "manual";
    }> = remarks
      .map((item: any) => {
        const termNo = Number(item?.termNo);
        const remark = String(item?.remark ?? "").trim();
        const source =
          String(item?.source ?? "") === "automatic" ? "automatic" : "manual";
        return {
          termNo,
          remark,
          source: source as "automatic" | "manual",
        };
      })
      .filter(
        (item: {
          termNo: number;
          remark: string;
          source: "automatic" | "manual";
        }) =>
          Number.isInteger(item.termNo) &&
          item.termNo >= 1 &&
          item.termNo <= 3 &&
          item.remark.length <= 500
      );

    if (normalized.length !== remarks.length) {
      return NextResponse.json(
        { error: "Each SF9 remark must use Term 1–3 and contain at most 500 characters." },
        { status: 400 }
      );
    }

    const toSave = normalized.filter((item) => item.remark.length > 0);
    const toDelete = normalized.filter((item) => item.remark.length === 0);

    if (toSave.length > 0) {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/sf9_teacher_remarks?on_conflict=school_year_id,student_id,term_no`,
        {
          method: "POST",
          headers: {
            ...headers(token),
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          body: JSON.stringify(
            toSave.map((item) => ({
              school_year_id: activeYear.id,
              student_id: studentId,
              term_no: item.termNo,
              remark: item.remark,
              source: item.source,
              updated_by: userId,
              updated_at: new Date().toISOString(),
            }))
          ),
          cache: "no-store",
        }
      );

      if (!response.ok) {
        return NextResponse.json(
          { error: "Unable to save the SF9 remarks." },
          { status: response.status === 403 ? 403 : 400 }
        );
      }
    }

    for (const item of toDelete) {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/sf9_teacher_remarks?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&student_id=eq.${encodeURIComponent(
          studentId
        )}&term_no=eq.${item.termNo}`,
        {
          method: "DELETE",
          headers: {
            ...headers(token),
            Prefer: "return=minimal",
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        return NextResponse.json(
          { error: "Unable to clear the SF9 remark." },
          { status: response.status === 403 ? 403 : 400 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported SF9 action." }, { status: 400 });
}
