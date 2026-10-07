"use client";

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
  LogOut,
  Megaphone,
  MessageCircle,
  Settings2,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

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
  admin_role: "super_administrator" | "registrar" | "content_administrator" | "school_administrator" | null;
  position: string | null;
  account_status: "active";
  must_change_password: boolean;
};

type NavigationItem = {
  name: Page;
  label: string;
  icon: typeof LayoutDashboard;
  group: string;
};

const commonItems = {
  overview: {
    name: "Overview" as Page,
    label: "Overview",
    icon: LayoutDashboard,
    group: "WORKSPACE",
  },
  grades: {
    name: "Grades" as Page,
    label: "Grades",
    icon: GraduationCap,
    group: "ACADEMICS",
  },
  attendance: {
    name: "Attendance" as Page,
    label: "Attendance",
    icon: ClipboardCheck,
    group: "ACADEMICS",
  },
  schedule: {
    name: "Class schedule" as Page,
    label: "Class Schedule",
    icon: CalendarDays,
    group: "ACADEMICS",
  },
  announcements: {
    name: "Announcements" as Page,
    label: "Announcements",
    icon: Megaphone,
    group: "COMMUNICATION",
  },
  resources: {
    name: "Learning resources" as Page,
    label: "Learning Resources",
    icon: FolderOpen,
    group: "COMMUNICATION",
  },
  students: {
    name: "Students" as Page,
    label: "My Students",
    icon: Users,
    group: "ADVISER TOOLS",
  },
  schoolForms: {
    name: "School forms" as Page,
    label: "School Forms",
    icon: FileSpreadsheet,
    group: "ADVISER TOOLS",
  },
  myLearners: {
    name: "My learners" as Page,
    label: "My Learners",
    icon: Users,
    group: "TEACHING",
  },
  teachingAssignments: {
    name: "Teaching assignments" as Page,
    label: "My Teaching Assignments",
    icon: BookOpen,
    group: "TEACHING",
  },
};

const navigation: Record<Role, NavigationItem[]> = {
  student: [
    commonItems.overview,
    commonItems.grades,
    commonItems.attendance,
    commonItems.schedule,
    commonItems.announcements,
    commonItems.resources,
  ],
  teacher: [
    commonItems.overview,
    commonItems.students,
    { ...commonItems.grades, group: "ADVISER TOOLS" },
    { ...commonItems.attendance, group: "ADVISER TOOLS" },
    commonItems.schoolForms,
    commonItems.myLearners,
    commonItems.teachingAssignments,
    { ...commonItems.schedule, group: "TEACHING" },
    { ...commonItems.resources, group: "TEACHING" },
    commonItems.announcements,
  ],
  administrator: [commonItems.overview],
  staff_administrator: [commonItems.overview],
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

function administratorLabel(profile: Profile, adminPermissions: string[] = []) {
  if (profile.role === "administrator") return "Super Administrator";
  if (profile.role !== "staff_administrator") return roleLabel[profile.role];
  if (profile.admin_role === "registrar") return "Registrar";
  if (profile.admin_role === "content_administrator") return "Content Administrator";
  if (adminPermissions.length === 1 && adminPermissions.includes("hr.manage")) {
    return "Human Resources";
  }
  return "School Administrator";
}

type DashboardAction = {
  label: string;
  description: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: string;
};

function DashboardHome({
  profile,
  displayRole,
  academicContext,
  adminPermissions,
  teacherAssignments,
  teacherLearnerSections,
  adviserSections,
  personnelAttention,
  academicSetupAttention,
  communityUnread,
}: {
  profile: Profile;
  displayRole: string;
  academicContext: AcademicContext | null;
  adminPermissions: string[];
  teacherAssignments: TeacherAssignment[];
  teacherLearnerSections: TeacherLearnerSection[];
  adviserSections: AdviserSection[];
  personnelAttention: PersonnelProfileAttention | null;
  academicSetupAttention: AcademicSetupAttention | null;
  communityUnread: number;
}) {
  const isSuperAdmin = profile.role === "administrator";
  const can = (permission: string) =>
    isSuperAdmin || adminPermissions.includes(permission);

  let actions: DashboardAction[] = [];

  if (profile.role === "student") {
    actions = [
      {
        label: "Grades",
        description: "View your published term grades.",
        href: "/portal/grades",
        icon: GraduationCap,
      },
      {
        label: "Attendance",
        description: "Check your attendance record.",
        href: "/portal/attendance",
        icon: ClipboardCheck,
      },
      {
        label: "Class Schedule",
        description: "See your weekly class timetable.",
        href: "/portal?open=schedule",
        icon: CalendarDays,
      },
      {
        label: "Announcements",
        description: "Read the latest school updates.",
        href: "/portal/announcements",
        icon: Megaphone,
      },
      {
        label: "Learning Resources",
        description: "Open files and learning materials.",
        href: "/portal/resources",
        icon: FolderOpen,
      },
      {
        label: "Community Chat",
        description: "Connect with the ANHS community.",
        href: "/portal/community",
        icon: MessageCircle,
        badge: communityUnread > 0 ? `${communityUnread > 99 ? "99+" : communityUnread} new` : undefined,
      },
    ];
  } else if (profile.role === "teacher") {
    actions = [
      ...(adviserSections.length > 0
        ? [
            {
              label: "My Students",
              description: "Manage your advisory class learners.",
              href: "/portal/my-students",
              icon: Users,
            },
            {
              label: "Grades",
              description: "Encode and publish adviser grades.",
              href: "/portal/grades",
              icon: GraduationCap,
            },
            {
              label: "Attendance",
              description: "Record and review class attendance.",
              href: "/portal/attendance",
              icon: ClipboardCheck,
            },
          ]
        : []),
      {
        label: "My Learners",
        description: "View learners in your assigned subjects.",
        href: "/portal/my-learners",
        icon: Users,
      },
      {
        label: "Teaching Assignments",
        description: "Review your subjects and sections.",
        href: "/portal?open=assignments",
        icon: BookOpen,
      },
      {
        label: "Class Schedule",
        description: "View your current teaching timetable.",
        href: "/portal?open=schedule",
        icon: CalendarDays,
      },
      {
        label: "Learning Resources",
        description: "Open or manage class materials.",
        href: "/portal/resources",
        icon: FolderOpen,
      },
      {
        label: "Announcements",
        description: "Read school announcements.",
        href: "/portal/announcements",
        icon: Megaphone,
      },
      {
        label: "Community Chat",
        description: "Connect with colleagues and learners.",
        href: "/portal/community",
        icon: MessageCircle,
        badge: communityUnread > 0 ? `${communityUnread > 99 ? "99+" : communityUnread} new` : undefined,
      },
    ];
  } else {
    actions = [
      ...(isSuperAdmin
        ? [
            {
              label: "Learner Management",
              description: "Manage learner records and enrollment.",
              href: "/portal/admin/learners",
              icon: GraduationCap,
            },
          ]
        : []),
      ...(can("teaching.manage")
        ? [
            {
              label: "Subjects & Teachers",
              description: "Manage subjects and teaching assignments.",
              href: "/portal/admin/teaching",
              icon: BookOpen,
            },
          ]
        : []),
      ...(can("schedules.manage")
        ? [
            {
              label: "Class Schedules",
              description: "Manage section and teacher schedules.",
              href: "/portal/admin/schedules",
              icon: CalendarDays,
            },
          ]
        : []),
      ...(can("attendance.manage")
        ? [
            {
              label: "Attendance",
              description: "Review attendance administration.",
              href: "/portal/admin/attendance",
              icon: ClipboardCheck,
            },
          ]
        : []),
      ...(can("sf10.manage")
        ? [
            {
              label: "SF10 Records",
              description: "Open permanent learner records.",
              href: "/portal/admin/sf10",
              icon: FileSpreadsheet,
            },
          ]
        : []),
      ...(can("users.manage")
        ? [
            {
              label: "Users & Accounts",
              description: "Manage Student and Personnel accounts.",
              href: "/portal/admin/users",
              icon: Users,
            },
          ]
        : []),
      ...(can("hr.manage")
        ? [
            {
              label: "Personnel Profiles",
              description: "Review HR and personnel information.",
              href: "/portal/admin/teacher-profiles",
              icon: UserRound,
            },
          ]
        : []),
      ...(can("announcements.manage")
        ? [
            {
              label: "Announcements",
              description: "Publish and manage school updates.",
              href: "/portal/announcements",
              icon: Megaphone,
            },
          ]
        : []),
      ...(can("reports.view")
        ? [
            {
              label: "Reports & Analytics",
              description: "Review school data and summaries.",
              href: "/portal/admin/reports",
              icon: BarChart3,
            },
          ]
        : []),
      ...(can("school_setup.manage")
        ? [
            {
              label: "School Setup",
              description: "Manage school years and sections.",
              href: "/portal/admin/school-setup",
              icon: Settings2,
            },
          ]
        : []),
      ...(can("resources.manage")
        ? [
            {
              label: "Learning Resources",
              description: "Manage shared learning materials.",
              href: "/portal/resources",
              icon: FolderOpen,
            },
          ]
        : []),
      {
        label: "Community Chat",
        description: "Open the school community chatroom.",
        href: "/portal/community",
        icon: MessageCircle,
        badge: communityUnread > 0 ? `${communityUnread > 99 ? "99+" : communityUnread} new` : undefined,
      },
    ];
  }

  const teacherSections = new Set(
    teacherAssignments.map((assignment) => `${assignment.grade_level}:${assignment.section}`)
  ).size;
  const rosterSections = teacherLearnerSections.length;

  const setupAttention =
    (academicSetupAttention?.unassigned_count ?? 0) +
    (academicSetupAttention?.unscheduled_count ?? 0);

  const personnelReview = personnelAttention?.can_manage
    ? personnelAttention.total_incomplete
    : personnelAttention?.self?.missing_fields.length ?? 0;

  return (
    <section className="panel real-dashboard-home">
      <div className="real-dashboard-heading">
        <div>
          <span className="real-dashboard-kicker">QUICK ACCESS</span>
          <h2>{profile.role === "student" ? "My School Day" : profile.role === "teacher" ? "My Teaching Workspace" : "Administration Workspace"}</h2>
          <p>The tools you use most are grouped here for faster access.</p>
        </div>
        <span className="real-dashboard-role">{displayRole}</span>
      </div>

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
                {academicContext?.grade_level
                  ? `Grade ${academicContext.grade_level}${academicContext.section ? ` · ${academicContext.section}` : ""}`
                  : "Not Assigned"}
              </strong>
            </div>
            <div>
              <span>{academicContext?.grade_level && [8, 9, 10].includes(academicContext.grade_level) ? "TVE Major" : "Account"}</span>
              <strong>
                {academicContext?.grade_level && [8, 9, 10].includes(academicContext.grade_level)
                  ? academicContext.tve_major || "Not Assigned Yet"
                  : "Active Student"}
              </strong>
            </div>
          </>
        ) : profile.role === "teacher" ? (
          <>
            <div>
              <span>Teaching Classes</span>
              <strong>{teacherAssignments.length}</strong>
            </div>
            <div>
              <span>Assigned Sections</span>
              <strong>{rosterSections || teacherSections}</strong>
            </div>
            <div>
              <span>Adviser Sections</span>
              <strong>{adviserSections.length}</strong>
            </div>
          </>
        ) : (
          <>
            <div>
              <span>Setup Items</span>
              <strong>{setupAttention}</strong>
            </div>
            <div>
              <span>Personnel To Review</span>
              <strong>{personnelReview}</strong>
            </div>
            <div>
              <span>School Year</span>
              <strong>{academicContext?.school_year ?? "Current"}</strong>
            </div>
          </>
        )}
      </div>

      <div className="real-dashboard-actions">
        {actions.map((action) => (
          <a key={action.label} href={action.href} className="real-dashboard-action">
            <span className="real-dashboard-action-icon">
              <action.icon size={19} />
            </span>
            <span className="real-dashboard-action-copy">
              <strong>{action.label}</strong>
              <small>{action.description}</small>
            </span>
            {action.badge && <span className="real-dashboard-action-badge">{action.badge}</span>}
            <ChevronRight className="real-dashboard-action-arrow" size={16} />
          </a>
        ))}
      </div>
    </section>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AN";
}

function SideNav({
  profile,
  page,
  onPage,
  schoolYear,
  adminPermissions,
  isAdviser,
  hasPersonnelProfile,
  communityUnread,
}: {
  profile: Profile;
  page: Page;
  onPage: (page: Page) => void;
  schoolYear: string;
  adminPermissions: string[];
  isAdviser: boolean;
  hasPersonnelProfile: boolean;
  communityUnread: number;
}) {
  const { setOpenMobile } = useSidebar();
  const visibleGroups = Array.from(
    new Set(
      navigation[profile.role]
        .filter(
          (item) =>
            !(
              profile.role === "teacher" &&
              item.group === "ADVISER TOOLS" &&
              !isAdviser
            )
        )
        .map((item) => item.group)
    )
  );

  function go(pageName: Page) {
    if (pageName === "Grades" && (profile.role === "teacher" || profile.role === "student")) {
      window.location.href = "/portal/grades";
      return;
    }

    if (pageName === "Attendance" && (profile.role === "teacher" || profile.role === "student")) {
      window.location.href = "/portal/attendance";
      return;
    }

    if (pageName === "Announcements") {
      window.location.href = "/portal/announcements";
      return;
    }

    if (pageName === "Learning resources") {
      window.location.href = "/portal/resources";
      return;
    }

    if (pageName === "Students" && profile.role === "teacher") {
      window.location.href = "/portal/my-students";
      return;
    }

    if (pageName === "My learners" && profile.role === "teacher") {
      window.location.href = "/portal/my-learners";
      return;
    }

    if (pageName === "Students" && profile.role === "administrator") {
      window.location.href = "/portal/admin/learners";
      return;
    }

    onPage(pageName);
    setOpenMobile(false);
  }

  return (
    <Sidebar>
      <SidebarHeader className="brand">
        <div className="brand-mark">
          <img src="/school-logo.png" alt="Asuncion National High School logo" />
        </div>
        <div>
          <strong>ASUNCION NHS</strong>
          <span>Academic Portal</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="side-content">
        <div className="school-year">
          <span>SCHOOL YEAR</span>
          <strong>{schoolYear}</strong>
        </div>

        {visibleGroups.map((group) => (
          <div className="nav-group-section" key={group}>
            <p className="nav-label">{group}</p>
            <SidebarMenu>
              {navigation[profile.role]
                .filter(
                  (item) =>
                    item.group === group &&
                    !(
                      profile.role === "teacher" &&
                      item.group === "ADVISER TOOLS" &&
                      !isAdviser
                    )
                )
                .map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      className="nav-button"
                      isActive={page === item.name}
                      onClick={() => go(item.name)}
                    >
                      <item.icon size={19} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </div>
        ))}

        <div className="nav-group-section">
          <p className="nav-label">MY COMMUNITY</p>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="nav-button"
                onClick={() => {
                  window.location.href = "/portal/community";
                }}
              >
                <MessageCircle size={19} />
                <span>Community Chat</span>
                {communityUnread > 0 && (
                  <span className="community-unread-badge">
                    {communityUnread > 99 ? "99+" : communityUnread}
                  </span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>

        {hasPersonnelProfile && (
          <div className="nav-group-section">
            <p className="nav-label">PROFILE</p>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="nav-button"
                  onClick={() => {
                    window.location.href = "/portal/teacher-profile";
                  }}
                >
                  <UserRound size={19} />
                  <span>{profile.role === "teacher" ? "My Teacher Profile" : "My Personnel Profile"}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        )}

        {(profile.role === "administrator" || profile.role === "staff_administrator") && (
          <>
            {(profile.role === "administrator" ||
              ["sf10.manage", "teaching.manage", "attendance.manage"].some((permission) =>
                adminPermissions.includes(permission)
              )) && (
              <div className="nav-group-section">
                <p className="nav-label">ACADEMIC MANAGEMENT</p>
                <SidebarMenu>
                  {profile.role === "administrator" && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className="nav-button"
                        onClick={() => {
                          window.location.href = "/portal/admin/learners";
                        }}
                      >
                        <GraduationCap size={19} />
                        <span>Learner Management</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {(profile.role === "administrator" || adminPermissions.includes("sf10.manage")) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className="nav-button"
                        onClick={() => {
                          window.location.href = "/portal/admin/sf10";
                        }}
                      >
                        <FileSpreadsheet size={19} />
                        <span>SF10 Records</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {(profile.role === "administrator" || adminPermissions.includes("teaching.manage")) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className="nav-button"
                        onClick={() => {
                          window.location.href = "/portal/admin/teaching";
                        }}
                      >
                        <BookOpen size={19} />
                        <span>Subjects & Teachers</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {(profile.role === "administrator" || adminPermissions.includes("attendance.manage")) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className="nav-button"
                        onClick={() => {
                          window.location.href = "/portal/admin/attendance";
                        }}
                      >
                        <ClipboardCheck size={19} />
                        <span>Attendance</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </div>
            )}

            {(profile.role === "administrator" || adminPermissions.includes("schedules.manage")) && (
              <div className="nav-group-section">
                <p className="nav-label">SCHEDULING</p>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton className="nav-button" onClick={() => {
                      window.location.href = "/portal/admin/schedules";
                    }}>
                      <CalendarDays size={19} />
                      <span>Class Schedules</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton className="nav-button" onClick={() => {
                      window.location.href = "/portal/admin/schedules?view=teacher";
                    }}>
                      <CalendarDays size={19} />
                      <span>Teacher Schedule</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </div>
            )}

            {(profile.role === "administrator" ||
              adminPermissions.includes("announcements.manage") ||
              adminPermissions.includes("resources.manage")) && (
              <div className="nav-group-section">
                <p className="nav-label">COMMUNICATION</p>
                <SidebarMenu>
                  {(profile.role === "administrator" || adminPermissions.includes("announcements.manage")) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className="nav-button"
                        onClick={() => go("Announcements")}
                      >
                        <Megaphone size={19} />
                        <span>Announcements</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {(profile.role === "administrator" || adminPermissions.includes("resources.manage")) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className="nav-button"
                        onClick={() => go("Learning resources")}
                      >
                        <FolderOpen size={19} />
                        <span>Learning Resources</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </div>
            )}

            {(profile.role === "administrator" ||
              ["users.manage", "accounts.manage", "password_resets.manage", "bulk_import.manage"].some((permission) =>
                adminPermissions.includes(permission)
              )) && (
              <div className="nav-group-section">
                <p className="nav-label">ACCOUNTS</p>
                <SidebarMenu>
                  {(profile.role === "administrator" || adminPermissions.includes("users.manage")) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className="nav-button"
                        onClick={() => {
                          window.location.href = "/portal/admin/users";
                        }}
                      >
                        <Users size={19} />
                        <span>Users & Accounts</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {(profile.role === "administrator" || adminPermissions.includes("accounts.manage")) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className="nav-button"
                        onClick={() => {
                          window.location.href = "/portal/admin/accounts";
                        }}
                      >
                        <Users size={19} />
                        <span>Account Approvals</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {(profile.role === "administrator" || adminPermissions.includes("password_resets.manage")) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className="nav-button"
                        onClick={() => {
                          window.location.href = "/portal/admin/password-resets";
                        }}
                      >
                        <ShieldCheck size={19} />
                        <span>Password Resets</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {(profile.role === "administrator" || adminPermissions.includes("bulk_import.manage")) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className="nav-button"
                        onClick={() => {
                          window.location.href = "/portal/admin/masterlist";
                        }}
                      >
                        <FileSpreadsheet size={19} />
                        <span>Bulk Account Import</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </div>
            )}

            {(profile.role === "administrator" || adminPermissions.includes("hr.manage")) && (
              <div className="nav-group-section">
                <p className="nav-label">PERSONNEL</p>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="nav-button"
                      onClick={() => {
                        window.location.href = "/portal/admin/teacher-profiles";
                      }}
                    >
                      <UserRound size={19} />
                      <span>Teacher HR Profiles</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {profile.role === "administrator" && (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          className="nav-button"
                          onClick={() => {
                            window.location.href = "/portal/admin/teacher-import";
                          }}
                        >
                          <UserRound size={19} />
                          <span>Teacher Profile Import</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          className="nav-button"
                          onClick={() => {
                            window.location.href = "/portal/admin/administrators";
                          }}
                        >
                          <ShieldCheck size={19} />
                          <span>Administrators</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </>
                  )}
                </SidebarMenu>
              </div>
            )}

            {(profile.role === "administrator" ||
              adminPermissions.includes("school_setup.manage") ||
              adminPermissions.includes("reports.view")) && (
              <div className="nav-group-section">
                <p className="nav-label">SYSTEM</p>
                <SidebarMenu>
                  {(profile.role === "administrator" || adminPermissions.includes("school_setup.manage")) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className="nav-button"
                        onClick={() => {
                          window.location.href = "/portal/admin/school-setup";
                        }}
                      >
                        <Settings2 size={19} />
                        <span>School Setup</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {(profile.role === "administrator" || adminPermissions.includes("reports.view")) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className="nav-button"
                        onClick={() => {
                          window.location.href = "/portal/admin/reports";
                        }}
                      >
                        <BarChart3 size={19} />
                        <span>Reports & Analytics</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </div>
            )}
          </>
        )}

      </SidebarContent>

      <SidebarFooter className="side-footer">
        <SidebarMenuButton
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/";
          }}
        >
          <LogOut size={18} />
          Sign Out
        </SidebarMenuButton>

      </SidebarFooter>
    </Sidebar>
  );
}

function EmptySection({ page, role }: { page: Page; role: Role }) {
  const descriptions: Record<Page, string> = {
    Overview: "Your account is connected. Academic records will appear here as each live module is configured.",
    Grades: role === "student"
      ? "No official grades are available in the portal yet."
      : "Grade encoding will be enabled after subjects, sections, and teaching assignments are configured.",
    Attendance: role === "student"
      ? "No official attendance records are available in the portal yet."
      : "Attendance recording will be enabled after class assignments are configured.",
    "Class schedule": "No official class schedule has been published in the portal yet.",
    Announcements: "No official portal announcements have been published yet.",
    "Learning resources": "No learning resources have been uploaded to the live portal yet.",
    Students: role === "administrator"
      ? "Student enrollment records will appear here after the academic database is configured."
      : "Your advisory students will appear here after a Section Adviser assignment is configured.",
    "My learners": "Your assigned class rosters are available from the dedicated My Learners page.",
    "Teaching assignments": "Your active Subject Teacher assignments will appear here.",
    "School forms": "School Forms are not available yet. This module is still under development.",
    "School setup": "School year, grade levels, sections, subjects, and assignments will be configured in the next phase.",
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [academicContext, setAcademicContext] = useState<AcademicContext | null>(null);
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [page, setPage] = useState<Page>("Overview");

  useEffect(() => {
    const open = new URLSearchParams(window.location.search).get("open");
    if (open === "schedule") setPage("Class schedule");
    if (open === "assignments") setPage("Teaching assignments");
  }, []);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([]);
  const [teacherAssignmentsLoading, setTeacherAssignmentsLoading] = useState(false);
  const [teacherLearnerSections, setTeacherLearnerSections] = useState<TeacherLearnerSection[]>([]);
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
  const [personnelAttention, setPersonnelAttention] = useState<PersonnelProfileAttention | null>(null);
  const [personnelAttentionLoading, setPersonnelAttentionLoading] = useState(false);
  const [academicSetupAttention, setAcademicSetupAttention] = useState<AcademicSetupAttention | null>(null);
  const [academicSetupAttentionLoading, setAcademicSetupAttentionLoading] = useState(false);
  const [communityUnread, setCommunityUnread] = useState(0);
  const [majorSaving, setMajorSaving] = useState("");
  const [classSchedules, setClassSchedules] = useState<ClassScheduleEntry[]>([]);
  const [classSchedulesLoading, setClassSchedulesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.profile) {
          if (response.status === 401) {
            window.location.href = "/";
            return;
          }
          throw new Error(result.error ?? "Unable to load your profile.");
        }

        if (active) {
          const loadedProfile = result.profile as Profile;
          setProfile(loadedProfile);
          setAcademicContext((result.academicContext ?? null) as AcademicContext | null);
          setAdminPermissions((result.adminPermissions ?? []) as string[]);

          if (loadedProfile.role !== "student") {
            setPersonnelAttentionLoading(true);
            try {
              const attentionResponse = await fetch("/api/teacher-profiles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "profile_attention" }),
                cache: "no-store",
              });
              const attentionResult = await attentionResponse.json().catch(() => ({}));
              if (active && attentionResponse.ok) {
                setPersonnelAttention(attentionResult as PersonnelProfileAttention);
              }
            } finally {
              if (active) setPersonnelAttentionLoading(false);
            }
          }

          if (
            loadedProfile.role === "administrator" ||
            loadedProfile.role === "staff_administrator"
          ) {
            setAcademicSetupAttentionLoading(true);
            try {
              const setupResponse = await fetch("/api/admin/academic-setup-attention", {
                cache: "no-store",
              });
              const setupResult = await setupResponse.json().catch(() => ({}));
              if (active && setupResponse.ok) {
                setAcademicSetupAttention(setupResult as AcademicSetupAttention);
              }
            } finally {
              if (active) setAcademicSetupAttentionLoading(false);
            }
          }

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
                fetch("/api/academic/my-assignments", { cache: "no-store" }),
                fetch("/api/academic/my-learners", { cache: "no-store" }),
                fetch("/api/academic/adviser-students", { cache: "no-store" }),
                fetch("/api/academic/adviser-attention", { cache: "no-store" }),
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
                  (assignmentResult.assignments ?? []) as TeacherAssignment[]
                );
              }
              if (active && learnersResponse.ok) {
                setTeacherLearnerSections(
                  (learnersResult.sections ?? []) as TeacherLearnerSection[]
                );
              }
              if (active && adviserResponse.ok) {
                setAdviserSections(
                  (adviserResult.sections ?? []) as AdviserSection[]
                );
                setAdviserLearners(
                  (adviserResult.learners ?? []) as AdviserLearner[]
                );
                setAdviserMajors(
                  (adviserResult.majors ?? []) as string[]
                );
              }
              if (active && attentionResponse.ok) {
                setAdviserAttention({
                  schoolDate: attentionResult.schoolDate,
                  isSchoolWeekday: attentionResult.isSchoolWeekday,
                  alerts: (attentionResult.alerts ?? []) as AdviserAttentionAlert[],
                  totalAlertTypes: Number(attentionResult.totalAlertTypes ?? 0),
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

          if (loadedProfile.role === "teacher" || loadedProfile.role === "student") {
            setClassSchedulesLoading(true);
            try {
              const scheduleResponse = await fetch("/api/academic/my-schedule", {
                cache: "no-store",
              });
              const scheduleResult = await scheduleResponse.json().catch(() => ({}));
              if (active && scheduleResponse.ok) {
                setClassSchedules(
                  (scheduleResult.schedules ?? []) as ClassScheduleEntry[]
                );
              }
            } finally {
              if (active) setClassSchedulesLoading(false);
            }
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load your profile.");
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

  useEffect(() => {
    if (!profile) return;

    let active = true;
    async function loadCommunityUnread() {
      try {
        const response = await fetch("/api/community?summary=1", {
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({}));
        if (active && response.ok) {
          setCommunityUnread(Number(result.unread_count ?? 0));
        }
      } catch {
        // Unread count is a non-blocking sidebar enhancement.
      }
    }

    void loadCommunityUnread();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadCommunityUnread();
      }
    }, 5000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadCommunityUnread();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [profile]);

  const displayRole = useMemo(
    () => (profile ? administratorLabel(profile, adminPermissions) : ""),
    [profile, adminPermissions]
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
        throw new Error(result.error ?? "Unable to update the learner TVE Major.");
      }

      setAdviserLearners((current) =>
        current.map((learner) =>
          learner.enrollment_id === enrollmentId
            ? { ...learner, tve_major: major || null }
            : learner
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update the learner TVE Major."
      );
    } finally {
      setMajorSaving("");
    }
  }

  if (loading) {
    return (
      <main className="real-portal-loading">
        <img src="/school-logo.png" alt="" />
        <strong>Opening Your Academic Portal…</strong>
        <div
          className="real-portal-loading-track"
          role="progressbar"
          aria-label="Loading Academic Portal"
          aria-valuetext="Loading"
        >
          <span className="real-portal-loading-bar" />
        </div>
        <span className="real-portal-loading-caption">Preparing Your Workspace</span>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="real-portal-loading">
        <ShieldCheck size={34} />
        <strong>We could not open your portal.</strong>
        <span>{error || "Please sign in again."}</span>
        <button onClick={() => (window.location.href = "/")}>Return to Sign In</button>
      </main>
    );
  }

  return (
    <SidebarProvider>
      <SideNav
        profile={profile}
        page={page}
        onPage={setPage}
        schoolYear={academicContext?.school_year ?? "2026–2027"}
        adminPermissions={adminPermissions}
        isAdviser={adviserSections.length > 0}
        hasPersonnelProfile={
          profile.role === "teacher" || Boolean(personnelAttention?.self)
        }
        communityUnread={communityUnread}
      />

      <main className="workspace">
        <header className="topbar">
          <div className="crumb">
            <SidebarTrigger />
            <span>Academic Portal</span>
            <span className="slash">/</span>
            <strong>{page}</strong>
          </div>

          <div className="real-user-badge">
            <div
              aria-hidden="true"
              style={{
                width: 38,
                height: 38,
                minWidth: 38,
                minHeight: 38,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                padding: 0,
                margin: 0,
                lineHeight: 1,
                textAlign: "center",
                boxSizing: "border-box",
                background: "#e3eee7",
                border: "1px solid #d5e3d9",
                color: "#386348",
                fontSize: "0.8rem",
                fontWeight: 700,
              }}
            >
              {initials(profile.full_name)}
            </div>
            <div>
              <strong>{profile.full_name}</strong>
              <span>{displayRole}</span>
            </div>
          </div>
        </header>


        <div className="page-wrap">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                ASUNCION NATIONAL HIGH SCHOOL · SCHOOL YEAR {academicContext?.school_year ?? "2026–2027"}
              </p>
              <h1>
                {page === "Overview" ? `Welcome, ${profile.full_name}.` : pageDisplayTitle(page, profile.role)}
              </h1>
              <p>
                {page === "Overview"
                  ? "Your academic information and school tools in one place."
                  : "This module uses official records from the live academic database."}
              </p>
            </div>
          </div>

          {page === "Overview" && (
            <div className="real-overview-grid">
              {profile.role !== "student" &&
                (personnelAttentionLoading ||
                  Boolean(personnelAttention?.self?.missing_fields?.length) ||
                  Boolean(personnelAttention?.can_manage && personnelAttention.total_incomplete > 0)) && (
                  <section className="panel real-adviser-attention real-personnel-attention">
                    <div className="real-attention-heading">
                      <div className="real-attention-title">
                        <span className="real-attention-icon">
                          <UserRound size={19} />
                        </span>
                        <div>
                          <h2>Personnel Profile Attention</h2>
                          <p>Required personnel information that still needs completion.</p>
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
                              Missing: {personnelAttention.self.missing_fields.join(", ")}
                            </p>
                          </div>
                          <a href={`/portal/teacher-profile?field=${encodeURIComponent(personnelAttention.self.missing_fields[0] ?? "")}`}>
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
                                  <strong>Teaching Personnel Profiles Incomplete</strong>
                                  <span className="real-attention-badge">
                                    {personnelAttention.teaching_count}
                                  </span>
                                </div>
                                <p>
                                  Required profile information is still missing for these Teaching Personnel.
                                </p>
                                <div className="real-personnel-list">
                                  {personnelAttention.incomplete_teaching.slice(0, 8).map((person) => (
                                    <a
                                      key={person.id}
                                      className="real-personnel-action"
                                      href={`/portal/admin/teacher-profiles?teacher=${encodeURIComponent(person.id)}&field=${encodeURIComponent(person.missing_fields[0] ?? "")}`}
                                    >
                                      <strong>{person.full_name}</strong>
                                      <span>{person.position || "Teaching Personnel"}</span>
                                      <small>Missing: {person.missing_fields.join(", ")}</small>
                                      <span className="real-personnel-open">Open Required Field <ChevronRight size={13} /></span>
                                    </a>
                                  ))}
                                  {personnelAttention.teaching_count > 8 && (
                                    <small className="real-personnel-more">
                                      +{personnelAttention.teaching_count - 8} more Teaching Personnel
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
                                  <strong>Non-Teaching Personnel Profiles Incomplete</strong>
                                  <span className="real-attention-badge">
                                    {personnelAttention.non_teaching_count}
                                  </span>
                                </div>
                                <p>
                                  Required profile information is still missing for these Non-Teaching Personnel.
                                </p>
                                <div className="real-personnel-list">
                                  {personnelAttention.incomplete_non_teaching.slice(0, 8).map((person) => (
                                    <div key={person.id}>
                                      <strong>{person.full_name}</strong>
                                      <span>{person.position || "Non-Teaching Personnel"}</span>
                                      <small>Missing: {person.missing_fields.join(", ")}</small>
                                    </div>
                                  ))}
                                  {personnelAttention.non_teaching_count > 8 && (
                                    <small className="real-personnel-more">
                                      +{personnelAttention.non_teaching_count - 8} more Non-Teaching Personnel
                                    </small>
                                  )}
                                </div>
                              </div>
                            </article>
                          )}
                        </div>
                      )}
                  </section>
                )}

              {(profile.role === "administrator" ||
                profile.role === "staff_administrator") &&
                (academicSetupAttentionLoading ||
                  Boolean(
                    academicSetupAttention &&
                      (academicSetupAttention.unassigned_count > 0 ||
                        academicSetupAttention.unscheduled_count > 0)
                  )) && (
                  <section className="panel real-adviser-attention real-academic-setup-attention">
                    <div className="real-attention-heading">
                      <div className="real-attention-title">
                        <span className="real-attention-icon">
                          <Settings2 size={19} />
                        </span>
                        <div>
                          <h2>Academic Setup Attention</h2>
                          <p>
                            Subject Teacher assignments and class schedules that still
                            need Administrator action.
                          </p>
                        </div>
                      </div>
                      {!academicSetupAttentionLoading && academicSetupAttention && (
                        <span className="real-attention-count">
                          {academicSetupAttention.unassigned_count +
                            academicSetupAttention.unscheduled_count}{" "}
                          to review
                        </span>
                      )}
                    </div>

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
                                Active classes below still have a subject or TVE major
                                without an assigned Subject Teacher.
                              </p>
                              <div className="real-personnel-list">
                                {academicSetupAttention.unassigned.slice(0, 10).map((item) => (
                                  <a
                                    key={item.key}
                                    className="real-personnel-action"
                                    href={`/portal/admin/teaching?focus=subject-teacher&grade=${item.grade_level}&section=${encodeURIComponent(item.section_id)}&subject=${encodeURIComponent(item.subject_id)}${item.major ? `&major=${encodeURIComponent(item.major)}` : ""}`}
                                  >
                                    <strong>
                                      Grade {item.grade_level} · {item.section}
                                    </strong>
                                    <span>
                                      {item.subject}
                                      {item.major ? " · " + item.major : ""}
                                    </span>
                                    {item.teacher_name && (
                                      <small>Expected Teacher: {item.teacher_name}</small>
                                    )}
                                    <span className="real-personnel-open">Assign Teacher <ChevronRight size={13} /></span>
                                  </a>
                                ))}
                                {academicSetupAttention.unassigned_count > 10 && (
                                  <small className="real-personnel-more">
                                    +{academicSetupAttention.unassigned_count - 10} more
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
                                These Subject Teacher assignments are active but do not
                                yet have any active Class Schedule entry.
                              </p>
                              <div className="real-personnel-list">
                                {academicSetupAttention.unscheduled.slice(0, 10).map((item) => (
                                  <a
                                    key={item.key}
                                    className="real-personnel-action"
                                    href={`/portal/admin/schedules?view=section&grade=${item.grade_level}&section=${encodeURIComponent(item.section_id)}&assignment=${encodeURIComponent(item.key)}`}
                                  >
                                    <strong>
                                      Grade {item.grade_level} · {item.section}
                                    </strong>
                                    <span>
                                      {item.subject}
                                      {item.major ? " · " + item.major : ""}
                                    </span>
                                    <small>{item.teacher_name ?? "Assigned Teacher"}</small>
                                    <span className="real-personnel-open">Add Schedule <ChevronRight size={13} /></span>
                                  </a>
                                ))}
                                {academicSetupAttention.unscheduled_count > 10 && (
                                  <small className="real-personnel-more">
                                    +{academicSetupAttention.unscheduled_count - 10} more
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
                  </section>
                )}

              {profile.role === "teacher" &&
                (adviserAttentionLoading || adviserSections.length > 0) && (
                  <section className="panel real-adviser-attention">
                    <div className="real-attention-heading">
                      <div className="real-attention-title">
                        <span className="real-attention-icon">
                          <BellRing size={19} />
                        </span>
                        <div>
                          <h2>Adviser Attention</h2>
                          <p>
                            Important records that may need your action for your advisory
                            section.
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
                            Your currently checked learner records and Adviser tasks look
                            complete.
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
                                          Grade {learner.gradeLevel} · {learner.section}
                                          {learner.lrn ? ` · LRN ${learner.lrn}` : ""}
                                        </span>
                                        <small>
                                          Missing: {learner.missingFields.join(", ")}
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
                              (!alert.learners || alert.learners.length === 0) && (
                                <a href={alert.href}>
                                  {alert.actionLabel}
                                  <ChevronRight size={15} />
                                </a>
                              )}
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                )}

              <section className="welcome-card real-welcome">
                <div className="real-welcome-copy">
                  <h2>Your school workspace,<br />ready when you are.</h2>
                  <p>
                    Access the records, classes, schedules, and tools available to your
                    verified {displayRole.toLowerCase()} account.
                  </p>

                </div>
                <div className="academic-motif real-academic-motif">
                  <div className="real-seal-frame">
                    <img
                      className="hero-logo"
                      src="/school-logo.png"
                      alt="Asuncion National High School seal"
                    />
                  </div>
                  <span>ASUNCION NHS</span>
                  <small>Academic Portal</small>
                </div>
              </section>

              <DashboardHome
                profile={profile}
                displayRole={displayRole}
                academicContext={academicContext}
                adminPermissions={adminPermissions}
                teacherAssignments={teacherAssignments}
                teacherLearnerSections={teacherLearnerSections}
                adviserSections={adviserSections}
                personnelAttention={personnelAttention}
                academicSetupAttention={academicSetupAttention}
                communityUnread={communityUnread}
              />

              <section className="panel real-profile-card">
                <div className="real-card-title">
                  <span><UserRound size={18} /></span>
                  <div>
                    <h2>Account Information</h2>
                    <p>Your verified portal identity</p>
                  </div>
                </div>
                <dl>
                  <div><dt>Full Name</dt><dd>{profile.full_name}</dd></div>
                  <div><dt>Role</dt><dd>{displayRole}</dd></div>
                  {profile.lrn && <div><dt>LRN</dt><dd>{profile.lrn}</dd></div>}
                  {profile.role === "student" && (
                    <div>
                      <dt>Grade & Section</dt>
                      <dd>
                        {academicContext?.grade_level
                          ? `Grade ${academicContext.grade_level}${academicContext.section ? ` · ${academicContext.section}` : " · Section not assigned"}`
                          : profile.grade_level
                            ? `Grade ${profile.grade_level}${profile.section ? ` · ${profile.section}` : " · Section not assigned"}`
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
                  <div><dt>Email</dt><dd>{profile.email}</dd></div>
                </dl>
              </section>

              {profile.role === "teacher" && (
                <section className="panel real-my-learners-dashboard">
                  <div className="real-assignment-heading">
                    <div>
                      <h2>My Learners by Section</h2>
                      <p>
                        View-only rosters for the sections where you are assigned as
                        a Subject Teacher.
                      </p>
                    </div>
                    <a className="real-my-learners-link" href="/portal/my-learners">
                      Open Full Roster
                      <ChevronRight size={15} />
                    </a>
                  </div>

                  {teacherLearnersLoading ? (
                    <p className="real-assignment-empty">Loading learner rosters…</p>
                  ) : teacherLearnerSections.length === 0 ? (
                    <p className="real-assignment-empty">
                      No active Subject Teacher learner rosters are assigned to you yet.
                    </p>
                  ) : (
                    <div className="real-my-learners-sections">
                      {teacherLearnerSections.map((section) => (
                        <details key={section.id}>
                          <summary>
                            <div>
                              <span>
                                Grade {section.grade_level} · {section.name}
                              </span>
                              <strong>
                                {section.learner_count} learner
                                {section.learner_count === 1 ? "" : "s"}
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
                            {section.learners.map((learner, index) => (
                              <div key={learner.student_id}>
                                <span>{index + 1}</span>
                                <strong>{learner.full_name}</strong>
                                <small>{learner.lrn ? `LRN ${learner.lrn}` : "LRN Not Recorded"}</small>
                              </div>
                            ))}
                          </div>
                          <a
                            className="real-my-learners-section-link"
                            href={`/portal/my-learners?section=${section.id}`}
                          >
                            Open Grade {section.grade_level} · {section.name}
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
                      <p>{academicContext?.school_year ?? "Current school year"}</p>
                    </div>
                    <span className="tag blue">
                      {teacherAssignments.length} class{teacherAssignments.length === 1 ? "" : "es"}
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
                            <span>Grade {assignment.grade_level} · {assignment.section}</span>
                            <strong>
                              {assignment.subject}
                              {assignment.major ? ` · ${assignment.major}` : ""}
                            </strong>
                          </div>
                          <span>
                            {assignment.student_count} student
                            {assignment.student_count === 1 ? "" : "s"}
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
            !((profile.role === "teacher" || profile.role === "student") && page === "Class schedule") && (
              <EmptySection page={page} role={profile.role} />
            )}

          {profile.role === "teacher" && page === "School forms" && (
            <section className="panel real-school-forms-unavailable">
              <div className="real-school-forms-warning">
                <span className="real-school-forms-icon">
                  <CircleAlert size={22} />
                </span>
                <div>
                  <span className="real-school-forms-kicker">MODULE STATUS</span>
                  <h2>School Forms are not available yet.</h2>
                  <p>
                    This module is still under development. The forms below are
                    planned for future Adviser access in the Academic Portal.
                  </p>
                </div>
                <span className="real-school-forms-status">Coming Soon</span>
              </div>

              <div className="real-school-forms-list">
                <article>
                  <strong>SF1 · School Register</strong>
                  <p>
                    Official master list of enrolled learners in the section,
                    including demographic and background information.
                  </p>
                </article>
                <article>
                  <strong>SF2 · Learner&apos;s Daily Class Attendance</strong>
                  <p>
                    Daily record of learner attendance, including presence and
                    absence information.
                  </p>
                </article>
                <article>
                  <strong>SF3 · Books Issued and Returned</strong>
                  <p>
                    Record of textbooks and instructional materials issued to and
                    returned by learners.
                  </p>
                </article>
                <article>
                  <strong>SF5 · Report on Promotion and Level of Proficiency</strong>
                  <p>
                    End-of-school-year report showing learner promotion, retention,
                    and proficiency status. Senior High School uses SF5A/SF5B
                    variants.
                  </p>
                </article>
                <article>
                  <strong>SF8 · Learner&apos;s Basic Health and Nutrition Profile</strong>
                  <p>
                    Learner health and nutrition record, including height, weight,
                    and BMI-related information.
                  </p>
                </article>
                <article>
                  <strong>SF9 · Learner&apos;s Progress Report Card</strong>
                  <p>
                    Learner report card showing academic performance and other
                    official progress information.
                  </p>
                </article>
                <article>
                  <strong>SF10 · Learner&apos;s Permanent Academic Record</strong>
                  <p>
                    Comprehensive cumulative academic record of the learner across
                    school years.
                  </p>
                </article>
              </div>

              <div className="real-school-forms-note">
                <FileSpreadsheet size={18} />
                <span>
                  No School Form can be generated or printed from the Adviser
                  account yet.
                </span>
              </div>
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
                        <span>Grade {assignment.grade_level} · {assignment.section}</span>
                        <strong>
                          {assignment.subject}
                          {assignment.major ? ` · ${assignment.major}` : ""}
                        </strong>
                      </div>
                      <span>
                        {assignment.student_count} enrolled student
                        {assignment.student_count === 1 ? "" : "s"}
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
                  <span className="tag blue">
                    {classSchedules.length} entr{classSchedules.length === 1 ? "y" : "ies"}
                  </span>
                </div>

                {classSchedulesLoading ? (
                  <p className="real-assignment-empty">Loading class schedule…</p>
                ) : classSchedules.length === 0 ? (
                  <p className="real-assignment-empty">
                    No official class schedule has been published for your account yet.
                  </p>
                ) : (
                  <div className="real-schedule-list">
                    {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                      const dayEntries = classSchedules.filter(
                        (item) => item.day_of_week === day
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
                                    {new Date(`1970-01-01T${entry.start_time}`).toLocaleTimeString([], {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}
                                  </strong>
                                  <span>
                                    to{" "}
                                    {new Date(`1970-01-01T${entry.end_time}`).toLocaleTimeString([], {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                                <div>
                                  <span>
                                    Grade {entry.grade_level ?? ""} · {entry.section}
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
    </SidebarProvider>
  );
}
