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

export function ShsSf10Form({ detail }: { detail: any }) {
  const subjects: any[] = [];
  return <AnnexSection title="CORE SUBJECTS" subjects={subjects} />;
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
