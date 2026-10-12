"use client";

import type { CSSProperties } from "react";

export type Sf2DayColumn = {
  date: string;
  date_no: number;
  day: string;
} | null;

export type Sf2Learner = {
  student_id: string;
  name: string;
  sex: "M" | "F";
  cells: Array<{
    date: string;
    state:
      | "present"
      | "absent"
      | "late"
      | "cutting"
      | "movement"
      | "not_enrolled"
      | "unrecorded";
    code: string;
  }>;
  absent: number;
  tardy: number;
  remarks: string;
};

type Trio = { M: number; F: number; total: number };

export type Sf2ReportData = {
  school_year: string;
  school: {
    school_name: string;
    school_id: string;
    school_head_name: string;
    school_head_designation: string;
  };
  section: { id: string; grade_level: number; name: string };
  adviser_name: string;
  month: string;
  month_label: string;
  day_columns: Sf2DayColumn[];
  learners: { male: Sf2Learner[]; female: Sf2Learner[] };
  daily_totals: Array<{ date: string; male: number; female: number; total: number }>;
  summary: {
    beginning_enrollment: Trio;
    late_enrollment: Trio;
    registered_end: Trio;
    percentage_enrollment: Trio;
    average_daily_attendance: Trio;
    percentage_attendance: Trio;
    five_consecutive_absences: Trio;
    drop_out: Trio;
    transferred_out: Trio;
    transferred_in: Trio;
    number_of_class_days: number;
    completed_class_days: number;
  };
  completeness: {
    complete: boolean;
    missing_entries: number;
    missing_dates: Array<{ date: string; missing: number }>;
  };
};

const COL_WIDTHS_MM = [
  5.3272,
  41.1701,
  18.1928,
  ...Array.from({ length: 25 }, () => 6.0609),
  10.8394,
  9.7389,
  11.5781,
  9.0052,
  8.453,
  7.1666,
  7.1666,
  8.453,
];

function pct(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "";
}

function avg(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "";
}

function AttendanceColGroup() {
  return (
    <colgroup>
      {COL_WIDTHS_MM.map((width, index) => (
        <col key={index} style={{ width: `${width}mm` }} />
      ))}
    </colgroup>
  );
}

function AttendanceHeader({ days }: { days: Sf2DayColumn[] }) {
  return (
    <thead>
      <tr className="sf2-head-top">
        <th rowSpan={3} colSpan={3} className="sf2-name-head">
          LEARNER&apos;S NAME
          <span>(Last Name, First Name, Middle Name)</span>
        </th>
        <th colSpan={25} className="sf2-days-title">
          (1st row for date, 2nd row for Day: M,T,W,TH,F)
        </th>
        <th colSpan={2} className="sf2-month-total-head">
          Total for the Month
        </th>
        <th rowSpan={3} colSpan={6} className="sf2-remarks-head">
          REMARK/S (If DROPPED OUT, state reason, please refer to legend number 2.
          <br />
          If TRANSFERRED IN/OUT, write the name of School.)
        </th>
      </tr>
      <tr className="sf2-date-row">
        {days.map((day, index) => (
          <th key={index}>{day?.date_no ?? ""}</th>
        ))}
        <th rowSpan={2}>ABSENT</th>
        <th rowSpan={2}>TARDY</th>
      </tr>
      <tr className="sf2-day-row">
        {days.map((day, index) => (
          <th key={index}>{day?.day ?? ""}</th>
        ))}
      </tr>
    </thead>
  );
}

function AttendanceCell({
  cell,
}: {
  cell:
    | {
        state:
          | "present"
          | "absent"
          | "late"
          | "cutting"
          | "movement"
          | "not_enrolled"
          | "unrecorded";
        code: string;
      }
    | undefined;
}) {
  const state = cell?.state ?? "not_enrolled";
  return (
    <td
      className={[
        "sf2-att-cell",
        state === "late" ? "sf2-half-upper" : "",
        state === "cutting" ? "sf2-half-lower" : "",
        state === "unrecorded" ? "sf2-unrecorded" : "",
        state === "not_enrolled" ? "sf2-not-enrolled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {state === "absent" ? "X" : state === "unrecorded" ? "?" : ""}
    </td>
  );
}

function LearnerRows({
  rows,
  dayColumns,
}: {
  rows: Sf2Learner[];
  dayColumns: Sf2DayColumn[];
}) {
  return (
    <>
      {rows.map((learner, index) => (
        <tr className="sf2-learner-row" key={learner.student_id}>
          <td className="sf2-no">{index + 1}</td>
          <td colSpan={2} className="sf2-learner-name">
            {learner.name}
          </td>
          {dayColumns.map((day, dayIndex) => (
            <AttendanceCell
              key={dayIndex}
              cell={day ? learner.cells?.[dayIndex] : undefined}
            />
          ))}
          <td className="sf2-small-total">{learner.absent}</td>
          <td className="sf2-small-total">{learner.tardy}</td>
          <td colSpan={6} className="sf2-learner-remarks">
            {learner.remarks}
          </td>
        </tr>
      ))}
    </>
  );
}

function TotalLabel({ label }: { label: string }) {
  return (
    <span className="sf2-total-label">
      <span className="sf2-arrow">◀</span>
      <span>{label}</span>
      <span className="sf2-arrow">▶</span>
    </span>
  );
}

function SexTotalRow({
  label,
  totals,
  dayColumns,
  combined = false,
}: {
  label: string;
  totals: number[];
  dayColumns: Sf2DayColumn[];
  combined?: boolean;
}) {
  return (
    <tr className={combined ? "sf2-sex-total sf2-combined-total" : "sf2-sex-total"}>
      <td colSpan={3}>
        <TotalLabel label={label} />
      </td>
      {dayColumns.map((day, index) => (
        <td key={index}>{day ? totals[index] ?? "" : ""}</td>
      ))}
      <td />
      <td />
      <td colSpan={6} />
    </tr>
  );
}

function TopInformation({ report }: { report: Sf2ReportData }) {
  return (
    <div className="sf2-top-block">
      <div className="sf2-logo-row" aria-hidden="true">
        <div className="sf2-deped-seal-frame">
          <img
            className="sf2-deped-seal"
            src="https://upload.wikimedia.org/wikipedia/commons/2/20/Department_of_Education.svg"
            alt=""
            loading="eager"
            decoding="sync"
            referrerPolicy="no-referrer"
            onError={(event) => {
              const image = event.currentTarget;
              if (image.dataset.fallbackUsed === "1") return;
              image.dataset.fallbackUsed = "1";
              image.src = "/sf2/deped-seal.webp";
            }}
          />
        </div>
        <div className="sf2-deped-wordmark-frame">
          <img
            className="sf2-deped-wordmark"
            src="https://upload.wikimedia.org/wikipedia/commons/8/8c/Department_of_Education_%28DepEd%29.svg"
            alt=""
            loading="eager"
            decoding="sync"
            referrerPolicy="no-referrer"
            onError={(event) => {
              const image = event.currentTarget;
              if (image.dataset.fallbackUsed === "1") return;
              image.dataset.fallbackUsed = "1";
              image.src = "/sf2/deped-wordmark.webp";
            }}
          />
        </div>
      </div>

      <header className="sf2-title-block">
        <h1>School Form 2 (SF2) Daily Attendance Report of Learners</h1>
        <p>(This replaced Form 1, Form 2 &amp; STS Form 4 - Absenteeism and Dropout Profile)</p>
      </header>

      <div className="sf2-meta-grid">
        <label className="school-id-label">School ID</label>
        <div className="school-id-value">{report.school.school_id}</div>
        <label className="school-year-label">School Year</label>
        <div className="school-year-value">{report.school_year}</div>
        <label className="month-label">Report for the Month of</label>
        <div className="month-value">{report.month_label}</div>

        <label className="school-name-label">Name of School</label>
        <div className="school-name-value">{report.school.school_name}</div>
        <label className="grade-label">Grade Level</label>
        <div className="grade-value">{report.section.grade_level}</div>
        <label className="section-label">Section</label>
        <div className="section-value">{report.section.name}</div>
      </div>
    </div>
  );
}

function SummaryTable({ report }: { report: Sf2ReportData }) {
  const s = report.summary;
  const rows: Array<[string, Trio, "int" | "pct" | "avg"]> = [
    ["* Enrolment as of (1st Friday of June)", s.beginning_enrollment, "int"],
    ["Late Enrollment during the month (beyond cut-off)", s.late_enrollment, "int"],
    ["Registered Learner as of end of the month", s.registered_end, "int"],
    ["Percentage of Enrolment as of end of the month", s.percentage_enrollment, "pct"],
    ["Average Daily Attendance", s.average_daily_attendance, "avg"],
    ["Percentage of Attendance for the month", s.percentage_attendance, "pct"],
    ["Number of students with 5 consecutive days of absences:", s.five_consecutive_absences, "int"],
    ["Drop out", s.drop_out, "int"],
    ["Transferred out", s.transferred_out, "int"],
    ["Transferred in", s.transferred_in, "int"],
  ];

  const renderValue = (value: number, type: "int" | "pct" | "avg") => {
    if (type === "pct") return pct(value);
    if (type === "avg") return avg(value);
    return String(Math.round(value));
  };

  return (
    <div className="sf2-summary-wrap">
      <table className="sf2-summary-table">
        <tbody>
          <tr>
            <th>Month:</th>
            <td>{report.month_label}</td>
            <th>No. of Days of Classes:</th>
            <td>{s.number_of_class_days}</td>
            <th colSpan={3}>Summary for the Month</th>
          </tr>
          <tr>
            <td colSpan={4} />
            <th>M</th>
            <th>F</th>
            <th>TOTAL</th>
          </tr>
          {rows.map(([label, values, type]) => (
            <tr key={label}>
              <td colSpan={4}>{label}</td>
              <td>{renderValue(values.M, type)}</td>
              <td>{renderValue(values.F, type)}</td>
              <td>{renderValue(values.total, type)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="sf2-certification">
        <p>I certify that this is a true and correct report.</p>
        <div className="sf2-sign-line">{report.adviser_name}</div>
        <small>(Signature of Teacher over Printed Name)</small>
        <p className="sf2-attested">Attested by:</p>
        <div className="sf2-sign-line">
          {report.school.school_head_name}
          {report.school.school_head_designation
            ? `, ${report.school.school_head_designation}`
            : ""}
        </div>
        <small>(Signature of School Head over Printed Name)</small>
      </div>
    </div>
  );
}

function Guidelines() {
  return (
    <div className="sf2-guidelines">
      <strong>GUIDELINES:</strong>
      <p>1. The attendance shall be accomplished daily. Refer to the codes for checking learners&apos; attendance.</p>
      <p>2. Dates shall be written in the preceding columns beside Learner&apos;s Name.</p>
      <p>3. To compute the following:</p>
      <div className="sf2-formula">
        <span>a. Percentage of Enrolment =</span>
        <span className="frac"><u>Registered Learner as of End of the Month</u><br />Enrolment as of 1st Friday of June</span>
        <span>x 100</span>
      </div>
      <div className="sf2-formula">
        <span>b. Average Daily Attendance =</span>
        <span className="frac"><u>Total Daily Attendance</u><br />Number of School Days in reporting month</span>
      </div>
      <div className="sf2-formula">
        <span>c. Percentage of Attendance for the month =</span>
        <span className="frac"><u>Average daily attendance</u><br />Registered Learner as of End of the month</span>
        <span>x 100</span>
      </div>
      <p>4. Every End of the month, the class adviser will submit this form to the office of the principal for recording of summary table into the School Form 4. Once signed by the principal, this form should be returned to the adviser.</p>
      <p>5. The adviser will extend necessary intervention including but not limited to home visitation to learner/s that committed 5 consecutive days of absences or those with potentials of dropping out.</p>
      <p>6. Attendance performance of learner is expected to reflect in Form 137 and Form 138 every grading period.</p>
      <p>* Beginning of School Year cut-off report is every 1st Friday of School Calendar Days.</p>
    </div>
  );
}

function Codes() {
  return (
    <div className="sf2-codes">
      <strong>1. CODES FOR CHECKING ATTENDANCE</strong>
      <p>blank- Present; &nbsp; (x)- Absent; Tardy (half shaded= Upper for Late Comer, Lower for Cutting Classes)</p>
      <strong>2. REASONS/CAUSES OF DROP-OUTS</strong>
      <p><b>a. Domestic-Related Factors</b></p>
      <p>a.1. Had to take care of siblings</p>
      <p>a.2. Early marriage/pregnancy</p>
      <p>a.3. Parents&apos; attitude toward schooling</p>
      <p>a.4. Family problems</p>
      <p><b>b. Individual-Related Factors</b></p>
      <p>b.1. Illness</p>
      <p>b.2. Overage</p>
      <p>b.3. Death</p>
      <p>b.4. Drug Abuse</p>
      <p>b.5. Poor academic performance</p>
      <p>b.6. Lack of interest/Distractions</p>
      <p>b.7. Hunger/Malnutrition</p>
      <p><b>c. School-Related Factors</b></p>
      <p>c.1. Teacher Factor</p>
      <p>c.2. Physical condition of classroom</p>
      <p>c.3. Peer influence</p>
      <p><b>d. Geographic/Environmental</b></p>
      <p>d.1. Distance between home and school</p>
      <p>d.2. Armed conflict (incl. Tribal wars &amp; clanfeuds)</p>
      <p>d.3. Calamities/Disasters</p>
      <p><b>e. Financial-Related</b></p>
      <p>e.1. Child labor, work</p>
      <p><b>f. Others</b></p>
    </div>
  );
}

export function Sf2PrintForm({ report }: { report: Sf2ReportData }) {
  const maleTotals = report.day_columns.map((day) => {
    if (!day) return 0;
    return report.daily_totals.find((item) => item.date === day.date)?.male ?? 0;
  });
  const femaleTotals = report.day_columns.map((day) => {
    if (!day) return 0;
    return report.daily_totals.find((item) => item.date === day.date)?.female ?? 0;
  });
  const combinedTotals = report.day_columns.map((day) => {
    if (!day) return 0;
    return report.daily_totals.find((item) => item.date === day.date)?.total ?? 0;
  });

  const learnerCount = report.learners.male.length + report.learners.female.length;
  const rosterRowHeight = learnerCount > 46 ? "4.35mm" : "4.68mm";
  const style = {
    "--sf2-roster-row-height": rosterRowHeight,
  } as CSSProperties;

  return (
    <div className="sf2-print-document" style={style}>
      <div className="sf2-flow-sheet">
        <TopInformation report={report} />

        <table className="sf2-attendance-table">
          <AttendanceColGroup />
          <AttendanceHeader days={report.day_columns} />
          <tbody>
            <LearnerRows rows={report.learners.male} dayColumns={report.day_columns} />
            <SexTotalRow
              label="MALE | TOTAL Per Day"
              totals={maleTotals}
              dayColumns={report.day_columns}
            />
            <LearnerRows rows={report.learners.female} dayColumns={report.day_columns} />
            <SexTotalRow
              label="FEMALE | TOTAL Per Day"
              totals={femaleTotals}
              dayColumns={report.day_columns}
            />
            <SexTotalRow
              label="Combined TOTAL PER DAY"
              totals={combinedTotals}
              dayColumns={report.day_columns}
              combined
            />
          </tbody>
        </table>

        <div className="sf2-bottom-spacer" />
        <div className="sf2-bottom-grid">
          <Guidelines />
          <Codes />
          <SummaryTable report={report} />
        </div>
        <div className="sf2-page-footer">School Form 2: Page 2 of ________</div>
      </div>
    </div>
  );
}
