"use client";

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
      <div className={styles.identityRow}>
        <span>Name:</span>
        <strong className={styles.identityWide}>{card.full_name}</strong>
        <span>Age:</span>
        <strong>{card.age ?? ""}</strong>
        <span>Sex:</span>
        <strong>{card.sex}</strong>
      </div>
      <div className={styles.identityRow}>
        <span>LRN:</span>
        <strong className={styles.identityWide}>{card.lrn}</strong>
        <span>Grade:</span>
        <strong>{card.grade_level}</strong>
        <span>Section:</span>
        <strong>{card.section}</strong>
      </div>
      <div className={styles.identityRow}>
        <span>Track (SHS only):</span>
        <strong className={styles.track}>{card.track || ""}</strong>
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
        <span className={styles.fillLine} />
        <span>Date:</span>
        <span className={styles.fillLine} />
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

export function Sf9PrintForms({ detail }: { detail: Sf9Detail }) {
  const first = detail.cards?.[0];
  const second = detail.cards?.[1];

  return (
    <div className={styles.printDocument}>
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
