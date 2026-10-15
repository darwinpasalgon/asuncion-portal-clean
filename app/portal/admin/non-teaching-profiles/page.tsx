"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, KeyRound, Save, Search, UserRound } from "lucide-react";
import styles from "./non-teaching-profiles.module.css";

type Details = Record<string, string>;
type Personnel = {
  id: string;
  full_name: string;
  email: string | null;
  position: string | null;
  personal?: Details;
  portal_user_id?: string | null;
  updated_at?: string | null;
};

const bachelorDegreeOptions = [
  ["BACHELOR OF ELEMENTARY EDUCATION (BEED)", "Bachelor of Elementary Education (BEEd)"],
  ["BACHELOR OF SECONDARY EDUCATION (BSED)", "Bachelor of Secondary Education (BSEd)"],
  ["BACHELOR OF EARLY CHILDHOOD EDUCATION (BECED)", "Bachelor of Early Childhood Education (BECEd)"],
  ["BACHELOR OF SPECIAL NEEDS EDUCATION (BSNED)", "Bachelor of Special Needs Education (BSNEd)"],
  ["BACHELOR OF PHYSICAL EDUCATION (BPED)", "Bachelor of Physical Education (BPEd)"],
  ["BACHELOR OF TECHNOLOGY AND LIVELIHOOD EDUCATION (BTLED)", "Bachelor of Technology and Livelihood Education (BTLEd)"],
  ["BACHELOR OF TECHNICAL-VOCATIONAL TEACHER EDUCATION (BTVTED)", "Bachelor of Technical-Vocational Teacher Education (BTVTEd)"],
  ["OTHER BACHELOR'S DEGREE", "Other Bachelor's Degree"],
] as const;

function controlId(label: string) {
  const ids: Record<string, string> = {
    "Graduate Studies": "profile-graduate-status",
    "Bachelor's Degree": "profile-bachelors-degree",
    "Other Bachelor's Degree Course": "profile-bachelors-degree-other",
    "PhilSys (National ID) Number": "profile-philsys-number",
    "Religion": "profile-religion",
    "Ethnic Group": "profile-ethnic-group",
  };
  return ids[label] ?? "";
}

function formatPhilSys(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.match(/.{1,4}/g)?.join(" - ") ?? digits;
}

export default function NonTeachingProfilesPage() {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [person, setPerson] = useState<Personnel | null>(null);
  const [personal, setPersonal] = useState<Details>({});
  const [query, setQuery] = useState("");
  const [focusField, setFocusField] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [newCredentials, setNewCredentials] = useState<{ email: string; temporary_password: string } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadPersonnel() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/teacher-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_non_teaching" }),
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to load Non-Teaching Personnel.");
      const loaded = (result.personnel ?? []) as Personnel[];
      setPersonnel(loaded);
      const params = new URLSearchParams(window.location.search);
      const requestedId = params.get("personnel") ?? "";
      setFocusField(params.get("field") ?? "");
      if (requestedId && loaded.some((item) => item.id === requestedId)) {
        setSelectedId(requestedId);
      } else if (!selectedId && loaded[0]?.id) {
        setSelectedId(loaded[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Non-Teaching Personnel.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPersonnel();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    async function loadRecord() {
      setLoadingRecord(true);
      setError("");
      setMessage("");
      setNewCredentials(null);
      try {
        const response = await fetch("/api/teacher-profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "get_non_teaching",
            personnel_id: selectedId,
          }),
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "Unable to load the personnel profile.");
        if (!active) return;
        setPerson(result.personnel ?? null);
        setPersonal((result.personnel?.personal ?? {}) as Details);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load the personnel profile.");
      } finally {
        if (active) setLoadingRecord(false);
      }
    }
    void loadRecord();
    return () => {
      active = false;
    };
  }, [selectedId]);

  useEffect(() => {
    if (loadingRecord || !selectedId || !focusField) return;
    const id = controlId(focusField);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => target.focus(), 350);
  }, [loadingRecord, selectedId, focusField, personal.bachelors_degree]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return personnel;
    return personnel.filter((item) =>
      [item.full_name, item.email ?? "", item.position ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(text)
    );
  }, [personnel, query]);

  function update(key: string, value: string) {
    setPersonal((current) => ({ ...current, [key]: value }));
  }

  async function createHeadTeacherAccount() {
    if (!person || !/^HEAD TEACHER\b/i.test(person.position ?? "") || person.portal_user_id) return;
    if (!window.confirm(`Create a portal account for ${person.full_name} using ${person.email}? The temporary password will only be displayed once.`)) return;
    setProvisioning(true);
    setNewCredentials(null);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/head-teacher-provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personnel_id: person.id }),
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to provision this Head Teacher account.");
      setPerson((previous) => previous ? { ...previous, portal_user_id: result.user_id } : previous);
      if (result.created && result.temporary_password) {
        setNewCredentials({ email: person.email ?? "", temporary_password: result.temporary_password });
        setMessage("Account created. Copy the temporary credentials now. The password is displayed once.");
      } else {
        setMessage("Existing account linked. If the login password is unknown, use Reset Password.");
      }
      await loadPersonnel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to provision account.");
    } finally {
      setProvisioning(false);
    }
  }

  async function requestPasswordReset() {
    if (!person?.portal_user_id) {
      setError("This Non-Teaching Personnel record is not linked to a portal account yet.");
      return;
    }

    const confirmed = window.confirm(
      `Create a password reset request for ${person.full_name}? You will be taken to Password Resets to verify the account and issue a temporary password.`
    );
    if (!confirmed) return;

    setResetting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/password-resets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: person.portal_user_id }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to create the password reset request.");
      }

      window.location.href = "/portal/admin/password-resets";
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reach the password reset service."
      );
    } finally {
      setResetting(false);
    }
  }

  async function saveName() {
    if (!selectedId) return;
    setSavingName(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/teacher-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_personnel_name",
          personnel_id: selectedId,
          name: {
            last_name: personal.last_name ?? "",
            first_name: personal.first_name ?? "",
            middle_name: personal.middle_name ?? "",
            name_extension: personal.name_extension ?? "",
          },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to save the personnel name.");

      const saved = (result.personnel ?? {}) as Personnel;
      setPerson((current) =>
        current ? { ...current, ...saved, full_name: result.full_name ?? current.full_name } : current
      );
      if (result.name) {
        setPersonal((current) => ({ ...current, ...result.name }));
      }
      setPersonnel((current) =>
        current.map((item) =>
          item.id === selectedId
            ? { ...item, ...saved, full_name: result.full_name ?? item.full_name }
            : item
        )
      );
      setMessage("Personnel name updated. Other incomplete profile fields were left unchanged.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save the personnel name.");
    } finally {
      setSavingName(false);
    }
  }

  async function save() {
    if (!selectedId) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/teacher-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_non_teaching_profile",
          personnel_id: selectedId,
          personal,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to save the personnel profile.");
      setPerson(result.personnel ?? person);
      setPersonal((result.personnel?.personal ?? personal) as Details);
      setPersonnel((current) =>
        current.map((item) =>
          item.id === selectedId
            ? { ...item, ...(result.personnel ?? {}) }
            : item
        )
      );
      setMessage("Non-Teaching Personnel profile saved.");
      setFocusField("");
      window.history.replaceState({}, "", "/portal/admin/non-teaching-profiles");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save the personnel profile.");
    } finally {
      setSaving(false);
    }
  }

  const graduateStatus = String(personal.graduate_status ?? "").toUpperCase();
  const bachelorDegree = String(personal.bachelors_degree ?? "").toUpperCase();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <a href="/portal" className={styles.back}><ArrowLeft size={16} />Back to Portal</a>
        <header className={styles.header}>
          <div>
            <span>HUMAN RESOURCES</span>
            <h1>Non-Teaching Personnel Profiles</h1>
            <p>Complete the required personnel information and open dashboard alerts directly to the missing field.</p>
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}

        <div className={styles.workspace}>
          <aside className={styles.listPanel}>
            <label className={styles.search}>
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search personnel..." />
            </label>
            <div className={styles.list}>
              {loading ? <p>Loading personnel...</p> : filtered.map((item) => (
                <button
                  key={item.id}
                  className={selectedId === item.id ? styles.selected : ""}
                  onClick={() => {
                    setSelectedId(item.id);
                    setFocusField("");
                  }}
                >
                  <UserRound size={17} />
                  <span><strong>{item.full_name}</strong><small>{item.position || "Non-Teaching Personnel"}</small></span>
                </button>
              ))}
              {!loading && filtered.length === 0 && <p>No matching personnel.</p>}
            </div>
          </aside>

          <section className={styles.formPanel}>
            {!selectedId ? (
              <div className={styles.empty}>Select a Non-Teaching Personnel record.</div>
            ) : loadingRecord ? (
              <div className={styles.empty}>Loading profile...</div>
            ) : person ? (
              <>
                <div className={styles.personHeading}>
                  <div><span>NON-TEACHING PERSONNEL</span><h2>{person.full_name}</h2><p>{person.position || "Position not set"} · {person.email || "No email"}</p></div>
                  <div className={styles.headingActions}>
                    {!person.portal_user_id && /^HEAD TEACHER\b/i.test(person.position ?? "") && (
                      <button className={styles.resetButton} onClick={() => void createHeadTeacherAccount()} disabled={provisioning}>
                        <KeyRound size={16} />{provisioning ? "Creating Account..." : "Create Portal Account"}
                      </button>
                    )}
                    <button
                      className={styles.resetButton}
                      onClick={() => void requestPasswordReset()}
                      disabled={resetting || !person.portal_user_id}
                      title={
                        person.portal_user_id
                          ? "Create a password reset request"
                          : "This personnel record is not linked to a portal account"
                      }
                    >
                      <KeyRound size={16} />
                      {resetting
                        ? "Creating Request..."
                        : person.portal_user_id
                          ? "Reset Password"
                          : "No Portal Account"}
                    </button>
                    <button onClick={() => void save()} disabled={saving}>
                      <Save size={16} />{saving ? "Saving..." : "Save Profile"}
                    </button>
                  </div>
                </div>

                {newCredentials && (
                  <div role="status" className={styles.namePanel}>
                    <strong>New Portal Credentials (shown once)</strong>
                    <p>Email: {newCredentials.email}</p>
                    <p>Temporary Password: <code>{newCredentials.temporary_password}</code></p>
                    <p>Copy these details securely and ask the user to change the password after first login.</p>
                    <button type="button" onClick={() => setNewCredentials(null)}>Hide Credentials</button>
                  </div>
                )}
                <div className={styles.namePanel}>
                  <div className={styles.namePanelHead}>
                    <div>
                      <strong>Name</strong>
                      <span>
                        Save name corrections separately. You do not need to complete
                        the rest of the personnel profile first.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void saveName()}
                      disabled={savingName}
                    >
                      <Save size={15} />
                      {savingName ? "Saving Name..." : "Save Name"}
                    </button>
                  </div>
                  <div className={styles.formGrid}>
                    <label><span>Last Name</span><input value={personal.last_name ?? ""} onChange={(event) => update("last_name", event.target.value)} /></label>
                    <label><span>First Name</span><input value={personal.first_name ?? ""} onChange={(event) => update("first_name", event.target.value)} /></label>
                    <label><span>Middle Name</span><input value={personal.middle_name ?? ""} onChange={(event) => update("middle_name", event.target.value)} /></label>
                    <label><span>Name Extension</span><input value={personal.name_extension ?? ""} onChange={(event) => update("name_extension", event.target.value)} placeholder="JR., SR., III" /></label>
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <label className={styles.wide}>
                    <span>Graduate Studies <b>Required</b></span>
                    <select id="profile-graduate-status" value={graduateStatus} onChange={(event) => update("graduate_status", event.target.value)}>
                      <option value="">Select status</option>
                      <option value="GRADUATED">Graduated</option>
                      <option value="ON GOING">On Going</option>
                      <option value="NONE">None</option>
                    </select>
                  </label>

                  {graduateStatus !== "NONE" && graduateStatus && (
                    <label className={styles.wide}><span>Graduate Studies Degree / Course</span><input value={personal.graduate_course ?? ""} onChange={(event) => update("graduate_course", event.target.value)} placeholder="Example: Master of Arts in Education" /></label>
                  )}

                  {graduateStatus === "ON GOING" && (
                    <>
                      <label><span>Units Earned</span><input inputMode="decimal" value={personal.graduate_units_earned ?? ""} onChange={(event) => update("graduate_units_earned", event.target.value)} /></label>
                      <label className={styles.checkbox}><input type="checkbox" checked={String(personal.graduate_car_completed ?? "").toUpperCase() === "YES"} onChange={(event) => update("graduate_car_completed", event.target.checked ? "YES" : "NO")} /><span>Completed Academic Requirements (CAR)</span></label>
                    </>
                  )}

                  <label className={styles.wide}>
                    <span>Bachelor&apos;s Degree <b>Required</b></span>
                    <select id="profile-bachelors-degree" value={bachelorDegree} onChange={(event) => update("bachelors_degree", event.target.value)}>
                      <option value="">Select degree</option>
                      {bachelorDegreeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>

                  {bachelorDegree === "OTHER BACHELOR'S DEGREE" && (
                    <label className={styles.wide}><span>Other Bachelor&apos;s Degree Course <b>Required</b></span><input id="profile-bachelors-degree-other" value={personal.bachelors_degree_other ?? ""} onChange={(event) => update("bachelors_degree_other", event.target.value)} /></label>
                  )}

                  {(bachelorDegree === "BACHELOR OF SECONDARY EDUCATION (BSED)" || bachelorDegree === "BACHELOR OF TECHNICAL-VOCATIONAL TEACHER EDUCATION (BTVTED)") && (
                    <>
                      <label><span>Major</span><input value={personal.major ?? ""} onChange={(event) => update("major", event.target.value)} /></label>
                      <label><span>Minor</span><input value={personal.minor ?? ""} onChange={(event) => update("minor", event.target.value)} /></label>
                    </>
                  )}

                  <label><span>PhilSys Number <b>Required</b></span><input id="profile-philsys-number" value={personal.philsys_number ?? ""} onChange={(event) => update("philsys_number", formatPhilSys(event.target.value))} placeholder="1234 - 5678 - 9012 - 3456" /></label>
                  <label><span>Religion <b>Required</b></span><input id="profile-religion" value={personal.religion ?? ""} onChange={(event) => update("religion", event.target.value)} /></label>
                  <label className={styles.wide}><span>Ethnic Group <b>Required</b></span><input id="profile-ethnic-group" value={personal.ethnic_group ?? ""} onChange={(event) => update("ethnic_group", event.target.value)} /></label>
                </div>
              </>
            ) : (
              <div className={styles.empty}>Personnel profile unavailable.</div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
