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
  const records: any[] = Array.isArray(detail.scholasticRecords) ? detail.scholasticRecords : [];
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
  const records: any[] = Array.isArray(detail.scholasticRecords) ? detail.scholasticRecords : [];
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

function ShsSemesterBlock({
  record,
  semester,
  school,
  track,
  strand,
  schoolHead,
  designation,
  rows = 9,
}: {
  record?: any;
  semester: "1ST" | "2ND";
  school: any;
  track: string;
  strand: string;
  schoolHead: string;
  designation: string;
  rows?: number;
}) {
  const subjects = paddedSubjects(record?.subjects ?? [], rows);
  return (
    <section className="shs-semester">
      <table className="shs-meta-table sf10-grid">
        <tbody>
          <tr>
            <td><b>SCHOOL:</b></td><td colSpan={7}>{record ? text(school.school_name).toUpperCase() : ""}</td>
            <td><b>SCHOOL ID:</b></td><td colSpan={2}>{record ? text(school.school_id) : ""}</td>
            <td><b>GRADE LEVEL:</b></td><td>{record?.grade_level ?? ""}</td>
            <td><b>SY:</b></td><td colSpan={2}>{record?.school_year ?? ""}</td>
            <td><b>SEM:</b></td><td>{semester}</td>
          </tr>
          <tr>
            <td><b>TRACK/STRAND:</b></td><td colSpan={12}>{record ? [track, strand].filter(Boolean).join(" / ") : ""}</td>
            <td><b>SECTION:</b></td><td colSpan={4}>{record?.section ?? ""}</td>
          </tr>
        </tbody>
      </table>

      <table className="sf10-grid shs-grade-table">
        <thead>
          <tr>
            <th rowSpan={2} className="shs-type-col">Indicate if Subject is CORE, APPLIED, or SPECIALIZED</th>
            <th rowSpan={2} className="shs-subject-col">SUBJECTS</th>
            <th colSpan={2}>Quarter</th>
            <th rowSpan={2} className="shs-final-col">SEM FINAL GRADE</th>
            <th rowSpan={2} className="shs-action-col">ACTION TAKEN</th>
          </tr>
          <tr>
            <th className="shs-quarter">{semester === "1ST" ? "1ST" : "3RD"}</th>
            <th className="shs-quarter">{semester === "1ST" ? "2ND" : "4TH"}</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject, index) => (
            <tr key={subject?.assignment_id ?? `shs-blank-${semester}-${index}`}>
              <td>{subject ? "Core/Applied/Specialized" : ""}</td>
              <td className="subject-cell">{subject?.subject ?? ""}</td>
              <td>{subject?.terms?.[semester === "1ST" ? 0 : 2] ?? ""}</td>
              <td>{subject?.terms?.[semester === "1ST" ? 1 : 3] ?? ""}</td>
              <td>{subject?.final_rating ?? ""}</td>
              <td>{subject?.remarks ?? ""}</td>
            </tr>
          ))}
          <tr className="general-row">
            <td colSpan={4}><b>General Ave. for the Semester:</b></td>
            <td>{record?.general_average ?? ""}</td>
            <td>{record?.general_average == null ? "" : record.general_average >= 75 ? "PROMOTED" : "RETAINED"}</td>
          </tr>
        </tbody>
      </table>

      <div className="shs-remarks"><b>REMARKS:</b> <span></span></div>
      <div className="shs-sign-row">
        <div><b>Prepared by:</b><strong>{record?.adviser_name ?? ""}</strong><small>Signature of Adviser over Printed Name</small></div>
        <div><b>Certified True and Correct:</b><strong>{schoolHead}{schoolHead ? `, ${designation}` : ""}</strong><small>Signature of Authorized Person over Printed Name, Designation</small></div>
        <div><b>Date Checked (MM/DD/YYYY):</b><strong></strong></div>
      </div>

      <div className="shs-remedial-head">
        <b>REMEDIAL CLASSES</b>
        <span>Conducted from (MM/DD/YYYY): __________</span>
        <span>to (MM/DD/YYYY): __________</span>
        <span>SCHOOL: __________________</span>
        <span>SCHOOL ID: ________</span>
      </div>
      <table className="sf10-grid shs-remedial-table">
        <thead>
          <tr>
            <th>Indicate if Subject is CORE, APPLIED, or SPECIALIZED</th>
            <th>SUBJECTS</th>
            <th>SEM FINAL GRADE</th>
            <th>REMEDIAL CLASS MARK</th>
            <th>RECOMPUTED FINAL GRADE</th>
            <th>ACTION TAKEN</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>
        </tbody>
      </table>
      <div className="shs-teacher-sign">
        <span><b>Name of Teacher/Adviser:</b> __________________________</span>
        <span><b>Signature:</b> ____________________</span>
      </div>
    </section>
  );
}

export function ShsSf10Form({ detail }: { detail: Sf10Detail }) {
  const record = detail.permanentRecord ?? {};
  const school = detail.schoolInformation ?? {};
  const student = detail.student ?? {};
  const records: any[] = Array.isArray(detail.scholasticRecords) ? detail.scholasticRecords : [];
  const grade11 = records.filter((item) => Number(item.grade_level) === 11);
  const grade12 = records.filter((item) => Number(item.grade_level) === 12);
  const schoolHead = text(school.school_head_name);
  const designation = text(school.school_head_designation) || "Principal IV";
  const track = text(record.shs_track) || "ACADEMIC";
  const strand = text(record.shs_strand);
  const allSubjects: any[] = records.flatMap((item: any) =>
    Array.isArray(item.subjects) ? item.subjects : []
  );
  const finalRatings = allSubjects
    .map((item: any) => item.final_rating)
    .filter((value: any) => typeof value === "number") as number[];
  const shsAverage = finalRatings.length
    ? Math.round((finalRatings.reduce((sum, value) => sum + value, 0) / finalRatings.length) * 100) / 100
    : "";

  return (
    <div className="sf10-form-root shs-root">
      <section className="sf10-paper shs-paper">
        <div className="shs-form-code">SF10-SHS</div>
        <header className="shs-heading">
          <span>REPUBLIC OF THE PHILIPPINES</span>
          <span>DEPARTMENT OF EDUCATION</span>
          <strong>SENIOR HIGH SCHOOL STUDENT PERMANENT RECORD</strong>
        </header>

        <div className="section-band shs-band">LEARNER&apos;S INFORMATION</div>
        <table className="info-table shs-info">
          <tbody>
            <tr>
              <td className="label">LAST NAME:</td><td className="value">{text(record.last_name)}</td>
              <td className="label">FIRST NAME:</td><td className="value">{text(record.first_name)}</td>
              <td className="label">MIDDLE NAME:</td><td className="value">{text(record.middle_name)}</td>
            </tr>
            <tr>
              <td className="label">LRN:</td><td className="value">{text(student.lrn)}</td>
              <td className="label">Date of Birth (MM/DD/YYYY):</td><td className="value">{displayDate(record.birth_date)}</td>
              <td className="label">Sex:</td><td className="value">{text(record.sex).toUpperCase()}</td>
            </tr>
            <tr>
              <td colSpan={4}></td>
              <td className="label">Date of SHS Admission (MM/DD/YYYY):</td>
              <td className="value">{displayDate(record.shs_admission_date)}</td>
            </tr>
          </tbody>
        </table>

        <div className="section-band shs-band">ELIGIBILITY FOR SHS ENROLMENT</div>
        <div className="shs-eligibility">
          <div>
            <span className="checkbox-box"></span> High School Completer*
            <span>Gen. Ave: <u>{text(record.jhs_general_average)}</u></span>
            <span className="checkbox-box">✓</span> Junior High School Completer
            <span>Gen. Ave: <u>{text(record.jhs_general_average)}</u></span>
          </div>
          <div>
            <span>Date of Graduation/Completion (MM/DD/YYYY): <u>{displayDate(record.jhs_completion_date)}</u></span>
            <span>Name of School: <u>{text(record.jhs_school_name) || text(school.school_name)}</u></span>
            <span>School Address: <u>{text(record.jhs_school_address) || text(school.school_address)}</u></span>
          </div>
          <div>
            <span className="checkbox-box"></span> PEPT Passer** <span>Rating: ______</span>
            <span className="checkbox-box"></span> ALS A&amp;E Passer*** <span>Rating: ______</span>
            <span>Others (Pls. Specify): __________________</span>
          </div>
          <div>
            <span>Date of Examination/Assessment (MM/DD/YYYY): __________________</span>
            <span>Name and Address of Community Learning Center: ______________________________</span>
          </div>
          <small>*High School Completers are students who graduated from secondary school under the old curriculum</small>
          <small>**PEPT - Philippine Educational Placement Test for JHS &nbsp;&nbsp;&nbsp; ***ALS A&amp;E - Alternative Learning System Accreditation and Equivalency Test for JHS</small>
        </div>

        <div className="section-band shs-band">SCHOLASTIC RECORD</div>
        <ShsSemesterBlock record={grade11[0]} semester="1ST" school={school} track={track} strand={strand} schoolHead={schoolHead} designation={designation} rows={9} />
        <ShsSemesterBlock record={grade11[1] ?? grade11[0]} semester="2ND" school={school} track={track} strand={strand} schoolHead={schoolHead} designation={designation} rows={9} />
      </section>

      <section className="sf10-paper shs-paper">
        <div className="page-two-head shs-page-two"><span>Page 2</span><span>SF10-SHS</span></div>
        <ShsSemesterBlock record={grade12[0]} semester="1ST" school={school} track={track} strand={strand} schoolHead={schoolHead} designation={designation} rows={10} />
        <ShsSemesterBlock record={grade12[1] ?? grade12[0]} semester="2ND" school={school} track={track} strand={strand} schoolHead={schoolHead} designation={designation} rows={10} />

        <section className="shs-completion">
          <div><b>Track/Strand Accomplished:</b> <u>{[track, strand].filter(Boolean).join(" / ")}</u><span><b>SHS General Average:</b> <u>{shsAverage}</u></span></div>
          <div><b>Awards/Honors Received:</b> <u>{text(record.awards_honors)}</u><span><b>Date of SHS Graduation (MM/DD/YYYY):</b> <u>{displayDate(record.shs_graduation_date)}</u></span></div>
          <div className="certified-by"><b>Certified by:</b><span className="seal-title">Place School Seal Here:</span></div>
          <div className="school-head-cert">
            <strong>{schoolHead}</strong><span>{displayDate(record.sf10_date_issued)}</span>
            <small>Signature of School Head over Printed Name</small><small>Date</small>
            <em>{designation}</em>
          </div>
        </section>

        <section className="shs-note">
          <b>NOTE:</b>
          <p>
            This permanent record or a photocopy of this permanent record that bears the seal of the school and the original signature in ink of the School Head shall be considered valid for all legal purposes. Any erasure or alteration made on this copy should be validated by the School Head.
          </p>
          <p>
            If the student transfers to another school, the originating school should produce one (1) certified true copy of this permanent record for safekeeping. The receiving school shall continue filling up the original form.
          </p>
          <p>
            Upon graduation, the school from which the student graduated should keep the original form and produce one (1) certified true copy for the Division Office.
          </p>
        </section>
      </section>

      <section className="sf10-paper shs-annex-paper">
        <div className="annex-code">Form 137-SHS</div>
        <h2>ANNEX: LIST OF SUBJECTS TAKEN</h2>
        <p>Please check the subjects passed by the student</p>
        <AnnexSection title="CORE SUBJECTS" subjects={allSubjects.filter((_: any, index: number) => index < 15)} />
        <div className="annex-note">*STEM students will take these instead:</div>
        <AnnexSection title="APPLIED SUBJECTS" subjects={allSubjects.slice(15, 22)} />
        <AnnexSection title="SPECIALIZED SUBJECTS (Please write the list of subjects below)" subjects={allSubjects.slice(22, 32)} />
        <AnnexSection title="OTHER SUBJECTS (Please write the list of subjects below)" subjects={allSubjects.slice(32, 42)} />
      </section>
    </div>
  );
}

function AnnexSection({ title, subjects }: { title: string; subjects: any[] }) {
  const rows = paddedSubjects(subjects, title.startsWith("CORE") ? 15 : title.startsWith("APPLIED") ? 7 : 10);
  return (
    <section className="annex-section">
      <h3>{title}</h3>
      {rows.map((subject, index) => (
        <div className="annex-row" key={subject?.assignment_id ?? `annex-${title}-${index}`}>
          <span className="annex-check">{subject?.remarks === "Passed" || subject?.remarks === "PASSED" ? "✓" : ""}</span>
          <span>{subject?.subject ?? ""}</span>
        </div>
      ))}
    </section>
  );
}
