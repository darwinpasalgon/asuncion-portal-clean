import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";
import { attendanceStartDate } from "@/lib/attendance-calendar";
import { hasAdminPermission } from "@/lib/admin-access";

type Profile = {
  id: string;
  full_name: string;
  role: "teacher" | "administrator" | "staff_administrator";
  account_status: string;
};

type EnrollmentRow = {
  id: string;
  student_id: string;
  grade_level: number;
  section_id: string | null;
  enrollment_status: string;
  enrolled_at: string;
  learner_status: string;
  status_note: string | null;
  status_changed_at: string | null;
};

type AttendanceRow = {
  student_id: string;
  attendance_date: string;
  status: string;
  note: string | null;
  updated_at: string;
};

type LearnerInfo = {
  student_id: string;
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  name_extension: string | null;
  sex: string | null;
};

const MAX_DAY_COLUMNS = 25;

function headers(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
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

function inFilter(values: string[]) {
  return `(${values.join(",")})`;
}

async function identity(request: NextRequest) {
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

  const profile = profiles?.[0] as Profile | undefined;
  if (
    !profile ||
    profile.account_status !== "active" ||
    !["teacher", "administrator", "staff_administrator"].includes(profile.role)
  ) {
    return null;
  }

  return { token, userId, profile };
}

function manilaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function validMonth(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

function monthBounds(month: string) {
  const [year, monthNo] = month.split("-").map(Number);
  const start = `${year}-${String(monthNo).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, monthNo, 0, 12));
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

function datesBetween(start: string, end: string) {
  const dates: string[] = [];
  const current = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function weekdayCode(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (day === 1) return "M";
  if (day === 2) return "T";
  if (day === 3) return "W";
  if (day === 4) return "TH";
  if (day === 5) return "F";
  return "";
}

function isWeekday(date: string) {
  return Boolean(weekdayCode(date));
}

function monthLabel(month: string) {
  const [year, monthNo] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNo - 1, 1)));
}

function normalizeSex(value: string | null | undefined) {
  const sex = String(value ?? "").trim().toUpperCase();
  if (sex === "M" || sex === "MALE") return "M";
  if (sex === "F" || sex === "FEMALE") return "F";
  return "";
}

function formatName(info: LearnerInfo | undefined, fallback: string) {
  const last = String(info?.last_name ?? "").trim();
  const first = String(info?.first_name ?? "").trim();
  const middle = String(info?.middle_name ?? "").trim();
  const extension = String(info?.name_extension ?? "").trim();

  if (!last || !first) return fallback.toUpperCase();

  const given = [first, extension, middle].filter(Boolean).join(" ");
  return `${last}, ${given}`.toUpperCase();
}

function dateOnly(value: string | null | undefined) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function firstStatusDate(rows: AttendanceRow[], statuses: string[]) {
  const matching = rows
    .filter((row) => statuses.includes(row.status))
    .map((row) => row.attendance_date)
    .sort();
  return matching[0] ?? null;
}

function earliestDate(...values: Array<string | null | undefined>) {
  const dates = values.filter((value): value is string => Boolean(value)).sort();
  return dates[0] ?? null;
}

function addSexSummary(target: { M: number; F: number }, sex: string) {
  if (sex === "M") target.M += 1;
  if (sex === "F") target.F += 1;
}

function withTotal(pair: { M: number; F: number }) {
  return { ...pair, total: pair.M + pair.F };
}

export async function GET(request: NextRequest) {
  const auth = await identity(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Section Adviser or authorized Administrator access required." },
      { status: 403 }
    );
  }

  const { token, userId, profile } = auth;

  try {
    const yearRows = await getRows(
      "school_years?is_active=eq.true&select=id,name,start_year,end_year&limit=1",
      token
    );
    const activeYear = yearRows?.[0] ?? null;
    if (!activeYear) {
      return NextResponse.json({
        profile,
        activeYear: null,
        accessMode: null,
        sections: [],
        report: null,
      });
    }

    let accessMode: "adviser" | "admin" = "adviser";
    let sections: Array<{ id: string; grade_level: number; name: string }> = [];

    if (profile.role === "teacher") {
      // Fetch only the caller's own active adviser records under RLS. Do not
      // swallow a query error as a misleading empty section selector.
      const adviserRows = await getRows(
        `section_advisers?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&teacher_id=eq.${encodeURIComponent(
          userId
        )}&is_active=eq.true&select=section_id`,
        token
      );

      const sectionIds = new Set<string>(
        (adviserRows ?? []).map((row: { section_id: string }) => String(row.section_id))
      );

      if (sectionIds.size) {
        // Fetch the active section directory and intersect it with confirmed
        // adviser assignments. Avoid a brittle encoded PostgREST "in" clause.
        const activeSections = await getRows(
          "sections?is_active=eq.true&select=id,grade_level,name&order=grade_level.asc,name.asc",
          token
        );
        sections = (activeSections ?? []).filter(
          (row: { id: string }) => sectionIds.has(String(row.id))
        );
      }
    } else {
      const allowed =
        (await hasAdminPermission(token, "attendance.manage")) ||
        (await hasAdminPermission(token, "reports.view"));
      if (!allowed) {
        return NextResponse.json(
          { error: "Attendance or Reports access required." },
          { status: 403 }
        );
      }
      accessMode = "admin";
      sections = await getRows(
        "sections?is_active=eq.true&select=id,grade_level,name&order=grade_level.asc,name.asc",
        token
      );
    }

    const selectedSectionId = request.nextUrl.searchParams.get("sectionId") ?? "";
    const requestedMonth = request.nextUrl.searchParams.get("month") ?? "";
    const today = manilaToday();
    const defaultMonth = today.slice(0, 7);

    if (!selectedSectionId) {
      return NextResponse.json({
        profile,
        activeYear,
        accessMode,
        sections,
        defaultMonth,
        report: null,
      });
    }

    const section = sections.find((item) => item.id === selectedSectionId);
    if (!section) {
      return NextResponse.json(
        { error: "That section is outside your SF2 access." },
        { status: 403 }
      );
    }

    const month = validMonth(requestedMonth) ? requestedMonth : defaultMonth;
    const schoolYearMin = `${activeYear.start_year}-06`;
    const schoolYearMax = `${activeYear.end_year}-05`;
    if (month < schoolYearMin || month > schoolYearMax || month > defaultMonth) {
      return NextResponse.json(
        { error: "Select a month within the active school year up to the current month." },
        { status: 400 }
      );
    }

    const bounds = monthBounds(month);
    const cutoff = month === defaultMonth && today < bounds.end ? today : bounds.end;

    const [
      schoolRows,
      adviserRows,
      enrollmentRows,
      attendanceRows,
      exclusionRows,
    ] = await Promise.all([
      getRows(
        "school_information?select=school_name,school_id,school_head_name,school_head_designation&limit=1",
        token
      ).catch(() => []),
      getRows(
        `section_advisers?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&section_id=eq.${encodeURIComponent(
          selectedSectionId
        )}&is_active=eq.true&select=teacher_id&limit=1`,
        token
      ).catch(() => []),
      getRows(
        `student_enrollments?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&section_id=eq.${encodeURIComponent(
          selectedSectionId
        )}&select=id,student_id,grade_level,section_id,enrollment_status,enrolled_at,learner_status,status_note,status_changed_at`,
        token
      ).catch(() => []),
      getRows(
        `daily_attendance?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&section_id=eq.${encodeURIComponent(
          selectedSectionId
        )}&attendance_date=gte.${bounds.start}&attendance_date=lte.${cutoff}&select=student_id,attendance_date,status,note,updated_at&order=attendance_date.asc,updated_at.asc`,
        token
      ).catch(() => []),
      getRows(
        `attendance_day_exclusions?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&section_id=eq.${encodeURIComponent(
          selectedSectionId
        )}&attendance_date=gte.${bounds.start}&attendance_date=lte.${cutoff}&select=attendance_date,exclusion_type,reason`,
        token
      ).catch(() => []),
    ]);

    const enrollments = (enrollmentRows ?? []) as EnrollmentRow[];
    const attendance = (attendanceRows ?? []) as AttendanceRow[];
    const attendanceStudentIds = new Set(
      attendance.map((row) => String(row.student_id))
    );
    const studentIds = Array.from(
      new Set(
        enrollments
          .filter((row) => {
            const portalEnrollmentDate = dateOnly(row.enrolled_at);
            return (
              !portalEnrollmentDate ||
              portalEnrollmentDate <= cutoff ||
              attendanceStudentIds.has(String(row.student_id))
            );
          })
          .map((row) => String(row.student_id))
      )
    );

    const teacherId = String(adviserRows?.[0]?.teacher_id ?? "");
    const profileIds = [...studentIds, ...(teacherId ? [teacherId] : [])];

    const [people, learnerInformation] = await Promise.all([
      profileIds.length
        ? getRows(
            `profiles?id=in.${encodeURIComponent(
              inFilter(profileIds)
            )}&select=id,full_name,role,account_status`,
            token
          ).catch(() => [])
        : Promise.resolve([]),
      studentIds.length
        ? getRows(
            `learner_information?student_id=in.${encodeURIComponent(
              inFilter(studentIds)
            )}&select=student_id,last_name,first_name,middle_name,name_extension,sex`,
            token
          ).catch(() => [])
        : Promise.resolve([]),
    ]);

    const peopleMap = new Map<string, string>(
      ((people ?? []) as Array<{ id: string; full_name: string }>).map(
        (person) => [String(person.id), String(person.full_name)]
      )
    );
    const learnerInfoMap = new Map<string, LearnerInfo>(
      ((learnerInformation ?? []) as LearnerInfo[]).map((item) => [
        String(item.student_id),
        item,
      ])
    );

    const attendanceByStudent = new Map<string, AttendanceRow[]>();
    const attendanceByStudentDate = new Map<string, AttendanceRow>();
    for (const row of attendance) {
      const studentId = String(row.student_id);
      if (!attendanceByStudent.has(studentId)) attendanceByStudent.set(studentId, []);
      attendanceByStudent.get(studentId)?.push(row);
      attendanceByStudentDate.set(`${studentId}|${row.attendance_date}`, row);
    }

    const excludedDates = new Set(
      (exclusionRows ?? []).map((row: { attendance_date: string }) =>
        String(row.attendance_date)
      )
    );

    const schoolDays = datesBetween(bounds.start, cutoff)
      .filter((date) => date >= attendanceStartDate(activeYear) && isWeekday(date) && !excludedDates.has(date))
      .slice(0, MAX_DAY_COLUMNS);

    const learners = studentIds
      .map((studentId) => {
        const enrollment = enrollments.find((row) => String(row.student_id) === studentId)!;
        const info = learnerInfoMap.get(studentId);
        const sex = normalizeSex(info?.sex);
        const rows = attendanceByStudent.get(studentId) ?? [];
        const transferInDate = firstStatusDate(rows, ["transferred_in"]);
        const transferOutDate = firstStatusDate(rows, ["transferred_out"]);
        const droppedDate = firstStatusDate(rows, ["dropped"]);
        const statusChanged = dateOnly(enrollment.status_changed_at);

        const effectiveOutDate =
          transferOutDate ||
          droppedDate ||
          (statusChanged &&
          ["transferred_out", "dropped"].includes(
            String(enrollment.learner_status ?? "").toLowerCase()
          )
            ? statusChanged
            : null);

        const portalEnrollmentDate = dateOnly(enrollment.enrolled_at);
        const firstRecordedAttendanceDate =
          rows.map((row) => row.attendance_date).sort()[0] ?? null;
        // Bulk import timestamps reflect when a learner was added to the portal,
        // not necessarily the learner's real first day in the class. If official
        // attendance exists earlier, SF2 must honor that earlier school record.
        const effectiveInDate =
          transferInDate ||
          earliestDate(portalEnrollmentDate, firstRecordedAttendanceDate);

        const remarks: string[] = [];
        const transferInRow = rows.find((row) => row.status === "transferred_in");
        const transferOutRow = rows.find((row) => row.status === "transferred_out");
        const droppedRow = rows.find((row) => row.status === "dropped");

        if (transferInDate) {
          remarks.push(
            `TRANSFERRED IN${transferInRow?.note ? ` - ${transferInRow.note}` : ""}`
          );
        }
        if (transferOutDate || String(enrollment.learner_status).toLowerCase() === "transferred_out") {
          const note = transferOutRow?.note || enrollment.status_note;
          remarks.push(
            `TRANSFERRED OUT${note ? ` - ${note}` : ""}`
          );
        }
        if (droppedDate || String(enrollment.learner_status).toLowerCase() === "dropped") {
          const note = droppedRow?.note || enrollment.status_note;
          remarks.push(`DROPPED OUT${note ? ` - ${note}` : ""}`);
        }

        const cells = schoolDays.map((date) => {
          const expected =
            (!effectiveInDate || date >= effectiveInDate) &&
            (!effectiveOutDate || date <= effectiveOutDate);
          if (!expected) return { date, state: "not_enrolled", code: "" };

          const row = attendanceByStudentDate.get(`${studentId}|${date}`);
          if (!row) return { date, state: "unrecorded", code: "" };

          if (row.status === "absent") return { date, state: "absent", code: "X" };
          if (row.status === "absent_morning") {
            return { date, state: "absent_morning", code: "" };
          }
          if (row.status === "absent_afternoon") {
            return { date, state: "absent_afternoon", code: "" };
          }
          if (row.status === "cutting_classes") {
            return { date, state: "cutting", code: "" };
          }
          if (["transferred_in", "transferred_out", "dropped"].includes(row.status)) {
            return { date, state: "movement", code: "" };
          }
          return { date, state: "present", code: "" };
        });

        const absent = cells.filter((cell) => cell.state === "absent").length;
        const tardy = cells.filter(
          (cell) =>
            cell.state === "absent_morning" ||
            cell.state === "absent_afternoon" ||
            cell.state === "cutting"
        ).length;

        let currentStreak = 0;
        let maxStreak = 0;
        for (const cell of cells) {
          if (cell.state === "absent") {
            currentStreak += 1;
            maxStreak = Math.max(maxStreak, currentStreak);
          } else if (cell.state !== "not_enrolled") {
            currentStreak = 0;
          }
        }

        const presentDays = cells.filter(
          (cell) =>
            cell.state === "present" ||
            cell.state === "absent_morning" ||
            cell.state === "absent_afternoon" ||
            cell.state === "cutting"
        ).length;

        return {
          student_id: studentId,
          name: formatName(info, peopleMap.get(studentId) ?? "Learner"),
          sex,
          cells,
          absent,
          tardy,
          present_days: presentDays,
          five_consecutive_absences: maxStreak >= 5,
          remarks: remarks.join("; "),
          transfer_in_date: transferInDate,
          transfer_out_date: transferOutDate,
          dropped_date: droppedDate,
          effective_in_date: effectiveInDate,
          effective_out_date: effectiveOutDate,
          // Preserve historical movement records for SF2 summaries, but do not
          // print learners who have transferred out in the learner roster.
          is_transferred_out:
            String(enrollment.learner_status ?? "").trim().toLowerCase() === "transferred_out" ||
            String(enrollment.enrollment_status ?? "").trim().toLowerCase() === "transferred" ||
            Boolean(transferOutDate && (!transferInDate || transferOutDate >= transferInDate)),
        };
      })
      .filter((learner) => learner.sex === "M" || learner.sex === "F")
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    // The printable roster and its daily attendance totals exclude transferred-out
    // learners; the full learner collection below still drives movement summaries.
    const printLearners = learners.filter((learner) => !learner.is_transferred_out);
    const males = printLearners.filter((learner) => learner.sex === "M");
    const females = printLearners.filter((learner) => learner.sex === "F");

    const dailyTotals = schoolDays.map((date, index) => {
      const male = males.filter((learner) =>
        ["present", "absent_morning", "absent_afternoon", "cutting"].includes(learner.cells[index]?.state)
      ).length;
      const female = females.filter((learner) =>
        ["present", "absent_morning", "absent_afternoon", "cutting"].includes(learner.cells[index]?.state)
      ).length;
      return { date, male, female, total: male + female };
    });

    const missingByDate = schoolDays
      .map((date, index) => ({
        date,
        missing: printLearners.filter(
          (learner) => learner.cells[index]?.state === "unrecorded"
        ).length,
      }))
      .filter((item) => item.missing > 0);

    const registeredEnd = { M: 0, F: 0 };
    const transferIn = { M: 0, F: 0 };
    const transferOut = { M: 0, F: 0 };
    const dropOut = { M: 0, F: 0 };

    for (const learner of learners) {
      const activeAtEnd =
        (!learner.effective_in_date || learner.effective_in_date <= cutoff) &&
        (!learner.effective_out_date || learner.effective_out_date > cutoff);
      if (activeAtEnd) addSexSummary(registeredEnd, learner.sex);
      if (
        learner.transfer_in_date &&
        learner.transfer_in_date >= bounds.start &&
        learner.transfer_in_date <= cutoff
      ) {
        addSexSummary(transferIn, learner.sex);
      }
      if (
        learner.transfer_out_date &&
        learner.transfer_out_date >= bounds.start &&
        learner.transfer_out_date <= cutoff
      ) {
        addSexSummary(transferOut, learner.sex);
      }
      if (
        learner.dropped_date &&
        learner.dropped_date >= bounds.start &&
        learner.dropped_date <= cutoff
      ) {
        addSexSummary(dropOut, learner.sex);
      }
    }

    const lateEnrollment = { M: 0, F: 0 };
    const beginningEnrollment = {
      M: Math.max(
        0,
        registeredEnd.M + transferOut.M + dropOut.M - transferIn.M - lateEnrollment.M
      ),
      F: Math.max(
        0,
        registeredEnd.F + transferOut.F + dropOut.F - transferIn.F - lateEnrollment.F
      ),
    };

    const completedDates = missingByDate.length
      ? dailyTotals.filter(
          (item) => !missingByDate.some((missing) => missing.date === item.date)
        )
      : dailyTotals;

    const averageDaily = {
      M: completedDates.length
        ? completedDates.reduce((sum, item) => sum + item.male, 0) /
          completedDates.length
        : 0,
      F: completedDates.length
        ? completedDates.reduce((sum, item) => sum + item.female, 0) /
          completedDates.length
        : 0,
    };

    const registeredTotals = withTotal(registeredEnd);
    const beginningTotals = withTotal(beginningEnrollment);
    const averageTotal = averageDaily.M + averageDaily.F;

    const percentageEnrollment = {
      M: beginningEnrollment.M
        ? (registeredEnd.M / beginningEnrollment.M) * 100
        : 0,
      F: beginningEnrollment.F
        ? (registeredEnd.F / beginningEnrollment.F) * 100
        : 0,
      total: beginningTotals.total
        ? (registeredTotals.total / beginningTotals.total) * 100
        : 0,
    };

    const percentageAttendance = {
      M: registeredEnd.M ? (averageDaily.M / registeredEnd.M) * 100 : 0,
      F: registeredEnd.F ? (averageDaily.F / registeredEnd.F) * 100 : 0,
      total: registeredTotals.total
        ? (averageTotal / registeredTotals.total) * 100
        : 0,
    };

    const fiveConsecutive = {
      M: males.filter((learner) => learner.five_consecutive_absences).length,
      F: females.filter((learner) => learner.five_consecutive_absences).length,
    };

    const school = schoolRows?.[0] ?? {};
    const adviserName = teacherId ? peopleMap.get(teacherId) ?? "" : "";

    return NextResponse.json({
      profile,
      activeYear,
      accessMode,
      sections,
      defaultMonth,
      report: {
        school_year: String(activeYear.name ?? ""),
        school: {
          school_name: String(school.school_name ?? "Asuncion National High School"),
          school_id: String(school.school_id ?? "304217"),
          school_head_name: String(school.school_head_name ?? ""),
          school_head_designation: String(school.school_head_designation ?? ""),
        },
        section,
        adviser_name: adviserName,
        month,
        month_label: monthLabel(month),
        report_start: bounds.start,
        report_end: cutoff,
        school_days: schoolDays.map((date) => ({
          date,
          date_no: Number(date.slice(-2)),
          day: weekdayCode(date),
        })),
        day_columns: Array.from({ length: MAX_DAY_COLUMNS }, (_, index) => {
          const date = schoolDays[index] ?? null;
          return date
            ? {
                date,
                date_no: Number(date.slice(-2)),
                day: weekdayCode(date),
              }
            : null;
        }),
        learners: { male: males, female: females },
        daily_totals: dailyTotals,
        summary: {
          beginning_enrollment: withTotal(beginningEnrollment),
          late_enrollment: withTotal(lateEnrollment),
          registered_end: registeredTotals,
          percentage_enrollment: percentageEnrollment,
          average_daily_attendance: {
            M: averageDaily.M,
            F: averageDaily.F,
            total: averageTotal,
          },
          percentage_attendance: percentageAttendance,
          five_consecutive_absences: withTotal(fiveConsecutive),
          drop_out: withTotal(dropOut),
          transferred_out: withTotal(transferOut),
          transferred_in: withTotal(transferIn),
          number_of_class_days: schoolDays.length,
          completed_class_days: completedDates.length,
        },
        completeness: {
          complete: missingByDate.length === 0,
          missing_entries: missingByDate.reduce((sum, item) => sum + item.missing, 0),
          missing_dates: missingByDate,
        },
      },
    });
  } catch (error) {
    console.error("SF2 load failed", error);
    return NextResponse.json(
      { error: "Unable to generate the monthly SF2 report." },
      { status: 500 }
    );
  }
}
