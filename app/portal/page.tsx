"use client";

import { useEffect, useMemo, useState } from "react";
import {
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
          setProfile(result.profile as Profile);
          setAcademicContext((result.academicContext ?? null) as AcademicContext | null);
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
                  : "This live module will use official school records once its database is configured."}
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
                  <h2>Your real account<br />is connected.</h2>
                  <p>
                    The demonstration role switch and fictional academic records
                    have been removed. We can now build each live school module
                    on top of your authenticated identity.
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
                  </div>
                </section>
              )}

              <section className="panel real-next-card">
                <BookOpen size={28} />
                <h2>Next build phase</h2>
                <p>
                  School year, grade levels, sections, and student enrollment are now live.
                  The next phase is subjects and teacher assignments.
                </p>
              </section>
            </div>
          )}

          {page !== "Overview" && <EmptySection page={page} role={profile.role} />}

          <footer className="page-footer">
            <span>Asuncion National High School</span>
            <span>Academic Portal · Authenticated workspace</span>
          </footer>
        </div>
      </main>
    </SidebarProvider>
  );
}
