"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Save,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { TECHNICAL_VOCATIONAL_MAJORS } from "@/lib/subject-config";
import {
  LIS_ETHNICITY_OPTIONS,
  LIS_MOTHER_TONGUE_OPTIONS,
  LIS_RELIGION_OPTIONS,
} from "@/lib/lis-learner-options";
import styles from "./my-students.module.css";

type Section = { id: string; grade_level: number; name: string };

type Learner = {
  enrollment_id: string;
  student_id: string;
  full_name: string;
  lrn: string | null;
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  name_extension: string | null;
  sex: string | null;
  birth_date: string | null;
  mother_tongue: string | null;
  is_indigenous_peoples: boolean | null;
  ethnic_group: string | null;
  religion: string | null;
  cct_recipient: boolean | null;
  address_house_street_purok: string | null;
  address_barangay: string | null;
  address_municipality_city: string | null;
  address_province: string | null;
  father_name: string | null;
  mother_maiden_name: string | null;
  guardian_name: string | null;
  guardian_relationship: string | null;
  guardian_contact_number: string | null;
  learning_modality: string | null;
  remarks: string | null;
  grade_level: number;
  section_id: string;
  section: string;
  tve_major: string | null;
  learner_status: string;
};

function sexGroup(value: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "m" || normalized === "male") return "Male";
  if (normalized === "f" || normalized === "female") return "Female";
  return "Unspecified";
}

function displayName(learner: Learner) {
  if (learner.last_name && learner.first_name) {
    return `${learner.last_name}, ${learner.first_name}${
      learner.middle_name ? ` ${learner.middle_name}` : ""
    }${learner.name_extension ? ` ${learner.name_extension}` : ""}`;
  }
  return learner.full_name;
}

export default function MyStudentsPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [majors, setMajors] = useState<string[]>([...TECHNICAL_VOCATIONAL_MAJORS]);
  const [schoolYear, setSchoolYear] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load(preferredId = selectedId) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/academic/adviser-students", {
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to load your advisory class.");
        return;
      }

      const nextLearners = (result.learners ?? []) as Learner[];
      setSections((result.sections ?? []) as Section[]);
      setLearners(nextLearners);
      setMajors((result.majors ?? TECHNICAL_VOCATIONAL_MAJORS) as string[]);
      setSchoolYear(result.activeYear?.name ?? "");

      const stillExists = nextLearners.some(
        (learner) => learner.student_id === preferredId
      );
      setSelectedId(
        stillExists ? preferredId : nextLearners[0]?.student_id ?? ""
      );
    } catch {
      setError("Unable to reach the learner service.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const requestedStudent =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("student") ?? ""
        : "";
    void load(requestedStudent);
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return learners.filter((learner) => {
      if (sectionFilter && learner.section_id !== sectionFilter) return false;
      if (!needle) return true;
      return [
        learner.full_name,
        learner.last_name,
        learner.first_name,
        learner.lrn,
        learner.section,
        learner.guardian_name,
      ].some((value) => String(value ?? "").toLowerCase().includes(needle));
    });
  }, [learners, search, sectionFilter]);

  const groups = useMemo(
    () =>
      ["Male", "Female", "Unspecified"]
        .map((group) => ({
          group,
          learners: filtered.filter(
            (learner) => sexGroup(learner.sex) === group
          ),
        }))
        .filter((item) => item.learners.length > 0),
    [filtered]
  );

  const selected = learners.find((learner) => learner.student_id === selectedId) ?? null;

  const counts = useMemo(
    () => ({
      total: learners.length,
      male: learners.filter((learner) => sexGroup(learner.sex) === "Male").length,
      female: learners.filter((learner) => sexGroup(learner.sex) === "Female").length,
      tveAssigned: learners.filter(
        (learner) =>
          [8, 9, 10].includes(learner.grade_level) && Boolean(learner.tve_major)
      ).length,
    }),
    [learners]
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;

    setWorking(true);
    setError("");
    setSuccess("");

    const form = new FormData(event.currentTarget);
    const fields = [
      "last_name",
      "first_name",
      "middle_name",
      "name_extension",
      "sex",
      "birth_date",
      "mother_tongue",
      "is_indigenous_peoples",
      "ethnic_group",
      "religion",
      "cct_recipient",
      "address_house_street_purok",
      "address_barangay",
      "address_municipality_city",
      "address_province",
      "father_name",
      "mother_maiden_name",
      "guardian_name",
      "guardian_relationship",
      "guardian_contact_number",
      "learning_modality",
      "remarks",
    ];

    const data = Object.fromEntries(
      fields.map((field) => [field, String(form.get(field) ?? "")])
    );

    try {
      const infoResponse = await fetch("/api/academic/adviser-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_learner_info",
          studentId: selected.student_id,
          data,
        }),
      });
      const infoResult = await infoResponse.json().catch(() => ({}));
      if (!infoResponse.ok) {
        setError(infoResult.error ?? "Unable to update learner information.");
        return;
      }

      if ([8, 9, 10].includes(selected.grade_level)) {
        const major = String(form.get("tve_major") ?? "");
        if (major !== (selected.tve_major ?? "")) {
          const majorResponse = await fetch("/api/academic/adviser-students", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "set_tve_major",
              enrollmentId: selected.enrollment_id,
              major,
            }),
          });
          const majorResult = await majorResponse.json().catch(() => ({}));
          if (!majorResponse.ok) {
            setError(
              majorResult.error ??
                "Learner information was saved, but the TVE Major could not be updated."
            );
            await load(selected.student_id);
            return;
          }
        }
      }

      setSuccess(`${selected.full_name}'s learner information was updated.`);
      await load(selected.student_id);
    } catch {
      setError("Unable to reach the learner service.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topbar}>
          <a href="/portal">
            <ArrowLeft size={16} /> Back to Portal
          </a>
          <div>
            <a href="/portal/grades">
              <GraduationCap size={15} /> Grades
            </a>
            <a href="/portal/attendance">
              <ClipboardCheck size={15} /> Attendance
            </a>
          </div>
        </nav>

        <header className={styles.header}>
          <div>
            <span>ADVISER TOOLS</span>
            <h1>My Students</h1>
            <p>
              View and maintain learner information for your active advisory
              section. Academic placement and account controls remain protected.
            </p>
          </div>
          <div className={styles.yearCard}>
            <CheckCircle2 size={18} />
            <div>
              <small>SCHOOL YEAR</small>
              <strong>{schoolYear || "Not Configured"}</strong>
            </div>
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <section className={styles.summary}>
          <article>
            <Users size={20} />
            <span>My Students</span>
            <strong>{counts.total}</strong>
          </article>
          <article>
            <UserRound size={20} />
            <span>Male</span>
            <strong>{counts.male}</strong>
          </article>
          <article>
            <UserRound size={20} />
            <span>Female</span>
            <strong>{counts.female}</strong>
          </article>
          <article>
            <BookOpenCheck size={20} />
            <span>TVE Major Assigned</span>
            <strong>{counts.tveAssigned}</strong>
          </article>
        </section>

        {loading ? (
          <section className={styles.empty}>Loading your advisory class…</section>
        ) : sections.length === 0 ? (
          <section className={styles.empty}>
            <UserRound size={30} />
            <strong>No Adviser Section Assigned</strong>
            <span>
              An Administrator must assign you as the active Section Adviser
              before learner records appear here.
            </span>
          </section>
        ) : (
          <div className={styles.workspace}>
            <aside className={styles.listPanel}>
              <div className={styles.listControls}>
                <label className={styles.search}>
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search learner or LRN"
                  />
                </label>
                {sections.length > 1 && (
                  <select
                    value={sectionFilter}
                    onChange={(event) => setSectionFilter(event.target.value)}
                  >
                    <option value="">All Advisory Sections</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        Grade {section.grade_level} · {section.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className={styles.roster}>
                {groups.length === 0 ? (
                  <div className={styles.noResults}>No learners found.</div>
                ) : (
                  groups.map(({ group, learners: groupLearners }) => (
                    <section key={group}>
                      <div className={styles.groupHeading}>
                        <strong>{group}</strong>
                        <span>{groupLearners.length}</span>
                      </div>
                      {groupLearners.map((learner) => (
                        <button
                          type="button"
                          key={learner.student_id}
                          className={
                            selectedId === learner.student_id
                              ? styles.selectedLearner
                              : styles.learner
                          }
                          onClick={() => {
                            setSelectedId(learner.student_id);
                            setError("");
                            setSuccess("");
                          }}
                        >
                          <span className={styles.avatar}>
                            <UserRound size={17} />
                          </span>
                          <span>
                            <strong>{displayName(learner)}</strong>
                            <small>
                              Grade {learner.grade_level} · {learner.section}
                              {learner.lrn ? ` · LRN ${learner.lrn}` : ""}
                            </small>
                          </span>
                        </button>
                      ))}
                    </section>
                  ))
                )}
              </div>
            </aside>

            <section className={styles.editorPanel}>
              {!selected ? (
                <div className={styles.emptyEditor}>
                  <UserRound size={30} />
                  <strong>Select a Learner</strong>
                  <span>The learner record will appear here.</span>
                </div>
              ) : (
                <form key={selected.student_id} onSubmit={save}>
                  <div className={styles.editorHeading}>
                    <div>
                      <span>LEARNER RECORD</span>
                      <h2>{selected.full_name}</h2>
                      <p>
                        Grade {selected.grade_level} · {selected.section} ·{" "}
                        {selected.lrn ? `LRN ${selected.lrn}` : "LRN Not Recorded"}
                      </p>
                    </div>
                    <span className={styles.statusBadge}>
                      {selected.learner_status || "active"}
                    </span>
                  </div>

                  <section className={styles.formSection}>
                    <div className={styles.sectionHeading}>
                      <h3>Student Information</h3>
                      <p>SF1 identity and learner profile fields.</p>
                    </div>
                    <div className={styles.formGrid}>
                      <label>
                        <span>Last Name</span>
                        <input name="last_name" defaultValue={selected.last_name ?? ""} required />
                      </label>
                      <label>
                        <span>First Name</span>
                        <input name="first_name" defaultValue={selected.first_name ?? ""} required />
                      </label>
                      <label>
                        <span>Middle Name</span>
                        <input name="middle_name" defaultValue={selected.middle_name ?? ""} />
                      </label>
                      <label>
                        <span>Name Extension</span>
                        <input name="name_extension" defaultValue={selected.name_extension ?? ""} />
                      </label>
                      <label>
                        <span>Sex</span>
                        <select name="sex" defaultValue={selected.sex ?? ""} required>
                          <option value="">Select</option>
                          <option value="M">Male</option>
                          <option value="F">Female</option>
                        </select>
                      </label>
                      <label>
                        <span>Birth Date</span>
                        <input type="date" name="birth_date" defaultValue={selected.birth_date ?? ""} />
                      </label>
                      <label>
                        <span>Mother Tongue</span>
                        <input
                          name="mother_tongue"
                          list="lis-mother-tongue-options"
                          defaultValue={selected.mother_tongue ?? ""}
                          placeholder="Type or select from LIS choices"
                        />
                      </label>
                      <label>
                        <span>Religion</span>
                        <select name="religion" defaultValue={selected.religion ?? ""}>
                          <option value="">Select Religion</option>
                          {selected.religion &&
                            !LIS_RELIGION_OPTIONS.includes(
                              selected.religion as (typeof LIS_RELIGION_OPTIONS)[number]
                            ) && (
                              <option value={selected.religion}>{selected.religion}</option>
                            )}
                          {LIS_RELIGION_OPTIONS.map((religion) => (
                            <option key={religion} value={religion}>
                              {religion}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.checkboxField}>
                        <input
                          type="checkbox"
                          name="cct_recipient"
                          value="true"
                          defaultChecked={selected.cct_recipient === true}
                        />
                        <span>
                          <strong>Conditional Cash Transfer (CCT)</strong>
                          Is this learner CCT recipient?
                        </span>
                      </label>
                      <label className={styles.checkboxField}>
                        <input
                          type="checkbox"
                          name="is_indigenous_peoples"
                          value="true"
                          defaultChecked={selected.is_indigenous_peoples === true}
                          onChange={(event) => {
                            const select = event.currentTarget
                              .closest("form")
                              ?.querySelector<HTMLSelectElement>(
                                'select[name="ethnic_group"]'
                              );
                            if (select) {
                              select.disabled = !event.currentTarget.checked;
                              select.required = event.currentTarget.checked;
                              if (!event.currentTarget.checked) select.value = "";
                            }
                          }}
                        />
                        <span>
                          <strong>Indigenous Peoples</strong>
                          Is this learner a member of Indigenous Cultural Communities/Indigenous Peoples?
                        </span>
                      </label>
                      <label>
                        <span>Ethnicity</span>
                        <select
                          name="ethnic_group"
                          defaultValue={selected.ethnic_group ?? ""}
                          disabled={selected.is_indigenous_peoples !== true}
                          required={selected.is_indigenous_peoples === true}
                        >
                          <option value="">
                            {selected.is_indigenous_peoples === true
                              ? "Select Ethnicity"
                              : "Enable Indigenous Peoples first"}
                          </option>
                          {selected.ethnic_group &&
                            !LIS_ETHNICITY_OPTIONS.includes(
                              selected.ethnic_group as (typeof LIS_ETHNICITY_OPTIONS)[number]
                            ) && (
                              <option value={selected.ethnic_group}>
                                {selected.ethnic_group}
                              </option>
                            )}
                          {LIS_ETHNICITY_OPTIONS.map((ethnicity) => (
                            <option key={ethnicity} value={ethnicity}>
                              {ethnicity}
                            </option>
                          ))}
                        </select>
                      </label>
                      <datalist id="lis-mother-tongue-options">
                        {LIS_MOTHER_TONGUE_OPTIONS.map((language) => (
                          <option key={language} value={language} />
                        ))}
                      </datalist>
                      <label>
                        <span>Learning Modality</span>
                        <input name="learning_modality" defaultValue={selected.learning_modality ?? ""} />
                      </label>
                    </div>
                  </section>

                  <section className={styles.formSection}>
                    <div className={styles.sectionHeading}>
                      <h3>Address</h3>
                      <p>Current learner address from the school record.</p>
                    </div>
                    <div className={styles.formGrid}>
                      <label className={styles.wide}>
                        <span>House / Street / Purok</span>
                        <input
                          name="address_house_street_purok"
                          defaultValue={selected.address_house_street_purok ?? ""}
                        />
                      </label>
                      <label>
                        <span>Barangay</span>
                        <input name="address_barangay" defaultValue={selected.address_barangay ?? ""} />
                      </label>
                      <label>
                        <span>Municipality / City</span>
                        <input
                          name="address_municipality_city"
                          defaultValue={selected.address_municipality_city ?? ""}
                        />
                      </label>
                      <label>
                        <span>Province</span>
                        <input name="address_province" defaultValue={selected.address_province ?? ""} />
                      </label>
                    </div>
                  </section>

                  <section className={styles.formSection}>
                    <div className={styles.sectionHeading}>
                      <h3>Parent & Guardian Information</h3>
                      <p>Family and emergency-contact information.</p>
                    </div>
                    <div className={styles.formGrid}>
                      <label>
                        <span>Father's Name</span>
                        <input name="father_name" defaultValue={selected.father_name ?? ""} />
                      </label>
                      <label>
                        <span>Mother's Maiden Name</span>
                        <input
                          name="mother_maiden_name"
                          defaultValue={selected.mother_maiden_name ?? ""}
                        />
                      </label>
                      <label>
                        <span>Guardian</span>
                        <input name="guardian_name" defaultValue={selected.guardian_name ?? ""} />
                      </label>
                      <label>
                        <span>Relationship</span>
                        <input
                          name="guardian_relationship"
                          defaultValue={selected.guardian_relationship ?? ""}
                        />
                      </label>
                      <label>
                        <span>Guardian Contact</span>
                        <input
                          name="guardian_contact_number"
                          defaultValue={selected.guardian_contact_number ?? ""}
                        />
                      </label>
                    </div>
                  </section>

                  <section className={styles.formSection}>
                    <div className={styles.sectionHeading}>
                      <h3>Academic Information</h3>
                      <p>Placement fields are protected; Adviser-managed TVE Major remains editable.</p>
                    </div>
                    <div className={styles.formGrid}>
                      <label>
                        <span>LRN</span>
                        <input value={selected.lrn ?? ""} readOnly />
                      </label>
                      <label>
                        <span>Grade Level</span>
                        <input value={`Grade ${selected.grade_level}`} readOnly />
                      </label>
                      <label>
                        <span>Section</span>
                        <input value={selected.section} readOnly />
                      </label>
                      <label>
                        <span>Enrollment Status</span>
                        <input value={selected.learner_status || "Active"} readOnly />
                      </label>
                      {[8, 9, 10].includes(selected.grade_level) && (
                        <label className={styles.wide}>
                          <span>TVE Major</span>
                          <select name="tve_major" defaultValue={selected.tve_major ?? ""}>
                            <option value="">Not Assigned</option>
                            {majors.map((major) => (
                              <option key={major} value={major}>
                                {major}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label className={styles.full}>
                        <span>Remarks</span>
                        <textarea name="remarks" defaultValue={selected.remarks ?? ""} rows={3} />
                      </label>
                    </div>
                    <div className={styles.protectedNote}>
                      Grade Level, Section, enrollment status, LRN, account access, and password
                      remain Administrator-controlled. SF10 permanent-record corrections remain
                      Registrar-controlled.
                    </div>
                  </section>

                  <div className={styles.formActions}>
                    <a href="/portal/grades">
                      <GraduationCap size={16} /> Open Grades
                    </a>
                    <a href="/portal/attendance">
                      <ClipboardCheck size={16} /> Open Attendance
                    </a>
                    <button type="submit" disabled={working}>
                      <Save size={16} />
                      {working ? "Saving…" : "Save Learner Information"}
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
