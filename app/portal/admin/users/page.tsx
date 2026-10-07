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
import { captureRefreshScroll, restoreRefreshScroll } from "@/lib/background-refresh";
import ActionWaitOverlay from "@/app/components/action-wait-overlay";
import { positionOptions, teachingPositions } from "@/lib/deped-positions";

type PersonType = "student" | "teacher";
type UserStatus = "pending" | "active" | "suspended";

type LearnerInfo = {
  last_name: string;
  first_name: string;
  middle_name: string;
  name_extension: string;
  sex: string;
  birth_date: string;

  guardian_last_name: string;
  guardian_first_name: string;
  guardian_middle_name: string;
  guardian_no_middle_name: boolean | null;
  guardian_name_extension: string;
  guardian_name: string;
  guardian_relationship: string;
  guardian_contact_number: string;

  mother_last_name: string;
  mother_first_name: string;
  mother_middle_name: string;
  mother_no_middle_name: boolean | null;
  mother_name_extension: string;
  mother_maiden_reason: string;
  mother_maiden_name: string;

  father_last_name: string;
  father_first_name: string;
  father_middle_name: string;
  father_no_middle_name: boolean | null;
  father_name_extension: string;
  father_name: string;

  is_indigenous_peoples: boolean | null;
  ethnic_group: string;
  ethnicity_secondary: string;
  mother_tongue: string;
  mother_tongue_secondary: string;
  mother_tongue_tertiary: string;
  religion: string;
  learner_email: string;

  address_house_street_purok: string;
  address_barangay: string;
  address_municipality_city: string;
  address_province: string;
  address_zip_code: string;

  permanent_same_as_current: boolean | null;
  permanent_address_house_street_purok: string;
  permanent_address_barangay: string;
  permanent_address_municipality_city: string;
  permanent_address_province: string;
  permanent_address_zip_code: string;
  permanent_address_other_barangay: string;

  citizenship: string;
  cct_recipient: boolean | null;
  cct_household_id: string;
  has_special_educational_needs: boolean | null;
  lsen_type: string;
  vaccinated_covid19: boolean | null;
  learning_modality: string;
  remarks: string;
};

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
  learner_info: Partial<LearnerInfo> | null;
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
  learnerInfo: LearnerInfo;
};

function emptyLearnerInfo(): LearnerInfo {
  return {
    last_name: "",
    first_name: "",
    middle_name: "",
    name_extension: "",
    sex: "",
    birth_date: "",

    guardian_last_name: "",
    guardian_first_name: "",
    guardian_middle_name: "",
    guardian_no_middle_name: null,
    guardian_name_extension: "",
    guardian_name: "",
    guardian_relationship: "",
    guardian_contact_number: "",

    mother_last_name: "",
    mother_first_name: "",
    mother_middle_name: "",
    mother_no_middle_name: null,
    mother_name_extension: "",
    mother_maiden_reason: "",
    mother_maiden_name: "",

    father_last_name: "",
    father_first_name: "",
    father_middle_name: "",
    father_no_middle_name: null,
    father_name_extension: "",
    father_name: "",

    is_indigenous_peoples: null,
    ethnic_group: "",
    ethnicity_secondary: "",
    mother_tongue: "",
    mother_tongue_secondary: "",
    mother_tongue_tertiary: "",
    religion: "",
    learner_email: "",

    address_house_street_purok: "",
    address_barangay: "",
    address_municipality_city: "",
    address_province: "",
    address_zip_code: "",

    permanent_same_as_current: null,
    permanent_address_house_street_purok: "",
    permanent_address_barangay: "",
    permanent_address_municipality_city: "",
    permanent_address_province: "",
    permanent_address_zip_code: "",
    permanent_address_other_barangay: "",

    citizenship: "",
    cct_recipient: null,
    cct_household_id: "",
    has_special_educational_needs: null,
    lsen_type: "",
    vaccinated_covid19: null,
    learning_modality: "",
    remarks: "",
  };
}

function learnerInfoOf(user: UserRecord): LearnerInfo {
  return { ...emptyLearnerInfo(), ...(user.learner_info ?? {}) };
}

const RELIGION_OPTIONS = [
  "Buddhism",
  "Christianity",
  "Hinduism",
  "Indigenous Religion",
  "Islam",
  "Judaism",
  "No Religion",
  "Not disclosed",
  "Others",
  "Sikhism",
  "Taoism",
];

const LEARNING_MODALITIES = [
  "Modular (print)",
  "Modular Digital",
  "Online",
  "Educational TV",
  "Radio-based Instruction",
  "Homeschooling",
  "Blended",
  "Face to Face",
];

const LSEN_TYPES = [
  "Visual Impairment",
  "Hearing Impairment",
  "Learning Disability",
  "Intellectual Disability",
  "Autism Spectrum Disorder",
  "Emotional-Behavioral Disorder",
  "Orthopedic/ Physical Handicap",
  "Speech / Language Disorder",
  "Cerebral Palsy",
  "Special Health Problem/Chronic Disease (eg Cancer)",
  "Multiple Disabilities",
  "Difficulty in Seeing",
  "Difficulty in Hearing",
  "Difficulty in Basic Learning and Applying Knowledge",
  "Difficulty in Remembering, Concentrating, Paying Attention and Understanding",
  "Difficulty in Applying Adaptive Skills",
  "Difficulty in Displaying Inter-Personal Behavior",
  "Difficulty in Mobility (Walking, Climbing and Grasping)",
  "Difficulty in Communicating",
];

const LOCAL_ETHNICITY_SUGGESTIONS = [
  "Ata",
  "Ata-Manobo",
  "Bagobo",
  "Bagobo-Klata",
  "Bagobo-Tagabawa / Tagabawa",
  "Blaan",
  "Dibabawon",
  "Higaonon",
  "Kalagan / Kagan",
  "Mandaya",
  "Mangguangan",
  "Manobo / Menuvu",
  "Mansaka",
  "Matigsalog / Matigsalug",
  "Tagakaolo / Tagakaulo",
];

const LOCAL_LANGUAGE_SUGGESTIONS = [
  "Cebuano / Sinugbuanong Binisay",
  "Cebuano",
  "Davawenyo",
  "English",
  "Filipino",
  "Hiligaynon",
  "Ilocano",
  "Mandaya",
  "Mansaka",
  "Tagalog",
];

function BooleanChoice({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <div className={styles.booleanChoice}>
      <button
        type="button"
        className={value === true ? styles.choiceActive : ""}
        onClick={() => onChange(true)}
      >
        Yes
      </button>
      <button
        type="button"
        className={value === false ? styles.choiceActive : ""}
        onClick={() => onChange(false)}
      >
        No
      </button>
      <button
        type="button"
        className={value === null ? styles.choiceActive : ""}
        onClick={() => onChange(null)}
      >
        Not Recorded
      </button>
    </div>
  );
}

function ageAsOfFirstFridayJune(birthDate: string, schoolYear?: string) {
  if (!birthDate) return "";
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return "";
  const yearMatch = String(schoolYear ?? "").match(/(\d{4})/);
  const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();
  const juneFirst = new Date(year, 5, 1);
  const offset = (5 - juneFirst.getDay() + 7) % 7;
  const firstFriday = new Date(year, 5, 1 + offset);
  let age = firstFriday.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    firstFriday.getMonth() < birth.getMonth() ||
    (firstFriday.getMonth() === birth.getMonth() &&
      firstFriday.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? String(age) : "";
}

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

  async function loadUsers(background = false) {
    const scrollY = captureRefreshScroll(background);
    if (!background) setLoading(true);
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
      if (!background) setLoading(false);
      restoreRefreshScroll(scrollY);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("q")?.trim();
    if (query) {
      setPersonType("student");
      setSearch(query);
    }
    void loadUsers();
  }, []);

  useEffect(() => {
    if (!users.length) return;
    const editId = new URLSearchParams(window.location.search).get("edit")?.trim();
    if (!editId || editing) return;
    const target = users.find((user) => user.id === editId);
    if (target) {
      setPersonType("student");
      openEdit(target);
    }
  }, [users, editing]);

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

    const learnerInfo = learnerInfoOf(user);
    setEditing({
      id: user.id,
      personType: type,
      fullName: user.full_name,
      lrn: user.lrn ?? "",
      email: user.email,
      recoveryPhone:
        type === "student"
          ? learnerInfo.guardian_contact_number || user.recovery_phone
          : user.recovery_phone,
      gradeLevel: user.grade_level ? String(user.grade_level) : "",
      sectionId,
      position: user.position ?? "",
      learnerInfo,
    });
    setError("");
    setSuccess("");
  }

  function updateLearnerField<K extends keyof LearnerInfo>(
    field: K,
    value: LearnerInfo[K]
  ) {
    setEditing((current) =>
      current && current.personType === "student"
        ? {
            ...current,
            learnerInfo: {
              ...current.learnerInfo,
              [field]: value,
            },
          }
        : current
    );
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
      const learnerDisplayName =
        editing.personType === "student"
          ? [
              editing.learnerInfo.first_name,
              editing.learnerInfo.middle_name,
              editing.learnerInfo.last_name,
              editing.learnerInfo.name_extension,
            ]
              .map((item) => item.trim())
              .filter(Boolean)
              .join(" ") || editing.fullName
          : editing.fullName;

      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          user_id: editing.id,
          full_name: learnerDisplayName,
          ...(editing.personType === "student"
            ? {
                lrn: editing.lrn,
                grade_level: Number(editing.gradeLevel),
                section_id: editing.sectionId,
                ...editing.learnerInfo,
                recovery_phone:
                  editing.learnerInfo.guardian_contact_number ||
                  editing.recoveryPhone,
              }
            : {
                email: editing.email,
                position: editing.position,
                recovery_phone: editing.recoveryPhone,
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
      await loadUsers(true);
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
      await loadUsers(true);
    } catch {
      setError("Unable to reach the user-management service.");
    } finally {
      setWorking("");
    }
  }

  async function requestPasswordReset(user: UserRecord) {
    if (user.account_status !== "active") {
      setError("Only active accounts can request a password reset.");
      return;
    }

    const confirmed = window.confirm(
      `Create a password reset request for ${user.full_name}? You will be taken to Password Resets to issue the temporary password.`
    );
    if (!confirmed) return;

    setWorking(user.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/password-resets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "Unable to create the password reset request.");
        return;
      }

      window.location.href = "/portal/admin/password-resets";
    } catch {
      setError("Unable to reach the password reset service.");
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
      await loadUsers(true);
    } catch {
      setError("Unable to reach the user-management service.");
    } finally {
      setWorking("");
    }
  }

  return (
    <main className={styles.page}>
      <ActionWaitOverlay visible={Boolean(working)} message="Please wait…" />
      <div className={styles.shell}>
        <nav className={styles.topbar}>
          <a href="/portal">
            <ArrowLeft size={16} />
            Back to Portal
          </a>
          <div>
            <a href="/portal/admin/accounts">Pending Approvals</a>
            <a href="/portal/admin/masterlist">Bulk Account Import</a>
            <a href="/portal/admin/password-resets">Password Resets</a>
          </div>
        </nav>

        <header className={styles.header}>
          <div>
            <span>ADMINISTRATION</span>
            <h1>Users & Accounts</h1>
            <p>
              Edit official Student and Teacher information, control account
              access, and safely remove unused accounts.
            </p>
          </div>
          <div className={styles.security}>
            <ShieldCheck size={18} />
            <div>
              <small>ACTIVE SCHOOL YEAR</small>
              <strong>{activeYear?.name ?? "Not Configured"}</strong>
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
              <option value="all">All Statuses</option>
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

                          <button
                            onClick={() => void requestPasswordReset(user)}
                            disabled={working === user.id || user.account_status !== "active"}
                          >
                            <KeyRound size={15} /> Reset Password
                          </button>

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
          <section
            className={`${styles.modal} ${editing.personType === "student" ? styles.learnerModal : ""}`}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.modalHead}>
              <div>
                <span>EDIT {editing.personType.toUpperCase()}</span>
                <h2>{editing.personType === "student" ? "Learner Profile" : "Update Account Information"}</h2>
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
                <span>{editing.personType === "student" ? "Portal Display Name (Auto)" : "Full Name"}</span>
                <input
                  value={
                    editing.personType === "student"
                      ? [
                          editing.learnerInfo.first_name,
                          editing.learnerInfo.middle_name,
                          editing.learnerInfo.last_name,
                          editing.learnerInfo.name_extension,
                        ]
                          .map((item) => item.trim())
                          .filter(Boolean)
                          .join(" ") || editing.fullName
                      : editing.fullName
                  }
                  onChange={(event) =>
                    setEditing({ ...editing, fullName: event.target.value })
                  }
                  readOnly={editing.personType === "student"}
                  required
                />
              </label>

              {editing.personType === "student" ? (
                <>
                  <div className={styles.profileSection}>
                    <div className={styles.profileSectionTitle}>
                      <strong>Enrollment Information</strong>
                      <span>Current school-year placement and learner account identifier.</span>
                    </div>
                    <div className={styles.threeCol}>
                      <label>
                        <span>LRN</span>
                        <input value={editing.lrn} onChange={(event)=>setEditing({...editing,lrn:event.target.value})} inputMode="numeric" maxLength={12} required />
                      </label>
                      <label>
                        <span>Grade Level</span>
                        <select value={editing.gradeLevel} onChange={(event)=>setEditing({...editing,gradeLevel:event.target.value,sectionId:""})} required>
                          <option value="">Select Grade</option>
                          {[7,8,9,10,11,12].map((grade)=><option key={grade} value={grade}>Grade {grade}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>Section</span>
                        <select value={editing.sectionId} onChange={(event)=>setEditing({...editing,sectionId:event.target.value})} required>
                          <option value="">Select Section</option>
                          {editSections.map((section)=><option key={section.id} value={section.id}>{section.name}</option>)}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className={styles.profileSection}>
                    <div className={styles.profileSectionTitle}>
                      <strong>Learner Identity</strong>
                      <span>Official learner information retained from SF1 and the school portal.</span>
                    </div>
                    <div className={styles.fourCol}>
                      <label><span>Last Name</span><input value={editing.learnerInfo.last_name} onChange={(e)=>updateLearnerField("last_name",e.target.value)} /></label>
                      <label><span>First Name</span><input value={editing.learnerInfo.first_name} onChange={(e)=>updateLearnerField("first_name",e.target.value)} /></label>
                      <label><span>Middle Name</span><input value={editing.learnerInfo.middle_name} onChange={(e)=>updateLearnerField("middle_name",e.target.value)} /></label>
                      <label><span>Name Extension</span><input value={editing.learnerInfo.name_extension} onChange={(e)=>updateLearnerField("name_extension",e.target.value)} placeholder="Jr., II, III" /></label>
                    </div>
                    <div className={styles.threeCol}>
                      <label>
                        <span>Sex</span>
                        <select value={editing.learnerInfo.sex} onChange={(e)=>updateLearnerField("sex",e.target.value)}>
                          <option value="">Not Specified</option><option value="M">Male (M)</option><option value="F">Female (F)</option>
                        </select>
                      </label>
                      <label><span>Birth Date</span><input type="date" value={editing.learnerInfo.birth_date} onChange={(e)=>updateLearnerField("birth_date",e.target.value)} /></label>
                      <label><span>Age as of 1st Friday of June</span><input value={ageAsOfFirstFridayJune(editing.learnerInfo.birth_date,activeYear?.name)} readOnly placeholder="Auto-calculated" /></label>
                    </div>
                  </div>

                  <div className={styles.lisPanels}>
                    <section className={styles.lisPanel}>
                      <div className={styles.lisPanelTitle}><strong>Guardian</strong><span>LIS-style guardian information</span></div>
                      <label><span>Last Name</span><input value={editing.learnerInfo.guardian_last_name} onChange={(e)=>updateLearnerField("guardian_last_name",e.target.value)} /></label>
                      <label><span>First Name</span><input value={editing.learnerInfo.guardian_first_name} onChange={(e)=>updateLearnerField("guardian_first_name",e.target.value)} /></label>
                      <label><span>Middle Name</span><input value={editing.learnerInfo.guardian_middle_name} disabled={editing.learnerInfo.guardian_no_middle_name===true} onChange={(e)=>updateLearnerField("guardian_middle_name",e.target.value)} /></label>
                      <label className={styles.checkLine}><input type="checkbox" checked={editing.learnerInfo.guardian_no_middle_name===true} onChange={(e)=>updateLearnerField("guardian_no_middle_name",e.target.checked)} /><span>No Middle Name</span></label>
                      <label><span>Extension Name</span><input value={editing.learnerInfo.guardian_name_extension} onChange={(e)=>updateLearnerField("guardian_name_extension",e.target.value)} placeholder="Jr., II, III" /></label>
                      <label>
                        <span>Relationship</span>
                        <select value={editing.learnerInfo.guardian_relationship} onChange={(e)=>updateLearnerField("guardian_relationship",e.target.value)}>
                          <option value="">Select Relationship</option><option value="Parent">Parent</option><option value="Relative">Relative</option><option value="Non-relative">Non-relative</option>
                        </select>
                      </label>
                      <label><span>Contact Number</span><input value={editing.learnerInfo.guardian_contact_number} onChange={(e)=>updateLearnerField("guardian_contact_number",e.target.value)} placeholder="09XXXXXXXXX" /></label>
                      {!editing.learnerInfo.guardian_last_name && !editing.learnerInfo.guardian_first_name && editing.learnerInfo.guardian_name && <small className={styles.legacyHint}>Imported full name: {editing.learnerInfo.guardian_name}</small>}
                    </section>

                    <section className={styles.lisPanel}>
                      <div className={styles.lisPanelTitle}><strong>Mother&apos;s Maiden Name</strong><span>Use maiden name as recorded in official school records</span></div>
                      <label><span>Last Name</span><input value={editing.learnerInfo.mother_last_name} disabled={Boolean(editing.learnerInfo.mother_maiden_reason)} onChange={(e)=>updateLearnerField("mother_last_name",e.target.value)} /></label>
                      <label><span>First Name</span><input value={editing.learnerInfo.mother_first_name} disabled={Boolean(editing.learnerInfo.mother_maiden_reason)} onChange={(e)=>updateLearnerField("mother_first_name",e.target.value)} /></label>
                      <label><span>Middle Name</span><input value={editing.learnerInfo.mother_middle_name} disabled={Boolean(editing.learnerInfo.mother_maiden_reason)||editing.learnerInfo.mother_no_middle_name===true} onChange={(e)=>updateLearnerField("mother_middle_name",e.target.value)} /></label>
                      <label className={styles.checkLine}><input type="checkbox" checked={editing.learnerInfo.mother_no_middle_name===true} disabled={Boolean(editing.learnerInfo.mother_maiden_reason)} onChange={(e)=>updateLearnerField("mother_no_middle_name",e.target.checked)} /><span>No Middle Name</span></label>
                      <label><span>Extension Name</span><input value={editing.learnerInfo.mother_name_extension} disabled={Boolean(editing.learnerInfo.mother_maiden_reason)} onChange={(e)=>updateLearnerField("mother_name_extension",e.target.value)} /></label>
                      <label>
                        <span>Reason if Not Specified</span>
                        <select value={editing.learnerInfo.mother_maiden_reason} onChange={(e)=>updateLearnerField("mother_maiden_reason",e.target.value)}>
                          <option value="">Not Applicable</option><option value="No mother">No mother</option><option value="Not disclosed">Not disclosed</option>
                        </select>
                      </label>
                      {!editing.learnerInfo.mother_last_name && !editing.learnerInfo.mother_first_name && editing.learnerInfo.mother_maiden_name && <small className={styles.legacyHint}>Imported full name: {editing.learnerInfo.mother_maiden_name}</small>}
                    </section>

                    <section className={styles.lisPanel}>
                      <div className={styles.lisPanelTitle}><strong>Father</strong><span>Parent information from official learner records</span></div>
                      <label><span>Last Name</span><input value={editing.learnerInfo.father_last_name} onChange={(e)=>updateLearnerField("father_last_name",e.target.value)} /></label>
                      <label><span>First Name</span><input value={editing.learnerInfo.father_first_name} onChange={(e)=>updateLearnerField("father_first_name",e.target.value)} /></label>
                      <label><span>Middle Name</span><input value={editing.learnerInfo.father_middle_name} disabled={editing.learnerInfo.father_no_middle_name===true} onChange={(e)=>updateLearnerField("father_middle_name",e.target.value)} /></label>
                      <label className={styles.checkLine}><input type="checkbox" checked={editing.learnerInfo.father_no_middle_name===true} onChange={(e)=>updateLearnerField("father_no_middle_name",e.target.checked)} /><span>No Middle Name</span></label>
                      <label><span>Extension Name</span><input value={editing.learnerInfo.father_name_extension} onChange={(e)=>updateLearnerField("father_name_extension",e.target.value)} /></label>
                      {!editing.learnerInfo.father_last_name && !editing.learnerInfo.father_first_name && editing.learnerInfo.father_name && <small className={styles.legacyHint}>Imported full name: {editing.learnerInfo.father_name}</small>}
                    </section>
                  </div>

                  <div className={styles.lisPanels}>
                    <section className={styles.lisPanel}>
                      <div className={styles.lisPanelTitle}><strong>Indigenous Peoples</strong><span>ICC/IP membership and ethnicity</span></div>
                      <BooleanChoice value={editing.learnerInfo.is_indigenous_peoples} onChange={(value)=>updateLearnerField("is_indigenous_peoples",value)} />
                      {editing.learnerInfo.is_indigenous_peoples===true && <>
                        <label><span>Primary Ethnicity</span><input list="lis-ethnicity-options" value={editing.learnerInfo.ethnic_group} onChange={(e)=>updateLearnerField("ethnic_group",e.target.value)} /></label>
                        <label><span>Other Ethnicity</span><input list="lis-ethnicity-options" value={editing.learnerInfo.ethnicity_secondary} onChange={(e)=>updateLearnerField("ethnicity_secondary",e.target.value)} /></label>
                      </>}
                    </section>

                    <section className={styles.lisPanel}>
                      <div className={styles.lisPanelTitle}><strong>Mother Tongue</strong><span>Mother tongue and other spoken languages</span></div>
                      <label><span>Mother Tongue</span><input list="lis-language-options" value={editing.learnerInfo.mother_tongue} onChange={(e)=>updateLearnerField("mother_tongue",e.target.value)} /></label>
                      <label><span>Other Spoken Language 1</span><input list="lis-language-options" value={editing.learnerInfo.mother_tongue_secondary} onChange={(e)=>updateLearnerField("mother_tongue_secondary",e.target.value)} /></label>
                      <label><span>Other Spoken Language 2</span><input list="lis-language-options" value={editing.learnerInfo.mother_tongue_tertiary} onChange={(e)=>updateLearnerField("mother_tongue_tertiary",e.target.value)} /></label>
                    </section>

                    <section className={styles.lisPanel}>
                      <div className={styles.lisPanelTitle}><strong>Religion & Email</strong><span>Additional learner information</span></div>
                      <label>
                        <span>Religion</span>
                        <select value={editing.learnerInfo.religion} onChange={(e)=>updateLearnerField("religion",e.target.value)}>
                          <option value="">Select Religion</option>
                          {editing.learnerInfo.religion && !RELIGION_OPTIONS.includes(editing.learnerInfo.religion) && <option value={editing.learnerInfo.religion}>{editing.learnerInfo.religion}</option>}
                          {RELIGION_OPTIONS.map((option)=><option key={option} value={option}>{option}</option>)}
                        </select>
                      </label>
                      <label><span>Email Address</span><input type="email" value={editing.learnerInfo.learner_email} onChange={(e)=>updateLearnerField("learner_email",e.target.value)} placeholder="Optional learner email" /></label>
                    </section>
                  </div>

                  <div className={styles.lisPanels}>
                    <section className={styles.lisPanel}>
                      <div className={styles.lisPanelTitle}><strong>Current Residence</strong><span>Current home address</span></div>
                      <label><span>House # / Street / Sitio / Purok</span><input value={editing.learnerInfo.address_house_street_purok} onChange={(e)=>updateLearnerField("address_house_street_purok",e.target.value)} /></label>
                      <label><span>Province</span><input value={editing.learnerInfo.address_province} onChange={(e)=>updateLearnerField("address_province",e.target.value)} /></label>
                      <label><span>City / Municipality</span><input value={editing.learnerInfo.address_municipality_city} onChange={(e)=>updateLearnerField("address_municipality_city",e.target.value)} /></label>
                      <label><span>Zip Code</span><input value={editing.learnerInfo.address_zip_code} onChange={(e)=>updateLearnerField("address_zip_code",e.target.value)} inputMode="numeric" /></label>
                      <label><span>Barangay</span><input value={editing.learnerInfo.address_barangay} onChange={(e)=>updateLearnerField("address_barangay",e.target.value)} /></label>
                    </section>

                    <section className={styles.lisPanel}>
                      <div className={styles.lisPanelTitle}><strong>Permanent Residence</strong><span>Permanent home address</span></div>
                      <label className={styles.checkLine}><input type="checkbox" checked={editing.learnerInfo.permanent_same_as_current===true} onChange={(e)=>updateLearnerField("permanent_same_as_current",e.target.checked)} /><span>Same as Current Address</span></label>
                      {editing.learnerInfo.permanent_same_as_current===true ? <div className={styles.addressCopy}>Current residence will be copied automatically when saved.</div> : <>
                        <label><span>House # / Street / Sitio / Purok</span><input value={editing.learnerInfo.permanent_address_house_street_purok} onChange={(e)=>updateLearnerField("permanent_address_house_street_purok",e.target.value)} /></label>
                        <label><span>Province</span><input value={editing.learnerInfo.permanent_address_province} onChange={(e)=>updateLearnerField("permanent_address_province",e.target.value)} /></label>
                        <label><span>City / Municipality</span><input value={editing.learnerInfo.permanent_address_municipality_city} onChange={(e)=>updateLearnerField("permanent_address_municipality_city",e.target.value)} /></label>
                        <label><span>Zip Code</span><input value={editing.learnerInfo.permanent_address_zip_code} onChange={(e)=>updateLearnerField("permanent_address_zip_code",e.target.value)} /></label>
                        <label><span>Barangay</span><input value={editing.learnerInfo.permanent_address_barangay} onChange={(e)=>updateLearnerField("permanent_address_barangay",e.target.value)} /></label>
                        <label><span>Other Barangay</span><input value={editing.learnerInfo.permanent_address_other_barangay} onChange={(e)=>updateLearnerField("permanent_address_other_barangay",e.target.value)} /></label>
                      </>}
                    </section>

                    <section className={styles.lisPanel}>
                      <div className={styles.lisPanelTitle}><strong>Citizenship & 4Ps / CCT</strong><span>Citizenship and conditional cash transfer information</span></div>
                      <label><span>Country of Citizenship</span><input value={editing.learnerInfo.citizenship} onChange={(e)=>updateLearnerField("citizenship",e.target.value)} placeholder="e.g. Philippines" /></label>
                      <label><span>Conditional Cash Transfer (4Ps/CCT)</span><BooleanChoice value={editing.learnerInfo.cct_recipient} onChange={(value)=>updateLearnerField("cct_recipient",value)} /></label>
                      {editing.learnerInfo.cct_recipient===true && <label><span>4Ps Household ID</span><input value={editing.learnerInfo.cct_household_id} onChange={(e)=>updateLearnerField("cct_household_id",e.target.value)} minLength={12} maxLength={21} /><small>12 to 21 characters, following the LIS reference.</small></label>}
                    </section>
                  </div>

                  <div className={styles.lisPanels}>
                    <section className={styles.lisPanel}>
                      <div className={styles.lisPanelTitle}><strong>Special Educational Needs</strong><span>Learner support information</span></div>
                      <BooleanChoice value={editing.learnerInfo.has_special_educational_needs} onChange={(value)=>updateLearnerField("has_special_educational_needs",value)} />
                      {editing.learnerInfo.has_special_educational_needs===true && <label><span>LSEN Type</span><select value={editing.learnerInfo.lsen_type} onChange={(e)=>updateLearnerField("lsen_type",e.target.value)}><option value="">Select LSEN Type</option>{LSEN_TYPES.map((type)=><option key={type} value={type}>{type}</option>)}</select></label>}
                    </section>

                    <section className={styles.lisPanel}>
                      <div className={styles.lisPanelTitle}><strong>Vaccination</strong><span>Is learner vaccinated against COVID-19?</span></div>
                      <BooleanChoice value={editing.learnerInfo.vaccinated_covid19} onChange={(value)=>updateLearnerField("vaccinated_covid19",value)} />
                    </section>

                    <section className={styles.lisPanel}>
                      <div className={styles.lisPanelTitle}><strong>Actual Modality</strong><span>Current learning delivery modality</span></div>
                      <label>
                        <span>Learning Modality</span>
                        <select value={editing.learnerInfo.learning_modality} onChange={(e)=>updateLearnerField("learning_modality",e.target.value)}>
                          <option value="">Select Actual Modality</option>
                          {editing.learnerInfo.learning_modality && !LEARNING_MODALITIES.includes(editing.learnerInfo.learning_modality) && <option value={editing.learnerInfo.learning_modality}>{editing.learnerInfo.learning_modality}</option>}
                          {LEARNING_MODALITIES.map((modality)=><option key={modality} value={modality}>{modality}</option>)}
                        </select>
                      </label>
                    </section>
                  </div>

                  <div className={styles.profileSection}>
                    <div className={styles.profileSectionTitle}><strong>School Remarks</strong><span>Optional note retained from SF1 or learner management.</span></div>
                    <label><span>Remarks</span><input value={editing.learnerInfo.remarks} onChange={(e)=>updateLearnerField("remarks",e.target.value)} placeholder="Transfer in/out, dropped, late enrollment, etc." /></label>
                  </div>

                  <datalist id="lis-ethnicity-options">{LOCAL_ETHNICITY_SUGGESTIONS.map((value)=><option key={value} value={value} />)}</datalist>
                  <datalist id="lis-language-options">{LOCAL_LANGUAGE_SUGGESTIONS.map((value)=><option key={value} value={value} />)}</datalist>
                </>
              ) : (
                <>
                  <label>
                    <span>Login Email</span>
                    <input
                      type="email"
                      value={editing.email}
                      onChange={(event) =>
                        setEditing({ ...editing, email: event.target.value })
                      }
                      required
                    />
                    <small>
                      Changing this also changes the Teacher&apos;s actual portal login email.
                    </small>
                  </label>

                  <label>
                    <span>Position</span>
                    <select
                      value={editing.position.toUpperCase()}
                      onChange={(event) =>
                        setEditing({ ...editing, position: event.target.value })
                      }
                    >
                      <option value="">Select Teaching Position</option>
                      {positionOptions(teachingPositions, editing.position).map((item) => (
                        <option key={item} value={item}>
                          {item}
                          {!teachingPositions.includes(item as (typeof teachingPositions)[number])
                            ? " (CURRENT IMPORTED POSITION)"
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Mobile / Contact Number</span>
                    <input
                      value={editing.recoveryPhone}
                      onChange={(event) =>
                        setEditing({ ...editing, recoveryPhone: event.target.value })
                      }
                    />
                  </label>
                </>
              )}

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
            <h2>Permanently Delete Account?</h2>
            <p className={styles.deleteText}>
              You are about to permanently delete <strong>{deleteTarget.full_name}</strong>.
              If this person already has protected school records, the portal will
              refuse deletion and you should suspend the account instead.
            </p>

            <label>
              <span>Type DELETE to Confirm</span>
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
