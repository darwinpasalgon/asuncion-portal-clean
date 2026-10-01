"use client";

type Sf10Detail = any;

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function displayDate(value: unknown) {
  const raw = text(value).trim();
  if (!raw) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (match) return `${match[2]}/${match[3]}/${match[1]}`;
  return raw;
}

function paddedSubjects(subjects: any[] = [], count = 12) {
  return Array.from({ length: count }, (_, index) => subjects[index] ?? null);
}

function shortRegion(value: unknown) {
  const raw = text(value);
  const match = raw.match(/Region\s+([IVX]+)/i);
  return match?.[1] ?? (raw.replace(/^Region\s+/i, "") || "XI");
}

function JhsGradeBlock({
  record,
  school,
  emptyRows = 12,
}: {
  record?: any;
  school: any;
  emptyRows?: number;
}) {
  const subjects = paddedSubjects(record?.subjects ?? [], emptyRows);
  return (
    <section className="jhs-grade-block">
      <div className="jhs-meta-row">
        <span><b>School:</b> <u>{record ? text(school.school_name) : ""}</u></span>
        <span><b>School ID:</b> <u>{record ? text(school.school_id) : ""}</u></span>
        <span><b>District:</b> <u>{record ? text(school.district) : ""}</u></span>
        <span><b>Division:</b> <u>{record ? text(school.division) : ""}</u></span>
        <span><b>Region:</b> <u>{record ? shortRegion(school.region) : ""}</u></span>
      </div>
      <div className="jhs-meta-row jhs-meta-row-2">
        <span><b>Classified as Grade:</b> <u>{record ? `Grade - ${record.grade_level}` : ""}</u></span>
        <span><b>Section:</b> <u>{record ? record.section : ""}</u></span>
        <span><b>School Year:</b> <u>{record ? record.school_year : ""}</u></span>
        <span className="grow"><b>Name of Adviser/Teacher:</b> <u>{record ? record.adviser_name : ""}</u></span>
        <span><b>Signature:</b> <u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></span>
      </div>

      <table className="sf10-grid jhs-grade-table">
        <thead>
          <tr>
            <th rowSpan={2} className="area-col">LEARNING AREAS</th>
            <th colSpan={4}>QUARTERLY RATING</th>
            <th rowSpan={2} className="final-col">FINAL<br/>RATING</th>
            <th rowSpan={2} className="remarks-col">REMARKS</th>
          </tr>
          <tr>
            <th className="quarter-col">1</th>
            <th className="quarter-col">2</th>
            <th className="quarter-col">3</th>
            <th className="quarter-col">4</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject, index) => (
            <tr key={subject?.assignment_id ?? `blank-${index}`}>
              <td className="subject-cell">{subject?.subject ?? ""}</td>
              <td>{subject?.terms?.[0] ?? ""}</td>
              <td>{subject?.terms?.[1] ?? ""}</td>
              <td>{subject?.terms?.[2] ?? ""}</td>
              <td>{subject?.terms?.[3] ?? ""}</td>
              <td>{subject?.final_rating ?? ""}</td>
              <td>{subject?.remarks ?? ""}</td>
            </tr>
          ))}
          <tr className="general-row">
            <td colSpan={5}><b><i>General Average</i></b></td>
            <td>{record?.general_average ?? ""}</td>
            <td>{record?.general_average == null ? "" : record.general_average >= 75 ? "PROMOTED" : "RETAINED"}</td>
          </tr>
        </tbody>
      </table>

      <div className="remedial-title-row">
        <b>Remedial Classes</b>
        <span>Conducted from (mm/dd/yyyy) ____________________ to (mm/dd/yyyy) _______________</span>
      </div>
      <table className="sf10-grid remedial-table">
        <thead>
          <tr>
            <th>Learning Areas</th>
            <th>Final Rating</th>
            <th>Remedial Class Mark</th>
            <th>Recomputed Final Grade</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
          <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
          <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
        </tbody>
      </table>
    </section>
  );
}

function JhsCertification({
  detail,
  transferOnly = false,
}: {
  detail: Sf10Detail;
  transferOnly?: boolean;
}) {
  const school = detail.schoolInformation ?? {};
  const student = detail.student ?? {};
  const records = detail.scholasticRecords ?? [];
  const last = records[records.length - 1];
  const nextGrade = last?.grade_level ? Math.min(12, Number(last.grade_level) + 1) : "";
  const schoolHead = text(school.school_head_name);
  const designation = text(school.school_head_designation) || "Principal IV";

  return (
    <section className="jhs-certification">
      {transferOnly && <div className="transfer-note">For Transfer Out /JHS Completer Only</div>}
      <div className="cert-title">CERTIFICATION</div>
      <p>
        I CERTIFY that this is a true record of <u>{text(student.full_name)}</u> with LRN{" "}
        <u>{text(student.lrn)}</u> and that he/she is eligible for admission to Grade{" "}
        <u>{nextGrade}</u>.
      </p>
      <p>
        Name of School: <u>{text(school.school_name)}</u> &nbsp;&nbsp; School ID:{" "}
        <u>{text(school.school_id)}</u> &nbsp;&nbsp; Last School Year Attended:{" "}
        <u>{last?.school_year ?? ""}</u>
      </p>
      <div className="cert-signature-row">
        <div><span className="signature-line"></span><small>Date</small></div>
        <div>
          <span className="signature-line">{schoolHead}</span>
          <small>Name of Principal/School Head over Printed Name</small>
          <em>{designation}</em>
        </div>
        <div><span className="seal-box">(Affix School Seal here)</span></div>
      </div>
    </section>
  );
}

export function JhsSf10Form({ detail }: { detail: Sf10Detail }) {
  const record = detail.permanentRecord ?? {};
  const school = detail.schoolInformation ?? {};
  const student = detail.student ?? {};
  const records = detail.scholasticRecords ?? [];
  const frontRecords = records.slice(0, 2);
  const backRecords = records.slice(2, 5);

  return (
    <div className="sf10-form-root jhs-root">
      <section className="sf10-paper jhs-paper">
        <div className="form-code">SF 10-JHS</div>
        <header className="jhs-heading">
          <div>Republic of the Philippines</div>
          <div>Department of Education</div>
          <strong>Learner Permanent Record for Junior High School (SF10-JHS)</strong>
          <em>(Formerly Form 137)</em>
        </header>

        <div className="section-band">LEARNER&apos;S INFORMATION</div>
        <table className="info-table">
          <tbody>
            <tr>
              <td className="label">LAST NAME:</td>
              <td className="value">{text(record.last_name)}</td>
              <td className="label">FIRST NAME:</td>
              <td className="value">{text(record.first_name)}</td>
              <td className="label">NAME EXTN. (Jr,I,II):</td>
              <td className="value">{text(record.name_extension)}</td>
              <td className="label">MIDDLE NAME:</td>
              <td className="value">{text(record.middle_name)}</td>
            </tr>
            <tr>
              <td className="label" colSpan={2}>Learner Reference Number (LRN):</td>
              <td className="value" colSpan={2}>{text(student.lrn)}</td>
              <td className="label">Birthdate (mm/dd/yyyy):</td>
              <td className="value">{displayDate(record.birth_date)}</td>
              <td className="label">Sex:</td>
              <td className="value">{text(record.sex).toUpperCase()}</td>
            </tr>
          </tbody>
        </table>

        <div className="section-band">ELIGIBILITY FOR JHS ENROLMENT</div>
        <div className="eligibility-box">
          <div className="eligibility-line">
            <span className="checkbox-box">{text(record.eligibility_type) === "elementary_completer" ? "✓" : ""}</span>
            <span>Elementary School Completer</span>
            <span>General Average: <u>{text(record.elementary_general_average)}</u></span>
            <span>Citation: (If Any) <u>{text(record.elementary_citation)}</u></span>
          </div>
          <div className="eligibility-line">
            <span>Name of Elementary School: <u>{text(record.elementary_school_name)}</u></span>
            <span>School ID: <u>{text(record.elementary_school_id)}</u></span>
            <span>Address of School: <u>{text(record.elementary_school_address)}</u></span>
          </div>
          <div className="other-credential">Other Credential Presented</div>
          <div className="eligibility-line credential-line">
            <span className="checkbox-box">{text(record.eligibility_type) === "pept" ? "✓" : ""}</span>
            <span>PEPT Passer</span>
            <span>Rating: <u>{text(record.eligibility_rating)}</u></span>
            <span className="checkbox-box">{text(record.eligibility_type) === "a_and_e" ? "✓" : ""}</span>
            <span>ALS A &amp; E Passer</span>
            <span>Rating: <u>{text(record.eligibility_rating)}</u></span>
            <span>Others (Pls. Specify): <u>{text(record.eligibility_other)}</u></span>
          </div>
          <div className="eligibility-line">
            <span>Date of Examination/Assessment (mm/dd/yyyy): <u>{displayDate(record.assessment_date)}</u></span>
            <span>Name and Address of Testing Center: <u>{text(record.testing_center)}</u></span>
          </div>
        </div>

        <div className="section-band">SCHOLASTIC RECORD</div>
        <JhsGradeBlock record={frontRecords[0]} school={school} emptyRows={12} />
        <JhsGradeBlock record={frontRecords[1]} school={school} emptyRows={14} />
        <JhsCertification detail={detail} />
      </section>

      <section className="sf10-paper jhs-paper">
        <div className="page-two-head">
          <span>SF 10-JHS</span><span>Pag 2 of ________</span>
        </div>
        <JhsGradeBlock record={backRecords[0]} school={school} emptyRows={12} />
        <JhsGradeBlock record={backRecords[1]} school={school} emptyRows={12} />
        <JhsGradeBlock record={backRecords[2]} school={school} emptyRows={12} />
        <JhsCertification detail={detail} transferOnly />
        <div className="jhs-footer-note"><span>(May add Certification box if needed)</span><span>SFRT Revised 2017</span></div>
      </section>
    </div>
  );
}


export function ShsSf10Form({ detail }: { detail: any }) {
  return <div>SHS SF10 debug</div>;
}
