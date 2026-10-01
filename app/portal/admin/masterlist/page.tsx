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
  };
  return aliases[key] ?? key;
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

  function template() {
    if (personType === "student") {
      downloadCsv(
        "ANHS_Student_Account_Import.csv",
        ["LRN", "Full Name", "Grade Level", "Section", "Mobile"],
        [["123456789012", "Juan Dela Cruz", 8, "Narra", ""]]
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

    if (!selected.name.toLowerCase().endsWith(".csv")) {
      setError("Use a CSV file. In Excel, choose Save As → CSV UTF-8 (Comma delimited).");
      return;
    }

    const table = parseCsv(await selected.text());
    if (table.length < 2) {
      setError("The CSV does not contain account rows.");
      return;
    }

    const headers = table[0].map(keyOf);
    const required =
      personType === "student"
        ? ["lrn", "full_name", "grade_level", "section"]
        : ["full_name", "email"];

    if (required.some((item) => !headers.includes(item))) {
      setError(
        personType === "student"
          ? "Student CSV needs LRN, Full Name, Grade Level, and Section."
          : "Teacher CSV needs Full Name and Email."
      );
      return;
    }

    const existingLrns = new Set(users.map((user) => user.lrn ?? "").filter(Boolean));
    const existingEmails = new Set(users.map((user) => user.email.toLowerCase()));
    const sectionSet = new Set(
      sections.map((section) => `${section.grade_level}|${section.name.toLowerCase()}`)
    );
    const seen = new Set<string>();
    const preview: PreviewRow[] = [];

    for (let index = 1; index < table.length; index += 1) {
      const values = table[index];
      const data: Record<string, string> = {};
      headers.forEach((header, col) => (data[header] = String(values[col] ?? "").trim()));

      const fullName = data.full_name ?? "";
      const lrn = (data.lrn ?? "").replace(/\s/g, "");
      const email = (data.email ?? "").toLowerCase();
      const grade = data.grade_level ? Number(data.grade_level) : null;
      const section = data.section ?? "";
      const mobile = data.mobile ?? "";
      const problems: string[] = [];

      if (!fullName) problems.push("Full Name is required.");
      if (!validPhone(mobile)) problems.push("Invalid mobile number.");

      if (personType === "student") {
        if (!/^\d{12}$/.test(lrn)) problems.push("LRN must be exactly 12 digits.");
        if (!Number.isInteger(grade) || Number(grade) < 7 || Number(grade) > 12) {
          problems.push("Grade Level must be 7–12.");
        }
        if (!section) problems.push("Section is required.");
        if (Number.isInteger(grade) && section && !sectionSet.has(`${grade}|${section.toLowerCase()}`)) {
          problems.push("Section does not match the Grade Level.");
        }
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
        row_number: index + 1,
        full_name: fullName,
        lrn,
        grade_level: Number.isInteger(grade) ? Number(grade) : null,
        section,
        email,
        position: data.position || "Teacher",
        mobile,
        valid: problems.length === 0,
        error: problems.join(" "),
      });
    }

    setRows(preview);
    setMessage("Validation complete. Review all rows before importing.");
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
      for (let start = 0; start < valid.length; start += 50) {
        const response = await fetch("/api/admin/import-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "import",
            personType,
            fileName: file.name,
            rows: valid.slice(start, start + 50),
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            (result.error ?? "Account import failed.") +
              (result.detail ? " " + result.detail : "")
          );
        }
        issued.push(...(result.credentials ?? []));
        setCredentials([...issued]);
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
              Create school-managed Student and Teacher accounts from an Excel-compatible CSV.
              Every imported user receives a temporary password and must change it on first login.
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
            <button className={personType === "student" ? styles.activeTab : ""} onClick={() => { setPersonType("student"); setRows([]); setFile(null); setCredentials([]); }}>Students</button>
            <button className={personType === "teacher" ? styles.activeTab : ""} onClick={() => { setPersonType("teacher"); setRows([]); setFile(null); setCredentials([]); }}>Teachers</button>
          </div>

          <div className={styles.importRow}>
            <button className={styles.secondary} onClick={template}><Download size={16} />Download template</button>
            <label className={styles.filePicker}><Upload size={18} /><div><strong>{file?.name ?? "Choose CSV file"}</strong><span>Prepare in Excel, then save as CSV UTF-8</span></div><input type="file" accept=".csv,text/csv" onChange={chooseFile} /></label>
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
