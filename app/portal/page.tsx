"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileSpreadsheet,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
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

type ClassScheduleEntry = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  grade_level: number | null;
  section: string;
  subject: string;
  major: string | null;
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
    label: "My Teaching Assignments",
    icon: Users,
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
    commonItems.grades,
    commonItems.attendance,
    commonItems.schedule,
    commonItems.announcements,
    commonItems.resources,
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
}: {
  profile: Profile;
  page: Page;
  onPage: (page: Page) => void;
  schoolYear: string;
  adminPermissions: string[];
}) {
  const { setOpenMobile } = useSidebar();
  const visibleGroups = Array.from(
    new Set(navigation[profile.role].map((item) => item.group))
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
                .filter((item) => item.group === group)
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

        {profile.role === "teacher" && (
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
                  <span>My Teacher Profile</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        )}

        {(profile.role === "administrator" || profile.role === "staff_administrator") && (
          <>
            {(profile.role === "administrator" || adminPermissions.includes("sf10.manage")) && (
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
                  {profile.role === "administrator" && (
                    <>
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
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          className="nav-button"
                          onClick={() => {
                            window.location.href = "/portal/admin/schedules";
                          }}
                        >
                          <CalendarDays size={19} />
                          <span>Class Schedules</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
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
                    </>
                  )}
                </SidebarMenu>
              </div>
            )}

            {profile.role === "administrator" && (
              <div className="nav-group-section">
                <p className="nav-label">COMMUNICATION</p>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="nav-button"
                      onClick={() => go("Announcements")}
                    >
                      <Megaphone size={19} />
                      <span>Announcements</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="nav-button"
                      onClick={() => go("Learning resources")}
                    >
                      <FolderOpen size={19} />
                      <span>Learning Resources</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </div>
            )}

            {(profile.role === "administrator" || adminPermissions.includes("hr.manage")) && (
              <div className="nav-group-section">
                <p className="nav-label">ACCOUNTS & PERSONNEL</p>
                <SidebarMenu>
                  {(profile.role === "administrator" || adminPermissions.includes("hr.manage")) && (
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
                  )}
                  {profile.role === "administrator" && (
                    <>
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
                            window.location.href = "/portal/admin/password-resets";
                          }}
                        >
                          <ShieldCheck size={19} />
                          <span>Password Resets</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </>
                  )}
                </SidebarMenu>
              </div>
            )}

            {profile.role === "administrator" && (
              <div className="nav-group-section">
                <p className="nav-label">SYSTEM</p>
                <SidebarMenu>
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
          Sign out
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
      : "Your assigned students will appear here after teaching assignments are configured.",
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
    "School setup": Settings2,
  };

  const Icon = icons[page];

  return (
    <section className="panel real-empty-panel">
      <Icon size={34} />
      <h2>{page}</h2>
      <p>{descriptions[page]}</p>
    </section>
  );
}

export default function PortalPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [academicContext, setAcademicContext] = useState<AcademicContext | null>(null);
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [page, setPage] = useState<Page>("Overview");
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([]);
  const [teacherAssignmentsLoading, setTeacherAssignmentsLoading] = useState(false);
  const [adviserSections, setAdviserSections] = useState<AdviserSection[]>([]);
  const [adviserLearners, setAdviserLearners] = useState<AdviserLearner[]>([]);
  const [adviserMajors, setAdviserMajors] = useState<string[]>([]);
  const [adviserLearnersLoading, setAdviserLearnersLoading] = useState(false);
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

          if (loadedProfile.role === "teacher") {
            setTeacherAssignmentsLoading(true);
            setAdviserLearnersLoading(true);
            try {
              const [assignmentResponse, adviserResponse] = await Promise.all([
                fetch("/api/academic/my-assignments", { cache: "no-store" }),
                fetch("/api/academic/adviser-students", { cache: "no-store" }),
              ]);
              const [assignmentResult, adviserResult] = await Promise.all([
                assignmentResponse.json().catch(() => ({})),
                adviserResponse.json().catch(() => ({})),
              ]);

              if (active && assignmentResponse.ok) {
                setTeacherAssignments(
                  (assignmentResult.assignments ?? []) as TeacherAssignment[]
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
            } finally {
              if (active) {
                setTeacherAssignmentsLoading(false);
                setAdviserLearnersLoading(false);
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
        <strong>Opening your academic portal…</strong>
        <div
          className="real-portal-loading-track"
          role="progressbar"
          aria-label="Loading academic portal"
          aria-valuetext="Loading"
        >
          <span className="real-portal-loading-bar" />
        </div>
        <span className="real-portal-loading-caption">Preparing your workspace</span>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="real-portal-loading">
        <ShieldCheck size={34} />
        <strong>We could not open your portal.</strong>
        <span>{error || "Please sign in again."}</span>
        <button onClick={() => (window.location.href = "/")}>Return to sign in</button>
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
                {page === "Overview" ? `Welcome, ${profile.full_name}.` : page}
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

              <section className="panel real-profile-card">
                <div className="real-card-title">
                  <span><UserRound size={18} /></span>
                  <div>
                    <h2>Account information</h2>
                    <p>Your verified portal identity</p>
                  </div>
                </div>
                <dl>
                  <div><dt>Full name</dt><dd>{profile.full_name}</dd></div>
                  <div><dt>Role</dt><dd>{displayRole}</dd></div>
                  {profile.lrn && <div><dt>LRN</dt><dd>{profile.lrn}</dd></div>}
                  {profile.role === "student" && (
                    <div>
                      <dt>Grade & section</dt>
                      <dd>
                        {academicContext?.grade_level
                          ? `Grade ${academicContext.grade_level}${academicContext.section ? ` · ${academicContext.section}` : " · Section not assigned"}`
                          : profile.grade_level
                            ? `Grade ${profile.grade_level}${profile.section ? ` · ${profile.section}` : " · Section not assigned"}`
                            : "Not assigned yet"}
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
                        <dt>TVE Major</dt>
                        <dd>{academicContext.tve_major || "Not assigned yet"}</dd>
                      </div>
                    )}
                  <div><dt>Email</dt><dd>{profile.email}</dd></div>
                </dl>
              </section>

              {profile.role === "teacher" && (
                <section className="panel real-teacher-assignments">
                  <div className="real-assignment-heading">
                    <div>
                      <h2>My teaching assignments</h2>
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
            !(profile.role === "teacher" && page === "Students") &&
            !((profile.role === "teacher" || profile.role === "student") && page === "Class schedule") && (
              <EmptySection page={page} role={profile.role} />
            )}

          {profile.role === "teacher" && page === "Students" && (
            <>
            <section className="panel real-teacher-class-page">
              <div className="real-assignment-heading">
                <div>
                  <h2>Assigned classes</h2>
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

            {(adviserLearnersLoading || adviserSections.length > 0) && (
              <section className="panel real-adviser-major-panel">
                <div className="real-assignment-heading">
                  <div>
                    <h2>Adviser TVE Major assignment</h2>
                    <p>
                      Set the Technical Vocational Education major for learners in your
                      Grade 8–10 advisory section.
                    </p>
                  </div>
                  <span className="tag blue">
                    {adviserLearners.filter((learner) => learner.tve_major).length}/
                    {adviserLearners.length} assigned
                  </span>
                </div>

                {adviserLearnersLoading ? (
                  <p className="real-assignment-empty">Loading adviser class…</p>
                ) : adviserLearners.length === 0 ? (
                  <p className="real-assignment-empty">
                    No active Grade 8–10 learners are enrolled in your advisory section.
                  </p>
                ) : (
                  <>
                    <div className="real-adviser-major-note">
                      Only the active Section Adviser can change these learner majors.
                      TVE teacher student counts update automatically from this selection.
                    </div>
                    <div className="real-adviser-major-list">
                      {adviserLearners.map((learner) => (
                        <div className="real-adviser-major-row" key={learner.enrollment_id}>
                          <div>
                            <span>
                              Grade {learner.grade_level} · {learner.section}
                            </span>
                            <strong>{learner.full_name}</strong>
                            <small>{learner.lrn ? `LRN ${learner.lrn}` : "LRN not recorded"}</small>
                          </div>
                          <label>
                            <span>TVE Major</span>
                            <select
                              value={learner.tve_major ?? ""}
                              disabled={majorSaving === learner.enrollment_id}
                              onChange={(event) =>
                                void saveLearnerMajor(
                                  learner.enrollment_id,
                                  event.target.value
                                )
                              }
                            >
                              <option value="">Not assigned</option>
                              {adviserMajors.map((major) => (
                                <option key={major} value={major}>{major}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}
            </>
          )}

          {(profile.role === "teacher" || profile.role === "student") &&
            page === "Class schedule" && (
              <section className="panel real-schedule-page">
                <div className="real-assignment-heading">
                  <div>
                    <h2>Class schedule</h2>
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
                              <article key={entry.id}>
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
                                  <small>{entry.room || "Room not specified"}</small>
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
            <span>Academic Portal · Authenticated workspace</span>
          </footer>
        </div>
      </main>
    </SidebarProvider>
  );
}
