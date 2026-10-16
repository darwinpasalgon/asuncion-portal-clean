// Grade 11 SF9 subject arrangement from the original AMOGUIS.xlsx.
// Credit units are optional until the revised official template supplies them.
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
  units?: number | null;
};

export type Sf9Grade11DisplayRow = Sf9Grade11GradeRow & {
  kind: "section" | "group" | "subject";
  indent?: boolean;
  electiveTerm?: number;
  units?: number | null;
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
  programCode = "",
  coreUnits: Record<string, number | null> = {}
): Sf9Grade11DisplayRow[] {
  const normalize = (text: string) =>
    String(text ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  const byName = new Map(
    gradeRows.map((row) => [normalize(row.label), row])
  );
  const findGradeRow = (label: string) => byName.get(normalize(label));
  const unitsByName = new Map(
    Object.entries(coreUnits).map(([name, units]) => [normalize(name), units])
  );

  function subjectRow(label: string, key: string, indent = false): Sf9Grade11DisplayRow {
    const existing = findGradeRow(label);
    return {
      key, label, kind: "subject", indent,
      units: unitsByName.get(normalize(label)) ?? null,
      terms: existing?.terms ?? [null, null, null],
      final_grade: existing?.final_grade ?? null,
      remarks: existing?.remarks ?? "",
    };
  }

  const heading = (key: string, label: string, kind: "section" | "group"): Sf9Grade11DisplayRow => ({
    key, label, kind, units: null,
    terms: [null, null, null], final_grade: null, remarks: "",
  });

  const rows: Sf9Grade11DisplayRow[] = [
    heading("shs11-core-heading", "Core Subjects", "section"),
    heading("shs11-language-heading", GRADE11_COMMUNICATION_LABEL, "group"),
    ...GRADE11_SF9_CORE_ORDER.map((label, i) => subjectRow(
      label, "shs11-core-" + i, i < 2
    )),
    heading("shs11-elective-heading", "Elective Subjects", "section"),
  ];

  // Names must come from the configured academic/TVL program, not generic
  // "Academic Elective 1/2/3" placeholders or another section's strand.
  if (!programCode) return rows;
  for (const termNo of [1, 2, 3]) {
    const chosen = electiveOfferings.filter(
      (offering) => offering.term_no === termNo && offering.name.trim()
    );
    for (const [index, offer] of chosen.entries()) {
      const source = findGradeRow(offer.name);
      const terms: Array<number | null> = [null, null, null];
      terms[termNo - 1] = source?.terms?.[termNo - 1] ?? null;
      rows.push({
        key: "shs11-elective-" + termNo + "-" + index,
        label: offer.name,
        units: offer.units ?? null,
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
