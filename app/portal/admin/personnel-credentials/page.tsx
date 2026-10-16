"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Download, KeyRound, RefreshCw, ShieldCheck, Users } from "lucide-react";

type PersonnelLogin = {
  id: string;
  full_name: string;
  email: string;
  position: string;
  role: "teacher" | "administrator" | "staff_administrator";
  admin_role: string | null;
  account_status: string;
  must_change_password: boolean;
};

function safeCell(value: unknown) {
  const text = String(value ?? "");
  // Quoting does not prevent spreadsheet formula injection; escape potential
  // expressions, even when they start with whitespace or tabs.
  const safe = /^[\s\uFEFF]*[=+@\-]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}
function roleLabel(row: PersonnelLogin) {
  if (row.role === "teacher") return "Teaching Personnel";
  if (row.role === "administrator") return "Super Administrator";
  return row.admin_role === "registrar" ? "Registrar" : "Non-Teaching / Staff Administrator";
}
function downloadDirectory(rows: PersonnelLogin[]) {
  const header = ["Full Name", "Login Email", "Position", "Account Type", "Status", "Password Change Required"];
  const data = rows.map((row) => [
    row.full_name, row.email, row.position, roleLabel(row),
    row.account_status, row.must_change_password ? "Yes" : "No",
  ]);
  const csv = [header, ...data].map((row) => row.map(safeCell).join(",")).join("\r\n");
  const objectURL = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = objectURL;
  a.download = "ANHS_Personnel_Login_Directory.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectURL), 1500);
}
const panel: React.CSSProperties = {
  border: "1px solid #dce8ee", borderRadius: 16,
  padding: 22, background: "#fff", boxShadow: "0 6px 18px #173c4f08",
};
const link: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7,
  borderRadius: 10, padding: "10px 14px", fontWeight: 750,
  fontSize: 13, textDecoration: "none", border: "1px solid #bedfdc",
  color: "#08746b", background: "#f1fbf8",
};

export default function PersonnelCredentialsPage() {
  const [staff, setStaff] = useState<PersonnelLogin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | "teacher" | "non-teacher">("all");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/personnel-login-directory", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to load personnel login emails.");
      setStaff(result.staff ?? []);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to load personnel login emails.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const shown = useMemo(() => staff.filter((row) => {
    const matchesType = type === "all" ||
      (type === "teacher" ? row.role === "teacher" : row.role !== "teacher");
    const q = search.trim().toLowerCase();
    return matchesType && (!q || [row.full_name, row.email, row.position].some(
      (part) => part.toLowerCase().includes(q)));
  }), [staff, search, type]);
  const teaching = staff.filter((row) => row.role === "teacher").length;
  const adminStaff = staff.length - teaching;

  return (
    <main style={{ minHeight: "100vh", background: "#f4f8fb", padding: "25px 15px", color: "#25495d" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gap: 17 }}>
        <nav style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <a href="/portal/admin/users" style={{ ...link, background: "#fff", color: "#286c88", borderColor: "#d4e3eb" }}>
            <ArrowLeft size={15}/> Users & Accounts
          </a>
          <button type="button" onClick={() => void load()} disabled={loading}
            style={{ ...link, cursor: "pointer" }}><RefreshCw size={15}/> {loading ? "Checking…" : "Refresh"}</button>
        </nav>

        <header style={{ display: "grid", gap: 6 }}>
          <div style={{ color: "#16806e", fontWeight: 850, fontSize: 11, letterSpacing: 1.5 }}>
            <ShieldCheck size={14} style={{ verticalAlign: "middle", marginRight: 5 }}/>
            SUPER ADMINISTRATOR · ACCOUNT ACCESS
          </div>
          <h1 style={{ fontSize: "clamp(27px, 4vw, 36px)", fontWeight: 850, letterSpacing: "-0.035em", margin: "5px 0" }}>
            Personnel Login Credentials
          </h1>
          <p style={{ color: "#607b8c", lineHeight: 1.65, fontSize: 14 }}>
            Download the official login-email list for personnel who have portal accounts. Existing passwords are
            never displayed or downloadable. Fresh temporary passwords are issued only through an approved
            first-login recovery or verified password reset.
          </p>
        </header>

        {error && <div role="alert" style={{ ...panel, background: "#fff4f1", color: "#a34035" }}>{error}</div>}

        <section style={{ ...panel, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <strong style={{ display: "block", fontSize: 17 }}>First-Login Credential Generation</strong>
              <small style={{ color: "#668390" }}>Teacher accounts eligible for one-time credential recovery</small>
            </div>
            <a href="/portal/admin/teacher-import#first-login-credentials" style={link}>
              <KeyRound size={16}/> Check & Generate Fresh Credentials <ArrowUpRight size={13}/>
            </a>
          </div>
          <p style={{ color: "#738b98", lineHeight: 1.5, fontSize: 12 }}>
            The generation page checks eligibility before offering a download and requires confirmation before
            changing any password. If there are no eligible accounts, use individual password reset instead.
          </p>
          <a href="/portal/admin/password-resets" style={{ fontSize: 13, color: "#126f8c", fontWeight: 700 }}>
            Open Verified Password Resets →
          </a>
        </section>

        <section style={{ ...panel, display: "grid", gap: 13 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ fontSize: 17, display: "block" }}>Personnel Login Directory</strong>
              <small style={{ color: "#67818d" }}>
                <Users size={12} style={{ verticalAlign: "middle" }}/> {staff.length} portal accounts
                {" · "}{teaching} teaching · {adminStaff} administrative
              </small>
            </div>
            <button type="button" onClick={() => downloadDirectory(shown)} disabled={loading || !shown.length}
              style={{ ...link, cursor: "pointer", opacity: loading || !shown.length ? 0.5 : 1 }}>
              <Download size={15}/> Download Login Emails CSV
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <input aria-label="Search personnel" placeholder="Search by name, login email, position…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ flex: "1 1 250px", minHeight: 40, padding: "8px 11px", border: "1px solid #ccdee6", borderRadius: 9 }}/>
            <select aria-label="Personnel type" value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              style={{ minHeight: 40, padding: "8px 12px", border: "1px solid #ccdee6", borderRadius: 9 }}>
              <option value="all">All Personnel</option>
              <option value="teacher">Teaching Personnel</option>
              <option value="non-teacher">Administrative Personnel</option>
            </select>
          </div>
          {loading ? <p>Loading active personnel login directory…</p> :
            staff.length === 0 ? <p>No personnel portal accounts found.</p> :
            <div style={{ overflowX: "auto", border: "1px solid #e5ecef", borderRadius: 10 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
                <thead><tr style={{ background: "#f2f7f9", textAlign: "left", fontSize: 12 }}>
                  {["Personnel", "Login Email", "Position / Role", "Status", "First-Login Setting"].map((head) =>
                    <th key={head} style={{ padding: 13 }}>{head}</th>)}
                </tr></thead>
                <tbody>{shown.map((row) => <tr key={row.id} style={{ borderTop: "1px solid #edf1f3" }}>
                  <td style={{ padding: 12, fontSize: 12, fontWeight: 700 }}>{row.full_name}</td>
                  <td style={{ padding: 12, fontSize: 12, overflowWrap: "anywhere" }}>{row.email}</td>
                  <td style={{ padding: 12, fontSize: 12 }}>{row.position || roleLabel(row)}</td>
                  <td style={{ padding: 12, fontSize: 12 }}>{row.account_status}</td>
                  <td style={{ padding: 12, fontSize: 12 }}>
                    {row.must_change_password ? "Password Change Required" : "Not Required"}
                  </td>
                </tr>)}</tbody>
              </table>
            </div>}
          <small style={{ color: "#738b98" }}>
            {shown.length} of {staff.length} account(s) shown. CSV includes names, login emails, roles and
            account status, but never current or past passwords. Personnel records without a portal
            account are not login credentials and are not listed.
          </small>
        </section>
      </div>
    </main>
  );
}
