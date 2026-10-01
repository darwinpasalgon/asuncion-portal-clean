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


export function JhsSf10Form({ detail }: { detail: any }) {
  return <div>JHS SF10 debug</div>;
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


export function ShsSf10Form({ detail }: { detail: any }) {
  return (
    <ShsSemesterBlock
      record={undefined}
      semester="1ST"
      school={{}}
      track=""
      strand=""
      schoolHead=""
      designation=""
    />
  );
}
