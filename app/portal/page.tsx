"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Settings2,
  ShieldCheck,
  UserRound,
  UserRoundCheck,
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

type Role = "student" | "teacher" | "administrator";
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
};

type TeacherAssignment = {
  id: string;
  grade_level: number;
  section: string;
  subject: string;
  subject_code: string | null;
  student_count: number;
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
  subject_code: string | null;
};

type Profile = {
  id: string;
  full_name: string;
  email: string;
  lrn: string | null;
  grade_level: number | null;
  section: string | null;
  role: Role;
  requested_role: "student" | "teacher";
  account_status: "active";
  must_change_password: boolean;
};

const commonItems = {
  overview: { name: "Overview" as Page, icon: LayoutDashboard },
  grades: { name: "Grades" as Page, icon: GraduationCap },
  attendance: { name: "Attendance" as Page, icon: ClipboardCheck },
  schedule: { name: "Class schedule" as Page, icon: CalendarDays },
  announcements: { name: "Announcements" as Page, icon: Megaphone },
  resources: { name: "Learning resources" as Page, icon: FolderOpen },
  students: { name: "Students" as Page, icon: Users },
  setup: { name: "School setup" as Page, icon: Settings2 },
};

const navigation: Record<Role, { name: Page; icon: typeof LayoutDashboard }[]> = {
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
  administrator: [
    commonItems.overview,
    commonItems.students,
    commonItems.announcements,
    commonItems.resources,
  ],
};

const roleLabel: Record<Role, string> = {
  student: "Student",
  teacher: "Teacher",
  administrator: "Administrator",
};

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
}: {
  profile: Profile;
  page: Page;
  onPage: (page: Page) => void;
  schoolYear: string;
}) {
  const { setOpenMobile } = useSidebar();

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
      window.location.href = "/portal/admin/reports?tab=classlist";
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
          <span className="year-label">Authenticated workspace</span>
        </div>

        <p className="nav-label">WORKSPACE</p>
        <SidebarMenu>
          {navigation[profile.role].map((item) => (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton
                className="nav-button"
                isActive={page === item.name}
                onClick={() => go(item.name)}
              >
                <item.icon size={19} />
                <span>{item.name}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        {profile.role === "administrator" && (
          <>
            <p className="nav-label real-admin-label">ADMINISTRATION</p>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="nav-button"
                  onClick={() => {
                    window.location.href = "/portal/admin/accounts";
                  }}
                >
                  <Users size={19} />
                  <span>Account approvals</span>
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
                  <span>Users & accounts</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="nav-button"
                  onClick={() => {
                    window.location.href = "/portal/admin/masterlist";
                  }}
                >
                  <UserRoundCheck size={19} />
                  <span>Masterlist & activation</span>
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
                  <span>Password resets</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="nav-button"
                  onClick={() => {
                    window.location.href = "/portal/admin/school-setup";
                  }}
                >
                  <Settings2 size={19} />
                  <span>School setup</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="nav-button"
                  onClick={() => {
                    window.location.href = "/portal/admin/teaching";
                  }}
                >
                  <BookOpen size={19} />
                  <span>Subjects & teachers</span>
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
                  <span>Class schedules</span>
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
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="nav-button"
                  onClick={() => {
                    window.location.href = "/portal/admin/reports";
                  }}
                >
                  <BarChart3 size={19} />
                  <span>Reports & analytics</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </>
        )}

        <div className="side-tip">
          <ShieldCheck size={22} />
          <strong>Secure school access</strong>
          <p>Your portal access is based on your verified school account and assigned role.</p>
        </div>
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

        <div className="side-user">
          <span className="avatar">{initials(profile.full_name)}</span>
          <div>
            <strong>{profile.full_name}</strong>
            <span>{roleLabel[profile.role]}</span>
          </div>
        </div>
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
  const [page, setPage] = useState<Page>("Overview");
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([]);
  const [teacherAssignmentsLoading, setTeacherAssignmentsLoading] = useState(false);
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

          if (loadedProfile.role === "teacher") {
            setTeacherAssignmentsLoading(true);
            try {
              const assignmentResponse = await fetch("/api/academic/my-assignments", {
                cache: "no-store",
              });
              const assignmentResult = await assignmentResponse.json().catch(() => ({}));
              if (active && assignmentResponse.ok) {
                setTeacherAssignments(
                  (assignmentResult.assignments ?? []) as TeacherAssignment[]
                );
              }
            } finally {
              if (active) setTeacherAssignmentsLoading(false);
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

  const accountId = useMemo(() => {
    if (!profile) return "";
    return profile.role === "student" && profile.lrn
      ? `LRN ${profile.lrn}`
      : profile.email;
  }, [profile]);

  if (loading) {
    return (
      <main className="real-portal-loading">
        <img src="/school-logo.png" alt="" />
        <strong>Opening your academic portal…</strong>
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
              <span>{roleLabel[profile.role]}</span>
            </div>
          </div>
        </header>

        <div className="real-status-bar">
          <ShieldCheck size={16} />
          <span>
            Signed in as <strong>{roleLabel[profile.role]}</strong> · {accountId}
          </span>
        </div>

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
                  ? `Your verified ${roleLabel[profile.role].toLowerCase()} account is now connected to the portal.`
                  : "This module uses official records from the live academic database."}
              </p>
            </div>
            <div className="real-role-card">
              <UserRound size={18} />
              <div>
                <span>ACCOUNT ROLE</span>
                <strong>{roleLabel[profile.role]}</strong>
              </div>
            </div>
          </div>

          {page === "Overview" && (
            <div className="real-overview-grid">
              <section className="welcome-card real-welcome">
                <div>
                  <span className="tag">VERIFIED PORTAL ACCESS</span>
                  <h2>Your verified school account<br />is connected.</h2>
                  <p>
                    Your account role determines the school records, classes, and
                    administrative tools you are authorized to access in the portal.
                  </p>
                </div>
                <div className="academic-motif">
                  <img
                    className="hero-logo"
                    src="/school-logo.png"
                    alt="Asuncion National High School seal"
                  />
                  <span>ASUNCION NHS</span>
                  <small>Academic Portal</small>
                </div>
              </section>

              <section className="panel real-profile-card">
                <h2>Account information</h2>
                <dl>
                  <div><dt>Full name</dt><dd>{profile.full_name}</dd></div>
                  <div><dt>Role</dt><dd>{roleLabel[profile.role]}</dd></div>
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
                  <div><dt>Email</dt><dd>{profile.email}</dd></div>
                  <div><dt>Status</dt><dd><span className="tag">Active</span></dd></div>
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
                              {assignment.subject_code ? ` (${assignment.subject_code})` : ""}
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

              {profile.role === "administrator" && (
                <section className="panel real-admin-card">
                  <h2>Administrator tools</h2>
                  <p>These tools are connected to the live authentication database.</p>
                  <div>
                    <button onClick={() => (window.location.href = "/portal/admin/accounts")}>
                      <Users size={18} /> Account approvals
                    </button>
                    <button onClick={() => (window.location.href = "/portal/admin/password-resets")}>
                      <ShieldCheck size={18} /> Password reset requests
                    </button>
                    <button onClick={() => (window.location.href = "/portal/admin/school-setup")}>
                      <Settings2 size={18} /> School setup
                    </button>
                    <button onClick={() => (window.location.href = "/portal/admin/teaching")}>
                      <BookOpen size={18} /> Subjects & teachers
                    </button>
                    <button onClick={() => (window.location.href = "/portal/admin/schedules")}>
                      <CalendarDays size={18} /> Class schedules
                    </button>
                    <button onClick={() => (window.location.href = "/portal/admin/attendance")}>
                      <ClipboardCheck size={18} /> Attendance
                    </button>
                    <button onClick={() => (window.location.href = "/portal/admin/reports")}>
                      <BarChart3 size={18} /> Reports & analytics
                    </button>
                  </div>
                </section>
              )}

              <section className="panel real-next-card">
                <BookOpen size={28} />
                <h2>System status</h2>
                <p>
                  Core academic modules are connected: enrollment, subjects, Teacher
                  assignments, schedules, grades, attendance, announcements,
                  memorandums, learning resources, and Administrator reports.
                </p>
              </section>
            </div>
          )}

          {page !== "Overview" &&
            !(profile.role === "teacher" && page === "Students") &&
            !((profile.role === "teacher" || profile.role === "student") && page === "Class schedule") && (
              <EmptySection page={page} role={profile.role} />
            )}

          {profile.role === "teacher" && page === "Students" && (
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
                          {assignment.subject_code ? ` (${assignment.subject_code})` : ""}
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
                                    {entry.subject_code ? ` (${entry.subject_code})` : ""}
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
