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
  guardian_last_name: string | null;
  guardian_first_name: string | null;
  guardian_middle_name: string | null;
  guardian_no_middle_name: boolean | null;
  guardian_name_extension: string | null;
  guardian_name: string | null;
  guardian_relationship: string | null;
  guardian_contact_number: string | null;

  mother_last_name: string | null;
  mother_first_name: string | null;
  mother_middle_name: string | null;
  mother_no_middle_name: boolean | null;
  mother_name_extension: string | null;
  mother_maiden_reason: string | null;
  mother_maiden_name: string | null;

  father_last_name: string | null;
  father_first_name: string | null;
  father_middle_name: string | null;
  father_no_middle_name: boolean | null;
  father_name_extension: string | null;
  father_name: string | null;

  mother_tongue: string | null;
  mother_tongue_secondary: string | null;
  mother_tongue_tertiary: string | null;
  is_indigenous_peoples: boolean | null;
  ethnic_group: string | null;
  ethnicity_secondary: string | null;
  religion: string | null;
  learner_email: string | null;

  address_house_street_purok: string | null;
  address_barangay: string | null;
  address_municipality_city: string | null;
  address_province: string | null;
  address_zip_code: string | null;

  permanent_same_as_current: boolean | null;
  permanent_address_house_street_purok: string | null;
  permanent_address_barangay: string | null;
  permanent_address_municipality_city: string | null;
  permanent_address_province: string | null;
  permanent_address_zip_code: string | null;
  permanent_address_other_barangay: string | null;

  citizenship: string | null;
  cct_recipient: boolean | null;
  cct_household_id: string | null;
  has_special_educational_needs: boolean | null;
  lsen_type: string | null;
  vaccinated_covid19: boolean | null;
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

function booleanDefault(value: boolean | null) {
  return value === true ? "true" : value === false ? "false" : "";
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
      "guardian_last_name",
      "guardian_first_name",
      "guardian_middle_name",
      "guardian_no_middle_name",
      "guardian_name_extension",
      "guardian_relationship",
      "guardian_contact_number",
      "mother_last_name",
      "mother_first_name",
      "mother_middle_name",
      "mother_no_middle_name",
      "mother_name_extension",
      "mother_maiden_reason",
      "father_last_name",
      "father_first_name",
      "father_middle_name",
      "father_no_middle_name",
      "father_name_extension",
      "mother_tongue",
      "mother_tongue_secondary",
      "mother_tongue_tertiary",
      "is_indigenous_peoples",
      "ethnic_group",
      "ethnicity_secondary",
      "religion",
      "learner_email",
      "address_house_street_purok",
      "address_barangay",
      "address_municipality_city",
      "address_province",
      "address_zip_code",
      "permanent_same_as_current",
      "permanent_address_house_street_purok",
      "permanent_address_barangay",
      "permanent_address_municipality_city",
      "permanent_address_province",
      "permanent_address_zip_code",
      "permanent_address_other_barangay",
      "citizenship",
      "cct_recipient",
      "cct_household_id",
      "has_special_educational_needs",
      "lsen_type",
      "vaccinated_covid19",
      "learning_modality",
      "remarks",
    ];

    const data = Object.fromEntries(
      fields.map((field) => [field, String(form.get(field) ?? "")])
    );

    const hasStructuredGuardian = [
      data.guardian_last_name,
      data.guardian_first_name,
      data.guardian_middle_name,
      data.guardian_name_extension,
    ].some((value) => String(value ?? "").trim());
    if (!hasStructuredGuardian && selected.guardian_name) {
      for (const field of [
        "guardian_last_name",
        "guardian_first_name",
        "guardian_middle_name",
        "guardian_no_middle_name",
        "guardian_name_extension",
      ]) delete data[field];
    }

    const hasStructuredMother = [
      data.mother_last_name,
      data.mother_first_name,
      data.mother_middle_name,
      data.mother_name_extension,
      data.mother_maiden_reason,
    ].some((value) => String(value ?? "").trim());
    if (!hasStructuredMother && selected.mother_maiden_name) {
      for (const field of [
        "mother_last_name",
        "mother_first_name",
        "mother_middle_name",
        "mother_no_middle_name",
        "mother_name_extension",
        "mother_maiden_reason",
      ]) delete data[field];
    }

    const hasStructuredFather = [
      data.father_last_name,
      data.father_first_name,
      data.father_middle_name,
      data.father_name_extension,
    ].some((value) => String(value ?? "").trim());
    if (!hasStructuredFather && selected.father_name) {
      for (const field of [
        "father_last_name",
        "father_first_name",
        "father_middle_name",
        "father_no_middle_name",
        "father_name_extension",
      ]) delete data[field];
    }

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
                      <h3>Learner Identity & Profile</h3>
                      <p>Official identity plus the language, ethnicity, religion, email, and modality fields patterned after DepEd LIS.</p>
                    </div>
                    <div className={styles.formGrid}>
                      <label><span>Last Name</span><input name="last_name" defaultValue={selected.last_name ?? ""} required /></label>
                      <label><span>First Name</span><input name="first_name" defaultValue={selected.first_name ?? ""} required /></label>
                      <label><span>Middle Name</span><input name="middle_name" defaultValue={selected.middle_name ?? ""} /></label>
                      <label><span>Name Extension</span><input name="name_extension" defaultValue={selected.name_extension ?? ""} /></label>
                      <label>
                        <span>Sex</span>
                        <select name="sex" defaultValue={selected.sex ?? ""} required>
                          <option value="">Select</option><option value="M">Male</option><option value="F">Female</option>
                        </select>
                      </label>
                      <label><span>Birth Date</span><input type="date" name="birth_date" defaultValue={selected.birth_date ?? ""} /></label>
                      <label><span>Mother Tongue</span><input name="mother_tongue" defaultValue={selected.mother_tongue ?? ""} /></label>
                      <label><span>Other Spoken Language 1</span><input name="mother_tongue_secondary" defaultValue={selected.mother_tongue_secondary ?? ""} /></label>
                      <label><span>Other Spoken Language 2</span><input name="mother_tongue_tertiary" defaultValue={selected.mother_tongue_tertiary ?? ""} /></label>
                      <label>
                        <span>Indigenous Peoples (ICC/IP)</span>
                        <select name="is_indigenous_peoples" defaultValue={booleanDefault(selected.is_indigenous_peoples)}>
                          <option value="">Not Recorded</option><option value="true">Yes</option><option value="false">No</option>
                        </select>
                      </label>
                      <label><span>Primary Ethnicity</span><input name="ethnic_group" defaultValue={selected.ethnic_group ?? ""} /></label>
                      <label><span>Other Ethnicity</span><input name="ethnicity_secondary" defaultValue={selected.ethnicity_secondary ?? ""} /></label>
                      <label>
                        <span>Religion</span>
                        <select name="religion" defaultValue={selected.religion ?? ""}>
                          <option value="">Select Religion</option>
                          {selected.religion && !RELIGION_OPTIONS.includes(selected.religion) && <option value={selected.religion}>{selected.religion}</option>}
                          {RELIGION_OPTIONS.map((value)=><option key={value} value={value}>{value}</option>)}
                        </select>
                      </label>
                      <label><span>Learner Email</span><input type="email" name="learner_email" defaultValue={selected.learner_email ?? ""} /></label>
                      <label>
                        <span>Actual Modality</span>
                        <select name="learning_modality" defaultValue={selected.learning_modality ?? ""}>
                          <option value="">Select Actual Modality</option>
                          {selected.learning_modality && !LEARNING_MODALITIES.includes(selected.learning_modality) && <option value={selected.learning_modality}>{selected.learning_modality}</option>}
                          {LEARNING_MODALITIES.map((value)=><option key={value} value={value}>{value}</option>)}
                        </select>
                      </label>
                    </div>
                  </section>

                  <section className={styles.formSection}>
                    <div className={styles.sectionHeading}>
                      <h3>Current & Permanent Residence</h3>
                      <p>Current and permanent address fields patterned after the LIS Update Profile page.</p>
                    </div>
                    <div className={styles.formGrid}>
                      <label className={styles.wide}><span>Current House / Street / Purok</span><input name="address_house_street_purok" defaultValue={selected.address_house_street_purok ?? ""} /></label>
                      <label><span>Current Province</span><input name="address_province" defaultValue={selected.address_province ?? ""} /></label>
                      <label><span>Current Municipality / City</span><input name="address_municipality_city" defaultValue={selected.address_municipality_city ?? ""} /></label>
                      <label><span>Current Zip Code</span><input name="address_zip_code" defaultValue={selected.address_zip_code ?? ""} /></label>
                      <label><span>Current Barangay</span><input name="address_barangay" defaultValue={selected.address_barangay ?? ""} /></label>
                      <label>
                        <span>Permanent Address</span>
                        <select name="permanent_same_as_current" defaultValue={booleanDefault(selected.permanent_same_as_current)}>
                          <option value="">Not Recorded</option><option value="true">Same as Current Address</option><option value="false">Different Address</option>
                        </select>
                      </label>
                      <label className={styles.wide}><span>Permanent House / Street / Purok</span><input name="permanent_address_house_street_purok" defaultValue={selected.permanent_address_house_street_purok ?? ""} /></label>
                      <label><span>Permanent Province</span><input name="permanent_address_province" defaultValue={selected.permanent_address_province ?? ""} /></label>
                      <label><span>Permanent Municipality / City</span><input name="permanent_address_municipality_city" defaultValue={selected.permanent_address_municipality_city ?? ""} /></label>
                      <label><span>Permanent Zip Code</span><input name="permanent_address_zip_code" defaultValue={selected.permanent_address_zip_code ?? ""} /></label>
                      <label><span>Permanent Barangay</span><input name="permanent_address_barangay" defaultValue={selected.permanent_address_barangay ?? ""} /></label>
                      <label><span>Other Barangay</span><input name="permanent_address_other_barangay" defaultValue={selected.permanent_address_other_barangay ?? ""} /></label>
                    </div>
                  </section>

                  <section className={styles.formSection}>
                    <div className={styles.sectionHeading}>
                      <h3>Guardian, Mother & Father</h3>
                      <p>Structured LIS-style parent and guardian names. Existing imported full names are shown for reference.</p>
                    </div>
                    <div className={styles.formGrid}>
                      <label><span>Guardian Last Name</span><input name="guardian_last_name" defaultValue={selected.guardian_last_name ?? ""} /></label>
                      <label><span>Guardian First Name</span><input name="guardian_first_name" defaultValue={selected.guardian_first_name ?? ""} /></label>
                      <label><span>Guardian Middle Name</span><input name="guardian_middle_name" defaultValue={selected.guardian_middle_name ?? ""} /></label>
                      <label>
                        <span>Guardian Middle Name Status</span>
                        <select name="guardian_no_middle_name" defaultValue={booleanDefault(selected.guardian_no_middle_name)}>
                          <option value="">Not Recorded</option><option value="false">Has / May Have Middle Name</option><option value="true">No Middle Name</option>
                        </select>
                      </label>
                      <label><span>Guardian Extension</span><input name="guardian_name_extension" defaultValue={selected.guardian_name_extension ?? ""} /></label>
                      <label>
                        <span>Guardian Relationship</span>
                        <select name="guardian_relationship" defaultValue={selected.guardian_relationship ?? ""}>
                          <option value="">Select</option><option value="Parent">Parent</option><option value="Relative">Relative</option><option value="Non-relative">Non-relative</option>
                        </select>
                      </label>
                      <label><span>Guardian Contact</span><input name="guardian_contact_number" defaultValue={selected.guardian_contact_number ?? ""} /></label>
                      <label className={styles.wide}><span>Imported Guardian Name</span><input value={selected.guardian_name ?? "Not recorded"} readOnly /></label>

                      <label><span>Mother Last Name</span><input name="mother_last_name" defaultValue={selected.mother_last_name ?? ""} /></label>
                      <label><span>Mother First Name</span><input name="mother_first_name" defaultValue={selected.mother_first_name ?? ""} /></label>
                      <label><span>Mother Middle Name</span><input name="mother_middle_name" defaultValue={selected.mother_middle_name ?? ""} /></label>
                      <label>
                        <span>Mother Middle Name Status</span>
                        <select name="mother_no_middle_name" defaultValue={booleanDefault(selected.mother_no_middle_name)}>
                          <option value="">Not Recorded</option><option value="false">Has / May Have Middle Name</option><option value="true">No Middle Name</option>
                        </select>
                      </label>
                      <label><span>Mother Extension</span><input name="mother_name_extension" defaultValue={selected.mother_name_extension ?? ""} /></label>
                      <label>
                        <span>Reason if Mother&apos;s Maiden Name Not Specified</span>
                        <select name="mother_maiden_reason" defaultValue={selected.mother_maiden_reason ?? ""}>
                          <option value="">Not Applicable</option><option value="No mother">No mother</option><option value="Not disclosed">Not disclosed</option>
                        </select>
                      </label>
                      <label className={styles.wide}><span>Imported Mother&apos;s Maiden Name</span><input value={selected.mother_maiden_name ?? "Not recorded"} readOnly /></label>

                      <label><span>Father Last Name</span><input name="father_last_name" defaultValue={selected.father_last_name ?? ""} /></label>
                      <label><span>Father First Name</span><input name="father_first_name" defaultValue={selected.father_first_name ?? ""} /></label>
                      <label><span>Father Middle Name</span><input name="father_middle_name" defaultValue={selected.father_middle_name ?? ""} /></label>
                      <label>
                        <span>Father Middle Name Status</span>
                        <select name="father_no_middle_name" defaultValue={booleanDefault(selected.father_no_middle_name)}>
                          <option value="">Not Recorded</option><option value="false">Has / May Have Middle Name</option><option value="true">No Middle Name</option>
                        </select>
                      </label>
                      <label><span>Father Extension</span><input name="father_name_extension" defaultValue={selected.father_name_extension ?? ""} /></label>
                      <label className={styles.wide}><span>Imported Father Name</span><input value={selected.father_name ?? "Not recorded"} readOnly /></label>
                    </div>
                  </section>

                  <section className={styles.formSection}>
                    <div className={styles.sectionHeading}>
                      <h3>Citizenship, 4Ps & Learner Needs</h3>
                      <p>Additional LIS-style learner profile information.</p>
                    </div>
                    <div className={styles.formGrid}>
                      <label><span>Country of Citizenship</span><input name="citizenship" defaultValue={selected.citizenship ?? ""} placeholder="e.g. Philippines" /></label>
                      <label>
                        <span>4Ps / CCT Recipient</span>
                        <select name="cct_recipient" defaultValue={booleanDefault(selected.cct_recipient)}>
                          <option value="">Not Recorded</option><option value="true">Yes</option><option value="false">No</option>
                        </select>
                      </label>
                      <label><span>4Ps Household ID</span><input name="cct_household_id" defaultValue={selected.cct_household_id ?? ""} minLength={12} maxLength={21} /></label>
                      <label>
                        <span>Special Educational Needs</span>
                        <select name="has_special_educational_needs" defaultValue={booleanDefault(selected.has_special_educational_needs)}>
                          <option value="">Not Recorded</option><option value="true">Yes</option><option value="false">No</option>
                        </select>
                      </label>
                      <label className={styles.wide}>
                        <span>LSEN Type</span>
                        <select name="lsen_type" defaultValue={selected.lsen_type ?? ""}>
                          <option value="">Select LSEN Type</option>
                          {LSEN_TYPES.map((value)=><option key={value} value={value}>{value}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>COVID-19 Vaccination</span>
                        <select name="vaccinated_covid19" defaultValue={booleanDefault(selected.vaccinated_covid19)}>
                          <option value="">Not Recorded</option><option value="true">Yes</option><option value="false">No</option>
                        </select>
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
