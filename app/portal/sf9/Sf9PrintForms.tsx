"use client";

import type { CSSProperties } from "react";
import { DEPED_LOGO_DATA_URI } from "../admin/sf10/Sf10LogoData";
import styles from "./sf9.module.css";

type GradeRow = {
  key: string;
  label: string;
  terms: Array<number | null>;
  final_grade: number | null;
  remarks: string;
  component?: boolean;
};

type Attendance = {
  months: string[];
  class_days: Record<string, number>;
  days_present: Record<string, number>;
  days_absent: Record<string, number>;
  total_class_days: number;
  total_present: number;
  total_absent: number;
};

export type Sf9LayoutSettings = {
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
};

export const DEFAULT_SF9_LAYOUT: Sf9LayoutSettings = {
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
};

export type Sf9CardData = {
  id: string;
  full_name: string;
  lrn: string;
  sex: string;
  age: number | null;
  grade_level: number;
  section: string;
  track: string;
  grade_rows: GradeRow[];
  general_average: number | null;
  attendance: Attendance;
  comments: string[];
};

type Sf9Detail = {
  activeYear: { name: string };
  schoolInformation: {
    school_name: string;
    school_id: string;
    district: string;
    division: string;
    region: string;
    school_address: string;
    school_head_name: string;
    school_head_designation: string;
  };
  adviser: { full_name: string };
  cards: Sf9CardData[];
  layoutSettings?: Sf9LayoutSettings;
};

function displayNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace(/\.0$/, "");
}

function padGradeRows(rows: GradeRow[]) {
  const target = 11;
  if (rows.length >= target) return rows.slice(0, target);
  return [
    ...rows,
    ...Array.from({ length: target - rows.length }, (_, index) => ({
      key: "blank-" + index,
      label: "",
      terms: [null, null, null],
      final_grade: null,
      remarks: "",
      component: false,
    })),
  ];
}

function HeaderBlock({
  school,
  schoolYear,
}: {
  school: Sf9Detail["schoolInformation"];
  schoolYear: string;
}) {
  return (
    <>
      <div className={styles.formHeader}>
        <img className={styles.depedLogo} src={DEPED_LOGO_DATA_URI} alt="" />
        <div className={styles.headerText}>
          <div>Republic of the Philippines</div>
          <strong>Department of Education</strong>
          <div>{school.region || "REGION XI"}</div>
          <strong>{school.division || "SCHOOLS DIVISION OF DAVAO DEL NORTE"}</strong>
          <div>{school.district || "Asuncion District"}</div>
          <div>{school.school_address || "Asuncion, Davao del Norte"}</div>
          <strong className={styles.schoolName}>
            {school.school_name || "ASUNCION NATIONAL HIGH SCHOOL"}
          </strong>
        </div>
        <img className={styles.schoolLogo} src="/school-logo.png" alt="" />
      </div>
      <div className={styles.reportTitle}>LEARNER&apos;S PERFORMANCE REPORT</div>
      <div className={styles.schoolYear}>School Year {schoolYear}</div>
    </>
  );
}

function LearnerIdentity({ card }: { card: Sf9CardData }) {
  return (
    <div className={styles.identity}>
      <div className={styles.identityNameRow}>
        <span>Name:</span>
        <strong>{card.full_name}</strong>
        <span>Age:</span>
        <strong>{card.age ?? ""}</strong>
        <span>Sex:</span>
        <strong>{card.sex}</strong>
      </div>
      <div className={styles.identityLrnRow}>
        <span>LRN:</span>
        <strong>{card.lrn}</strong>
        <i aria-hidden="true" />
        <span>Grade:</span>
        <strong>{card.grade_level}</strong>
        <span>Section:</span>
        <strong>{card.section}</strong>
      </div>
      <div className={styles.identityTrackRow}>
        <span>Track (SHS only):</span>
        <i aria-hidden="true" />
        <strong>{card.track || ""}</strong>
      </div>
    </div>
  );
}

function FrontCard({
  card,
  detail,
}: {
  card: Sf9CardData;
  detail: Sf9Detail;
}) {
  const rows = padGradeRows(card.grade_rows);
  return (
    <article className={styles.cardFront}>
      <HeaderBlock
        school={detail.schoolInformation}
        schoolYear={detail.activeYear?.name ?? ""}
      />

      <LearnerIdentity card={card} />

      <div className={styles.parentNote}>
        <div>Dear Parents,</div>
        <p>
          This Performance Report presents your child&apos;s progress and achievement
          in the different learning areas.
        </p>
        <p>
          The school welcomes you to reach out should you wish to know more about
          your child&apos;s learning and performance.
        </p>
      </div>

      <div className={styles.signaturesTop}>
        <div>
          <strong>{detail.schoolInformation.school_head_name}</strong>
          <span>{detail.schoolInformation.school_head_designation || "School Head"}</span>
        </div>
        <div>
          <strong>{detail.adviser.full_name || ""}</strong>
          <span>Adviser</span>
        </div>
      </div>

      <div className={styles.progressTitle}>LEARNING PROGRESS AND ACHIEVEMENT</div>
      <table className={styles.gradeTable}>
        <thead>
          <tr>
            <th rowSpan={2} className={styles.learningAreaCol}>Learning Areas</th>
            <th colSpan={3}>TERM</th>
            <th rowSpan={2} className={styles.finalCol}>Final<br />Grade</th>
            <th rowSpan={2} className={styles.remarksCol}>Remarks</th>
          </tr>
          <tr>
            <th>T1</th>
            <th>T2</th>
            <th>T3</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={row.component ? styles.componentRow : ""}>
              <td>{row.label}</td>
              <td>{displayNumber(row.terms?.[0])}</td>
              <td>{displayNumber(row.terms?.[1])}</td>
              <td>{displayNumber(row.terms?.[2])}</td>
              <td>{displayNumber(row.final_grade)}</td>
              <td>{row.remarks}</td>
            </tr>
          ))}
          <tr className={styles.generalAverageRow}>
            <td colSpan={4}>General Average</td>
            <td>{displayNumber(card.general_average)}</td>
            <td>
              {card.general_average === null
                ? ""
                : card.general_average >= 75
                  ? "Passed"
                  : "Failed"}
            </td>
          </tr>
        </tbody>
      </table>

      <div className={styles.descriptorTitle}>PERFORMANCE DESCRIPTORS</div>
      <table className={styles.descriptorTable}>
        <thead>
          <tr>
            <th>Grading Scale</th>
            <th>Descriptors</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>90-100</td><td>Advancing</td><td>Passed</td></tr>
          <tr><td>80-89</td><td>Benchmarking</td><td>Passed</td></tr>
          <tr><td>75-79</td><td>Connecting</td><td>Passed</td></tr>
          <tr><td>65-74</td><td>Developing</td><td>Failed</td></tr>
          <tr><td>0-64</td><td>Emerging</td><td>Failed</td></tr>
        </tbody>
      </table>
    </article>
  );
}

function AttendanceTable({ attendance }: { attendance: Attendance }) {
  const months = attendance.months;
  const row = (
    label: string,
    values: Record<string, number>,
    total: number
  ) => (
    <tr>
      <th>{label}</th>
      {months.map((month) => (
        <td key={month}>
          {attendance.class_days[month] > 0 ? displayNumber(values[month]) : ""}
        </td>
      ))}
      <td className={styles.totalCell}>
        {attendance.total_class_days > 0 ? displayNumber(total) : ""}
      </td>
    </tr>
  );

  return (
    <table className={styles.attendanceTable}>
      <thead>
        <tr>
          <th>Month</th>
          {months.map((month) => <th key={month}>{month}</th>)}
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {row("No. of Class Days", attendance.class_days, attendance.total_class_days)}
        {row("No. of Days Present", attendance.days_present, attendance.total_present)}
        {row("No. of Days Absent", attendance.days_absent, attendance.total_absent)}
      </tbody>
    </table>
  );
}

function BackCard({
  card,
  detail,
}: {
  card: Sf9CardData;
  detail: Sf9Detail;
}) {
  return (
    <article className={styles.cardBack}>
      <AttendanceTable attendance={card.attendance} />

      <div className={styles.backSectionTitle}>TEACHER&apos;S COMMENTS / REMARKS</div>
      <div className={styles.commentGrid}>
        {[1, 2, 3].map((term, index) => (
          <div key={term} className={styles.commentBlock}>
            <strong>Term {term}</strong>
            <p>{card.comments?.[index] || ""}</p>
          </div>
        ))}
      </div>

      <div className={styles.backSectionTitle}>PARENT/S GUARDIAN&apos;S SIGNATURE</div>
      <div className={styles.parentSignatureRows}>
        {[1, 2, 3].map((term) => (
          <div key={term}>
            <strong>Term {term}</strong><span />
          </div>
        ))}
      </div>

      <div className={styles.backSectionTitle}>CERTIFICATE OF TRANSFER</div>
      <div className={styles.transferText}>
        This is to certify that the above-named learner has satisfactorily completed the
        requirements for the grade level indicated.
      </div>
      <div className={styles.transferField}>
        <span>Admitted to Grade:</span>
        <span className={styles.fillLine} />
      </div>
      <div className={styles.transferField}>
        <span>Eligible for Admission to Grade:</span>
        <span className={styles.fillLine} />
      </div>

      <div className={styles.approvedRow}>
        <span>Approved:</span>
        <div>
          <strong>{detail.adviser.full_name || ""}</strong>
          <span>Adviser</span>
        </div>
      </div>

      <div className={styles.headSignature}>
        <strong>{detail.schoolInformation.school_head_name}</strong>
        <span>{detail.schoolInformation.school_head_designation || "School Head"}</span>
      </div>

      <div className={styles.backSectionTitle}>CANCELLATION OF ELIGIBILITY TO TRANSFER</div>
      <div className={styles.cancellationRow}>
        <span>Admitted in:</span>
        <span>Date:</span>
      </div>
      <div className={styles.headSignature}>
        <strong>{detail.schoolInformation.school_head_name}</strong>
        <span>{detail.schoolInformation.school_head_designation || "School Head"}</span>
      </div>
    </article>
  );
}

function EmptyHalf() {
  return <div className={styles.emptyHalf} aria-hidden="true" />;
}

export function Sf9PrintForms({
  detail,
  layoutSettings,
}: {
  detail: Sf9Detail;
  layoutSettings?: Sf9LayoutSettings;
}) {
  const first = detail.cards?.[0];
  const second = detail.cards?.[1];
  const layout = layoutSettings ?? detail.layoutSettings ?? DEFAULT_SF9_LAYOUT;

  const layoutStyle = {
    "--sf9-left-card-width": `${layout.leftCardWidthMm}mm`,
    "--sf9-right-card-width": `${layout.rightCardWidthMm}mm`,
    "--sf9-top": `${layout.topMm}mm`,
    "--sf9-bottom": `${layout.bottomMm}mm`,
    "--sf9-left-outer": `${layout.leftCardOuterMm}mm`,
    "--sf9-left-inner": `${layout.leftCardInnerMm}mm`,
    "--sf9-right-inner": `${layout.rightCardInnerMm}mm`,
    "--sf9-right-outer": `${layout.rightCardOuterMm}mm`,
    "--sf9-center-line": `${layout.centerLineMm}mm`,
    "--sf9-header-height": `${layout.headerHeightMm}mm`,
    "--sf9-header-gap": `${layout.headerGapMm}mm`,
    "--sf9-logo-size": `${layout.logoSizeMm}mm`,
    "--sf9-front-font": `${layout.frontFontPt}pt`,
    "--sf9-back-font": `${layout.backFontPt}pt`,
    "--sf9-line-height": String(layout.lineHeight),
  } as CSSProperties;

  return (
    <div className={styles.printDocument} style={layoutStyle}>
      <section className={styles.printSheet + " " + styles.frontSheet}>
        <div className={styles.halfSheet}>
          {first ? <FrontCard card={first} detail={detail} /> : <EmptyHalf />}
        </div>
        <div className={styles.cutLine} />
        <div className={styles.halfSheet}>
          {second ? <FrontCard card={second} detail={detail} /> : <EmptyHalf />}
        </div>
      </section>

      <section className={styles.printSheet + " " + styles.backSheet}>
        <div className={styles.halfSheet}>
          {first ? <BackCard card={first} detail={detail} /> : <EmptyHalf />}
        </div>
        <div className={styles.cutLine} />
        <div className={styles.halfSheet}>
          {second ? <BackCard card={second} detail={detail} /> : <EmptyHalf />}
        </div>
      </section>
    </div>
  );
}
