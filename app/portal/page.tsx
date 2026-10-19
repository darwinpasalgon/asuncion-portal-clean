"use client";

import { gradeLabel } from "@/lib/grade-label";
import { electiveGroupLabel } from "@/lib/shs-stem-groups";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BellRing,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  FileSpreadsheet,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  Printer,
  Settings2,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { usePortal } from "@/components/portal/portal-shell";
import FeatureIcon from "@/components/portal/feature-icon";
import WorkspaceDirectory from "@/components/portal/workspace-directory";

type Role = "student" | "teacher" | "administrator" | "staff_administrator";
type Page =
  | "Overview"
  | "Grades"
  | "Attendance"
  | "Class schedule"
  | "Announcements"
  | "Learning resources"
  | "Students"
  | "My learners"
  | "Teaching assignments"
  | "School forms"
  | "School setup";

type AcademicContext = {
  school_year: string | null;
  school_year_id: string | null;
  grade_level: number | null;
  section: string | null;
  enrollment_status: string | null;
  tve_major: string | null;
  shs_track: string | null;
  shs_strand_program: string | null;
  shs_elective_group?: string | null;
  sex: string | null;
};

type TeacherAssignment = {
  id: string;
  grade_level: number;
  section_id?: string;
  section: string;
  subject: string;
  major: string | null;
  student_count: number;
  section_student_count?: number;
  pending_tve_major_count?: number;
  terms?: number[];
  roster_restricted?: boolean;
};

type AdviserSection = {
  id: string;
  grade_level: number;
  name: string;
};

type TeacherLearner = {
  student_id: string;
  full_name: string;
  lrn: string | null;
  last_name: string | null;
  first_name: string | null;
  sex: string | null;
};

type TeacherLearnerSection = {
  id: string;
  grade_level: number;
  name: string;
  learner_count: number;
  section_enrollment_count?: number;
  pending_tve_major_count?: number;
  roster_note?: string;
  subjects: Array<{
    assignment_id: string;
    subject: string;
    major: string | null;
  }>;
  learners: TeacherLearner[];
};

type AdviserLearner = {
  enrollment_id: string;
  student_id: string;
  full_name: string;
  lrn: string | null;
  grade_level: number;
  section_id: string;
  section: string;
  tve_major: string | null;
};

type AdviserAttentionLearner = {
  studentId: string;
  fullName: string;
  lrn: string | null;
  gradeLevel: number;
  section: string;
  missingFields: string[];
  href: string;
};

type AdviserAttentionAlert = {
  id: string;
  severity: "warning" | "info";
  title: string;
  detail: string;
  count: number;
  href: string | null;
  actionLabel: string | null;
  administratorAction: boolean;
  learners?: AdviserAttentionLearner[];
};

type AdviserAttention = {
  schoolDate?: string;
  isSchoolWeekday?: boolean;
  alerts: AdviserAttentionAlert[];
  totalAlertTypes: number;
};

type PersonnelAttentionPerson = {
  id: string;
  portal_user_id?: string | null;
  full_name: string;
  email?: string | null;
  position?: string | null;
  personnel_type: "teaching" | "non_teaching";
  missing_fields: string[];
};

type PersonnelProfileAttention = {
  self: {
    personnel_type: "teaching" | "non_teaching";
    full_name?: string;
    missing_fields: string[];
    complete: boolean;
  } | null;
  can_manage: boolean;
  incomplete_teaching: PersonnelAttentionPerson[];
  incomplete_non_teaching: PersonnelAttentionPerson[];
  teaching_count: number;
  non_teaching_count: number;
  total_incomplete: number;
};

type ServiceCreditSummary = {
  service_credit_balance: number | null;
  wellness_leave_balance: number | null;
  total_service_credits_earned: number;
  total_service_credits_used: number;
  transaction_count: number;
  wellness_transaction_count: number;
};

type AcademicSetupAttentionItem = {
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

type AcademicSetupAttention = {
  unassigned: AcademicSetupAttentionItem[];
  unscheduled: AcademicSetupAttentionItem[];
  unassigned_count: number;
  unscheduled_count: number;
  can_teach: boolean;
  can_schedule: boolean;
};

type ClassScheduleEntry = {
  term_no?: number;
  id: string;
  entry_type?: "class" | "block" | "rotation";
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  grade_level: number | null;
  section: string;
  subject: string;
  major: string | null;
  purpose?: string | null;
  instructor?: string | null;
};

type Profile = {
  id: string;
  full_name: string;
  email: string;
  lrn: string | null;
  grade_level: number | null;
  section: string | null;
  role: Role;
  requested_role: "student" | "teacher" | "administrator";
  admin_role:
    | "super_administrator"
    | "registrar"
    | "content_administrator"
    | "school_administrator"
    | null;
  position: string | null;
  account_status: "active";
  must_change_password: boolean;
  has_profile_photo?: boolean;
  profile_photo_updated_at?: string | null;
};

type GradeLevelHead = {
  grade_level: number;
  display_name: string;
};

const roleLabel: Record<Role, string> = {
  student: "Student",
  teacher: "Teacher",
  administrator: "Super Administrator",
  staff_administrator: "Administrator",
};

function pageDisplayTitle(page: Page, role: Role) {
  if (page === "Students") {
    return role === "teacher" ? "My Students" : "Learner Management";
  }
  if (page === "My learners") return "My Learners";
  if (page === "Teaching assignments") return "My Teaching Assignments";
  if (page === "School forms") return "School Forms";
  if (page === "Class schedule") return "Class Schedule";
  if (page === "Learning resources") return "Learning Resources";
  if (page === "School setup") return "School Setup";
  return page;
}

function shsTrackLabel(value: string | null | undefined) {
  const track = String(value ?? "").trim();
  if (!track) return "Not Assigned Yet";
  if (track === "Technical-Vocational-Livelihood" || track === "TVL")
    return "TVL";
  return track;
}

function shsStrandLabel(value: string | null | undefined) {
  const strand = String(value ?? "").trim();
  if (!strand) return "Not Assigned Yet";
  const labels: Record<string, string> = {
    "Science, Technology, Engineering, and Mathematics": "STEM",
    "Humanities and Social Sciences": "HUMSS",
    "Accountancy, Business, and Management": "ABM",
    "Organic Agriculture Production": "OAP",
    "Food Processing": "FP",
  };
  return labels[strand] ?? strand;
}

function administratorLabel(profile: Profile, adminPermissions: string[] = []) {
  if (profile.role === "administrator") return "Super Administrator";
  if (profile.role !== "staff_administrator") return roleLabel[profile.role];
  if (profile.admin_role === "registrar") return "Registrar";
  if (profile.admin_role === "content_administrator")
    return "Content Administrator";
  if (adminPermissions.length === 1 && adminPermissions.includes("hr.manage")) {
    return "Human Resources";
  }
  return "School Administrator";
}

function DashboardHome({
  profile,
  displayRole,
  academicContext,
  adminPermissions,
  teacherAssignments,
  teacherLearnerSections,
  adviserSections,
  personnelAttention,
  serviceCreditSummary,
  academicSetupAttention,
  communityUnread,
  gradeLevelHead,
  summaryLoading,
}: {
  profile: Profile;
  displayRole: string;
  academicContext: AcademicContext | null;
  adminPermissions: string[];
  teacherAssignments: TeacherAssignment[];
  teacherLearnerSections: TeacherLearnerSection[];
  adviserSections: AdviserSection[];
  personnelAttention: PersonnelProfileAttention | null;
  serviceCreditSummary: ServiceCreditSummary | null;
  academicSetupAttention: AcademicSetupAttention | null;
  communityUnread: number;
  gradeLevelHead: GradeLevelHead | null;
  summaryLoading: boolean;
}) {
  const { groups, session } = usePortal();
  const preferred =
    profile.role === "student"
      ? [
          "grades",
          "attendance",
          "schedule",
          "announcements",
          "resources",
          "community",
        ]
      : profile.role === "teacher"
        ? session.isAdviser
          ? ["advisory", "attendance", "grades", "sf9", "sf2", "schedule"]
          : [
              "learners",
              "schedule",
              "grades",
              "assignments",
              "resources",
              "my-credits",
            ]
        : [
            "learners",
            "teaching",
            "schedules",
            "school-attendance",
            "sf9",
            "teachers",
            "credits",
            "reports",
            "accounts",
            "announcements",
            "resources",
          ];
  const features = groups.flatMap((group) => group.items);
  const actions = preferred
    .flatMap((id) => features.filter((item) => item.id === id))
    .slice(0, 6);

  const teacherSections = new Set(
    teacherAssignments.map(
      (assignment) => `${assignment.grade_level}:${assignment.section}`,
    ),
  ).size;
  const rosterSections = teacherLearnerSections.length;

  const setupAttention =
    (academicSetupAttention?.unassigned_count ?? 0) +
    (academicSetupAttention?.unscheduled_count ?? 0);

  const personnelReview = personnelAttention?.can_manage
    ? personnelAttention.total_incomplete
    : (personnelAttention?.self?.missing_fields.length ?? 0);

  return (
    <section className="panel real-dashboard-home">
      <div className="real-dashboard-heading">
        <div>
          <span className="real-dashboard-kicker">QUICK ACCESS</span>
          <h2>
            {profile.role === "student"
              ? "My School Day"
              : profile.role === "teacher"
                ? "My Teaching Workspace"
                : "Administration Workspace"}
          </h2>
          <p>
            Start with your everyday tasks, or explore the feature groups below.
          </p>
        </div>
        <span className="real-dashboard-role">{displayRole}</span>
      </div>

      {(profile.role === "administrator" ||
        (profile.role === "staff_administrator" &&
          ["school_setup.manage", "teaching.manage", "reports.view"].some(
            (permission) => adminPermissions.includes(permission)
          ))) && (
        <a
          href="/portal/admin/jhs-readiness"
          style={{
            display: "inline-flex", alignItems: "center", gap: 9,
            padding: "11px 15px", marginBottom: 15, borderRadius: 11,
            width: "fit-content", background: "#e8f6f2",
            border: "1px solid #c5e4d9", color: "#147665",
            textDecoration: "none", fontSize: 13, fontWeight: 750,
          }}
        >
          <ClipboardCheck size={17} />
          Grades 7–10 Readiness Audit
          <ChevronRight size={15} />
        </a>
      )}

      <div className="real-dashboard-summary">
        {profile.role === "student" ? (
          <>
            <div>
              <span>School Year</span>
              <strong>{academicContext?.school_year ?? "Current"}</strong>
            </div>
            <div>
              <span>Grade & Section</span>
              <strong>
                {academicContext?.grade_level != null
                  ? `${gradeLabel(academicContext.grade_level)}${academicContext.section ? ` · ${academicContext.section}` : ""}`
                  : "Not Assigned"}
              </strong>
            </div>
            <div>
              <span>
                {academicContext?.grade_level &&
                [8, 9, 10].includes(academicContext.grade_level)
                  ? "TVE Major"
                  : academicContext?.grade_level &&
                      [11, 12].includes(academicContext.grade_level)
                    ? "Track / Strand"
                    : "Account"}
              </span>
              <strong>
                {academicContext?.grade_level &&
                [8, 9, 10].includes(academicContext.grade_level)
                  ? academicContext.tve_major || "Not Assigned Yet"
                  : academicContext?.grade_level &&
                      [11, 12].includes(academicContext.grade_level)
                    ? `${shsTrackLabel(academicContext.shs_track)} · ${shsStrandLabel(academicContext.shs_strand_program)}`
                    : "Active Student"}
              </strong>
            </div>
          </>
        ) : profile.role === "teacher" ? (
          <>
            <div>
              <span>Teaching Classes</span>
              <strong>
                {summaryLoading ? "…" : teacherAssignments.length}
              </strong>
            </div>
            <div>
              <span>Assigned Sections</span>
              <strong>
                {summaryLoading ? "…" : rosterSections || teacherSections}
              </strong>
            </div>
            <div>
              <span>
                {gradeLevelHead ? "Grade Level Head" : "Adviser Sections"}
              </span>
              <strong>
                {gradeLevelHead
                  ? `Grade ${gradeLevelHead.grade_level}`
                  : summaryLoading
                    ? "…"
                    : adviserSections.length}
              </strong>
            </div>
            <div>
              <span>Service Credits</span>
              <strong>
                {serviceCreditSummary?.service_credit_balance === null ||
                serviceCreditSummary?.service_credit_balance === undefined
                  ? summaryLoading
                    ? "…"
                    : serviceCreditSummary
                      ? "Not Recorded"
                      : "Not Available"
                  : `${Number(serviceCreditSummary.service_credit_balance).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} days`}
              </strong>
            </div>
          </>
        ) : (
          <>
            {features.some((item) =>
              ["teaching", "schedules"].includes(item.id),
            ) && (
              <div>
                <span>Academic Items to Review</span>
                <strong>
                  {academicSetupAttention === null
                    ? summaryLoading
                      ? "…"
                      : "Not Available"
                    : setupAttention}
                </strong>
              </div>
            )}
            {(features.some((item) => item.id === "teachers") ||
              personnelAttention?.self) && (
              <div>
                <span>Personnel To Review</span>
                <strong>
                  {personnelAttention === null
                    ? summaryLoading
                      ? "…"
                      : "Not Available"
                    : personnelReview}
                </strong>
              </div>
            )}
            <div>
              <span>School Year</span>
              <strong>{academicContext?.school_year ?? "Current"}</strong>
            </div>
            {profile.role === "staff_administrator" && (
              <div>
                <span>My Service Credits</span>
                <strong>
                  {serviceCreditSummary?.service_credit_balance === null ||
                  serviceCreditSummary?.service_credit_balance === undefined
                    ? summaryLoading
                      ? "…"
                      : serviceCreditSummary
                        ? "Not Recorded"
                        : "Not Available"
                    : `${Number(serviceCreditSummary.service_credit_balance).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} days`}
                </strong>
              </div>
            )}
          </>
        )}
      </div>

      <div className="real-dashboard-actions">
        {actions.map((action) => (
          <a
            key={action.label}
            href={action.href}
            className="real-dashboard-action"
          >
            <span className="real-dashboard-action-icon">
              <FeatureIcon name={action.icon} size={20} />
            </span>
            <span className="real-dashboard-action-copy">
              <strong>{action.label}</strong>
              <small>{action.description}</small>
            </span>
            {action.id === "community" && communityUnread > 0 && (
              <span className="real-dashboard-action-badge">
                {communityUnread > 99 ? "99+" : communityUnread} new
              </span>
            )}
            <ChevronRight className="real-dashboard-action-arrow" size={16} />
          </a>
        ))}
      </div>
    </section>
  );
}

function EmptySection({ page, role }: { page: Page; role: Role }) {
  const descriptions: Record<Page, string> = {
    Overview:
      "Your account is connected. Academic records will appear here as each live module is configured.",
    Grades:
      role === "student"
        ? "No official grades are available in the portal yet."
        : "Grade encoding will be enabled after subjects, sections, and teaching assignments are configured.",
    Attendance:
      role === "student"
        ? "No official attendance records are available in the portal yet."
        : "Attendance recording will be enabled after class assignments are configured.",
    "Class schedule":
      "No official class schedule has been published in the portal yet.",
    Announcements: "No official portal announcements have been published yet.",
    "Learning resources":
      "No learning resources have been uploaded to the live portal yet.",
    Students:
      role === "administrator"
        ? "Student enrollment records will appear here after the academic database is configured."
        : "Your advisory students will appear here after a Section Adviser assignment is configured.",
    "My learners":
      "Your assigned class rosters are available from the dedicated My Learners page.",
    "Teaching assignments":
      "Your active Subject Teacher assignments will appear here.",
    "School forms":
      "SF2, SF9, and SF10 are available to active Section Advisers. Other School Forms remain under development.",
    "School setup":
      "School year, grade levels, sections, subjects, and assignments will be configured in the next phase.",
  };

  const icons: Record<Page, typeof BookOpen> = {
    Overview: LayoutDashboard,
    Grades: GraduationCap,
    Attendance: ClipboardCheck,
    "Class schedule": CalendarDays,
    Announcements: Megaphone,
    "Learning resources": FolderOpen,
    Students: Users,
    "My learners": Users,
    "Teaching assignments": BookOpen,
    "School forms": FileSpreadsheet,
    "School setup": Settings2,
  };

  const Icon = icons[page];

  return (
    <section className="panel real-empty-panel">
      <Icon size={34} />
      <h2>{pageDisplayTitle(page, role)}</h2>
      <p>{descriptions[page]}</p>
    </section>
  );
}

export default function PortalPage() {
  const { session, communityUnread } = usePortal();
  const { profile, academicContext, adminPermissions, gradeLevelHead } =
    session;
  const searchParams = useSearchParams();
  const open = searchParams.get("open");
  const page: Page =
    open === "schedule"
      ? "Class schedule"
      : open === "assignments"
        ? "Teaching assignments"
        : open === "school-forms"
          ? "School forms"
          : "Overview";
  const [teacherAssignments, setTeacherAssignments] = useState<
    TeacherAssignment[]
  >([]);
  const [teacherAssignmentsLoading, setTeacherAssignmentsLoading] =
    useState(false);
  const [teacherLearnerSections, setTeacherLearnerSections] = useState<
    TeacherLearnerSection[]
  >([]);
  const [teacherLearnersLoading, setTeacherLearnersLoading] = useState(false);
  const [adviserSections, setAdviserSections] = useState<AdviserSection[]>([]);
  const [adviserLearners, setAdviserLearners] = useState<AdviserLearner[]>([]);
  const [adviserMajors, setAdviserMajors] = useState<string[]>([]);
  const [adviserLearnersLoading, setAdviserLearnersLoading] = useState(false);
  const [adviserAttention, setAdviserAttention] = useState<AdviserAttention>({
    alerts: [],
    totalAlertTypes: 0,
  });
  const [adviserAttentionLoading, setAdviserAttentionLoading] = useState(false);
  const [personnelAttention, setPersonnelAttention] =
    useState<PersonnelProfileAttention | null>(null);
  const [personnelAttentionLoading, setPersonnelAttentionLoading] =
    useState(false);
  const [serviceCreditSummary, setServiceCreditSummary] =
    useState<ServiceCreditSummary | null>(null);
  const [academicSetupAttention, setAcademicSetupAttention] =
    useState<AcademicSetupAttention | null>(null);
  const [academicSetupAttentionLoading, setAcademicSetupAttentionLoading] =
    useState(false);
  const [majorSaving, setMajorSaving] = useState("");
  const [scheduleTerm, setScheduleTerm] = useState(() => {
    const requested = Number(searchParams.get("term"));
    return [1, 2, 3].includes(requested) ? requested : 1;
  });

  const [classSchedules, setClassSchedules] = useState<ClassScheduleEntry[]>(
    [],
  );
  const [classSchedulesLoading, setClassSchedulesLoading] = useState(false);
  const availableScheduleTerms = [...new Set(classSchedules.flatMap(entry => entry.term_no ? [entry.term_no] : []))].sort();
  const selectedScheduleTerm = availableScheduleTerms.includes(scheduleTerm) ? scheduleTerm : availableScheduleTerms[0] ?? 1;
  const visibleClassSchedules = classSchedules.filter(entry => !entry.term_no || entry.term_no === selectedScheduleTerm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        if (active) {
          const loadedProfile = profile;
          const summaries = await Promise.allSettled([
            (async () => {
              if (loadedProfile.role !== "student") {
                setPersonnelAttentionLoading(true);
                try {
                  const attentionResponse = await fetch(
                    "/api/teacher-profiles",
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "profile_attention" }),
                      cache: "no-store",
                    },
                  );
                  const attentionResult = await attentionResponse
                    .json()
                    .catch(() => ({}));
                  if (!attentionResponse.ok)
                    throw new Error("Unable to refresh workspace summary.");
                  if (active && attentionResponse.ok) {
                    setPersonnelAttention(
                      attentionResult as PersonnelProfileAttention,
                    );
                  }
                } finally {
                  if (active) setPersonnelAttentionLoading(false);
                }
              }
            })(),
            (async () => {
              if (
                loadedProfile.role === "teacher" ||
                loadedProfile.role === "staff_administrator"
              ) {
                try {
                  const creditsResponse = await fetch("/api/service-credits", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "self" }),
                    cache: "no-store",
                  });
                  const creditsResult = await creditsResponse
                    .json()
                    .catch(() => ({}));
                  if (active && creditsResponse.ok) {
                    setServiceCreditSummary(
                      (creditsResult.summary ??
                        null) as ServiceCreditSummary | null,
                    );
                  }
                } catch {
                  // Service Credits is a non-blocking dashboard summary.
                }
              }
            })(),
            (async () => {
              if (
                loadedProfile.role === "administrator" ||
                loadedProfile.role === "staff_administrator"
              ) {
                setAcademicSetupAttentionLoading(true);
                try {
                  const setupResponse = await fetch(
                    "/api/admin/academic-setup-attention",
                    {
                      cache: "no-store",
                    },
                  );
                  const setupResult = await setupResponse
                    .json()
                    .catch(() => ({}));
                  if (!setupResponse.ok)
                    throw new Error("Unable to refresh workspace summary.");
                  if (active && setupResponse.ok) {
                    setAcademicSetupAttention(
                      setupResult as AcademicSetupAttention,
                    );
                  }
                } finally {
                  if (active) setAcademicSetupAttentionLoading(false);
                }
              }
            })(),
            (async () => {
              if (loadedProfile.role === "teacher") {
                setTeacherAssignmentsLoading(true);
                setTeacherLearnersLoading(true);
                setAdviserLearnersLoading(true);
                setAdviserAttentionLoading(true);
                try {
                  const [
                    assignmentResponse,
                    learnersResponse,
                    adviserResponse,
                    attentionResponse,
                  ] = await Promise.all([
                    fetch("/api/academic/my-assignments", {
                      cache: "no-store",
                    }),
                    fetch("/api/academic/my-learners", { cache: "no-store" }),
                    fetch("/api/academic/adviser-students", {
                      cache: "no-store",
                    }),
                    fetch("/api/academic/adviser-attention", {
                      cache: "no-store",
                    }),
                  ]);
                  const [
                    assignmentResult,
                    learnersResult,
                    adviserResult,
                    attentionResult,
                  ] = await Promise.all([
                    assignmentResponse.json().catch(() => ({})),
                    learnersResponse.json().catch(() => ({})),
                    adviserResponse.json().catch(() => ({})),
                    attentionResponse.json().catch(() => ({})),
                  ]);

                  if (active && assignmentResponse.ok) {
                    setTeacherAssignments(
                      (assignmentResult.assignments ??
                        []) as TeacherAssignment[],
                    );
                  }
                  if (active && learnersResponse.ok) {
                    setTeacherLearnerSections(
                      (learnersResult.sections ??
                        []) as TeacherLearnerSection[],
                    );
                  }
                  if (active && adviserResponse.ok) {
                    setAdviserSections(
                      (adviserResult.sections ?? []) as AdviserSection[],
                    );
                    setAdviserLearners(
                      (adviserResult.learners ?? []) as AdviserLearner[],
                    );
                    setAdviserMajors((adviserResult.majors ?? []) as string[]);
                  }
                  if (active && attentionResponse.ok) {
                    setAdviserAttention({
                      schoolDate: attentionResult.schoolDate,
                      isSchoolWeekday: attentionResult.isSchoolWeekday,
                      alerts: (attentionResult.alerts ??
                        []) as AdviserAttentionAlert[],
                      totalAlertTypes: Number(
                        attentionResult.totalAlertTypes ?? 0,
                      ),
                    });
                  }
                } finally {
                  if (active) {
                    setTeacherAssignmentsLoading(false);
                    setTeacherLearnersLoading(false);
                    setAdviserLearnersLoading(false);
                    setAdviserAttentionLoading(false);
                  }
                }
              }
            })(),
            (async () => {
              if (
                loadedProfile.role === "teacher" ||
                loadedProfile.role === "student"
              ) {
                setClassSchedulesLoading(true);
                try {
                  const scheduleResponse = await fetch(
                    "/api/academic/my-schedule",
                    {
                      cache: "no-store",
                    },
                  );
                  const scheduleResult = await scheduleResponse
                    .json()
                    .catch(() => ({}));
                  if (!scheduleResponse.ok)
                    throw new Error("Unable to refresh workspace summary.");
                  if (active && scheduleResponse.ok) {
                    setClassSchedules(
                      (scheduleResult.schedules ?? []) as ClassScheduleEntry[],
                    );
                  }
                } finally {
                  if (active) setClassSchedulesLoading(false);
                }
              }
            })(),
          ]);
          if (
            active &&
            summaries.some((result) => result.status === "rejected")
          ) {
            setError(
              "Some workspace summaries could not load. Your tools are still available. Refresh to try again.",
            );
          }
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Unable to load your profile.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const displayRole = useMemo(
    () =>
      profile
        ? gradeLevelHead
          ? `Grade ${gradeLevelHead.grade_level} Level Head`
          : administratorLabel(profile, adminPermissions)
        : "",
    [profile, adminPermissions, gradeLevelHead],
  );

  async function saveLearnerMajor(enrollmentId: string, major: string) {
    setMajorSaving(enrollmentId);
    setError("");
    try {
      const response = await fetch("/api/academic/adviser-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_tve_major",
          enrollmentId,
          major,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          result.error ?? "Unable to update the learner TVE Major.",
        );
      }

      setAdviserLearners((current) =>
        current.map((learner) =>
          learner.enrollment_id === enrollmentId
            ? { ...learner, tve_major: major || null }
            : learner,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update the learner TVE Major.",
      );
    } finally {
      setMajorSaving("");
    }
  }

  return (
    <main className="workspace">
      <div className="page-wrap">
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              ASUNCION NATIONAL HIGH SCHOOL · SCHOOL YEAR{" "}
              {academicContext?.school_year ?? "2026–2027"}
            </p>
            <h1>
              {page === "Overview"
                ? `Welcome, ${profile.full_name}.`
                : pageDisplayTitle(page, profile.role)}
            </h1>
            <p>
              {page === "Overview"
                ? "Your academic information and school tools in one place."
                : page === "Class schedule"
                  ? "Your classes and teaching periods for the week."
                  : page === "School forms"
                    ? "Prepare and print forms for your advisory class."
                    : "Your assigned subjects and sections."}
            </p>
          </div>
        </div>

        {loading && (
          <p className="portal-summary-loading" role="status">
            Updating your workspace summaries…
          </p>
        )}
        {error && (
          <p className="portal-summary-error" role="alert">
            {error}
          </p>
        )}

        {page === "Overview" && (
          <div className="real-overview-grid">
            <DashboardHome
              profile={profile}
              displayRole={displayRole}
              academicContext={academicContext}
              adminPermissions={adminPermissions}
              teacherAssignments={teacherAssignments}
              teacherLearnerSections={teacherLearnerSections}
              adviserSections={adviserSections}
              personnelAttention={personnelAttention}
              serviceCreditSummary={serviceCreditSummary}
              academicSetupAttention={academicSetupAttention}
              communityUnread={communityUnread}
              gradeLevelHead={gradeLevelHead}
              summaryLoading={loading}
            />
            <WorkspaceDirectory />

            {profile.role !== "student" &&
              (personnelAttentionLoading ||
                Boolean(personnelAttention?.self?.missing_fields?.length) ||
                Boolean(
                  personnelAttention?.can_manage &&
                    personnelAttention.total_incomplete > 0,
                )) && (
                <details className="panel real-adviser-attention real-personnel-attention portal-attention-details">
                  <summary className="portal-attention-summary">
                    <div className="real-attention-heading">
                      <div className="real-attention-title">
                        <span className="real-attention-icon">
                          <UserRound size={19} />
                        </span>
                        <div>
                          <h2>Personnel Profile Attention</h2>
                          <p>
                            Required personnel information that still needs
                            completion.
                          </p>
                        </div>
                      </div>
                      {!personnelAttentionLoading && personnelAttention && (
                        <span className="real-attention-count">
                          {personnelAttention.can_manage
                            ? `${personnelAttention.total_incomplete} incomplete`
                            : `${personnelAttention.self?.missing_fields.length ?? 0} required`}
                        </span>
                      )}
                    </div>
                  </summary>
                  {personnelAttentionLoading ? (
                    <div className="real-attention-loading">
                      Checking required personnel profile information…
                    </div>
                  ) : personnelAttention?.self &&
                    personnelAttention.self.missing_fields.length > 0 ? (
                    <div className="real-attention-list">
                      <article className="real-attention-item warning">
                        <span className="real-attention-item-icon">
                          <CircleAlert size={18} />
                        </span>
                        <div className="real-attention-copy">
                          <div>
                            <strong>Complete Your Personnel Profile</strong>
                            <span className="real-attention-badge">
                              {personnelAttention.self.missing_fields.length}
                            </span>
                          </div>
                          <p>
                            Missing:{" "}
                            {personnelAttention.self.missing_fields.join(", ")}
                          </p>
                        </div>
                        <a
                          href={`/portal/teacher-profile?field=${encodeURIComponent(personnelAttention.self.missing_fields[0] ?? "")}`}
                        >
                          Complete My Profile
                          <ChevronRight size={15} />
                        </a>
                      </article>
                    </div>
                  ) : null}

                  {!personnelAttentionLoading &&
                    personnelAttention?.can_manage &&
                    personnelAttention.total_incomplete > 0 && (
                      <div className="real-attention-list">
                        {personnelAttention.teaching_count > 0 && (
                          <article className="real-attention-item warning">
                            <span className="real-attention-item-icon">
                              <CircleAlert size={18} />
                            </span>
                            <div className="real-attention-copy">
                              <div>
                                <strong>
                                  Teaching Personnel Profiles Incomplete
                                </strong>
                                <span className="real-attention-badge">
                                  {personnelAttention.teaching_count}
                                </span>
                              </div>
                              <p>
                                Required profile information is still missing
                                for these Teaching Personnel.
                              </p>
                              <div className="real-personnel-list">
                                {personnelAttention.incomplete_teaching
                                  .slice(0, 8)
                                  .map((person) => (
                                    <a
                                      key={person.id}
                                      className="real-personnel-action"
                                      href={`/portal/admin/teacher-profiles?teacher=${encodeURIComponent(person.id)}&field=${encodeURIComponent(person.missing_fields[0] ?? "")}`}
                                    >
                                      <strong>{person.full_name}</strong>
                                      <span>
                                        {person.position ||
                                          "Teaching Personnel"}
                                      </span>
                                      <small>
                                        Missing:{" "}
                                        {person.missing_fields.join(", ")}
                                      </small>
                                      <span className="real-personnel-open">
                                        Open Required Field{" "}
                                        <ChevronRight size={13} />
                                      </span>
                                    </a>
                                  ))}
                                {personnelAttention.teaching_count > 8 && (
                                  <small className="real-personnel-more">
                                    +{personnelAttention.teaching_count - 8}{" "}
                                    more Teaching Personnel
                                  </small>
                                )}
                              </div>
                            </div>
                            <a href="/portal/admin/teacher-profiles">
                              Open HR Profiles
                              <ChevronRight size={15} />
                            </a>
                          </article>
                        )}

                        {personnelAttention.non_teaching_count > 0 && (
                          <article className="real-attention-item warning">
                            <span className="real-attention-item-icon">
                              <CircleAlert size={18} />
                            </span>
                            <div className="real-attention-copy">
                              <div>
                                <strong>
                                  Non-Teaching Personnel Profiles Incomplete
                                </strong>
                                <span className="real-attention-badge">
                                  {personnelAttention.non_teaching_count}
                                </span>
                              </div>
                              <p>
                                Required profile information is still missing
                                for these Non-Teaching Personnel.
                              </p>
                              <div className="real-personnel-list">
                                {personnelAttention.incomplete_non_teaching
                                  .slice(0, 8)
                                  .map((person) => (
                                    <a
                                      key={person.id}
                                      className="real-personnel-action"
                                      href={`/portal/admin/non-teaching-profiles?personnel=${encodeURIComponent(person.id)}&field=${encodeURIComponent(person.missing_fields[0] ?? "")}`}
                                    >
                                      <strong>{person.full_name}</strong>
                                      <span>
                                        {person.position ||
                                          "Non-Teaching Personnel"}
                                      </span>
                                      <small>
                                        Missing:{" "}
                                        {person.missing_fields.join(", ")}
                                      </small>
                                      <span className="real-personnel-open">
                                        Open Required Field{" "}
                                        <ChevronRight size={13} />
                                      </span>
                                    </a>
                                  ))}
                                {personnelAttention.non_teaching_count > 8 && (
                                  <small className="real-personnel-more">
                                    +{personnelAttention.non_teaching_count - 8}{" "}
                                    more Non-Teaching Personnel
                                  </small>
                                )}
                              </div>
                            </div>
                          </article>
                        )}
                      </div>
                    )}
                </details>
              )}

            {(profile.role === "administrator" ||
              profile.role === "staff_administrator") &&
              (academicSetupAttentionLoading ||
                Boolean(
                  academicSetupAttention &&
                    (academicSetupAttention.unassigned_count > 0 ||
                      academicSetupAttention.unscheduled_count > 0),
                )) && (
                <details className="panel real-adviser-attention real-academic-setup-attention portal-attention-details">
                  <summary className="portal-attention-summary">
                    <div className="real-attention-heading">
                      <div className="real-attention-title">
                        <span className="real-attention-icon">
                          <Settings2 size={19} />
                        </span>
                        <div>
                          <h2>Academic Setup Attention</h2>
                          <p>
                            Subject Teacher assignments and class schedules that
                            still need Administrator action.
                          </p>
                        </div>
                      </div>
                      {!academicSetupAttentionLoading &&
                        academicSetupAttention && (
                          <span className="real-attention-count">
                            {academicSetupAttention.unassigned_count +
                              academicSetupAttention.unscheduled_count}{" "}
                            to review
                          </span>
                        )}
                    </div>
                  </summary>
                  {academicSetupAttentionLoading ? (
                    <div className="real-attention-loading">
                      Checking Subject Teacher assignments and schedules…
                    </div>
                  ) : academicSetupAttention ? (
                    <div className="real-attention-list">
                      {academicSetupAttention.unassigned_count > 0 && (
                        <article className="real-attention-item warning">
                          <span className="real-attention-item-icon">
                            <CircleAlert size={18} />
                          </span>
                          <div className="real-attention-copy">
                            <div>
                              <strong>Subject Teachers Not Assigned</strong>
                              <span className="real-attention-badge">
                                {academicSetupAttention.unassigned_count}
                              </span>
                            </div>
                            <p>
                              Active classes below still have a subject or TVE
                              major without an assigned Subject Teacher.
                            </p>
                            <div className="real-personnel-list">
                              {academicSetupAttention.unassigned
                                .slice(0, 10)
                                .map((item) => (
                                  <a
                                    key={item.key}
                                    className="real-personnel-action"
                                    href={`/portal/admin/teaching?focus=subject-teacher&grade=${item.grade_level}&section=${encodeURIComponent(item.section_id)}&subject=${encodeURIComponent(item.subject_id)}${item.major ? `&major=${encodeURIComponent(item.major)}` : ""}`}
                                  >
                                    <strong>
                                      {gradeLabel(item.grade_level)} · {item.section}
                                    </strong>
                                    <span>
                                      {item.subject}
                                      {item.major ? " · " + item.major : ""}
                                    </span>
                                    {item.teacher_name && (
                                      <small>
                                        Expected Teacher: {item.teacher_name}
                                      </small>
                                    )}
                                    <span className="real-personnel-open">
                                      Assign Teacher <ChevronRight size={13} />
                                    </span>
                                  </a>
                                ))}
                              {academicSetupAttention.unassigned_count > 10 && (
                                <small className="real-personnel-more">
                                  +
                                  {academicSetupAttention.unassigned_count - 10}{" "}
                                  more
                                </small>
                              )}
                            </div>
                          </div>
                          {academicSetupAttention.can_teach && (
                            <a href="/portal/admin/teaching">
                              Assign Teachers
                              <ChevronRight size={15} />
                            </a>
                          )}
                        </article>
                      )}

                      {academicSetupAttention.unscheduled_count > 0 && (
                        <article className="real-attention-item warning">
                          <span className="real-attention-item-icon">
                            <CalendarDays size={18} />
                          </span>
                          <div className="real-attention-copy">
                            <div>
                              <strong>Assigned Subjects Not Scheduled</strong>
                              <span className="real-attention-badge">
                                {academicSetupAttention.unscheduled_count}
                              </span>
                            </div>
                            <p>
                              These Subject Teacher assignments are active but
                              do not yet have any active Class Schedule entry.
                            </p>
                            <div className="real-personnel-list">
                              {academicSetupAttention.unscheduled
                                .slice(0, 10)
                                .map((item) => (
                                  <a
                                    key={item.key}
                                    className="real-personnel-action"
                                    href={`/portal/admin/schedules?view=section&grade=${item.grade_level}&section=${encodeURIComponent(item.section_id)}&assignment=${encodeURIComponent(item.key)}`}
                                  >
                                    <strong>
                                      {gradeLabel(item.grade_level)} · {item.section}
                                    </strong>
                                    <span>
                                      {item.subject}
                                      {item.major ? " · " + item.major : ""}
                                    </span>
                                    <small>
                                      {item.teacher_name ?? "Assigned Teacher"}
                                    </small>
                                    <span className="real-personnel-open">
                                      Add Schedule <ChevronRight size={13} />
                                    </span>
                                  </a>
                                ))}
                              {academicSetupAttention.unscheduled_count >
                                10 && (
                                <small className="real-personnel-more">
                                  +
                                  {academicSetupAttention.unscheduled_count -
                                    10}{" "}
                                  more
                                </small>
                              )}
                            </div>
                          </div>
                          {academicSetupAttention.can_schedule && (
                            <a href="/portal/admin/schedules">
                              Open Class Schedules
                              <ChevronRight size={15} />
                            </a>
                          )}
                        </article>
                      )}
                    </div>
                  ) : null}
                </details>
              )}

            {profile.role === "teacher" &&
              (adviserAttentionLoading || adviserSections.length > 0) && (
                <details className="panel real-adviser-attention portal-attention-details">
                  <summary className="portal-attention-summary">
                    <div className="real-attention-heading">
                      <div className="real-attention-title">
                        <span className="real-attention-icon">
                          <BellRing size={19} />
                        </span>
                        <div>
                          <h2>Adviser Attention</h2>
                          <p>
                            Important records that may need your action for your
                            advisory section.
                          </p>
                        </div>
                      </div>
                      {!adviserAttentionLoading && (
                        <span
                          className={
                            adviserAttention.totalAlertTypes > 0
                              ? "real-attention-count"
                              : "real-attention-count clear"
                          }
                        >
                          {adviserAttention.totalAlertTypes > 0
                            ? `${adviserAttention.totalAlertTypes} to review`
                            : "All Clear"}
                        </span>
                      )}
                    </div>
                  </summary>
                  {adviserAttentionLoading ? (
                    <div className="real-attention-loading">
                      Checking learner records, attendance, and grades…
                    </div>
                  ) : adviserAttention.alerts.length === 0 ? (
                    <div className="real-attention-clear">
                      <CheckCircle2 size={22} />
                      <div>
                        <strong>No Missing Adviser Data Detected</strong>
                        <span>
                          Your currently checked learner records and Adviser
                          tasks look complete.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="real-attention-list">
                      {adviserAttention.alerts.map((alert) => (
                        <article
                          className={`real-attention-item ${alert.severity}`}
                          key={alert.id}
                        >
                          <span className="real-attention-item-icon">
                            <CircleAlert size={18} />
                          </span>
                          <div className="real-attention-copy">
                            <div>
                              <strong>{alert.title}</strong>
                              <span className="real-attention-badge">
                                {alert.count}
                              </span>
                              {alert.administratorAction && (
                                <span className="real-attention-admin">
                                  Administrator Action
                                </span>
                              )}
                            </div>
                            <p>{alert.detail}</p>
                            {alert.learners && alert.learners.length > 0 && (
                              <div className="real-attention-learners">
                                {alert.learners.map((learner) => (
                                  <a
                                    className="real-attention-learner"
                                    href={learner.href}
                                    key={learner.studentId}
                                  >
                                    <div>
                                      <strong>{learner.fullName}</strong>
                                      <span>
                                        Grade {learner.gradeLevel} ·{" "}
                                        {learner.section}
                                        {learner.lrn
                                          ? ` · LRN ${learner.lrn}`
                                          : ""}
                                      </span>
                                      <small>
                                        Missing:{" "}
                                        {learner.missingFields.join(", ")}
                                      </small>
                                    </div>
                                    <span className="real-attention-open">
                                      Open Learner Record
                                      <ChevronRight size={14} />
                                    </span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                          {alert.href &&
                            alert.actionLabel &&
                            (!alert.learners ||
                              alert.learners.length === 0) && (
                              <a href={alert.href}>
                                {alert.actionLabel}
                                <ChevronRight size={15} />
                              </a>
                            )}
                        </article>
                      ))}
                    </div>
                  )}
                </details>
              )}

            <section className="panel real-profile-card">
              <div className="real-card-title">
                <span>
                  <UserRound size={18} />
                </span>
                <div>
                  <h2>Account Information</h2>
                  <p>Your verified portal identity</p>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Full Name</dt>
                  <dd>{profile.full_name}</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>{displayRole}</dd>
                </div>
                {profile.lrn && (
                  <div>
                    <dt>LRN</dt>
                    <dd>{profile.lrn}</dd>
                  </div>
                )}
                {profile.role === "student" && (
                  <div>
                    <dt>Grade & Section</dt>
                    <dd>
                      {academicContext?.grade_level != null
                        ? `${gradeLabel(academicContext.grade_level)}${academicContext.section ? ` · ${academicContext.section}` : " · Section not assigned"}`
                        : profile.grade_level != null
                          ? `${gradeLabel(profile.grade_level)}${profile.section ? ` · ${profile.section}` : " · Section not assigned"}`
                          : "Not Assigned yet"}
                    </dd>
                  </div>
                )}
                {profile.role === "student" && (
                  <div>
                    <dt>Sex</dt>
                    <dd>
                      {academicContext?.sex === "M"
                        ? "Male"
                        : academicContext?.sex === "F"
                          ? "Female"
                          : "Not recorded"}
                    </dd>
                  </div>
                )}
                {profile.role === "student" &&
                  academicContext?.grade_level &&
                  [8, 9, 10].includes(academicContext.grade_level) && (
                    <div>
                      <dt>Technical Vocational Education Major</dt>
                      <dd>{academicContext.tve_major || "Not Assigned Yet"}</dd>
                    </div>
                  )}
                {profile.role === "student" &&
                  academicContext?.grade_level &&
                  [11, 12].includes(academicContext.grade_level) && (
                    <>
                      <div>
                        <dt>Track</dt>
                        <dd>{shsTrackLabel(academicContext.shs_track)}</dd>
                      </div>
                      <div>
                        <dt>Strand</dt>
                        <dd>
                          {shsStrandLabel(academicContext.shs_strand_program)}
                        </dd>
                      </div>
                      {academicContext.grade_level === 11 && academicContext.shs_elective_group && (
                        <div><dt>Major</dt><dd>{electiveGroupLabel(academicContext.shs_elective_group)}</dd></div>
                      )}
                    </>
                  )}
                <div>
                  <dt>Email</dt>
                  <dd>{profile.email}</dd>
                </div>
              </dl>
            </section>

            {profile.role === "teacher" && (
              <section className="panel real-my-learners-dashboard">
                <div className="real-assignment-heading">
                  <div>
                    <h2>My Learners by Section</h2>
                    <p>
                      View-only rosters for the sections where you are assigned
                      as a Subject Teacher.
                    </p>
                  </div>
                  <a
                    className="real-my-learners-link"
                    href="/portal/my-learners"
                  >
                    Open Full Roster
                    <ChevronRight size={15} />
                  </a>
                </div>

                {teacherLearnersLoading ? (
                  <p className="real-assignment-empty">
                    Loading learner rosters…
                  </p>
                ) : teacherLearnerSections.length === 0 ? (
                  <p className="real-assignment-empty">
                    No active Subject Teacher learner rosters are assigned to
                    you yet.
                  </p>
                ) : (
                  <div className="real-my-learners-sections">
                    {teacherLearnerSections.map((section) => (
                      <details key={section.id}>
                        <summary>
                          <div>
                            <span>
                              {gradeLabel(section.grade_level)} · {section.name}
                            </span>
                            <strong>
                              {section.roster_note
                                ? "Current Grade 7 TVE rotation"
                                : (section.pending_tve_major_count ?? 0) > 0
                                  ? section.learner_count > 0
                                    ? `${section.learner_count} assigned · ${section.pending_tve_major_count} pending major`
                                    : `${section.section_enrollment_count ?? 0} in section · major pending`
                                  : `${section.learner_count} learner${section.learner_count === 1 ? "" : "s"}`}
                            </strong>
                          </div>
                          <div className="real-my-learners-subjects">
                            {section.subjects.slice(0, 3).map((subject) => (
                              <span key={subject.assignment_id}>
                                {subject.subject}
                                {subject.major ? ` · ${subject.major}` : ""}
                              </span>
                            ))}
                            {section.subjects.length > 3 && (
                              <span>+{section.subjects.length - 3} more</span>
                            )}
                          </div>
                        </summary>
                        <div className="real-my-learners-roster">
                          {section.roster_note &&
                          section.learners.length === 0 ? (
                            <p className="real-assignment-empty">
                              {section.roster_note}
                            </p>
                          ) : (
                            section.learners.map((learner, index) => (
                              <div key={learner.student_id}>
                                <span>{index + 1}</span>
                                <strong>{learner.full_name}</strong>
                                <small>
                                  {learner.lrn
                                    ? `LRN ${learner.lrn}`
                                    : "LRN Not Recorded"}
                                </small>
                              </div>
                            ))
                          )}
                        </div>
                        <a
                          className="real-my-learners-section-link"
                          href={`/portal/my-learners?section=${section.id}`}
                        >
                          Open {gradeLabel(section.grade_level)} · {section.name}
                          <ChevronRight size={14} />
                        </a>
                      </details>
                    ))}
                  </div>
                )}
              </section>
            )}

            {profile.role === "teacher" && (
              <section className="panel real-teacher-assignments">
                <div className="real-assignment-heading">
                  <div>
                    <h2>My Teaching Assignments</h2>
                    <p>
                      {academicContext?.school_year ?? "Current school year"}
                    </p>
                  </div>
                  <span className="tag blue">
                    {teacherAssignments.length} class
                    {teacherAssignments.length === 1 ? "" : "es"}
                  </span>
                </div>

                {teacherAssignmentsLoading ? (
                  <p className="real-assignment-empty">Loading assignments…</p>
                ) : teacherAssignments.length === 0 ? (
                  <p className="real-assignment-empty">
                    No active class assignments have been assigned to you yet.
                  </p>
                ) : (
                  <div className="real-assignment-list">
                    {teacherAssignments.slice(0, 6).map((assignment) => (
                      <article key={assignment.id}>
                        <div>
                          <span>
                            {gradeLabel(assignment.grade_level)} ·{" "}
                            {assignment.section}
                          </span>
                          <strong>
                            {assignment.subject}
                            {assignment.major ? ` · ${assignment.grade_level === 11 ? electiveGroupLabel(assignment.major) : assignment.major}` : ""}
                        {assignment.terms?.length ? ` · Term ${assignment.terms.join(", ")}` : ""}
                          </strong>
                        </div>
                        <span>
                          {assignment.roster_restricted ? "Learner group confirmation pending" : assignment.major &&
                          (assignment.pending_tve_major_count ?? 0) > 0
                            ? assignment.student_count > 0
                              ? `${assignment.student_count} assigned · ${assignment.pending_tve_major_count} pending major`
                              : `${assignment.section_student_count ?? 0} in section · major pending`
                            : `${assignment.student_count} student${assignment.student_count === 1 ? "" : "s"}`}
                        </span>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {page !== "Overview" &&
          !(profile.role === "teacher" && page === "Teaching assignments") &&
          !(profile.role === "teacher" && page === "School forms") &&
          !(
            (profile.role === "teacher" || profile.role === "student") &&
            page === "Class schedule"
          ) && <EmptySection page={page} role={profile.role} />}

        {profile.role === "teacher" && page === "School forms" && (
          <section className="panel real-school-forms-unavailable">
            {adviserSections.length === 0 ? (
              <div className="real-school-forms-warning">
                <span className="real-school-forms-icon">
                  <FileSpreadsheet size={22} />
                </span>
                <div>
                  <span className="real-school-forms-kicker">
                    SECTION ADVISER ACCESS
                  </span>
                  <h2>School Forms</h2>
                  <p>
                    SF2, SF9, and SF10 are available to active Section Advisers.
                    No active advisory section is assigned to this account.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="real-school-forms-warning">
                  <span className="real-school-forms-icon">
                    <FileSpreadsheet size={22} />
                  </span>
                  <div>
                    <span className="real-school-forms-kicker">
                      AVAILABLE NOW
                    </span>
                    <h2>School Forms</h2>
                    <p>
                      Use the official forms below for your current advisory
                      section.
                    </p>
                  </div>
                  <span className="real-school-forms-status">3 Available</span>
                </div>

                <div className="real-school-forms-list">
                  <article>
                    <strong>SF2 · Daily Attendance Report of Learners</strong>
                    <p>
                      Generate the monthly attendance report with Male/Female
                      daily totals, monthly summary, and learner remarks.
                    </p>
                    <a href="/portal/sf2" className="real-school-forms-status">
                      Open SF2
                    </a>
                  </article>

                  <article>
                    <strong>SF9 · Learner&apos;s Progress Report Card</strong>
                    <p>
                      Print one or two learner report cards on A4 landscape
                      using published grades and recorded attendance.
                    </p>
                    <a href="/portal/sf9" className="real-school-forms-status">
                      Open SF9
                    </a>
                  </article>

                  <article>
                    <strong>SF10 · Learner Permanent Record</strong>
                    <p>
                      View and print the permanent record of learners in your
                      current advisory section. Editing remains restricted to
                      authorized records personnel.
                    </p>
                    <a href="/portal/sf10" className="real-school-forms-status">
                      Open SF10
                    </a>
                  </article>
                </div>

                <div className="real-school-forms-note">
                  <FileSpreadsheet size={18} />
                  <span>
                    SF1, SF3, SF5, SF8, and the remaining School Forms are still
                    under development.
                  </span>
                </div>
              </>
            )}
          </section>
        )}

        {profile.role === "teacher" && page === "Teaching assignments" && (
          <section className="panel real-teacher-class-page">
            <div className="real-assignment-heading">
              <div>
                <h2>Assigned Classes</h2>
                <p>
                  These are the sections and subjects currently assigned to your
                  Teacher account.
                </p>
              </div>
            </div>

            {teacherAssignmentsLoading ? (
              <p className="real-assignment-empty">Loading assigned classes…</p>
            ) : teacherAssignments.length === 0 ? (
              <p className="real-assignment-empty">
                No active classes are assigned to you yet.
              </p>
            ) : (
              <div className="real-assignment-list full">
                {teacherAssignments.map((assignment) => (
                  <article key={assignment.id}>
                    <div>
                      <span>
                        {gradeLabel(assignment.grade_level)} · {assignment.section}
                      </span>
                      <strong>
                        {assignment.subject}
                        {assignment.major ? ` · ${assignment.grade_level === 11 ? electiveGroupLabel(assignment.major) : assignment.major}` : ""}
                        {assignment.terms?.length ? ` · Term ${assignment.terms.join(", ")}` : ""}
                      </strong>
                    </div>
                    <span>
                      {assignment.roster_restricted ? "Learner group confirmation pending" : assignment.major &&
                      (assignment.pending_tve_major_count ?? 0) > 0
                        ? assignment.student_count > 0
                          ? `${assignment.student_count} assigned · ${assignment.pending_tve_major_count} awaiting major`
                          : `${assignment.section_student_count ?? 0} learners in section · major assignment pending`
                        : `${assignment.student_count} enrolled student${assignment.student_count === 1 ? "" : "s"}`}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {(profile.role === "teacher" || profile.role === "student") &&
          page === "Class schedule" && (
            <section className="panel real-schedule-page">
              <div className="real-assignment-heading">
                <div>
                  <h2>Class Schedule</h2>
                  <p>
                    {academicContext?.school_year ?? "Current school year"} ·
                    official published class schedule
                  </p>
                </div>
                <div className="real-schedule-heading-actions">
                  <span className="tag blue">
                    {visibleClassSchedules.length} entr
                    {visibleClassSchedules.length === 1 ? "y" : "ies"}
                  </span>
                  {profile.role === "teacher" && (
                    <a
                      className="real-schedule-print-link"
                      href={`/portal/my-schedule/print?term=${selectedScheduleTerm}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Printer size={15} />
                      Print Schedule
                    </a>
                  )}
                </div>
              </div>

              {availableScheduleTerms.length > 0 && (
                <label>Term <select value={selectedScheduleTerm} onChange={event => setScheduleTerm(Number(event.target.value))}>
                  {availableScheduleTerms.map(term => <option key={term} value={term}>Term {term}</option>)}
                </select></label>
              )}
              {classSchedulesLoading ? (
                <p className="real-assignment-empty">Loading class schedule…</p>
              ) : visibleClassSchedules.length === 0 ? (
                <p className="real-assignment-empty">
                  No official class schedule has been published for your account
                  yet.
                </p>
              ) : (
                <div className="real-schedule-list">
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                    const dayEntries = visibleClassSchedules.filter(
                      (item) => item.day_of_week === day,
                    );
                    if (dayEntries.length === 0) return null;
                    const dayNames = [
                      "",
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                      "Sunday",
                    ];

                    return (
                      <div className="real-schedule-day" key={day}>
                        <h3>{dayNames[day]}</h3>
                        <div>
                          {dayEntries.map((entry) => (
                            <article
                              key={entry.id}
                              className={
                                entry.entry_type === "block"
                                  ? "real-schedule-block"
                                  : entry.entry_type === "rotation"
                                    ? "real-schedule-rotation"
                                    : undefined
                              }
                            >
                              <div className="real-schedule-time">
                                <strong>
                                  {new Date(
                                    `1970-01-01T${entry.start_time}`,
                                  ).toLocaleTimeString([], {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </strong>
                                <span>
                                  to{" "}
                                  {new Date(
                                    `1970-01-01T${entry.end_time}`,
                                  ).toLocaleTimeString([], {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <div>
                                <span>
                                  {gradeLabel(entry.grade_level)} ·{" "}
                                  {entry.section}
                                </span>
                                <strong>
                                  {entry.subject}
                                  {entry.major ? ` · ${entry.major}` : ""}
                                </strong>
                                <small>
                                  {entry.entry_type === "block"
                                    ? `${entry.purpose || "Non-instructional period"} · No class`
                                    : entry.entry_type === "rotation"
                                      ? `${entry.instructor || "TVE Instructor"} · ${entry.purpose || "Exploratory rotation"}`
                                      : entry.instructor
                                        ? entry.room
                                          ? `${entry.instructor} · ${entry.room}`
                                          : entry.instructor
                                        : entry.room || "Room not specified"}
                                </small>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

        <footer className="page-footer">
          <span>Asuncion National High School</span>
          <span>Academic Portal · Authenticated Workspace</span>
        </footer>
      </div>
    </main>
  );
}
