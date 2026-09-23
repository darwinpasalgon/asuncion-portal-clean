"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Edit3,
  KeyRound,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserRound,
  UserX,
  Users,
  X,
} from "lucide-react";
import styles from "./users.module.css";

type PersonType = "student" | "teacher";
type UserStatus = "pending" | "active" | "suspended";

type UserRecord = {
  id: string;
  full_name: string;
  email: string;
  recovery_phone: string;
  lrn: string | null;
  requested_role: PersonType;
  role: PersonType | null;
  account_status: UserStatus;
  grade_level: number | null;
  section: string | null;
  position: string | null;
  created_at: string;
};

type Section = {
  id: string;
  grade_level: number;
  name: string;
};

type EditState = {
  id: string;
  personType: PersonType;
  fullName: string;
  lrn: string;
  email: string;
  recoveryPhone: string;
  gradeLevel: string;
  sectionId: string;
  position: string;
};

function personTypeOf(user: UserRecord): PersonType {
  return user.role === "teacher" || user.requested_role === "teacher"
    ? "teacher"
    : "student";
}

function statusLabel(status: UserStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function UsersAccountsPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [activeYear, setActiveYear] = useState<{ id: string; name: string } | null>(null);
  const [personType, setPersonType] = useState<PersonType>("student");
  const [status, setStatus] = useState<"all" | UserStatus>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<EditState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to load Students and Teachers.");
        return;
      }
      setUsers(result.users ?? []);
      setSections(result.sections ?? []);
      setActiveYear(result.activeYear ?? null);
    } catch {
      setError("Unable to reach the user-management service.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.filter((user) => {
      if (personTypeOf(user) !== personType) return false;
      if (status !== "all" && user.account_status !== status) return false;
      if (!needle) return true;
      return [
        user.full_name,
        user.email,
        user.lrn ?? "",
        user.section ?? "",
        user.position ?? "",
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [users, personType, status, search]);

  function openEdit(user: UserRecord) {
    const type = personTypeOf(user);
    const sectionId =
      type === "student"
        ? sections.find(
            (section) =>
              section.grade_level === user.grade_level &&
              section.name === user.section
          )?.id ?? ""
        : "";

    setEditing({
      id: user.id,
      personType: type,
      fullName: user.full_name,
      lrn: user.lrn ?? "",
      email: user.email,
      recoveryPhone: user.recovery_phone,
      gradeLevel: user.grade_level ? String(user.grade_level) : "",
      sectionId,
      position: user.position ?? "Teacher",
    });
    setError("");
    setSuccess("");
  }

  const editSections =
    editing?.personType === "student" && editing.gradeLevel
      ? sections.filter(
          (section) => section.grade_level === Number(editing.gradeLevel)
        )
      : [];

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    setWorking(editing.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          user_id: editing.id,
          full_name: editing.fullName,
          recovery_phone: editing.recoveryPhone,
          ...(editing.personType === "student"
            ? {
                lrn: editing.lrn,
                grade_level: Number(editing.gradeLevel),
                section_id: editing.sectionId,
              }
            : {
                email: editing.email,
                position: editing.position,
              }),
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to update this account.");
        return;
      }

      setEditing(null);
      setSuccess("Account information updated successfully.");
      await loadUsers();
    } catch {
      setError("Unable to reach the user-management service.");
    } finally {
      setWorking("");
    }
  }

  async function changeStatus(user: UserRecord, action: "suspend" | "reactivate") {
    const verb = action === "suspend" ? "suspend" : "reactivate";
    if (!window.confirm(`Are you sure you want to ${verb} ${user.full_name}?`)) {
      return;
    }

    setWorking(user.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, user_id: user.id }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "Unable to update account status.");
        return;
      }

      setSuccess(
        action === "suspend"
          ? "Account suspended. The user can no longer access the portal."
          : "Account reactivated successfully."
      );
      await loadUsers();
    } catch {
      setError("Unable to reach the user-management service.");
    } finally {
      setWorking("");
    }
  }

  async function deleteUser() {
    if (!deleteTarget || deleteText !== "DELETE") return;

    setWorking(deleteTarget.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          user_id: deleteTarget.id,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const blockers = Array.isArray(result.blockers)
          ? " Existing records: " + result.blockers.join(", ") + "."
          : "";
        setError(
          (result.error ?? "Unable to permanently delete this account.") + blockers
        );
        setDeleteTarget(null);
        setDeleteText("");
        return;
      }

      setDeleteTarget(null);
      setDeleteText("");
      setSuccess("Account permanently deleted.");
      await loadUsers();
    } catch {
      setError("Unable to reach the user-management service.");
    } finally {
      setWorking("");
    }
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
            <a href="/portal/admin/accounts">Pending approvals</a>
            <a href="/portal/admin/masterlist">Masterlist & activation</a>
            <a href="/portal/admin/password-resets">Password resets</a>
          </div>
        </nav>

        <header className={styles.header}>
          <div>
            <span>ADMINISTRATION</span>
            <h1>Users & accounts</h1>
            <p>
              Edit official Student and Teacher information, control account
              access, and safely remove unused accounts.
            </p>
          </div>
          <div className={styles.security}>
            <ShieldCheck size={18} />
            <div>
              <small>ACTIVE SCHOOL YEAR</small>
              <strong>{activeYear?.name ?? "Not configured"}</strong>
            </div>
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <section className={styles.panel}>
          <div className={styles.controls}>
            <div className={styles.tabs}>
              <button
                className={personType === "student" ? styles.activeTab : ""}
                onClick={() => setPersonType("student")}
              >
                Students
              </button>
              <button
                className={personType === "teacher" ? styles.activeTab : ""}
                onClick={() => setPersonType("teacher")}
              >
                Teachers
              </button>
            </div>

            <label className={styles.search}>
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  personType === "student"
                    ? "Search name, LRN, or section"
                    : "Search name, email, or position"
                }
              />
            </label>

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "all" | UserStatus)
              }
              aria-label="Account status"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>

            <button
              className={styles.refresh}
              onClick={() => void loadUsers()}
              disabled={loading}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div className={styles.summary}>
            <Users size={18} />
            <strong>{filtered.length}</strong>
            <span>{personType === "student" ? "Student" : "Teacher"} account{filtered.length === 1 ? "" : "s"} shown</span>
          </div>

          {loading ? (
            <div className={styles.empty}>Loading user accounts…</div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>No matching accounts found.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>{personType === "student" ? "LRN" : "Email"}</th>
                    <th>{personType === "student" ? "Class" : "Position"}</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className={styles.nameCell}>
                          <span className={styles.avatar}><UserRound size={17} /></span>
                          <div>
                            <strong>{user.full_name}</strong>
                            <small>
                              {personTypeOf(user) === "student" ? "Student" : "Teacher"}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>{personType === "student" ? user.lrn ?? "—" : user.email}</td>
                      <td>
                        {personType === "student"
                          ? user.grade_level
                            ? `Grade ${user.grade_level} · ${user.section || "No section"}`
                            : "Not assigned"
                          : user.position || "Teacher"}
                      </td>
                      <td>{user.recovery_phone || "—"}</td>
                      <td>
                        <span className={styles[user.account_status]}>
                          {statusLabel(user.account_status)}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button onClick={() => openEdit(user)}>
                            <Edit3 size={15} /> Edit
                          </button>

                          {user.account_status === "active" && (
                            <button
                              onClick={() => void changeStatus(user, "suspend")}
                              disabled={working === user.id}
                            >
                              <UserX size={15} /> Suspend
                            </button>
                          )}

                          {user.account_status === "suspended" && (
                            <button
                              onClick={() => void changeStatus(user, "reactivate")}
                              disabled={working === user.id}
                            >
                              <UserCheck size={15} /> Reactivate
                            </button>
                          )}

                          {user.account_status === "pending" && (
                            <a href="/portal/admin/accounts">Review</a>
                          )}

                          <a href="/portal/admin/password-resets">
                            <KeyRound size={15} /> Reset
                          </a>

                          <button
                            className={styles.dangerAction}
                            onClick={() => {
                              setDeleteTarget(user);
                              setDeleteText("");
                              setError("");
                              setSuccess("");
                            }}
                          >
                            <Trash2 size={15} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {editing && (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.modal} role="dialog" aria-modal="true">
            <div className={styles.modalHead}>
              <div>
                <span>EDIT {editing.personType.toUpperCase()}</span>
                <h2>Update account information</h2>
              </div>
              <button
                className={styles.iconButton}
                onClick={() => setEditing(null)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={saveEdit}>
              <label>
                <span>Full name</span>
                <input
                  value={editing.fullName}
                  onChange={(event) =>
                    setEditing({ ...editing, fullName: event.target.value })
                  }
                  required
                />
              </label>

              {editing.personType === "student" ? (
                <>
                  <label>
                    <span>LRN</span>
                    <input
                      value={editing.lrn}
                      onChange={(event) =>
                        setEditing({ ...editing, lrn: event.target.value })
                      }
                      inputMode="numeric"
                      maxLength={12}
                      required
                    />
                  </label>

                  <div className={styles.twoCol}>
                    <label>
                      <span>Grade level</span>
                      <select
                        value={editing.gradeLevel}
                        onChange={(event) =>
                          setEditing({
                            ...editing,
                            gradeLevel: event.target.value,
                            sectionId: "",
                          })
                        }
                        required
                      >
                        <option value="">Select grade</option>
                        {[7, 8, 9, 10, 11, 12].map((grade) => (
                          <option key={grade} value={grade}>
                            Grade {grade}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Section</span>
                      <select
                        value={editing.sectionId}
                        onChange={(event) =>
                          setEditing({ ...editing, sectionId: event.target.value })
                        }
                        required
                      >
                        <option value="">Select section</option>
                        {editSections.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <label>
                    <span>Login email</span>
                    <input
                      type="email"
                      value={editing.email}
                      onChange={(event) =>
                        setEditing({ ...editing, email: event.target.value })
                      }
                      required
                    />
                    <small>
                      Changing this also changes the Teacher's actual portal login email.
                    </small>
                  </label>

                  <label>
                    <span>Position / designation</span>
                    <input
                      value={editing.position}
                      onChange={(event) =>
                        setEditing({ ...editing, position: event.target.value })
                      }
                      placeholder="Teacher III, Master Teacher I, etc."
                    />
                  </label>
                </>
              )}

              <label>
                <span>Mobile / contact number</span>
                <input
                  value={editing.recoveryPhone}
                  onChange={(event) =>
                    setEditing({ ...editing, recoveryPhone: event.target.value })
                  }
                  required
                />
              </label>

              <div className={styles.modalActions}>
                <button type="button" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button
                  className={styles.primary}
                  type="submit"
                  disabled={working === editing.id}
                >
                  {working === editing.id ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.modal} role="dialog" aria-modal="true">
            <div className={styles.deleteIcon}><Trash2 size={22} /></div>
            <h2>Permanently delete account?</h2>
            <p className={styles.deleteText}>
              You are about to permanently delete <strong>{deleteTarget.full_name}</strong>.
              If this person already has protected school records, the portal will
              refuse deletion and you should suspend the account instead.
            </p>

            <label>
              <span>Type DELETE to confirm</span>
              <input
                value={deleteText}
                onChange={(event) => setDeleteText(event.target.value)}
                autoComplete="off"
              />
            </label>

            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteText("");
                }}
              >
                Cancel
              </button>
              <button
                className={styles.deleteButton}
                type="button"
                disabled={
                  deleteText !== "DELETE" || working === deleteTarget.id
                }
                onClick={() => void deleteUser()}
              >
                {working === deleteTarget.id ? "Deleting…" : "Permanently delete"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
