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
  UserRoundCheck,
  Users,
} from "lucide-react";
import styles from "./teacher-import.module.css";

type AccountDirectoryEntry = {
  id: string;
  full_name: string;
  email: string;
  role?: string | null;
  requested_role?: string | null;
};

type ParsedTeacher = {
  source_row: number;
  full_name: string;
  email: string;
  position: string;
  teacher_personal: Record<string, string>;
  teacher_official: Record<string, string>;
  source_data: Record<string, unknown>;
};

type PreparedTeacher = ParsedTeacher & {
  row_number: number;
  import_email: string;
  original_email: string;
  account_mode: "new" | "update" | "not_applicable";
  temporary_email: boolean;
};

type Credential = {
  full_name: string;
  identifier: string;
  position?: string | null;
  temporary_password: string;
};

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function identityKey(value: string) {
  const parts = normalize(value).split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return `${parts[0]}|${parts[parts.length - 1]}`;
}

function safeEmailPart(value: string) {
  return normalize(value)
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.]/g, "")
    .replace(/^\.+|\.+$/g, "");
}

function temporaryEmail(row: ParsedTeacher) {
  const personal = row.teacher_personal ?? {};
  const first = safeEmailPart(String(personal.first_name ?? "").split(/\s+/)[0] ?? "");
  const last = safeEmailPart(String(personal.last_name ?? ""));
  const base = [first, last].filter(Boolean).join(".") || `teacher.${row.source_row}`;
  return `${base}.${row.source_row}@temp.asuncion-nhs.invalid`;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function escapeCsv(value: unknown) {
  return '"' + String(value ?? "").replace(/"/g, '""') + '"';
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const text = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\r\n");
  const blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function TeacherProfileImportPage() {
  const [directory, setDirectory] = useState<AccountDirectoryEntry[]>([]);
  const [rows, setRows] = useState<PreparedTeacher[]>([]);
  const [excluded, setExcluded] = useState<ParsedTeacher[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [updatedProfiles, setUpdatedProfiles] = useState(0);
  const [fileName, setFileName] = useState("");
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDirectory() {
      try {
        const [usersResponse, meResponse] = await Promise.all([
          fetch("/api/admin/users", { cache: "no-store" }),
          fetch("/api/auth/me", { cache: "no-store" }),
        ]);
        const usersResult = await usersResponse.json().catch(() => ({}));
        const meResult = await meResponse.json().catch(() => ({}));

        if (!usersResponse.ok) throw new Error(usersResult.error ?? "Unable to load portal accounts.");
        if (!meResponse.ok) throw new Error(meResult.error ?? "Unable to load your account.");

        const entries: AccountDirectoryEntry[] = (usersResult.users ?? []).map(
          (item: Record<string, unknown>) => ({
            id: String(item.id ?? ""),
            full_name: String(item.full_name ?? ""),
            email: String(item.email ?? "").toLowerCase(),
            role: item.role ? String(item.role) : null,
            requested_role: item.requested_role ? String(item.requested_role) : null,
          })
        );

        if (meResult.profile) {
          entries.push({
            id: String(meResult.profile.id ?? ""),
            full_name: String(meResult.profile.full_name ?? ""),
            email: String(meResult.profile.email ?? "").toLowerCase(),
            role: String(meResult.profile.role ?? ""),
            requested_role: String(meResult.profile.requested_role ?? ""),
          });
        }

        if (active) setDirectory(entries.filter((item) => item.id && item.email));
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load portal accounts.");
      } finally {
        if (active) setLoadingDirectory(false);
      }
    }

    void loadDirectory();
    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => {
    const teachingRows = rows.filter((row) => row.account_mode !== "not_applicable");
    const updates = teachingRows.filter((row) => row.account_mode === "update").length;
    const temporary = teachingRows.filter((row) => row.temporary_email).length;
    const invalid = teachingRows.filter((row) => !validEmail(row.import_email)).length;
    return {
      total: rows.length,
      teaching: teachingRows.length,
      nonTeaching: rows.length - teachingRows.length,
      newAccounts: teachingRows.filter((row) => row.account_mode === "new").length,
      updates,
      temporary,
      invalid,
      excluded: excluded.length,
    };
  }, [rows, excluded]);

  async function chooseWorkbook(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setRows([]);
    setExcluded([]);
    setCredentials([]);
    setUpdatedProfiles(0);
    setMessage("");
    setError("");
    setFileName(file?.name ?? "");
    if (!file) return;

    if (!/\.(xls|xlsx)$/i.test(file.name)) {
      setError("Use the original Teacher Profile Excel workbook (.xls or .xlsx).");
      return;
    }

    setWorking(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/teacher-profiles", {
        method: "POST",
        body: formData,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to read the Teacher Profile workbook.");

      const parsed = (result.rows ?? []) as ParsedTeacher[];
      const personnelTypeOf = (row: ParsedTeacher) =>
        String(row.source_data?.personnel_type ?? "").trim() ||
        (/teacher/i.test(String(row.position ?? "")) ? "Teaching Personnel" : "Non-Teaching Personnel");
      const teaching = parsed.filter((row) => personnelTypeOf(row) === "Teaching Personnel");
      const nonTeaching = parsed.filter((row) => personnelTypeOf(row) === "Non-Teaching Personnel");
      setExcluded(nonTeaching);

      const existingByEmail = new Map(
        directory.map((item) => [item.email.toLowerCase(), item])
      );
      const currentAdministrator = directory.find((item) => item.role === "administrator");
      const duplicateCounts = new Map<string, number>();
      const duplicateLastRow = new Map<string, number>();

      for (const row of teaching) {
        const email = String(row.email ?? "").trim().toLowerCase();
        if (!email) continue;
        duplicateCounts.set(email, (duplicateCounts.get(email) ?? 0) + 1);
        duplicateLastRow.set(email, row.source_row);
      }

      const preparedTeaching = teaching.map((row): PreparedTeacher => {
        const sourceEmail = String(row.email ?? "").trim().toLowerCase();
        let importEmail = sourceEmail;
        let temporary = false;

        const adminMatch =
          currentAdministrator &&
          identityKey(currentAdministrator.full_name) === identityKey(row.full_name);

        if (adminMatch) {
          importEmail = currentAdministrator.email;
        } else if (!sourceEmail) {
          importEmail = temporaryEmail(row);
          temporary = true;
        } else if (
          (duplicateCounts.get(sourceEmail) ?? 0) > 1 &&
          duplicateLastRow.get(sourceEmail) !== row.source_row
        ) {
          importEmail = temporaryEmail(row);
          temporary = true;
        }

        if (!validEmail(importEmail)) {
          importEmail = temporaryEmail(row);
          temporary = true;
        }

        const existing = existingByEmail.get(importEmail.toLowerCase());
        const sourceData = {
          ...(row.source_data ?? {}),
          original_email: sourceEmail,
          import_email: importEmail,
        };

        return {
          ...row,
          row_number: row.source_row,
          import_email: importEmail,
          original_email: sourceEmail,
          account_mode: existing || adminMatch ? "update" : "new",
          temporary_email: temporary,
          source_data: sourceData,
        };
      });

      const preparedNonTeaching = nonTeaching.map((row): PreparedTeacher => ({
        ...row,
        row_number: row.source_row,
        import_email: String(row.email ?? "").trim().toLowerCase(),
        original_email: String(row.email ?? "").trim().toLowerCase(),
        account_mode: "not_applicable",
        temporary_email: false,
        source_data: {
          ...(row.source_data ?? {}),
          personnel_type: "Non-Teaching Personnel",
        },
      }));

      setRows([...preparedTeaching, ...preparedNonTeaching].sort((a, b) => a.source_row - b.source_row));
      setMessage(
        `${preparedTeaching.length} Teaching Personnel and ${preparedNonTeaching.length} Non-Teaching Personnel loaded. Only Teaching Personnel will be created or updated as Teacher accounts.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to read the Teacher Profile workbook.");
    } finally {
      setWorking(false);
      event.target.value = "";
    }
  }

  function changeEmail(sourceRow: number, value: string) {
    const next = value.trim().toLowerCase();
    setRows((current) =>
      current.map((row) => {
        if (row.source_row !== sourceRow) return row;
        const existing = directory.find((item) => item.email.toLowerCase() === next);
        return {
          ...row,
          import_email: next,
          temporary_email: next.endsWith("@temp.asuncion-nhs.invalid"),
          account_mode: existing ? "update" : "new",
          source_data: { ...row.source_data, import_email: next },
        };
      })
    );
  }

  async function importTeachers() {
    const importRows = rows.filter((row) => row.account_mode !== "not_applicable");
    if (!importRows.length || summary.invalid > 0) return;

    const seen = new Set<string>();
    const duplicate = importRows.find((row) => {
      const email = row.import_email.toLowerCase();
      if (seen.has(email)) return true;
      seen.add(email);
      return false;
    });
    if (duplicate) {
      setError(`The login email ${duplicate.import_email} is still duplicated. Edit one of the duplicate rows before importing.`);
      return;
    }

    setWorking(true);
    setError("");
    setMessage("");
    setCredentials([]);
    setUpdatedProfiles(0);

    const issued: Credential[] = [];
    let updated = 0;

    try {
      for (let start = 0; start < importRows.length; start += 200) {
        const batch = importRows.slice(start, start + 200).map((row) => ({
          row_number: row.row_number,
          full_name: row.full_name,
          email: row.import_email,
          position: row.position || "Teacher",
          mobile: "",
          teacher_personal: row.teacher_personal,
          teacher_official: row.teacher_official,
          source_data: row.source_data,
        }));

        const response = await fetch("/api/admin/import-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "import",
            personType: "teacher",
            fileName: fileName || "TEACHERS PROFILE.xlsx",
            rows: batch,
          }),
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "Teacher account import failed.");

        issued.push(...(result.accounts ?? []));
        updated += Number(result.updated_profiles ?? 0);

        if (Array.isArray(result.errors) && result.errors.length) {
          const first = result.errors[0];
          throw new Error(
            `${result.errors.length} row(s) could not be imported. ${first?.error ?? "Review the Teacher Profile workbook."}`
          );
        }
      }

      setCredentials(issued);
      setUpdatedProfiles(updated);
      setMessage(
        `Import complete: ${issued.length} new Teacher account${issued.length === 1 ? "" : "s"} created and ${updated} existing profile${updated === 1 ? "" : "s"} updated.`
      );
    } catch (err) {
      setCredentials(issued);
      setUpdatedProfiles(updated);
      setError(
        (err instanceof Error ? err.message : "Teacher account import failed.") +
          (issued.length
            ? ` ${issued.length} new account(s) were already created. Download those credentials before retrying.`
            : "")
      );
    } finally {
      setWorking(false);
    }
  }

  function downloadCredentials() {
    if (!credentials.length) return;
    downloadCsv(
      "ANHS_Teacher_Temporary_Credentials.csv",
      ["Email", "Full Name", "Position", "Temporary Password", "Temporary Email?"],
      credentials.map((item) => [
        item.identifier,
        item.full_name,
        item.position ?? "Teacher",
        item.temporary_password,
        item.identifier.endsWith("@temp.asuncion-nhs.invalid") ? "YES - update before regular use" : "No",
      ])
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topbar}>
          <a href="/portal"><ArrowLeft size={16} />Back to portal</a>
          <a href="/portal/admin/masterlist"><Users size={16} />Bulk account import</a>
        </nav>

        <header className={styles.header}>
          <div>
            <span>HUMAN RESOURCES · ACCOUNT PROVISIONING</span>
            <h1>Teacher Profile Import</h1>
            <p>
              Upload the original 20-column Teacher&apos;s Profile workbook. The portal creates
              Teacher accounts, imports the personnel profile, and updates existing Teacher
              profiles without resetting their passwords.
            </p>
          </div>
          <div className={styles.security}>
            <ShieldCheck size={20} />
            Super Administrator only
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2>1. Upload the Teacher Profile workbook</h2>
              <p>
                Missing or duplicated source emails receive a temporary non-routable login
                address. You can replace that email later from Users &amp; accounts.
              </p>
            </div>
            <FileSpreadsheet size={26} />
          </div>

          <label className={styles.filePicker}>
            <Upload size={20} />
            <div>
              <strong>{fileName || "Choose TEACHERS PROFILE Excel file"}</strong>
              <span>.xls or .xlsx · original school personnel layout</span>
            </div>
            <input type="file" accept=".xls,.xlsx" onChange={chooseWorkbook} disabled={working || loadingDirectory} />
          </label>

          {loadingDirectory && (
            <div className={styles.loading}><RefreshCw size={17} />Loading existing portal accounts…</div>
          )}
        </section>

        {rows.length > 0 && (
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2>2. Review account matching</h2>
                <p>
                  All personnel are shown with a Personnel Type label. Only Teaching Personnel
                  are included in Teacher account creation; Non-Teaching Personnel can be assigned
                  a separate portal role later.
                </p>
              </div>
              <UserRoundCheck size={26} />
            </div>

            <div className={styles.summary}>
              <span>Total personnel <strong>{summary.total}</strong></span>
              <span>Teaching Personnel <strong>{summary.teaching}</strong></span>
              <span>Non-Teaching Personnel <strong>{summary.nonTeaching}</strong></span>
              <span>New accounts <strong>{summary.newAccounts}</strong></span>
              <span>Existing profiles <strong>{summary.updates}</strong></span>
              <span>Temporary emails <strong>{summary.temporary}</strong></span>

            </div>

            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Teacher</th>
                    <th>Position</th>
                    <th>Personnel Type</th>
                    <th>Portal login email</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.source_row}>
                      <td>{row.source_row}</td>
                      <td>
                        <strong>{row.full_name}</strong>
                        {row.original_email && row.original_email !== row.import_email && (
                          <small>Source email: {row.original_email}</small>
                        )}
                      </td>
                      <td>{row.position || "Teacher"}</td>
                      <td>
                        {String(row.source_data?.personnel_type ?? "") ||
                          (row.account_mode === "not_applicable" ? "Non-Teaching Personnel" : "Teaching Personnel")}
                      </td>
                      <td>
                        <input
                          className={!validEmail(row.import_email) ? styles.invalidInput : ""}
                          value={row.import_email}
                          onChange={(event) => changeEmail(row.source_row, event.target.value)}
                          aria-label={`Login email for ${row.full_name}`}
                          readOnly={row.account_mode === "not_applicable"}
                        />
                        {row.temporary_email && <small className={styles.temp}>Temporary email</small>}
                        {row.account_mode === "not_applicable" && <small>Role can be assigned later</small>}
                      </td>
                      <td>
                        {row.account_mode === "not_applicable" ? (
                          <span>Not a Teacher account</span>
                        ) : (
                          <span className={row.account_mode === "update" ? styles.update : styles.create}>
                            {row.account_mode === "update" ? "Update profile" : "Create account"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>



            <div className={styles.importBar}>
              <div>
                <strong>Ready to import</strong>
                <span>
                  Existing Teacher accounts keep their passwords. New accounts receive a one-time
                  temporary password and must change it on first login.
                </span>
              </div>
              <button
                onClick={() => void importTeachers()}
                disabled={working || summary.invalid > 0 || rows.length === 0}
              >
                <KeyRound size={17} />
                {working ? "Importing…" : "Create / update Teacher profiles"}
              </button>
            </div>
          </section>
        )}

        {(credentials.length > 0 || updatedProfiles > 0) && (
          <section className={styles.credentials}>
            <CheckCircle2 size={26} />
            <div>
              <h2>Teacher import completed</h2>
              <p>
                {credentials.length} new account{credentials.length === 1 ? "" : "s"} created ·{" "}
                {updatedProfiles} existing profile{updatedProfiles === 1 ? "" : "s"} updated.
              </p>
              {credentials.length > 0 && (
                <button onClick={downloadCredentials}>
                  <Download size={16} />Download temporary credentials CSV
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
