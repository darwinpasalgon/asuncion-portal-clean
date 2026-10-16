/** Navigation is presentation only. Every destination retains its server access checks. */
export type PortalRole =
  | "student"
  | "teacher"
  | "administrator"
  | "staff_administrator";

export type NavigationAccess = {
  role: PortalRole;
  permissions: string[];
  isAdviser: boolean;
  hasPersonnelProfile: boolean;
  gradeLevelHead: number | null;
};

export type PortalFeature = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: string;
  keywords?: string;
};

export type PortalFeatureGroup = {
  id: string;
  label: string;
  description: string;
  icon: string;
  items: PortalFeature[];
};

export function portalNavigation(
  access: NavigationAccess,
): PortalFeatureGroup[] {
  const { role, isAdviser, hasPersonnelProfile, gradeLevelHead } = access;
  const admin = role === "administrator";
  const teacher = role === "teacher";
  const student = role === "student";
  const head = teacher && gradeLevelHead !== null;
  const can = (permission: string) =>
    admin ||
    (role === "staff_administrator" && access.permissions.includes(permission));
  const groups: PortalFeatureGroup[] = [];
  const group = (
    id: string,
    label: string,
    description: string,
    icon: string,
    items: Array<PortalFeature | false>,
  ) => {
    const available = items.filter((item): item is PortalFeature =>
      Boolean(item),
    );
    if (available.length)
      groups.push({ id, label, description, icon, items: available });
  };
  group("home", "Workspace", "Your school day at a glance", "home", [
    {
      id: "home",
      label: "Overview",
      description: "Quick access and items that need your attention.",
      href: "/portal",
      icon: "home",
      keywords: "dashboard home notifications alerts",
    },
  ]);
  group(
    "academics",
    student ? "My Academics" : "Academics",
    "Learners, classes and attendance",
    "book",
    [
      admin && {
        id: "learners",
        label: "Learner Management",
        description: "Manage enrollment and learner information.",
        href: "/portal/admin/learners",
        icon: "students",
      },
      teacher &&
        isAdviser && {
          id: "advisory",
          label: "My Advisory Class",
          description: "Update your advisory learners and their majors.",
          href: "/portal/my-students",
          icon: "students",
          keywords: "my students adviser TVE major STEM elective",
        },
      teacher && {
        id: "learners",
        label: "My Subject Learners",
        description: "View learners in your assigned subjects.",
        href: "/portal/my-learners",
        icon: "users",
        keywords: "my learners my students roster",
      },
      (student || teacher) && {
        id: "grades",
        label: student
          ? "My Grades"
          : isAdviser
            ? "Grades & Publishing"
            : "Subject Grades",
        description: student
          ? "View your published term grades."
          : isAdviser
            ? "Encode and publish your advisory class grades."
            : "View published grades for your assigned subjects.",
        href: "/portal/grades",
        icon: "grades",
        keywords: "grade entry publish term MAPEH",
      },
      (student || (teacher && isAdviser)) && {
        id: "attendance",
        label: student ? "My Attendance" : "Class Attendance",
        description: student
          ? "Review your attendance record."
          : "Record and correct daily learner attendance.",
        href: "/portal/attendance",
        icon: "attendance",
        keywords: "present absent morning afternoon",
      },
      (student || teacher) && {
        id: "schedule",
        label: "My Class Schedule",
        description: "View your weekly class timetable.",
        href: "/portal?open=schedule",
        icon: "calendar",
        keywords: "schedule timetable time",
      },
      teacher && {
        id: "assignments",
        label: "My Teaching Assignments",
        description: "Review your assigned subjects and sections.",
        href: "/portal?open=assignments",
        icon: "book",
        keywords: "load subjects teachers",
      },
      can("teaching.manage") && {
        id: "teaching",
        label: "Subjects & Teachers",
        description: "Assign advisers and subject teachers.",
        href: "/portal/admin/teaching",
        icon: "book",
        keywords: "assignment load adviser TVE major",
      },
      (can("schedules.manage") || head) && {
        id: "schedules",
        label: "Class Schedules",
        description: "Arrange schedules by section or teacher.",
        href: "/portal/admin/schedules",
        icon: "calendar",
        keywords: "teacher schedule timetable terms class program",
      },
      (can("attendance.manage") || head) && {
        id: "school-attendance",
        label: head
          ? `Grade ${gradeLevelHead} Attendance`
          : "School Attendance",
        description: "Review daily attendance across your assigned scope.",
        href: "/portal/admin/attendance",
        icon: "attendance",
      },
    ],
  );
  group(
    "records",
    "School Forms & Reports",
    "Print forms and review school records",
    "forms",
    [
      (admin ||
        (teacher && isAdviser) ||
        can("attendance.manage") ||
        can("reports.view")) && {
        id: "sf2",
        label: "SF2 · Monthly Attendance",
        description: "Prepare the monthly attendance report.",
        href: "/portal/sf2",
        icon: "forms",
        keywords: "school form 2 print",
      },
      (admin || (teacher && isAdviser)) && {
        id: "sf9",
        label: "SF9 · Report Cards",
        description: "Prepare and print learner report cards.",
        href: "/portal/sf9",
        icon: "forms",
        keywords: "school form 9 remarks grades print",
      },
      (can("sf10.manage") || (teacher && isAdviser)) && {
        id: "sf10",
        label: "SF10 · Permanent Records",
        description: "Manage permanent learner records.",
        href: teacher ? "/portal/sf10" : "/portal/admin/sf10",
        icon: "forms",
        keywords: "school form 10 registrar print",
      },
      (can("reports.view") || head) && {
        id: "reports",
        label: "Reports & Analytics",
        description: "Review school data and summaries.",
        href: "/portal/admin/reports",
        icon: "chart",
      },
      admin && {
        id: "readiness",
        label: "School Readiness",
        description: "Check the completeness of school records.",
        href: "/portal/admin/readiness",
        icon: "check",
      },
    ],
  );
  group(
    "personnel",
    "Personnel",
    "Staff records and service credits",
    "briefcase",
    [
      can("hr.manage") && {
        id: "teachers",
        label: "Teaching Personnel",
        description: "Review and update teacher profiles.",
        href: "/portal/admin/teacher-profiles",
        icon: "users",
        keywords: "HR teaching profile",
      },
      can("hr.manage") && {
        id: "non-teaching",
        label: "Non-Teaching Personnel",
        description: "Review non-teaching personnel profiles.",
        href: "/portal/admin/non-teaching-profiles",
        icon: "users",
        keywords: "HR staff profile",
      },
      can("hr.manage") && {
        id: "designations",
        label: "Designations & Promotions",
        description: "Manage personnel positions and designations.",
        href: "/portal/admin/personnel-designations",
        icon: "briefcase",
      },
      can("hr.manage") && {
        id: "credits",
        label: "Service Credits & Leave",
        description: "Manage service credits and wellness leave ledgers.",
        href: "/portal/admin/service-credits",
        icon: "attendance",
        keywords: "HR balance wellness leave",
      },
      admin && {
        id: "personnel-credentials",
        label: "Personnel Login Credentials",
        description: "Download login emails or generate eligible first-login credentials.",
        href: "/portal/admin/personnel-credentials",
        icon: "shield",
        keywords: "teacher staff first login username email password credentials CSV download",
      },
      admin && {
        id: "teacher-import",
        label: "Import Personnel Profiles",
        description: "Import teaching personnel information.",
        href: "/portal/admin/teacher-import",
        icon: "import",
        keywords: "bulk teacher profile import",
      },
    ],
  );
  group(
    "communication",
    "Communication",
    "Updates, resources and conversations",
    "message",
    [
      (student || teacher || can("announcements.manage")) && {
        id: "announcements",
        label: "Announcements & Memos",
        description: "Read school updates and official memos.",
        href: "/portal/announcements",
        icon: "megaphone",
        keywords: "news memo principal",
      },
      (student || teacher || can("resources.manage")) && {
        id: "resources",
        label: "Learning Resources",
        description: "Find shared learning files and materials.",
        href: "/portal/resources",
        icon: "folder",
      },
      {
        id: "community",
        label: "Community Chat",
        description: "Connect with your school community.",
        href: "/portal/community",
        icon: "message",
        keywords: "chatroom messages online",
      },
    ],
  );
  group(
    "administration",
    "Administration",
    "Accounts, access and school setup",
    "settings",
    [
      can("users.manage") && {
        id: "accounts",
        label: "Users & Accounts",
        description: "Manage student and personnel accounts.",
        href: "/portal/admin/users",
        icon: "users",
        keywords: "create account approvals login",
      },
      can("bulk_import.manage") && {
        id: "import",
        label: "Bulk Account Import",
        description: "Import accounts from school files.",
        href: "/portal/admin/masterlist",
        icon: "import",
        keywords: "SF1 excel student import",
      },
      can("password_resets.manage") && {
        id: "passwords",
        label: "Password Resets",
        description: "Review account recovery requests.",
        href: "/portal/admin/password-resets",
        icon: "shield",
      },
      admin && {
        id: "administrators",
        label: "Administrators & Access",
        description: "Manage administrator roles and permissions.",
        href: "/portal/admin/administrators",
        icon: "shield",
      },
      can("school_setup.manage") && {
        id: "setup",
        label: "School Setup",
        description: "Manage school years and class sections.",
        href: "/portal/admin/school-setup",
        icon: "settings",
        keywords: "year grade section",
      },
    ],
  );
  group(
    "personal",
    "My Account",
    "Your profile and personnel information",
    "user",
    [
      {
        id: "profile",
        label: "My Profile",
        description: "Manage your account details and display photo.",
        href: "/portal/profile",
        icon: "user",
        keywords: "photo password profile picture",
      },
      (teacher || (role === "staff_administrator" && hasPersonnelProfile)) && {
        id: "personnel-profile",
        label: teacher ? "My Teacher Profile" : "My Personnel Profile",
        description: "Complete your personal and employment information.",
        href: "/portal/teacher-profile",
        icon: "briefcase",
      },
      (teacher || role === "staff_administrator") && {
        id: "my-credits",
        label: "My Credits & Leave",
        description: "View your service credits and wellness leave balance.",
        href: "/portal/service-credits",
        icon: "attendance",
        keywords: "service credits wellness leave balance",
      },
    ],
  );
  return groups;
}

export function activePortalFeature(
  groups: PortalFeatureGroup[],
  pathname: string,
  search: string,
) {
  const params = new URLSearchParams(search);
  return groups
    .flatMap((group) => group.items.map((item) => ({ item, group })))
    .find(({ item }) => {
      const [path, query = ""] = item.href.split("?");
      if (path === "/portal")
        return (
          pathname === path &&
          (params.get("open") ?? "") ===
            (new URLSearchParams(query).get("open") ?? "")
        );
      return pathname === path || pathname.startsWith(path + "/");
    });
}

export function searchPortalFeatures(
  groups: PortalFeatureGroup[],
  query: string,
) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const text =
          `${group.label} ${item.label} ${item.description} ${item.keywords ?? ""}`.toLowerCase();
        return words.every((word) => text.includes(word));
      }),
    }))
    .filter((group) => group.items.length > 0);
}
