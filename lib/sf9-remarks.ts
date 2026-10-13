export type Sf9RemarkSignal = {
  termAverage: number | null;
  gradeComplete: boolean;
  subjectCount: number;
  attendanceRate: number | null;
  classDays: number;
  lowestSubject: string | null;
  lowestGrade: number | null;
};

function clipped(value: string) {
  return value.length <= 300 ? value : value.slice(0, 297).trimEnd() + "...";
}

function attendanceClause(rate: number | null) {
  if (rate === null) return "";
  if (rate >= 97) return "Napakaregular ng pagpasok.";
  if (rate >= 93) return "Regular ang pagpasok.";
  if (rate >= 90) return "May ilang pagliban na dapat pang mabawasan.";
  return "Kailangang maging mas regular ang pagpasok upang masuportahan ang pagkatuto.";
}

export function generateSf9Remark(signal: Sf9RemarkSignal) {
  if (!signal.gradeComplete || signal.termAverage === null) return "";

  const average = signal.termAverage;
  const attendance = attendanceClause(signal.attendanceRate);
  const lowSubject =
    signal.lowestGrade !== null &&
    signal.lowestGrade < 80 &&
    signal.lowestSubject
      ? signal.lowestSubject
      : null;

  let academic = "";
  let nextStep = "";

  if (average >= 90) {
    academic = "Napakahusay ang akademikong pagganap sa term na ito.";
    nextStep =
      signal.attendanceRate !== null && signal.attendanceRate < 93
        ? "Panatilihin ang mataas na antas ng pagganap habang pinagbubuti ang regular na pagpasok."
        : "Ipagpatuloy ang mahusay na pagganap at pagiging handa sa mga gawain.";
  } else if (average >= 85) {
    academic = "Maganda at matatag ang akademikong pagganap sa term na ito.";
    nextStep = lowSubject
      ? `Pagtuunan pa ang ${lowSubject} upang lalo pang mapataas ang pangkalahatang marka.`
      : "Ipagpatuloy ang pagsasanay upang lalo pang mapataas ang pangkalahatang marka.";
  } else if (average >= 80) {
    academic = "Maganda ang pag-unlad sa mga aralin sa term na ito.";
    nextStep = lowSubject
      ? `Dagdagan pa ang pagsasanay, lalo na sa ${lowSubject}.`
      : "Dagdagan pa ang pagsasanay upang maging mas matatag ang pagkatuto.";
  } else if (average >= 75) {
    academic = "Natutugunan ang pangunahing inaasahan sa pag-aaral sa term na ito.";
    nextStep = lowSubject
      ? `Kailangang higit pang pagtuunan ang ${lowSubject} at palakasin ang regular na pagsasanay.`
      : "Kailangang dagdagan pa ang pagsasanay upang higit pang umunlad.";
  } else {
    academic = "Kailangan ng higit pang suporta at pagsisikap sa mga aralin sa term na ito.";
    nextStep = lowSubject
      ? `Bigyang-pansin lalo ang ${lowSubject} at humingi ng tulong kapag kinakailangan.`
      : "Bigyang-pansin ang mga asignaturang mababa ang marka at humingi ng tulong kapag kinakailangan.";
  }

  const pieces =
    signal.attendanceRate !== null && signal.attendanceRate < 93
      ? [academic, attendance, nextStep]
      : [academic, nextStep, attendance];

  return clipped(pieces.filter(Boolean).join(" "));
}
