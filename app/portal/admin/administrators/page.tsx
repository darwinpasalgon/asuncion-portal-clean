"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import styles from "./administrators.module.css";

type AdminRole = "super_administrator" | "registrar" | "content_administrator" | "school_administrator";
type Administrator = {
  id: string;
  full_name: string;
  email: string;
  position: string | null;
  admin_role: AdminRole;
  account_status: "active" | "suspended";
  permissions: string[];
  is_current_user: boolean;
};

const customPermissions = [
  ["accounts.manage", "Account approvals"],
  ["users.manage", "Users & accounts"],
  ["bulk_import.manage", "Bulk account import"],
  ["school_setup.manage", "School setup"],
  ["teaching.manage", "Subjects & teachers"],
  ["schedules.manage", "Class schedules"],
  ["attendance.manage", "Attendance"],
  ["reports.view", "Reports & analytics"],
  ["announcements.manage", "Announcements"],
  ["resources.manage", "Learning resources"],
  ["password_resets.manage", "Password resets"],
  ["sf10.manage", "SF10 learner records"],
] as const;

function roleName(role: AdminRole) {
  if (role === "super_administrator") return "Super Administrator";
  if (role === "registrar") return "Registrar";
  if (role === "content_administrator") return "Content Administrator";
  return "Custom Administrator";
}

export default function AdministratorsPage() {
  const [admins, setAdmins] = useState<Administrator[]>([]);
  const [adminRole, setAdminRole] = useState<AdminRole>("registrar");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/administrators", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to load administrator accounts.");
        return;
      }
      setAdmins(result.administrators ?? []);
    } catch {
      setError("Unable to reach the administrator management service.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function togglePermission(permission: string) {
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission]
    );
  }

  async function createAdministrator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setWorking("create");
    setError("");
    setSuccess("");
    setTemporaryPassword("");

    try {
      const response = await fetch("/api/admin/administrators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          full_name: String(data.get("fullName") ?? ""),
          email: String(data.get("email") ?? ""),
          position: String(data.get("position") ?? ""),
          admin_role: adminRole,
          permissions: adminRole === "school_administrator" ? permissions : [],
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "Unable to create the administrator account.");
        return;
      }

      setTemporaryPassword(String(result.temporary_password ?? ""));
      setSuccess("Administrator account created. Give the temporary password only to the assigned staff member.");
      form.reset();
      setAdminRole("registrar");
      setPermissions([]);
      await load();
    } catch {
      setError("Unable to reach the administrator management service.");
    } finally {
      setWorking("");
    }
  }

  async function accountAction(admin: Administrator, action: "suspend" | "reactivate" | "delete") {
    if (admin.is_current_user) return;
    if (action === "delete" && !window.confirm(`Delete the delegated Administrator account for ${admin.full_name}?`)) {
      return;
    }

    setWorking(admin.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/administrators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          administrator_id: admin.id,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to update the administrator account.");
        return;
      }

      setSuccess(
        action === "delete"
          ? "Delegated Administrator deleted."
          : `${admin.full_name} is now ${action === "suspend" ? "suspended" : "active"}.`
      );
      await load();
    } catch {
      setError("Unable to reach the administrator management service.");
    } finally {
      setWorking("");
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topActions}>
          <a href="/portal"><ArrowLeft size={16} />Back to portal</a>
          <button onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} />Refresh
          </button>
        </nav>

        <header className={styles.header}>
          <div>
            <span>SUPER ADMINISTRATION</span>
            <h1>Administrators</h1>
            <p>
              Create delegated Administrator accounts without giving away Super Administrator access.
              Registrar access is limited to SF10 records. Additional administrative permissions can be assigned later.
            </p>
          </div>
          <div className={styles.superBadge}><ShieldCheck size={20} />Super Administrator only</div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        {temporaryPassword && (
          <div className={styles.credentials}>
            <KeyRound size={20} />
            <div>
              <strong>Temporary password</strong>
              <code>{temporaryPassword}</code>
              <span>This is shown after account creation. The user must change it on first sign-in.</span>
            </div>
          </div>
        )}

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Add delegated Administrator</h2>
              <p>Your Super Administrator account remains separate and cannot be created or replaced here.</p>
            </div>
            <UserPlus size={24} />
          </div>

          <form className={styles.form} onSubmit={createAdministrator}>
            <label>
              <span>Full name</span>
              <input name="fullName" required maxLength={120} placeholder="Registrar or staff name" />
            </label>
            <label>
              <span>Email address</span>
              <input name="email" required type="email" placeholder="name@deped.gov.ph" />
            </label>
            <label>
              <span>Position / designation</span>
              <input name="position" maxLength={100} placeholder="e.g. Registrar" />
            </label>
            <label>
              <span>Administrator role</span>
              <select
                value={adminRole}
                onChange={(event) => {
                  setAdminRole(event.target.value as AdminRole);
                  setPermissions([]);
                }}
              >
                <option value="registrar">Registrar - SF10 records</option>
                <option value="content_administrator">Content Administrator - announcements/resources</option>
                <option value="school_administrator">Custom Administrator</option>
              </select>
            </label>

            {adminRole === "registrar" && (
              <div className={styles.roleNote}>
                <strong>Registrar</strong>
                <span>Can access learner permanent-record information and the SF10 workspace. No user deletion, bulk import, password reset, or school-setup authority.</span>
              </div>
            )}

            {adminRole === "content_administrator" && (
              <div className={styles.roleNote}>
                <strong>Content Administrator</strong>
                <span>Reserved for school staff who will manage announcements and learning-resource content. These modules can be enabled as the delegated-permission rollout continues.</span>
              </div>
            )}

            {adminRole === "school_administrator" && (
              <div className={styles.permissionBox}>
                <strong>Custom permissions</strong>
                <p>Choose only the administrative modules this account should handle.</p>
                <div className={styles.permissionGrid}>
                  {customPermissions.map(([permission, label]) => (
                    <label key={permission} className={styles.check}>
                      <input
                        type="checkbox"
                        checked={permissions.includes(permission)}
                        onChange={() => togglePermission(permission)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button className={styles.primary} type="submit" disabled={working === "create"}>
              <UserPlus size={17} />{working === "create" ? "Creating…" : "Create Administrator"}
            </button>
          </form>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Administrator accounts</h2>
              <p>Only your account should show as Super Administrator unless you intentionally change the system design later.</p>
            </div>
          </div>

          {loading ? (
            <div className={styles.empty}>Loading administrators…</div>
          ) : admins.length === 0 ? (
            <div className={styles.empty}>No Administrator accounts found.</div>
          ) : (
            <div className={styles.adminList}>
              {admins.map((admin) => (
                <article className={styles.adminRow} key={admin.id}>
                  <div className={styles.identity}>
                    <strong>{admin.full_name}</strong>
                    <span>{admin.email}</span>
                  </div>
                  <div>
                    <span>ROLE</span>
                    <strong>{roleName(admin.admin_role)}</strong>
                  </div>
                  <div>
                    <span>POSITION</span>
                    <strong>{admin.position || "Administrator"}</strong>
                  </div>
                  <div>
                    <span>STATUS</span>
                    <strong className={admin.account_status === "active" ? styles.active : styles.suspended}>
                      {admin.account_status}
                    </strong>
                  </div>
                  <div className={styles.actions}>
                    {admin.is_current_user ? (
                      <span className={styles.current}>Your account</span>
                    ) : (
                      <>
                        <button
                          onClick={() => void accountAction(admin, admin.account_status === "active" ? "suspend" : "reactivate")}
                          disabled={working === admin.id}
                        >
                          {admin.account_status === "active" ? <UserX size={15} /> : <UserCheck size={15} />}
                          {admin.account_status === "active" ? "Suspend" : "Reactivate"}
                        </button>
                        <button
                          className={styles.delete}
                          onClick={() => void accountAction(admin, "delete")}
                          disabled={working === admin.id}
                        >
                          <Trash2 size={15} />Delete
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
