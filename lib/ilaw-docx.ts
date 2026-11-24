import type { IlawContent } from "./learning-workspaces";

function xml(value: string) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}
function paragraph(value: string, style = "", centered = false) {
  return value.split(/\r?\n/).map(line => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${centered ? '<w:jc w:val="center"/>' : ""}</w:pPr><w:r><w:t xml:space="preserve">${xml(line || " ")}</w:t></w:r></w:p>`).join("");
}
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function wordZip(files: Record<string, string>): Uint8Array {
  const entries: Buffer[] = [], directory: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const fileName = Buffer.from(name, "utf8"), data = Buffer.from(text, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6); local.writeUInt32LE(crc, 14);
    local.writeUInt16LE(33, 12);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(fileName.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8); central.writeUInt32LE(crc, 16);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(fileName.length, 28); central.writeUInt32LE(offset, 42);
    entries.push(local, fileName, data); directory.push(central, fileName);
    offset += local.length + fileName.length + data.length;
  }
  const central = Buffer.concat(directory), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...entries, central, end]));
}
export function createIlawDocx(plan: IlawContent, teacher: string, status = "draft") {
  let body = paragraph("Republic of the Philippines · Department of Education", "", true)
    + paragraph("Region XI · Schools Division of Davao del Norte", "", true)
    + paragraph("ASUNCION NATIONAL HIGH SCHOOL", "Title", true)
    + paragraph("ILAW LESSON PLAN", "Subtitle", true)
    + paragraph(plan.title, "Heading1")
    + paragraph(`Teacher: ${teacher}`)
    + paragraph(`Learning area: ${plan.subject} · Grade ${plan.grade_level}${plan.section ? ` · ${plan.section}` : ""}`)
    + paragraph(`Term ${plan.term_no} · Week ${plan.week_no}${plan.lesson_date ? ` · ${plan.lesson_date}` : ""}`)
    + paragraph(`${plan.sessions.length} session(s) · ${plan.duration_minutes} minutes per session · ${plan.language}`)
    + paragraph(status === "ready" ? "Teacher-reviewed plan" : "DRAFT · For teacher completion and review")
    + paragraph("Learning competencies", "Heading2") + paragraph(plan.competencies || "For teacher completion")
    + paragraph("Learner context and adaptations", "Heading2") + paragraph(plan.learner_context || "For teacher completion")
    + paragraph("Materials", "Heading2") + paragraph(plan.materials || "For teacher completion")
    + paragraph("References / BOW", "Heading2") + paragraph(plan.references || "For teacher completion");
  const sections = [["intentions", "I · Intentions"], ["learning_experiences", "L · Learning Experiences"], ["assessment", "A · Assessment"], ["ways_forward", "W · Ways Forward"]] as const;
  plan.sessions.forEach((session, index) => {
    body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' + paragraph(`Session ${index + 1} · ${plan.title}`, "Heading1");
    for (const [key, title] of sections) body += paragraph(title, "Heading2") + paragraph(session[key] || (key === "ways_forward" ? "To be completed by the teacher after the lesson, as appropriate." : "For teacher completion"));
  });
  body += paragraph("Prepared by: " + teacher) + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>';
  return wordZip({
    "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
    "word/_rels/document.xml.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    "word/styles.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="174C39"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="174C39"/></w:rPr></w:style></w:styles>',
  });
}
