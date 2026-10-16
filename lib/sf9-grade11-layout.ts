// Grade 11 SF9 learning-area layout transcribed from AMOGUIS.xlsx,
// "SF9 - GRADE 11 ACADEMIC", rows 32–44 (SY 2026–2027).
// This is a display layout. It never creates learner grades or assignments.
export type Sf9Grade11GradeRow = {
  key: string;
  label: string;
  terms: Array<number | null>;
  final_grade: number | null;
  remarks: string;
  component?: boolean;
};

export type Sf9Grade11Offering = {
  term_no: number;
  name: string;
};

export type Sf9Grade11DisplayRow = Sf9Grade11GradeRow & {
  kind: "section" | "group" | "subject";
  indent?: boolean;
  electiveTerm?: number;
};

export const GRADE11_SF9_CORE_ORDER = [
  "Effective Communication",
  "Mabisang Komunikasyon",
  "General Mathematics",
  "General Science",
  "Life and Career Skills",
  "Pag-Aaral ng Kasanayan at Lipunang Pilipino",
] as const;

export const GRADE11_COMMUNICATION_LABEL =
  "Effective Communication /Mabisang Komunikasyon";

export function sf9Grade11Rows(
  gradeRows: Sf9Grade11GradeRow[],
  electiveOfferings: Sf9Grade11Offering[] = [],
  programCode = ""
): Sf9Grade11DisplayRow[] {
  const normalize = (text: string) =>
    String(text ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  const byName = new Map(
    gradeRows.map((row) => [normalize(row.label), row])
  );
  const findGradeRow = (label: string) => byName.get(normalize(label));

  function subjectRow(label: string, key: string, indent = false): Sf9Grade11DisplayRow {
    const existing = findGradeRow(label);
    return {
      key, label, kind: "subject", indent,
      terms: existing?.terms ?? [null, null, null],
      final_grade: existing?.final_grade ?? null,
      remarks: existing?.remarks ?? "",
    };
  }

  const heading = (key: string, label: string, kind: "section" | "group"): Sf9Grade11DisplayRow => ({
    key, label, kind, terms: [null, null, null], final_grade: null, remarks: "",
  });

  const rows: Sf9Grade11DisplayRow[] = [
    heading("shs11-core-heading", "Core Subjects", "section"),
    heading("shs11-language-heading", GRADE11_COMMUNICATION_LABEL, "group"),
    ...GRADE11_SF9_CORE_ORDER.map((label, i) => subjectRow(
      label, "shs11-core-" + i, i < 2
    )),
    heading("shs11-elective-heading", "Elective Subjects", "section"),
  ];

  const defaults = programCode === "ASSH"
    ? ["Social Science Theory and Practice", "Academic Elective 2", "Academic Elective 3"]
    : ["Academic Elective 1", "Academic Elective 2", "Academic Elective 3"];

  for (const termNo of [1, 2, 3]) {
    const chosen = electiveOfferings.filter(
      (offering) => offering.term_no === termNo && offering.name.trim()
    );
    const names = chosen.length ? chosen.map((offering) => offering.name) : [defaults[termNo - 1]];
    for (const [index, name] of names.entries()) {
      const source = findGradeRow(name);
      // Each elective belongs to its configured term; never copy a grade into
      // another term's cell or invent a final mark for a single-term subject.
      const terms: Array<number | null> = [null, null, null];
      terms[termNo - 1] = source?.terms?.[termNo - 1] ?? null;
      rows.push({
        key: "shs11-elective-" + termNo + "-" + index,
        label: name,
        terms,
        kind: "subject",
        electiveTerm: termNo,
        final_grade: null,
        remarks: "",
      });
    }
  }
  return rows;
}
