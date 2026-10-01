"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import styles from "./masterlist.module.css";

type PersonType = "student" | "teacher";

type PreviewRow = {
  rowNumber: number;
  fullName: string;
  lrn: string;
  gradeLevel: number | null;
  section: string;
  email: string;
  position: string;
  recoveryPhone: string;
  valid: boolean;
  error: string;
};

type CreatedAccount = {
  row_number: number | null;
  full_name: string;
  identifier: string;
  grade_level: number | null;
  section: string | null;
  position: string | null;
  temporary_password: string;
};

type ImportError = {
  row_number?: number | null;
  name?: string;
  identifier?: string;
  error: string;
};

type Batch = {
  id: string;
  person_type: PersonType;
  file_name: string;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  created_at: string;
};

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return '"' + text.replace(/"/g, '""') + '"';
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const content = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + content], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function BulkAccountImportPage() {
  const [personType, setPersonType] = useState<PersonType>("student");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    valid: number;
    invalid: number;
  } | null>(null);
  const [accounts, setAccounts] = useState<CreatedAccount[]>([]);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [activeYear, setActiveYear] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<"" | "preview" | "import">("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadWorkspace() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/masterlist", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "Unable to load the bulk import workspace.");
        return;
      }

      setActiveYear(result.activeYear ?? null);
      setBatches(result.batches ?? []);
    } catch {
      setError("Unable to reach the bulk import service.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const validRows = useMemo(
    () => preview.filter((row) => row.valid),
    [preview]
  );

  function resetUpload(nextType?: PersonType) {
    if (nextType) setPersonType(nextType);
    setFile(null);
    setPreview([]);
    setSummary(null);
    setAccounts([]);
    setImportErrors([]);
    setError("");
    setSuccess("");
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setPreview([]);
    setSummary(null);
    setAccounts([]);
    setImportErrors([]);
    setError("");
    setSuccess("");
  }

  function downloadTemplate() {
    if (personType === "student") {
      downloadCsv(
        "ANHS_Student_Account_Import_Template.csv",
        ["LRN", "Full Name", "Grade Level", "Section", "Mobile"],
        [["123456789012", "Juan Dela Cruz", 8, "Narra", "09171234567"]]
      );
      return;
    }

    downloadCsv(
      "ANHS_Teacher_Account_Import_Template.csv",
      ["Full Name", "Email", "Position", "Mobile"],
      [["Juan Teacher", "juan.teacher@deped.gov.ph", "Teacher III", "09171234567"]]
    );
  }

  async function processFile(action: "preview" | "import") {
    if (!file) {
      setError("Choose a CSV masterlist file first.");
      return;
    }

    setWorking(action);
    setError("");
    setSuccess("");

    if (action === "import") {
      setAccounts([]);
      setImportErrors([]);
    }

    try {
      const body = new FormData();
      body.set("action", action);
      body.set("personType", personType);
      body.set("file", file);

      const response = await fetch("/api/admin/masterlist", {
        method: "POST",
        body,
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "Unable to process the account import.");
        return;
      }

      if (action === "preview") {
        setPreview(result.rows ?? []);
        setSummary(result.summary ?? null);
        setSuccess(
          "Validation complete. Review the rows before creating any accounts."
        );
        return;
      }

      const created = (result.accounts ?? []) as CreatedAccount[];
      const failed = (result.errors ?? []) as ImportError[];
      setAccounts(created);
      setImportErrors(failed);

      setSuccess(
        `${Number(result.imported ?? created.length)} account${Number(
          result.imported ?? created.length
        ) === 1 ? "" : "s"} created. ${Number(
          result.skipped ?? failed.length
        )} row${Number(result.skipped ?? failed.length) === 1 ? "" : "s"} skipped.`
      );

      await loadWorkspace();
    } catch {
      setError("Unable to reach the account import service.");
    } finally {
      setWorking("");
    }
  }

  function downloadCredentials() {
    if (!accounts.length) return;

    if (personType === "student") {
      downloadCsv(
        "ANHS_Student_Temporary_Credentials.csv",
        ["LRN", "Full Name", "Grade Level", "Section", "Temporary Password"],
        accounts.map((account) => [
          account.identifier,
          account.full_name,
          account.grade_level ?? "",
          account.section ?? "",
          account.temporary_password,
        ])
      );
      return;
    }

    downloadCsv(
      "ANHS_Teacher_Temporary_Credentials.csv",
      ["Full Name", "Email", "Position", "Temporary Password"],
      accounts.map((account) => [
        account.full_name,
        account.identifier,
        account.position ?? "Teacher",
        account.temporary_password,
      ])
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topbar}>
          <a href="/portal">
            <ArrowLeft size={16} />
            Back to portal
          </a>
          <div>
            <a href="/portal/admin/users">Users & accounts</a>
            <a href="/portal/admin/accounts">Pending approvals</a>
          </div>
        </nav>

        <header className={styles.header}>
          <div>
            <span>ADMINISTRATION</span>
            <h1>Bulk account import</h1>
            <p>
              Create school-managed Student and Teacher accounts from an official
              CSV masterlist. Every new user receives a temporary password and
              must create a private password on first sign-in.
            </p>
          </div>

          <div className={styles.yearCard}>
            <CheckCircle2 size={18} />
            <div>
              <small>ACTIVE SCHOOL YEAR</small>
              <strong>{activeYear?.name ?? "Not configured"}</strong>
            </div>
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2>1. Prepare the official masterlist</h2>
              <p>
                Download the template, edit it in Excel, then save it as CSV
                UTF-8 (Comma delimited).
              </p>
            </div>
            <FileSpreadsheet size={25} />
          </div>

          <div className={styles.tabs}>
            <button
              className={personType === "student" ? styles.activeTab : styles.tab}
              onClick={() => resetUpload("student")}
            >
              Students
            </button>
            <button
              className={personType === "teacher" ? styles.activeTab : styles.tab}
              onClick={() => resetUpload("teacher")}
            >
              Teachers
            </button>
          </div>

          <div className={styles.importGrid}>
            <button className={styles.secondary} onClick={downloadTemplate}>
              <Download size={16} />
              Download {personType === "student" ? "Student" : "Teacher"} template
            </button>

            <label className={styles.filePicker}>
              <Upload size={18} />
              <div>
                <strong>{file?.name ?? "Choose CSV file"}</strong>
                <span>CSV UTF-8 · maximum 200 accounts per file</span>
              </div>
              <input type="file" accept=".csv,text/csv" onChange={chooseFile} />
            </label>

            <button
              className={styles.secondary}
              disabled={!file || Boolean(working)}
              onClick={() => void processFile("preview")}
            >
              <RefreshCw size={16} />
              {working === "preview" ? "Checking…" : "Validate & preview"}
            </button>
          </div>

          {summary && (
            <div className={styles.summary}>
              <span>
                Total <strong>{summary.total}</strong>
              </span>
              <span>
                Ready <strong>{summary.valid}</strong>
              </span>
              <span>
                Needs correction <strong>{summary.invalid}</strong>
              </span>
            </div>
          )}

          {preview.length > 0 && (
            <>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Name</th>
                      <th>{personType === "student" ? "LRN" : "Email"}</th>
                      {personType === "student" ? (
                        <>
                          <th>Grade</th>
                          <th>Section</th>
                        </>
                      ) : (
                        <th>Position</th>
                      )}
                      <th>Mobile</th>
                      <th>Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row) => (
                      <tr key={row.rowNumber} className={!row.valid ? styles.invalidRow : ""}>
                        <td>{row.rowNumber}</td>
                        <td><strong>{row.fullName || "—"}</strong></td>
                        <td>{personType === "student" ? row.lrn : row.email}</td>
                        {personType === "student" ? (
                          <>
                            <td>{row.gradeLevel ?? "—"}</td>
                            <td>{row.section || "—"}</td>
                          </>
                        ) : (
                          <td>{row.position || "Teacher"}</td>
                        )}
                        <td>{row.recoveryPhone || "Optional"}</td>
                        <td>
                          {row.valid ? (
                            <span className={styles.ready}>Ready</span>
                          ) : (
                            <span className={styles.invalid}>{row.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.createBar}>
                <div>
                  <ShieldCheck size={18} />
                  <p>
                    Creating accounts is immediate. Rows with validation errors are
                    skipped. New users must change the temporary password on first login.
                  </p>
                </div>
                <button
                  className={styles.primary}
                  disabled={!validRows.length || Boolean(working)}
                  onClick={() => void processFile("import")}
                >
                  <Users size={17} />
                  {working === "import"
                    ? "Creating accounts…"
                    : `Create ${validRows.length} account${validRows.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </>
          )}
        </section>

        {accounts.length > 0 && (
          <section className={styles.credentials}>
            <div className={styles.credentialsHead}>
              <div>
                <KeyRound size={24} />
                <div>
                  <h2>Temporary credentials created</h2>
                  <p>
                    Download these now and distribute each credential only to its
                    account owner. The passwords are not stored in plaintext.
                  </p>
                </div>
              </div>
              <button onClick={downloadCredentials}>
                <Download size={16} />
                Download credentials CSV
              </button>
            </div>

            <div className={styles.credentialGrid}>
              {accounts.map((account) => (
                <article key={String(account.row_number) + account.identifier}>
                  <strong>{account.full_name}</strong>
                  <span>{account.identifier}</span>
                  <code>{account.temporary_password}</code>
                </article>
              ))}
            </div>
          </section>
        )}

        {importErrors.length > 0 && (
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2>Skipped rows</h2>
                <p>
                  These accounts were not created. Correct the source file and import
                  them again.
                </p>
              </div>
            </div>
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Name / identifier</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {importErrors.map((item, index) => (
                    <tr key={String(item.row_number) + index}>
                      <td>{item.row_number ?? "—"}</td>
                      <td>{item.name || item.identifier || "—"}</td>
                      <td><span className={styles.invalid}>{item.error}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2>Recent imports</h2>
              <p>
                Import history records counts only. Temporary passwords cannot be
                reopened from this history.
              </p>
            </div>
          </div>

          {loading ? (
            <div className={styles.empty}>Loading import history…</div>
          ) : batches.length === 0 ? (
            <div className={styles.empty}>No bulk account imports yet.</div>
          ) : (
            <div className={styles.batchList}>
              {batches.map((batch) => (
                <div key={batch.id}>
                  <div>
                    <strong>{batch.file_name}</strong>
                    <span>
                      {batch.person_type === "student" ? "Students" : "Teachers"} ·{" "}
                      {dateLabel(batch.created_at)}
                    </span>
                  </div>
                  <span>
                    {batch.imported_rows} created · {batch.skipped_rows} skipped
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
