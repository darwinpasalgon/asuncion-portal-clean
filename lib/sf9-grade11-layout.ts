// Official Grade 11 SF9 table, UPDATED G11 Academic School Form 9 (SY 26-27).xlsx
// Worksheet "SF9 - GRADE 11 ACADEMIC", rows 29–44.
// Layout: Learning Areas | TERM (T1 T2 T3) | Units | Final Grade | Remarks.
// The language heading has six units; its two indented components have no
// separate unit total. Each term-specific elective is three units by default.
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
  "Pag-Aaral ng Kasaysayan at Lipunang Pilipino",
] as const;
export const GRADE11_COMMUNICATION_LABEL =
  "Effective Communication /Mabisang Komunikasyon";

export const GRADE11_SF9_CORE_UNITS = 6;
export const GRADE11_SF9_ELECTIVE_UNITS = 3;
export const GRADE11_SF9_TEMPLATE_TOTAL_UNITS = 39;

const normalized = (text: string) =>
  String(text ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();

export function sf9Grade11Rows(
  gradeRows: Sf9Grade11GradeRow[],
  electiveOfferings: Sf9Grade11Offering[] = [],
  programCode = "",
  coreUnits: Record<string, number | null> = {}
): Sf9Grade11DisplayRow[] {
  const byName = new Map(gradeRows.map((row) => [normalized(row.label), row]));
  // The old portal subject spelling must continue to resolve any historical
  // rows even after the label is corrected to the revised official SF9.
  const historicalFilipino = normalized("Pag-Aaral ng Kasanayan at Lipunang Pilipino");
  const revisedFilipino = normalized("Pag-Aaral ng Kasaysayan at Lipunang Pilipino");
  const findGradeRow = (label: string) => byName.get(normalized(label)) ??
    (normalized(label) === revisedFilipino ? byName.get(historicalFilipino) : undefined);
  const unitsByName = new Map(Object.entries(coreUnits).map(([n,units]) => [normalized(n),units]));
  function unitFor(label: string, fallback: number): number {
    const explicit = unitsByName.get(normalized(label));
    return typeof explicit === "number" ? explicit : fallback;
  }
  const headline = (key: string, label: string, kind: "section" | "group"): Sf9Grade11DisplayRow => ({
    key, label, kind, units: null,
    terms: [null,null,null], final_grade: null, remarks: "",
  });
  function subject(label: string, index: number): Sf9Grade11DisplayRow {
    const record = findGradeRow(label);
    const indent = index < 2;
    return {
      key: "shs11-core-" + index, label, kind: "subject", indent,
      units: indent ? null : unitFor(label,GRADE11_SF9_CORE_UNITS),
      terms: record?.terms ?? [null,null,null],
      final_grade: record?.final_grade ?? null,
      remarks: record?.remarks ?? "",
    };
  }

  const effective = findGradeRow("Effective Communication");
  const mabisang = findGradeRow("Mabisang Komunikasyon");
  const communication = findGradeRow(GRADE11_COMMUNICATION_LABEL);
  const communicationTerms = [0,1,2].map((term) => {
    const recorded = communication?.terms?.[term];
    if (recorded != null) return recorded;
    const componentGrades = [effective?.terms?.[term],mabisang?.terms?.[term]]
      .filter((mark): mark is number => typeof mark === "number");
    if (!componentGrades.length) return null;
    return Math.round(componentGrades.reduce((sum,mark) => sum + mark,0) / componentGrades.length);
  });
  const combinedFinal = communication?.final_grade ?? (
    communicationTerms.every((mark) => mark != null)
      ? Math.round(communicationTerms.reduce<number>((sum,mark) => sum + Number(mark),0) / 3)
      : null
  );
  const communicationRow: Sf9Grade11DisplayRow = {
    ...headline("shs11-language-heading",GRADE11_COMMUNICATION_LABEL,"group"),
    units: unitFor("Effective Communication",GRADE11_SF9_CORE_UNITS),
    terms: communicationTerms,
    final_grade: combinedFinal,
    remarks: combinedFinal === null ? "" : combinedFinal >= 75 ? "Passed" : "Failed",
  };

  const rows: Sf9Grade11DisplayRow[] = [
    headline("shs11-core-heading","Core Subjects","section"),
    communicationRow,
    ...GRADE11_SF9_CORE_ORDER.map(subject),
    headline("shs11-elective-heading","Elective Subjects","section"),
  ];

  // The revised worksheet has three distinct elective rows, one for each
  // term; other terms stay shaded. Never print "Academic Elective 1/2/3"
  // instead of the actual configured name. Blank if not configured yet.
  for (const termNo of [1,2,3]) {
    const offered = programCode
      ? electiveOfferings.filter((offer) => offer.term_no === termNo && offer.name.trim())
      : [];
    const slots = offered.length ? offered : [{term_no:termNo,name:"",units:null}];
    slots.forEach((offer,index) => {
      const source = offer.name ? findGradeRow(offer.name) : undefined;
      const grade = source?.terms?.[termNo - 1] ?? null;
      const terms: Array<number | null> = [null,null,null];
      terms[termNo - 1] = grade;
      rows.push({
        key: "shs11-elective-" + termNo + "-" + index,
        label: offer.name,
        kind: "subject",
        units: typeof offer.units === "number" ? offer.units : GRADE11_SF9_ELECTIVE_UNITS,
        electiveTerm:termNo,
        terms,
        final_grade:grade,
        remarks:grade === null ? "" : grade >= 75 ? "Passed" : "Failed",
      });
    });
  }
  return rows;
}
export function sf9Grade11TotalUnits(rows: Sf9Grade11DisplayRow[]): number {
  return rows.reduce((sum,row) => sum +
    ((row.kind === "group" || row.kind === "subject") && typeof row.units === "number" ? row.units : 0),0);
}
