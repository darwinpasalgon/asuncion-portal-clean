export type Sf9RemarkSignal = {
  termAverage: number | null;
  gradeComplete: boolean;
  subjectCount: number;
  attendanceRate: number | null;
  classDays: number;
  lowestSubject: string | null;
  lowestGrade: number | null;
  subjectGrades?: Array<{ label: string; grade: number }>;
  variantSeed?: string;
};

function choose<T>(items: T[], index: number): T {
  return items[((index % items.length) + items.length) % items.length];
}

function hash(value: string): number {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}

export function generateSf9Remark(signal: Sf9RemarkSignal, variation = 0): string {
  if (!signal.gradeComplete || signal.termAverage === null) return "";

  const grades = (signal.subjectGrades ?? []).filter((item) =>
    Number.isFinite(item.grade) && Boolean(item.label)
  );
  const sorted = [...grades].sort((a, b) => b.grade - a.grade || a.label.localeCompare(b.label));
  const best = sorted[0];
  const needsAttention = sorted.filter((item) => item.grade < 80).sort((a, b) => a.grade - b.grade);
  const weakest = needsAttention[0] ?? null;
  const seed = hash(
    [signal.variantSeed ?? "", signal.termAverage, signal.attendanceRate ?? "NA",
      grades.map((item) => item.label + item.grade).join("|")].join(":")
  );
  const pick = <T,>(items: T[], offset: number) => choose(items, seed + variation * (offset + 3) + offset);

  const academic = signal.termAverage >= 90
    ? [
        "Napakahusay ng kabuuang akademikong pagganap sa term na ito.",
        "Mataas at kapansin-pansin ang mga nakuhang marka sa mga asignatura.",
        "Nagpakita ng mahusay na resulta sa pag-aaral ngayong term.",
        "Napanatili ang mataas na antas ng pagkatuto sa mga asignatura.",
        "Kahanga-hanga ang pangkalahatang resulta sa mga aralin.",
        "Mahusay ang naging pagganap batay sa mga naitalang marka.",
      ]
    : signal.termAverage >= 85
      ? [
          "Maganda at matatag ang kabuuang resulta sa pag-aaral.",
          "Mahusay ang pagganap sa karamihan ng mga asignatura.",
          "Nagpapakita ng matibay na pag-unawa batay sa mga marka.",
          "Maganda ang ipinakitang akademikong pagganap ngayong term.",
          "Kapansin-pansin ang maayos na resulta sa mga aralin.",
          "Nasa magandang antas ang kabuuang pagganap sa pag-aaral.",
        ]
      : signal.termAverage >= 80
        ? [
            "Maayos ang pangkalahatang pagganap sa mga asignatura.",
            "Maganda ang naging resulta sa ilang larangan ng pagkatuto.",
            "Nasa maayos na antas ang mga naitalang marka ngayong term.",
            "Nagpapakita ng pag-unlad na maaari pang mapahusay.",
            "May magandang pundasyon sa mga pangunahing aralin.",
            "Katanggap-tanggap ang kabuuang akademikong resulta.",
          ]
        : signal.termAverage >= 75
          ? [
              "Natutugunan ang inaasahang antas sa pangkalahatang pag-aaral.",
              "May mga kasanayang kailangan pang palakasin sa pag-aaral.",
              "Nakapapasa sa kabuuan ngunit may puwang pa para umunlad.",
              "Naitatala ang mga batayang inaasahan sa mga asignatura.",
              "Maaari pang paghusayin ang mga naitalang marka.",
              "Kailangan ng tuloy-tuloy na pagsasanay upang mapataas ang pagganap.",
            ]
          : [
              "Kailangan ng karagdagang gabay upang mapataas ang mga marka.",
              "May mahahalagang kasanayang kailangan pang paunlarin.",
              "Masusing pagsasanay ang makatutulong sa pag-aaral.",
              "Kailangan ng higit na suporta sa mga pangunahing aralin.",
              "May mga asignaturang nangangailangan ng mas tutok na paghahanda.",
              "Maaaring mapabuti ang resulta sa tuloy-tuloy na pag-aaral.",
            ];

  const specific = weakest
    ? [
        `Bigyang-pansin ang ${weakest.label} upang mapataas ang marka.`,
        `Makabubuting dagdagan ang pagrerepaso sa ${weakest.label}.`,
        `Kailangan pang palakasin ang pagkatuto sa ${weakest.label}.`,
        `Makatutulong ang karagdagang pagsasanay sa ${weakest.label}.`,
        `Pagtuunan ng pansin ang mga aralin sa ${weakest.label}.`,
      ]
    : best
      ? [
          `Namumukod-tangi ang nakuhang marka sa ${best.label}.`,
          `Isa sa pinakamataas na marka ang sa ${best.label}.`,
          `Magandang panatilihin ang naging resulta sa ${best.label}.`,
          `Kapansin-pansin ang mataas na marka sa ${best.label}.`,
          `Mahusay ang naging resulta sa ${best.label}.`,
        ]
      : signal.lowestSubject && (signal.lowestGrade ?? 100) < 80
        ? [`Pagtuunan ng pansin ang ${signal.lowestSubject}.`]
        : ["Ipagpatuloy ang maayos na paghahanda sa mga aralin."];

  const attendance = signal.attendanceRate === null || signal.classDays === 0
    ? [""]
    : signal.attendanceRate >= 97
      ? ["Napakaregular ng pagpasok.", "Mahusay ang naitalang pagdalo sa klase.", "Panatilihin ang mataas na antas ng pagpasok.", "Kapansin-pansin ang regular na pagpasok."]
      : signal.attendanceRate >= 93
        ? ["Regular ang pagpasok sa klase.", "Maayos ang naitalang attendance.", "Panatilihin ang magandang attendance record.", "Maganda ang pangkalahatang pagdalo sa klase."]
        : signal.attendanceRate >= 90
          ? ["May ilang pagliban na maaari pang mabawasan.", "Sikaping maging mas regular ang pagpasok.", "Makabubuting pagbutihin pa ang attendance.", "Makatutulong ang pagbawas ng pagliban."]
          : ["Kailangan pang pagbutihin ang regular na pagpasok.", "Pagtuunan ang pagdalo sa klase upang masuportahan ang pagkatuto.", "Mahalagang mabawasan ang mga pagliban.", "Makabubuting magkaroon ng mas tuloy-tuloy na attendance."];

  const opening = pick(academic, 0);
  const detail = pick(specific, 1);
  const presence = pick(attendance, 2);
  const pieces = variation % 3 === 1 ? [opening, presence, detail] : variation % 3 === 2 ? [detail, opening, presence] : [opening, detail, presence];
  const result = pieces.filter(Boolean).join(" ");
  return result.length <= 500 ? result : result.slice(0, 497).trimEnd() + "...";
}
