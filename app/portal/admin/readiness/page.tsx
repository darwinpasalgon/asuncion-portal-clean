"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  GraduationCap,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import styles from "./readiness.module.css";

type SetupItem = {
  key: string;
  grade_level: number;
  section_id: string;
  section: string;
  subject_id: string;
  subject: string;
  major: string | null;
  teacher_id?: string;
  teacher_name?: string;
};

type SetupAttention = {
  unassigned: SetupItem[];
  unscheduled: SetupItem[];
  unassigned_count: number;
  unscheduled_count: number;
};

type ReadinessData = {
  activeYear: { id: string; name: string } | null;
  today: string;
  isSchoolDay: boolean;
  permissions: Record<string, boolean>;
  totalLearners: number;
  gradeCounts: Array<{ grade_level: number; count: number }>;
  missingTve: {
    count: number;
    byGrade: Array<{ grade_level: number; count: number }>;
  };
  incompleteLearners: {
    count: number;
    samples: Array<{
      student_id: string;
      full_name: string;
      lrn: string | null;
      grade_level: number;
      section: string;
      missing_fields: string[];
    }>;
  };
  sectionsWithoutAdviser: Array<{
    id: string;
    grade_level: number;
    name: string;
  }>;
  attendanceGaps: Array<{
    section_id: string;
    grade_level: number;
    section: string;
    total: number;
    recorded: number;
    missing: number;
  }>;
  emptyGradeLevels: number[];
  pendingGradeLevelHeads: Array<{
    grade_level: number;
    display_name: string;
  }>;
  grades: {
    total: number;
    published: number;
    byTerm: Array<{ term_no: number; total: number; published: number }>;
  };
  personnel: {
    teaching_count: number;
    non_teaching_count: number;
    total_incomplete: number;
  } | null;
  passwordResets: { pending_count: number } | null;
};

type HealthCardProps = {
  title: string;
  description: string;
  count: number | null;
  href: string;
  action: string;
  icon: typeof Users;
  unavailable?: boolean;
  goodText?: string;
};

function HealthCard({
  title,
  description,
  count,
  href,
  action,
  icon: Icon,
  unavailable = false,
  goodText = "Complete",
}: HealthCardProps) {
  const good = !unavailable && count === 0;
  return (
    <article
      className={[
        styles.healthCard,
        good ? styles.good : "",
        unavailable ? styles.unavailable : "",
      ].join(" ")}
    >
      <div className={styles.cardIcon}>
        {good ? <CheckCircle2 size={20} /> : <Icon size={20} />}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          <strong>{unavailable ? "—" : good ? "✓" : count}</strong>
        </div>
        <a href={href} className={styles.cardAction}>
          {good ? goodText : action}
          <ChevronRight size={15} />
        </a>
      </div>
    </article>
  );
}

export default function SchoolReadinessPage() {
  const [data, setData] = useState<ReadinessData | null>(null);
  const [setup, setSetup] = useState<SetupAttention | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [readinessResponse, setupResponse] = await Promise.all([
        fetch("/api/admin/readiness", { cache: "no-store" }),
        fetch("/api/admin/academic-setup-attention", { cache: "no-store" }),
      ]);
      const readinessResult = await readinessResponse.json().catch(() => ({}));
      const setupResult = await setupResponse.json().catch(() => ({}));

      if (!readinessResponse.ok) {
        throw new Error(
          readinessResult.error ?? "Unable to load school readiness."
        );
      }
      setData(readinessResult as ReadinessData);
      setSetup(setupResponse.ok ? (setupResult as SetupAttention) : null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load school readiness."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const checks = useMemo(() => {
    if (!data) return [];
    const values: Array<number | null> = [
      setup?.unassigned_count ?? null,
      setup?.unscheduled_count ?? null,
      data.missingTve.count,
      data.incompleteLearners.count,
      data.sectionsWithoutAdviser.length,
      data.emptyGradeLevels.length,
      data.pendingGradeLevelHeads.length,
      data.personnel?.total_incomplete ?? null,
      data.passwordResets?.pending_count ?? null,
      data.isSchoolDay && data.permissions["attendance.manage"]
        ? data.attendanceGaps.length
        : null,
    ];
    return values.filter((value): value is number => value !== null);
  }, [data, setup]);

  const passedChecks = checks.filter((value) => value === 0).length;
  const issueChecks = checks.filter((value) => value > 0).length;
  const readinessPercent = checks.length
    ? Math.round((passedChecks / checks.length) * 100)
    : 0;

  const totalAttendanceMissing =
    data?.attendanceGaps.reduce((sum, item) => sum + item.missing, 0) ?? 0;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topActions}>
          <a href="/portal" className={styles.backLink}>
            <ArrowLeft size={16} />
            Back to Portal
          </a>
          <button
            className={styles.refresh}
            onClick={() => void loadData()}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? styles.spin : ""} />
            Refresh
          </button>
        </nav>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>ADMINISTRATION · DATA HEALTH</span>
            <h1>School Readiness</h1>
            <p>
              One place to find incomplete setup, missing data, and daily
              operational items that need attention.
            </p>
          </div>
          <div className={styles.secureBadge}>
            <ShieldCheck size={17} />
            Live school data
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}

        {loading && !data ? (
          <section className={styles.loading}>
            <RefreshCw size={24} className={styles.spin} />
            <strong>Checking school readiness…</strong>
            <span>Reviewing academic, learner, personnel, and attendance data.</span>
          </section>
        ) : data ? (
          <>
            <section className={styles.hero}>
              <div className={styles.score}>
                <div className={styles.scoreRing}>
                  <strong>{readinessPercent}%</strong>
                  <span>Ready</span>
                </div>
                <div>
                  <span className={styles.heroLabel}>
                    {data.activeYear?.name ?? "No Active School Year"}
                  </span>
                  <h2>
                    {issueChecks === 0
                      ? "All available readiness checks are clear."
                      : `${issueChecks} readiness check${issueChecks === 1 ? "" : "s"} need attention.`}
                  </h2>
                  <p>
                    {passedChecks} of {checks.length} available checks currently
                    have no outstanding items.
                  </p>
                </div>
              </div>
              <div className={styles.heroStats}>
                <div>
                  <span>Active Learners</span>
                  <strong>{data.totalLearners.toLocaleString()}</strong>
                </div>
                <div>
                  <span>Today</span>
                  <strong>{data.today}</strong>
                </div>
                <div>
                  <span>Attendance Missing</span>
                  <strong>
                    {data.isSchoolDay && data.permissions["attendance.manage"]
                      ? totalAttendanceMissing
                      : "—"}
                  </strong>
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <div>
                  <span>ACADEMIC SETUP</span>
                  <h2>Classes, Teachers & Enrollment</h2>
                </div>
                <Wrench size={22} />
              </div>
              <div className={styles.grid}>
                <HealthCard
                  title="Subjects Without Teachers"
                  description="Active section-subject combinations that still need a Subject Teacher."
                  count={setup?.unassigned_count ?? null}
                  href="/portal/admin/teaching"
                  action="Assign Teachers"
                  icon={BookOpen}
                  unavailable={!setup}
                />
                <HealthCard
                  title="Assigned Subjects Without Schedules"
                  description="Teacher assignments that still have no active class schedule."
                  count={setup?.unscheduled_count ?? null}
                  href="/portal/admin/schedules"
                  action="Open Schedules"
                  icon={CalendarCheck}
                  unavailable={!setup}
                />
                <HealthCard
                  title="Learners Missing TVE Major"
                  description="Active Grade 8–10 learners without a saved TVE major."
                  count={data.missingTve.count}
                  href="/portal/admin/learners?missing=tve_major"
                  action="Review Learners"
                  icon={GraduationCap}
                />
                <HealthCard
                  title="Sections Without Adviser"
                  description="Sections with active learners but no active adviser assignment."
                  count={data.sectionsWithoutAdviser.length}
                  href="/portal/admin/attendance"
                  action="Assign Advisers"
                  icon={UserRound}
                />
                <HealthCard
                  title="Grade Levels Without Learners"
                  description="Configured grade levels that currently have no active enrollment."
                  count={data.emptyGradeLevels.length}
                  href="/portal/admin/masterlist"
                  action="Review Enrollment"
                  icon={Users}
                />
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <div>
                  <span>DATA QUALITY</span>
                  <h2>Learner & Personnel Records</h2>
                </div>
                <CircleAlert size={22} />
              </div>
              <div className={styles.grid}>
                <HealthCard
                  title="Incomplete Learner Records"
                  description="Learners missing one or more required profile fields."
                  count={data.incompleteLearners.count}
                  href="/portal/admin/learners?missing=required"
                  action="Complete Records"
                  icon={GraduationCap}
                />
                <HealthCard
                  title="Incomplete Personnel Profiles"
                  description="Teaching and Non-Teaching Personnel with required HR fields still blank."
                  count={data.personnel?.total_incomplete ?? null}
                  href="/portal/admin/teacher-profiles"
                  action="Open Personnel Profiles"
                  icon={UserRound}
                  unavailable={!data.personnel}
                />
                <HealthCard
                  title="Grade Level Heads Awaiting Account Link"
                  description="Designated Grade Level Heads whose personnel record is not linked to a portal account."
                  count={data.pendingGradeLevelHeads.length}
                  href="/portal/admin/users"
                  action="Open Accounts"
                  icon={ShieldCheck}
                />
              </div>

              {data.incompleteLearners.samples.length > 0 && (
                <div className={styles.detailPanel}>
                  <div className={styles.detailHeading}>
                    <div>
                      <h3>Learner Records Needing Attention</h3>
                      <p>Showing the first {data.incompleteLearners.samples.length} affected learners.</p>
                    </div>
                    <a href="/portal/admin/learners?missing=required">
                      View All <ChevronRight size={15} />
                    </a>
                  </div>
                  <div className={styles.detailList}>
                    {data.incompleteLearners.samples.map((learner) => (
                      <a
                        key={learner.student_id}
                        href={`/portal/admin/learners?student=${encodeURIComponent(
                          learner.student_id
                        )}&missing=required`}
                        className={styles.detailRow}
                      >
                        <div>
                          <strong>{learner.full_name}</strong>
                          <span>
                            Grade {learner.grade_level} · {learner.section}
                            {learner.lrn ? ` · ${learner.lrn}` : ""}
                          </span>
                        </div>
                        <small>{learner.missing_fields.join(", ")}</small>
                        <ChevronRight size={16} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <div>
                  <span>DAILY OPERATIONS</span>
                  <h2>Attendance, Accounts & Grades</h2>
                </div>
                <ClipboardCheck size={22} />
              </div>
              <div className={styles.grid}>
                <HealthCard
                  title="Attendance Not Fully Recorded Today"
                  description={
                    data.isSchoolDay
                      ? "Sections where one or more active learners still have no attendance status today."
                      : "Today is a weekend, so the attendance completion check is not required."
                  }
                  count={
                    data.isSchoolDay && data.permissions["attendance.manage"]
                      ? data.attendanceGaps.length
                      : null
                  }
                  href={`/portal/admin/attendance?date=${data.today}`}
                  action="Review Attendance"
                  icon={ClipboardCheck}
                  unavailable={
                    !data.isSchoolDay || !data.permissions["attendance.manage"]
                  }
                  goodText="Today's Attendance Complete"
                />
                <HealthCard
                  title="Pending Password Reset Requests"
                  description="Requests still awaiting administrator identity verification."
                  count={data.passwordResets?.pending_count ?? null}
                  href="/portal/admin/password-resets"
                  action="Review Requests"
                  icon={KeyRound}
                  unavailable={!data.passwordResets}
                />
                <article className={styles.healthCard}>
                  <div className={styles.cardIcon}>
                    <BarChart3 size={20} />
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}>
                      <div>
                        <h3>Grade Records</h3>
                        <p>Current-year term-grade records saved in the portal.</p>
                      </div>
                      <strong>{data.grades.total}</strong>
                    </div>
                    <div className={styles.termStats}>
                      {data.grades.byTerm.map((term) => (
                        <span key={term.term_no}>
                          T{term.term_no}: {term.published}/{term.total} published
                        </span>
                      ))}
                    </div>
                    <a href="/portal/admin/reports" className={styles.cardAction}>
                      Open Reports <ChevronRight size={15} />
                    </a>
                  </div>
                </article>
              </div>

              {data.attendanceGaps.length > 0 && (
                <div className={styles.detailPanel}>
                  <div className={styles.detailHeading}>
                    <div>
                      <h3>Today's Attendance Gaps</h3>
                      <p>Sections with learners still missing an attendance status.</p>
                    </div>
                    <a href={`/portal/admin/attendance?date=${data.today}`}>
                      Open Attendance <ChevronRight size={15} />
                    </a>
                  </div>
                  <div className={styles.compactGrid}>
                    {data.attendanceGaps.map((item) => (
                      <div key={item.section_id} className={styles.compactItem}>
                        <strong>Grade {item.grade_level} · {item.section}</strong>
                        <span>
                          {item.recorded}/{item.total} recorded · {item.missing} missing
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <div>
                  <span>ENROLLMENT COVERAGE</span>
                  <h2>Active Learners by Grade Level</h2>
                </div>
                <Users size={22} />
              </div>
              <div className={styles.gradeGrid}>
                {data.gradeCounts.map((item) => (
                  <div
                    key={item.grade_level}
                    className={[
                      styles.gradeCard,
                      item.count === 0 ? styles.gradeEmpty : "",
                    ].join(" ")}
                  >
                    <span>Grade {item.grade_level}</span>
                    <strong>{item.count.toLocaleString()}</strong>
                    <small>{item.count === 0 ? "No active learners" : "Active learners"}</small>
                  </div>
                ))}
              </div>
            </section>

            {(data.pendingGradeLevelHeads.length > 0 ||
              data.emptyGradeLevels.length > 0) && (
              <section className={styles.notice}>
                <AlertTriangle size={21} />
                <div>
                  <strong>Setup items that need factual records</strong>
                  <p>
                    These items are intentionally not auto-filled. Enrollment and
                    account links should only be completed from verified school records.
                  </p>
                  {data.pendingGradeLevelHeads.length > 0 && (
                    <span>
                      Pending Grade Level Head accounts:{" "}
                      {data.pendingGradeLevelHeads
                        .map(
                          (head) =>
                            `Grade ${head.grade_level} ${head.display_name}`
                        )
                        .join("; ")}
                    </span>
                  )}
                  {data.emptyGradeLevels.length > 0 && (
                    <span>
                      No active enrollment:{" "}
                      {data.emptyGradeLevels
                        .map((grade) => `Grade ${grade}`)
                        .join(", ")}
                    </span>
                  )}
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
