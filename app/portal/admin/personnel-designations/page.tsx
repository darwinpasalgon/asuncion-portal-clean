"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, CheckCircle2, History, Save, Search } from "lucide-react";
import { nonTeachingPositions, teachingPositions, positionOptions } from "@/lib/deped-positions";
import styles from "./personnel-designations.module.css";

type Personnel = {
  id: string;
  owner_type: "teacher" | "non_teaching";
  full_name: string;
  email: string | null;
  position: string | null;
  category: string;
};
type Change = {
  id: string;
  previous_position: string | null;
  new_position: string;
  reason: string;
  changed_at: string;
};
const positions = [...teachingPositions, ...nonTeachingPositions];

async function request(action: string, extra: Record<string, unknown> = {}) {
  const response = await fetch("/api/teacher-profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Unable to complete request.");
  return data;
}

export default function PersonnelDesignationsPage() {
  const [people, setPeople] = useState<Personnel[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [position, setPosition] = useState("");
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    request("list_designations")
      .then((response) => {
        if (!alive) return;
        setPeople(response.personnel ?? []);
      })
      .catch((err) => { if (alive) setError(String(err.message ?? "Unable to load personnel.")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const person = useMemo(() => people.find((p) => p.owner_type + ":" + p.id === selectedId) ?? null, [people, selectedId]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) =>
      (filter === "all" || p.category === filter) &&
      (!q || [p.full_name, p.position ?? "", p.email ?? ""].join(" ").toLowerCase().includes(q))
    );
  }, [people, query, filter]);

  useEffect(() => {
    setPosition(String(person?.position ?? "").toUpperCase());
    setReason("");
    setMessage("");
    setHistory([]);
    if (!person) return;
    let alive = true;
    request("designation_history", { owner_type: person.owner_type, personnel_id: person.id })
      .then((response) => { if (alive) setHistory(response.history ?? []); })
      .catch((err) => { if (alive) setError(String(err.message ?? "Unable to load designation history.")); });
    return () => { alive = false; };
  }, [person?.id, person?.owner_type]);

  async function save() {
    if (!person || !position || !reason.trim() || saving) return;
    if (!window.confirm(`Change ${person.full_name}'s position from ${person.position ?? "Not Recorded"} to ${position}? The change will be recorded in personnel history.`)) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await request("change_designation", {
        owner_type: person.owner_type,
        personnel_id: person.id,
        position,
        expected_position: String(person.position ?? "").toUpperCase(),
        reason,
      });
      setPeople((current) => current.map((p) =>
        p.id === person.id && p.owner_type === person.owner_type
          ? { ...p, position: response.personnel.position }
          : p
      ));
      setReason("");
      setMessage(`Designation updated. ${response.classification_note ?? "The change was saved to personnel history."}`);
      const latest = await request("designation_history", { owner_type: person.owner_type, personnel_id: person.id });
      setHistory(latest.history ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Designation update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <a className={styles.back} href="/portal"><ArrowLeft size={16} />Back to Portal</a>
        <header className={styles.header}>
          <span>HUMAN RESOURCES</span>
          <h1>Personnel Designations</h1>
          <p>Manage teaching, non-teaching, and administrative positions in one place. A promotion keeps the existing account and historical records.</p>
        </header>
        {error && <div className={styles.error} role="alert">{error}</div>}
        {message && <div className={styles.success} role="status"><CheckCircle2 size={17} />{message}</div>}
        <div className={styles.workspace}>
          <aside className={styles.directory}>
            <label className={styles.search}><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search personnel or position" /></label>
            <label className={styles.category}>
              Personnel Type
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All Personnel</option>
                <option value="Teaching">Teaching</option>
                <option value="Non-Teaching">Non-Teaching</option>
                <option value="Administration">Administration</option>
              </select>
            </label>
            <p className={styles.count}>{loading ? "Loading..." : `${filtered.length} personnel`}</p>
            <div className={styles.list}>
              {filtered.map((p) => {
                const key = p.owner_type + ":" + p.id;
                return <button key={key} type="button" className={selectedId === key ? styles.selected : ""} onClick={() => { setSelectedId(key); setError(""); }}>
                  <strong>{p.full_name}</strong>
                  <small>{p.position || "Position Not Recorded"}</small>
                  <span>{p.category}</span>
                </button>;
              })}
              {!loading && filtered.length === 0 && <p className={styles.empty}>No matching personnel.</p>}
            </div>
          </aside>
          <section className={styles.detail}>
            {!person ? (
              <div className={styles.blank}><BriefcaseBusiness size={29} /><strong>Select an employee</strong><p>Choose a personnel record to update the designation.</p></div>
            ) : (
              <>
                <div className={styles.person}>
                  <span>{person.category} Personnel</span>
                  <h2>{person.full_name}</h2>
                  <p>{person.email || "No email recorded"}</p>
                  <p><strong>Current Position:</strong> {person.position || "Not Recorded"}</p>
                </div>
                <div className={styles.form}>
                  <label>New Designation
                    <select value={position} onChange={(e) => setPosition(e.target.value)}>
                      <option value="">Select Position</option>
                      {positionOptions(positions, person.position).map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <label>Promotion / Appointment Details
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="Example: Promoted to Master Teacher I effective October 15, 2026; appointment reference..." />
                  </label>
                  <button className={styles.save} type="button" disabled={saving || !position || !reason.trim() || position === String(person.position ?? "").toUpperCase()} onClick={() => void save()}>
                    <Save size={17} />{saving ? "Saving..." : "Update Designation"}
                  </button>
                  <p className={styles.note}>Changing a position does not automatically reclassify a teaching/non-teaching record, change account permissions, or remove Grade Level Head responsibilities. Review those separately for cross-category promotions.</p>
                </div>
                <div className={styles.history}>
                  <h3><History size={18} />Designation History</h3>
                  {history.length === 0 ? <p>No designation changes recorded yet.</p> : history.map((item) => (
                    <article key={item.id}>
                      <strong>{item.previous_position || "Not Recorded"} → {item.new_position}</strong>
                      <span>{new Date(item.changed_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}</span>
                      <p>{item.reason}</p>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
