"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  KeyRound,
  Upload,
  Users,
} from "lucide-react";
import styles from "./masterlist.module.css";

type PersonType = "student" | "teacher";
type UserRecord = {
  lrn: string | null;
  email: string;
};
type Section = { id: string; grade_level: number; name: string };
type PreviewRow = {
  row_number: number;
  full_name: string;
  lrn: string;
  grade_level: number | null;
  section: string;
  email: string;
  position: string;
  mobile: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  name_extension: string;
  sex: string;
  birth_date: string;
  mother_tongue: string;
  ethnic_group: string;
  religion: string;
  address_house_street_purok: string;
  address_barangay: string;
  address_municipality_city: string;
  address_province: string;
  father_name: string;
  mother_maiden_name: string;
  guardian_name: string;
  guardian_relationship: string;
  learning_modality: string;
  remarks: string;
  valid: boolean;
  error: string;
};
type Credential = {
  full_name: string;
  identifier: string;
  grade_level?: number | null;
  section?: string | null;
  position?: string | null;
  temporary_password: string;
};

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }

  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((r) => r.some((value) => value.trim()));
}

function keyOf(value: string) {
  const key = value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, string> = {
    lrn: "lrn",
    fullname: "full_name",
    name: "full_name",
    learnername: "full_name",
    teachername: "full_name",
    grade: "grade_level",
    gradelevel: "grade_level",
    section: "section",
    email: "email",
    emailaddress: "email",
    position: "position",
    designation: "position",
    mobile: "mobile",
    mobilenumber: "mobile",
    phone: "mobile",
    contact: "mobile",
    contactnumberofparentorguardian: "mobile",
    namelastnamefirstnamemiddlename: "full_name",
    lastname: "last_name",
    firstname: "first_name",
    middlename: "middle_name",
    nameextension: "name_extension",
    suffix: "name_extension",
    sexmf: "sex",
    sex: "sex",
    birthdate: "birth_date",
    birthdatemmddyyyy: "birth_date",
    mothertongue: "mother_tongue",
    mothertonguegrade1to3only: "mother_tongue",
    ethnicgroup: "ethnic_group",
    religion: "religion",
    housestreetsitiopurok: "address_house_street_purok",
    addresshousestreetsitiopurok: "address_house_street_purok",
    barangay: "address_barangay",
    municipalitycity: "address_municipality_city",
    province: "address_province",
    fathersname: "father_name",
    fathersnamelastnamefirstnamemiddlename: "father_name",
    mothersmaidenname: "mother_maiden_name",
    mothersmaidennamelastnamefirstnamemiddlename: "mother_maiden_name",
    guardianname: "guardian_name",
    guardianrelationship: "guardian_relationship",
    relationship: "guardian_relationship",
    learningmodality: "learning_modality",
    remarks: "remarks",
  };
  return aliases[key] ?? key;
}

function parseSf1Name(value: string) {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return { last_name: "", first_name: "", middle_name: "", name_extension: "" };
  }

  const suffixPattern = /^(Jr\.?|Sr\.?|I|II|III|IV|V)$/i;
  const last_name = parts[0] ?? "";
  const first_name = parts[1] ?? "";
  let middle_name = parts.slice(2).join(" ");
  let name_extension = "";

  if (parts.length >= 4 && suffixPattern.test(parts[2] ?? "")) {
    name_extension = parts[2] ?? "";
    middle_name = parts.slice(3).join(" ");
  }

  return { last_name, first_name, middle_name, name_extension };
}

function portalName(
  lastName: string,
  firstName: string,
  middleName: string,
  extension: string,
  fallback: string
) {
  const value = [firstName, middleName, lastName, extension]
    .map((item) => item.trim())
    .filter(Boolean)
    .join(" ");
  return value || fallback.trim();
}

function normalizeSex(value: string) {
  const raw = value.trim().toUpperCase();
  if (!raw) return "";
  if (raw === "M" || raw === "MALE") return "M";
  if (raw === "F" || raw === "FEMALE") return "F";
  return null;
}

function normalizeBirthDate(value: string) {
  const raw = value.trim();
  if (!raw) return "";

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    const date = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : raw;
  }

  const match = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(raw);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function validPhone(value: string) {
  if (!value.trim()) return true;
  const raw = value.replace(/[\s()-]/g, "");
  return /^09\d{9}$/.test(raw) || /^639\d{9}$/.test(raw) || /^\+\d{8,15}$/.test(raw);
}

function escapeCsv(value: unknown) {
  return '"' + String(value ?? "").replace(/"/g, '""') + '"';
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const content = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\r\n");
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function BulkAccountImportPage() {
  const [personType, setPersonType] = useState<PersonType>("student");
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [year, setYear] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/users", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Unable to load school data.");
        setUsers(result.users ?? []);
        setSections(result.sections ?? []);
        setYear(result.activeYear?.name ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load school data."));
  }, []);

  const summary = useMemo(() => {
    const valid = rows.filter((row) => row.valid).length;
    return { total: rows.length, valid, invalid: rows.length - valid };
  }, [rows]);

  const gradeOptions = useMemo(
    () => Array.from(new Set(sections.map((section) => section.grade_level))).sort((a, b) => a - b),
    [sections]
  );

  const sectionOptions = useMemo(
    () =>
      selectedGrade
        ? sections.filter((section) => section.grade_level === Number(selectedGrade))
        : [],
    [sections, selectedGrade]
  );

  const studentClassReady =
    personType !== "student" || Boolean(selectedGrade && selectedSection);

  function resetImport() {
    setRows([]);
    setFile(null);
    setCredentials([]);
    setError("");
    setMessage("");
  }

  function template() {
    if (personType === "student") {
      if (!selectedGrade || !selectedSection) {
        setError("Select the Grade Level and Section before downloading the learner template.");
        return;
      }
      setError("");
      downloadCsv(
        `ANHS_Grade_${selectedGrade}_${selectedSection.replace(/\s+/g, "_")}_Learner_Import.csv`,
        [
          "LRN",
          "NAME (Last Name, First Name, Middle Name)",
          "Sex (M/F)",
          "BIRTH DATE (mm/dd/yyyy)",
          "Mother Tongue",
          "Ethnic Group",
          "Religion",
          "House #/Street/Sitio/Purok",
          "Barangay",
          "Municipality/City",
          "Province",
          "Father's Name",
          "Mother's Maiden Name",
          "Guardian Name",
          "Guardian Relationship",
          "Contact Number of Parent or Guardian",
          "Learning Modality",
          "Remarks",
        ],
        [[
          "123456789012",
          "DELA CRUZ,JUAN, SANTOS",
          "M",
          "06/15/2013",
          "Cebuano",
          "",
          "Christianity",
          "Purok 12",
          "Cambanogoy",
          "Asuncion",
          "Davao del Norte",
          "DELA CRUZ, PEDRO, REYES",
          "SANTOS, MARIA, LOPEZ",
          "",
          "",
          "09123456789",
          "Face to Face",
          "",
        ]]
      );
    } else {
      downloadCsv(
        "ANHS_Teacher_Account_Import.csv",
        ["Full Name", "Email", "Position", "Mobile"],
        [["Juan Teacher", "juan.teacher@deped.gov.ph", "Teacher III", ""]]
      );
    }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setRows([]);
    setCredentials([]);
    setError("");
    setMessage("");
    if (!selected) return;

    if (personType === "student" && (!selectedGrade || !selectedSection)) {
      setFile(null);
      setError("Select the Grade Level and Section before choosing a learner SF1 file.");
      event.target.value = "";
      return;
    }

    const lowerName = selected.name.toLowerCase();
    let table: string[][] = [];
    let sf1Label = "";

    if (personType === "student" && /\.(xls|xlsx)$/.test(lowerName)) {
      const formData = new FormData();
      formData.append("file", selected);

      const response = await fetch("/api/admin/sf1-preview", {
        method: "POST",
        body: formData,
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          (result.error ?? "Unable to read the SF1 Excel file.") +
            (result.detail ? " " + result.detail : "")
        );
        return;
      }

      const metadata = result.metadata ?? {};
      const schoolId = String(metadata.school_id ?? "").replace(/\D/g, "");
      const detectedGradeMatch = String(metadata.grade_level ?? "").match(/\d{1,2}/);
      const detectedGrade = detectedGradeMatch ? Number(detectedGradeMatch[0]) : 0;
      const detectedSection = String(metadata.section ?? "").trim();

      if (schoolId && schoolId !== "304217") {
        setError(
          `This SF1 belongs to School ID ${schoolId}, not Asuncion National High School (304217).`
        );
        return;
      }

      if (detectedGrade && detectedGrade !== Number(selectedGrade)) {
        setError(
          `The uploaded SF1 appears to be for Grade ${detectedGrade}, but Grade ${selectedGrade} is selected in the portal.`
        );
        return;
      }

      if (
        detectedSection &&
        detectedSection.localeCompare(selectedSection, undefined, {
          sensitivity: "accent",
        }) !== 0
      ) {
        setError(
          `The uploaded SF1 appears to be for section ${detectedSection}, but ${selectedSection} is selected in the portal.`
        );
        return;
      }

      const sf1Rows = Array.isArray(result.rows) ? result.rows : [];
      if (!sf1Rows.length) {
        setError("No learner rows were detected in the SF1 Excel file.");
        return;
      }

      const canonicalHeaders = [
        "source_row",
        "lrn",
        "full_name",
        "sex",
        "birth_date",
        "mother_tongue",
        "ethnic_group",
        "religion",
        "address_house_street_purok",
        "address_barangay",
        "address_municipality_city",
        "address_province",
        "father_name",
        "mother_maiden_name",
        "guardian_name",
        "guardian_relationship",
        "mobile",
        "learning_modality",
        "remarks",
      ];

      table = [
        canonicalHeaders,
        ...sf1Rows.map((row: Record<string, unknown>) =>
          canonicalHeaders.map((header) => String(row?.[header] ?? ""))
        ),
      ];

      sf1Label = [
        detectedGrade ? `Grade ${detectedGrade}` : "",
        detectedSection,
      ]
        .filter(Boolean)
        .join(" - ");
    } else if (lowerName.endsWith(".csv")) {
      table = parseCsv(await selected.text());
    } else {
      setError(
        personType === "student"
          ? "Upload the original SF1 Excel file (.xls or .xlsx), or a CSV UTF-8 learner file."
          : "Teacher bulk import uses a CSV UTF-8 file."
      );
      return;
    }

    if (table.length < 2) {
      setError("The selected file does not contain account rows.");
      return;
    }

    const headers = table[0].map(keyOf);
    const required =
      personType === "student"
        ? ["lrn", "full_name"]
        : ["full_name", "email"];

    if (required.some((item) => !headers.includes(item))) {
      setError(
        personType === "student"
          ? "The learner file needs LRN and the SF1 NAME column. Other SF1 fields may be completed now or later in the Learner Profile."
          : "Teacher CSV needs Full Name and Email."
      );
      return;
    }

    if (
      personType === "student" &&
      !sections.some(
        (section) =>
          section.grade_level === Number(selectedGrade) &&
          section.name === selectedSection
      )
    ) {
      setError("The selected Grade Level and Section are no longer active. Choose the class again.");
      return;
    }

    const existingLrns = new Set(users.map((user) => user.lrn ?? "").filter(Boolean));
    const existingEmails = new Set(users.map((user) => user.email.toLowerCase()));
    const seen = new Set<string>();
    const preview: PreviewRow[] = [];

    for (let index = 1; index < table.length; index += 1) {
      const values = table[index];
      const data: Record<string, string> = {};
      headers.forEach((header, col) => (data[header] = String(values[col] ?? "").trim()));

      const sourceName = data.full_name ?? "";
      const parsedName = parseSf1Name(sourceName);
      const lastName = data.last_name || parsedName.last_name;
      const firstName = data.first_name || parsedName.first_name;
      const middleName = data.middle_name || parsedName.middle_name;
      const nameExtension = data.name_extension || parsedName.name_extension;
      const fullName =
        personType === "student"
          ? portalName(lastName, firstName, middleName, nameExtension, sourceName)
          : sourceName;
      const lrn = (data.lrn ?? "").replace(/\s/g, "");
      const email = (data.email ?? "").toLowerCase();
      const grade =
        personType === "student" && selectedGrade ? Number(selectedGrade) : null;
      const section = personType === "student" ? selectedSection : "";
      const mobile = data.mobile ?? "";
      const sex = personType === "student" ? normalizeSex(data.sex ?? "") : "";
      const birthDate =
        personType === "student" ? normalizeBirthDate(data.birth_date ?? "") : "";
      const problems: string[] = [];

      if (!fullName) problems.push("Name is required.");
      if (personType === "student" && sourceName && (!lastName || !firstName)) {
        problems.push("SF1 NAME should contain at least Last Name and First Name separated by commas.");
      }
      if (sex === null) problems.push("Sex must be M or F.");
      if (birthDate === null) problems.push("Birth Date must use mm/dd/yyyy.");
      if (!validPhone(mobile)) problems.push("Invalid parent/guardian contact number.");

      if (personType === "student") {
        if (!/^\d{12}$/.test(lrn)) problems.push("LRN must be exactly 12 digits.");
        if (existingLrns.has(lrn)) problems.push("LRN already has an account.");
        if (seen.has(lrn)) problems.push("Duplicate LRN in this CSV.");
        if (lrn) seen.add(lrn);
      } else {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push("Invalid email.");
        if (existingEmails.has(email)) problems.push("Email already has an account.");
        if (seen.has(email)) problems.push("Duplicate email in this CSV.");
        if (email) seen.add(email);
      }

      preview.push({
        row_number: Number(data.source_row) || index + 1,
        full_name: fullName,
        lrn,
        grade_level: Number.isInteger(grade) ? Number(grade) : null,
        section,
        email,
        position: data.position || "Teacher",
        mobile,
        last_name: lastName,
        first_name: firstName,
        middle_name: middleName,
        name_extension: nameExtension,
        sex: sex ?? "",
        birth_date: birthDate ?? "",
        mother_tongue: data.mother_tongue ?? "",
        ethnic_group: data.ethnic_group ?? "",
        religion: data.religion ?? "",
        address_house_street_purok: data.address_house_street_purok ?? "",
        address_barangay: data.address_barangay ?? "",
        address_municipality_city: data.address_municipality_city ?? "",
        address_province: data.address_province ?? "",
        father_name: data.father_name ?? "",
        mother_maiden_name: data.mother_maiden_name ?? "",
        guardian_name: data.guardian_name ?? "",
        guardian_relationship: data.guardian_relationship ?? "",
        learning_modality: data.learning_modality ?? "",
        remarks: data.remarks ?? "",
        valid: problems.length === 0,
        error: problems.join(" "),
      });
    }

    setRows(preview);
    setMessage(
      personType === "student"
        ? `${sf1Label ? `SF1 detected: ${sf1Label}. ` : ""}Validation complete for Grade ${selectedGrade} - ${selectedSection}. Review all rows before importing.`
        : "Validation complete. Review all rows before importing."
    );
  }

  async function importAccounts() {
    const valid = rows.filter((row) => row.valid);
    if (!file || !valid.length || summary.invalid > 0) return;

    setWorking(true);
    setError("");
    setMessage("");
    setCredentials([]);

    const issued: Credential[] = [];

    try {
      for (let start = 0; start < valid.length; start += 200) {
        const response = await fetch("/api/admin/import-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "import",
            personType,
            fileName: file.name,
            rows: valid.slice(start, start + 200),
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            (result.error ?? "Account import failed.") +
              (result.detail ? " " + result.detail : "")
          );
        }
        issued.push(...(result.accounts ?? []));
        setCredentials([...issued]);
        if (Array.isArray(result.errors) && result.errors.length) {
          const first = result.errors[0];
          throw new Error(
            `${result.errors.length} row(s) were skipped. ${first?.error ?? "Review the import file."}`
          );
        }
      }

      setMessage(
        `${issued.length} account${issued.length === 1 ? "" : "s"} created. Download the temporary credentials now.`
      );
    } catch (err) {
      setError(
        (err instanceof Error ? err.message : "Import failed.") +
          (issued.length
            ? ` ${issued.length} account(s) from earlier completed batches were already created; download those credentials before retrying the remaining rows.`
            : "")
      );
    } finally {
      setWorking(false);
    }
  }

  function downloadCredentials() {
    if (!credentials.length) return;
    if (personType === "student") {
      downloadCsv(
        "ANHS_Student_Temporary_Credentials.csv",
        ["LRN", "Full Name", "Grade Level", "Section", "Temporary Password"],
        credentials.map((item) => [
          item.identifier,
          item.full_name,
          item.grade_level ?? "",
          item.section ?? "",
          item.temporary_password,
        ])
      );
    } else {
      downloadCsv(
        "ANHS_Teacher_Temporary_Credentials.csv",
        ["Email", "Full Name", "Position", "Temporary Password"],
        credentials.map((item) => [
          item.identifier,
          item.full_name,
          item.position ?? "Teacher",
          item.temporary_password,
        ])
      );
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topbar}>
          <a href="/portal"><ArrowLeft size={16} />Back to portal</a>
          <a href="/portal/admin/users"><Users size={16} />Users & accounts</a>
        </nav>

        <header className={styles.header}>
          <div>
            <span>ADMINISTRATION</span>
            <h1>Bulk account import</h1>
            <p>
              Create school-managed Learner and Teacher accounts in bulk.
              Learners can use the original SF1 Excel file (.xls or .xlsx) and are grouped by selected Grade Level and Section. CSV remains available as an alternative. Every imported user receives
              a temporary password and must change it on first login.
            </p>
          </div>
          <div className={styles.year}><CheckCircle2 size={18} /><div><small>ACTIVE SCHOOL YEAR</small><strong>{year || "Loading…"}</strong></div></div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div><h2>Prepare the account file</h2><p>No public registration is used. Accounts are created by the school Administrator.</p></div>
            <FileSpreadsheet size={24} />
          </div>

          <div className={styles.tabs}>
            <button
              className={personType === "student" ? styles.activeTab : ""}
              onClick={() => {
                setPersonType("student");
                setSelectedGrade("");
                setSelectedSection("");
                resetImport();
              }}
            >
              Learners
            </button>
            <button
              className={personType === "teacher" ? styles.activeTab : ""}
              onClick={() => {
                setPersonType("teacher");
                setSelectedGrade("");
                setSelectedSection("");
                resetImport();
              }}
            >
              Teachers
            </button>
          </div>

          {personType === "student" && (
            <div className={styles.classChooser}>
              <label className={styles.classField}>
                <span>1. Grade Level</span>
                <select
                  value={selectedGrade}
                  onChange={(event) => {
                    setSelectedGrade(event.target.value);
                    setSelectedSection("");
                    resetImport();
                  }}
                >
                  <option value="">Select grade level</option>
                  {gradeOptions.map((grade) => (
                    <option key={grade} value={grade}>Grade {grade}</option>
                  ))}
                </select>
              </label>

              <label className={styles.classField}>
                <span>2. Section</span>
                <select
                  value={selectedSection}
                  disabled={!selectedGrade}
                  onChange={(event) => {
                    setSelectedSection(event.target.value);
                    resetImport();
                  }}
                >
                  <option value="">
                    {selectedGrade ? "Select section" : "Select grade level first"}
                  </option>
                  {sectionOptions.map((section) => (
                    <option key={section.id} value={section.name}>{section.name}</option>
                  ))}
                </select>
              </label>

              <div className={styles.classNote}>
                {selectedGrade && selectedSection
                  ? <>All learners in this CSV will be placed in <strong>Grade {selectedGrade} - {selectedSection}</strong>.</>
                  : "Choose a Grade Level and Section first, then upload the original SF1 .xls/.xlsx file. Age is calculated automatically from Birth Date."}
              </div>
            </div>
          )}

          <div className={styles.importRow}>
            <button
              className={styles.secondary}
              onClick={template}
              disabled={personType === "student" && !studentClassReady}
            >
              <Download size={16} />Download template
            </button>
            <label className={styles.filePicker + (personType === "student" && !studentClassReady ? " " + styles.filePickerDisabled : "")}>
              <Upload size={18} />
              <div>
                <strong>
                  {file?.name ??
                    (personType === "student" && !studentClassReady
                      ? "Select Grade and Section first"
                      : personType === "student"
                        ? "Choose SF1 Excel file"
                        : "Choose Teacher CSV file")}
                </strong>
                <span>
                  {personType === "student"
                    ? "Upload the original SF1 .xls/.xlsx file. CSV is also supported."
                    : "Teacher import uses CSV UTF-8."}
                </span>
              </div>
              <input
                type="file"
                accept={
                  personType === "student"
                    ? ".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                    : ".csv,text/csv"
                }
                onChange={chooseFile}
                disabled={personType === "student" && !studentClassReady}
              />
            </label>
          </div>

          {rows.length > 0 && (
            <>
              <div className={styles.summary}>
                <span>Total <strong>{summary.total}</strong></span>
                <span>Ready <strong>{summary.valid}</strong></span>
                <span>Needs correction <strong>{summary.invalid}</strong></span>
                <button className={styles.primary} onClick={() => void importAccounts()} disabled={working || summary.invalid > 0 || summary.valid === 0}>
                  <KeyRound size={16} />{working ? "Creating accounts…" : "Create accounts"}
                </button>
              </div>

              <div className={styles.tableWrap}>
                <table>
                  <thead><tr><th>Row</th><th>Name</th><th>{personType === "student" ? "LRN" : "Email"}</th>{personType === "student" && <><th>Grade</th><th>Section</th></>}<th>Status</th></tr></thead>
                  <tbody>{rows.map((row) => (
                    <tr key={row.row_number} className={!row.valid ? styles.invalidRow : ""}>
                      <td>{row.row_number}</td>
                      <td><strong>{row.full_name || "—"}</strong></td>
                      <td>{personType === "student" ? row.lrn : row.email}</td>
                      {personType === "student" && <><td>{row.grade_level ?? "—"}</td><td>{row.section || "—"}</td></>}
                      <td>{row.valid ? <span className={styles.ready}>Ready</span> : <span className={styles.invalid}>{row.error}</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {credentials.length > 0 && (
          <section className={styles.credentials}>
            <div><KeyRound size={22} /><div><h2>Temporary credentials</h2><p>Download these now. Temporary passwords are not stored in plaintext by the portal.</p></div></div>
            <button onClick={downloadCredentials}><Download size={16} />Download credentials CSV</button>
            <p className={styles.warning}>
              Give each user only their own credentials. On first sign-in, the portal automatically requires a new private password.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
