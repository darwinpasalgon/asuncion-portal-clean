"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import styles from "./my-learners.module.css";

type Learner = {
  student_id: string;
  full_name: string;
  lrn: string | null;
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  name_extension: string | null;
  sex: string | null;
};

type AssignedSubject = {
  assignment_id: string;
  subject: string;
  major: string | null;
};

type LearnerSection = {
  id: string;
  grade_level: number;
  name: string;
  learner_count: number;
  subjects: AssignedSubject[];
  learners: Learner[];
};

function sexGroup(value: string | null) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "m" || normalized === "male") return "Male";
  if (normalized === "f" || normalized === "female") return "Female";
  return "Unspecified";
}

function learnerDisplayName(learner: Learner) {
  if (learner.last_name && learner.first_name) {
    return `${learner.last_name}, ${learner.first_name}${
      learner.middle_name ? ` ${learner.middle_name}` : ""
    }${learner.name_extension ? ` ${learner.name_extension}` : ""}`;
  }
  return learner.full_name;
}

export default function MyLearnersPage() {
  const [schoolYear, setSchoolYear] = useState("");
  const [sections, setSections] = useState<LearnerSection[]>([]);
  const [sectionFilter, setSectionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/academic/my-learners", {
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to load your learner rosters.");
        }

        if (!active) return;
        const loadedSections = (result.sections ?? []) as LearnerSection[];
        setSchoolYear(result.activeYear?.name ?? "");
        setSections(loadedSections);

        const requested =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("section") ?? ""
            : "";
        if (requested && loadedSections.some((item) => item.id === requested)) {
          setSectionFilter(requested);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your learner rosters."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const visibleSections = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return sections
      .filter((section) => !sectionFilter || section.id === sectionFilter)
      .map((section) => ({
        ...section,
        learners: needle
          ? section.learners.filter((learner) =>
              [
                learner.full_name,
                learner.last_name,
                learner.first_name,
                learner.middle_name,
                learner.lrn,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(needle)
            )
          : section.learners,
      }));
  }, [sections, sectionFilter, search]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topbar}>
          <a href="/portal">
            <ArrowLeft size={16} />
            Back to Portal
          </a>
          <span>View-Only Subject Teacher Roster</span>
        </nav>

        <header className={styles.header}>
          <div>
            <span>TEACHING</span>
            <h1>My Learners</h1>
            <p>
              View the official learners in each section assigned to you as a
              Subject Teacher. Learner records cannot be edited from this page.
            </p>
          </div>
          <div className={styles.yearCard}>
            <BookOpen size={19} />
            <div>
              <span>SCHOOL YEAR</span>
              <strong>{schoolYear || "Active School Year"}</strong>
            </div>
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}

        <section className={styles.controls}>
          <label>
            <span>Section</span>
            <select
              value={sectionFilter}
              onChange={(event) => setSectionFilter(event.target.value)}
            >
              <option value="">All Assigned Sections</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  Grade {section.grade_level} · {section.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.search}>
            <span>Search Learner</span>
            <div>
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name or LRN"
              />
            </div>
          </label>
        </section>

        {loading ? (
          <section className={styles.empty}>
            <Users size={30} />
            <strong>Loading Your Learner Rosters…</strong>
          </section>
        ) : sections.length === 0 ? (
          <section className={styles.empty}>
            <Users size={30} />
            <strong>No Assigned Learners Yet</strong>
            <p>
              Learners will appear here after you receive an active Subject
              Teacher assignment.
            </p>
          </section>
        ) : (
          <div className={styles.sectionList}>
            {visibleSections.map((section) => {
              const groups = ["Male", "Female", "Unspecified"]
                .map((group) => ({
                  group,
                  learners: section.learners.filter(
                    (learner) => sexGroup(learner.sex) === group
                  ),
                }))
                .filter((item) => item.learners.length > 0);

              return (
                <section className={styles.sectionCard} key={section.id}>
                  <div className={styles.sectionHeading}>
                    <div>
                      <span>ASSIGNED SECTION</span>
                      <h2>
                        Grade {section.grade_level} · {section.name}
                      </h2>
                      <p>
                        {section.learner_count} enrolled learner
                        {section.learner_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className={styles.subjects}>
                      {section.subjects.map((subject) => (
                        <span key={subject.assignment_id}>
                          {subject.subject}
                          {subject.major ? ` · ${subject.major}` : ""}
                        </span>
                      ))}
                    </div>
                  </div>

                  {section.learners.length === 0 ? (
                    <div className={styles.noMatch}>
                      No learners match the current search.
                    </div>
                  ) : (
                    <div className={styles.groups}>
                      {groups.map(({ group, learners }) => (
                        <div className={styles.group} key={group}>
                          <div className={styles.groupHeading}>
                            <strong>{group}</strong>
                            <span>
                              {learners.length} learner
                              {learners.length === 1 ? "" : "s"}
                            </span>
                          </div>

                          <div className={styles.roster}>
                            {learners.map((learner, index) => (
                              <article key={learner.student_id}>
                                <span className={styles.number}>{index + 1}</span>
                                <span className={styles.avatar}>
                                  <UserRound size={16} />
                                </span>
                                <div>
                                  <strong>{learnerDisplayName(learner)}</strong>
                                  <span>
                                    {learner.lrn
                                      ? `LRN ${learner.lrn}`
                                      : "LRN Not Recorded"}
                                  </span>
                                </div>
                              </article>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        <div className={styles.privacyNote}>
          <strong>Subject Teacher Access</strong>
          <span>
            This page is view-only. Editing learner information, TVE Major,
            attendance, and official grades remains under the authorized Adviser
            workflow.
          </span>
        </div>
      </div>
    </main>
  );
}
