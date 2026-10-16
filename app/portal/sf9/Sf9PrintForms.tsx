"use client";

import type { CSSProperties } from "react";
import { DEPED_LOGO_DATA_URI } from "../admin/sf10/Sf10LogoData";
import styles from "./sf9.module.css";
import { sf9Grade11Rows, sf9Grade11TotalUnits, type Sf9Grade11Offering } from "@/lib/sf9-grade11-layout";

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
  recorded_days?: Record<string, number>;
  unrecorded_days?: Record<string, number>;
  total_recorded?: number;
  total_unrecorded?: number;
};

export type Sf9FontFamily = "bookman" | "arial" | "times" | "calibri" | "georgia";

export type Sf9BlockId =
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

export type Sf9BlockStyle = {
  fontFamily?: Sf9FontFamily;
  fontPt?: number;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  offsetXMm?: number;
  offsetYMm?: number;
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
  blockStyles: Partial<Record<Sf9BlockId, Sf9BlockStyle>>;
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
  blockStyles: {},
};

const SF9_FONT_STACKS: Record<Sf9FontFamily, string> = {
  bookman: '"Bookman Old Style","Bookman","URW Bookman",serif',
  arial: 'Arial,Helvetica,sans-serif',
  times: '"Times New Roman",Times,serif',
  calibri: 'Calibri,"Segoe UI",Arial,sans-serif',
  georgia: 'Georgia,serif',
};

function blockStyle(
  layout: Sf9LayoutSettings,
  blockId: Sf9BlockId
): CSSProperties {
  const block = layout.blockStyles?.[blockId];
  if (!block) return {};

  const x = Number(block.offsetXMm ?? 0);
  const y = Number(block.offsetYMm ?? 0);
  return {
    fontFamily: block.fontFamily ? SF9_FONT_STACKS[block.fontFamily] : undefined,
    fontSize:
      typeof block.fontPt === "number" && Number.isFinite(block.fontPt)
        ? `${block.fontPt}pt`
        : undefined,
    fontWeight:
      block.bold === true ? 700 : block.bold === false ? 400 : undefined,
    fontStyle:
      block.italic === true
        ? "italic"
        : block.italic === false
          ? "normal"
          : undefined,
    textAlign: block.align,
    lineHeight:
      typeof block.lineHeight === "number" && Number.isFinite(block.lineHeight)
        ? block.lineHeight
        : undefined,
    transform:
      x !== 0 || y !== 0 ? `translate(${x}mm, ${y}mm)` : undefined,
  };
}

export type Sf9CardData = {
  id: string;
  full_name: string;
  lrn: string;
  sex: string;
  age: number | null;
  grade_level: number;
  section: string;
  track: string;
  shs_program_code?: string;
  elective_offerings?: Sf9Grade11Offering[];
  core_subject_units?: Record<string, number | null>;
  grade_rows: GradeRow[];
  general_average: number | null;
  general_averages_by_term?: Array<number | null>;
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
  layout,
}: {
  school: Sf9Detail["schoolInformation"];
  schoolYear: string;
  layout: Sf9LayoutSettings;
}) {
  return (
    <>
      <div
        className={styles.formHeader}
        data-sf9-block="header"
        style={blockStyle(layout, "header")}
      >
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
      <div
        className={styles.reportTitle}
        data-sf9-block="reportTitle"
        style={blockStyle(layout, "reportTitle")}
      >
        LEARNER&apos;S PERFORMANCE REPORT
      </div>
      <div
        className={styles.schoolYear}
        data-sf9-block="schoolYear"
        style={blockStyle(layout, "schoolYear")}
      >
        School Year {schoolYear}
      </div>
    </>
  );
}

function LearnerIdentity({
  card,
  layout,
}: {
  card: Sf9CardData;
  layout: Sf9LayoutSettings;
}) {
  return (
    <div
      className={styles.identity}
      data-sf9-block="learnerInfo"
      style={blockStyle(layout, "learnerInfo")}
    >
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
  layout,
}: {
  card: Sf9CardData;
  detail: Sf9Detail;
  layout: Sf9LayoutSettings;
}) {
  const grade11Rows = card.grade_level === 11
    ? sf9Grade11Rows(
        card.grade_rows,
        card.elective_offerings ?? [],
        card.shs_program_code ?? "",
        card.core_subject_units ?? {}
      )
    : null;
  const rows = grade11Rows ?? padGradeRows(card.grade_rows);
  return (
    <article className={styles.cardFront}>
      <HeaderBlock
        school={detail.schoolInformation}
        schoolYear={detail.activeYear?.name ?? ""}
        layout={layout}
      />

      <LearnerIdentity card={card} layout={layout} />

      <div
        className={styles.parentNote}
        data-sf9-block="parentNote"
        style={blockStyle(layout, "parentNote")}
      >
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

      <div
        className={styles.signaturesTop}
        data-sf9-block="frontSignatures"
        style={blockStyle(layout, "frontSignatures")}
      >
        <div>
          <strong>{detail.schoolInformation.school_head_name}</strong>
          <span>{detail.schoolInformation.school_head_designation || "School Head"}</span>
        </div>
        <div>
          <strong>{detail.adviser.full_name || ""}</strong>
          <span>Adviser</span>
        </div>
      </div>

      <div
        className={styles.progressTitle}
        data-sf9-block="progressTitle"
        style={blockStyle(layout, "progressTitle")}
      >
        LEARNING PROGRESS AND ACHIEVEMENT
      </div>
      <table
        className={styles.gradeTable + (card.grade_level === 11 ? " " + styles.grade11Table : "")}
        data-sf9-block="gradeTable"
        style={blockStyle(layout, "gradeTable")}
      >
        <thead>
          <tr>
            <th rowSpan={2} className={styles.learningAreaCol}>Learning Areas</th>
            <th colSpan={3}>TERM</th>
            {card.grade_level === 11 && <th rowSpan={2} className={styles.unitsCol}>Units</th>}
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
          {rows.map((row) => {
            const kind = "kind" in row ? row.kind : undefined;
            if (kind === "section") {
              return (
                <tr key={row.key} className={styles.shsSectionRow}>
                  <td colSpan={card.grade_level === 11 ? 7 : 6}>{row.label}</td>
                </tr>
              );
            }
            const group = kind === "group";
            return (
              <tr key={row.key} className={
                group ? styles.shsGroupLabelRow :
                "indent" in row && row.indent ? styles.shsIndentedRow : row.component ? styles.componentRow : ""
              }>
                <td>{row.label}</td>
                {[0,1,2].map((term) => (
                  <td key={term} className={
                    card.grade_level === 11 && "electiveTerm" in row &&
                    typeof row.electiveTerm === "number" && row.electiveTerm !== term + 1
                      ? styles.grade11UnusedTerm : ""
                  }>{displayNumber(row.terms?.[term])}</td>
                ))}
                {card.grade_level === 11 && <td className={styles.grade11UnitsCell}>
                  {("units" in row && typeof row.units === "number") ? displayNumber(row.units) : ""}
                </td>}
                <td>{displayNumber(row.final_grade)}</td>
                <td>{row.remarks}</td>
              </tr>
            );
          })}
          {card.grade_level === 11 ? (
            <tr className={styles.generalAverageRow + " " + styles.grade11GeneralAverage}>
              <td colSpan={4}>General Average</td>
              <td className={styles.grade11UnitsCell}>{sf9Grade11TotalUnits(grade11Rows ?? [])}</td>
              <td>{displayNumber(card.general_average)}</td>
              <td>{card.general_average === null ? "" : card.general_average >= 75 ? "Passed" : "Failed"}</td>
            </tr>
          ) : (
            <tr className={styles.generalAverageRow}>
              <td>General Average</td>
              <td>{displayNumber(card.general_averages_by_term?.[0] ?? null)}</td>
              <td>{displayNumber(card.general_averages_by_term?.[1] ?? null)}</td>
              <td>{displayNumber(card.general_averages_by_term?.[2] ?? null)}</td>
              <td>{displayNumber(card.general_average)}</td>
              <td>
                {card.general_average === null ? "" : card.general_average >= 75 ? "Passed" : "Failed"}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div
        className={styles.descriptorTitle}
        data-sf9-block="descriptorTitle"
        style={blockStyle(layout, "descriptorTitle")}
      >
        PERFORMANCE DESCRIPTORS
      </div>
      <table
        className={styles.descriptorTable}
        data-sf9-block="descriptorTable"
        style={blockStyle(layout, "descriptorTable")}
      >
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

function AttendanceTable({
  attendance,
  layout,
}: {
  attendance: Attendance;
  layout: Sf9LayoutSettings;
}) {
  const months = attendance.months;
  const row = (
    label: string,
    values: Record<string, number>,
    total: number,
    isClassDayRow = false
  ) => (
    <tr>
      <th>{label}</th>
      {months.map((month) => (
        <td key={month}>
          {attendance.class_days[month] > 0 &&
          (isClassDayRow || (attendance.recorded_days?.[month] ?? 0) > 0)
            ? displayNumber(values[month]) : ""}
        </td>
      ))}
      <td className={styles.totalCell}>
        {attendance.total_class_days > 0 &&
        (isClassDayRow || (attendance.total_recorded ?? 0) > 0)
          ? displayNumber(total) : ""}
      </td>
    </tr>
  );

  return (
    <table
      className={styles.attendanceTable}
      data-sf9-block="attendanceTable"
      style={blockStyle(layout, "attendanceTable")}
    >
      <thead>
        <tr>
          <th>Month</th>
          {months.map((month) => <th key={month}>{month}</th>)}
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {row("No. of Class Days", attendance.class_days, attendance.total_class_days, true)}
        {row("No. of Days Present", attendance.days_present, attendance.total_present)}
        {row("No. of Days Absent", attendance.days_absent, attendance.total_absent)}
      </tbody>
    </table>
  );
}

function BackCard({
  card,
  detail,
  layout,
}: {
  card: Sf9CardData;
  detail: Sf9Detail;
  layout: Sf9LayoutSettings;
}) {
  return (
    <article className={styles.cardBack}>
      <AttendanceTable attendance={card.attendance} layout={layout} />

      <div
        className={styles.backSectionTitle}
        data-sf9-block="comments"
        style={blockStyle(layout, "comments")}
      >
        TEACHER&apos;S COMMENTS / REMARKS
      </div>
      <div
        className={styles.commentGrid}
        data-sf9-block="comments"
        style={blockStyle(layout, "comments")}
      >
        {[1, 2, 3].map((term, index) => (
          <div key={term} className={styles.commentBlock}>
            <strong>Term {term}</strong>
            <p>{card.comments?.[index] || ""}</p>
          </div>
        ))}
      </div>

      <div
        className={styles.backSectionTitle}
        data-sf9-block="guardianSignatures"
        style={blockStyle(layout, "guardianSignatures")}
      >
        PARENT/S GUARDIAN&apos;S SIGNATURE
      </div>
      <div
        className={styles.parentSignatureRows}
        data-sf9-block="guardianSignatures"
        style={blockStyle(layout, "guardianSignatures")}
      >
        {[1, 2, 3].map((term) => (
          <div key={term}>
            <strong>Term {term}</strong><span />
          </div>
        ))}
      </div>

      <div
        className={styles.backSectionTitle}
        data-sf9-block="transfer"
        style={blockStyle(layout, "transfer")}
      >
        CERTIFICATE OF TRANSFER
      </div>
      <div
        className={styles.transferText}
        data-sf9-block="transfer"
        style={blockStyle(layout, "transfer")}
      >
        This is to certify that the above-named learner has satisfactorily completed the
        requirements for the grade level indicated.
      </div>
      <div
        className={styles.transferField}
        data-sf9-block="transfer"
        style={blockStyle(layout, "transfer")}
      >
        <span>Admitted to Grade:</span>
        <span className={styles.fillLine} />
      </div>
      <div
        className={styles.transferField}
        data-sf9-block="transfer"
        style={blockStyle(layout, "transfer")}
      >
        <span>Eligible for Admission to Grade:</span>
        <span className={styles.fillLine} />
      </div>

      <div
        className={styles.approvedRow}
        data-sf9-block="transfer"
        style={blockStyle(layout, "transfer")}
      >
        <span>Approved:</span>
        <div>
          <strong>{detail.adviser.full_name || ""}</strong>
          <span>Adviser</span>
        </div>
      </div>

      <div
        className={styles.headSignature}
        data-sf9-block="transfer"
        style={blockStyle(layout, "transfer")}
      >
        <strong>{detail.schoolInformation.school_head_name}</strong>
        <span>{detail.schoolInformation.school_head_designation || "School Head"}</span>
      </div>

      <div
        className={styles.backSectionTitle}
        data-sf9-block="cancellation"
        style={blockStyle(layout, "cancellation")}
      >
        CANCELLATION OF ELIGIBILITY TO TRANSFER
      </div>
      <div
        className={styles.cancellationRow}
        data-sf9-block="cancellation"
        style={blockStyle(layout, "cancellation")}
      >
        <span>Admitted in:</span>
        <span>Date:</span>
      </div>
      <div
        className={styles.headSignature}
        data-sf9-block="cancellation"
        style={blockStyle(layout, "cancellation")}
      >
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
          {first ? <FrontCard card={first} detail={detail} layout={layout} /> : <EmptyHalf />}
        </div>
        <div className={styles.cutLine} />
        <div className={styles.halfSheet}>
          {second ? <FrontCard card={second} detail={detail} layout={layout} /> : <EmptyHalf />}
        </div>
      </section>

      <section className={styles.printSheet + " " + styles.backSheet}>
        <div className={styles.halfSheet}>
          {first ? <BackCard card={first} detail={detail} layout={layout} /> : <EmptyHalf />}
        </div>
        <div className={styles.cutLine} />
        <div className={styles.halfSheet}>
          {second ? <BackCard card={second} detail={detail} layout={layout} /> : <EmptyHalf />}
        </div>
      </section>
    </div>
  );
}
