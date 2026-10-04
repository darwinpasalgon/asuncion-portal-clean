import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

type AccessState = {
  valid: boolean;
  mustChangePassword: boolean;
  role: "student" | "teacher" | "administrator" | "staff_administrator" | null;
  accountStatus: string | null;
  permissions: string[];
};

async function accessState(token: string): Promise<AccessState> {
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!userResponse.ok) {
    return { valid: false, mustChangePassword: false, role: null, accountStatus: null, permissions: [] };
  }
  const user = await userResponse.json().catch(() => null);
  if (!user?.id) {
    return { valid: false, mustChangePassword: false, role: null, accountStatus: null, permissions: [] };
  }

  const profileResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=must_change_password,role,account_status&limit=1`,
    {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!profileResponse.ok) {
    return { valid: false, mustChangePassword: false, role: null, accountStatus: null, permissions: [] };
  }
  const profiles = await profileResponse.json().catch(() => []);
  const profile = profiles?.[0];
  let permissions: string[] = [];
  if (profile?.role === "staff_administrator") {
    const permissionResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/administrator_permissions?administrator_id=eq.${encodeURIComponent(
        user.id
      )}&select=permission&order=permission.asc`,
      {
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );
    if (permissionResponse.ok) {
      const rows = await permissionResponse.json().catch(() => []);
      permissions = (rows ?? [])
        .map((item: { permission?: string }) => String(item.permission ?? ""))
        .filter(Boolean);
    }
  }

  return {
    valid: profile?.account_status === "active" && Boolean(profile?.role),
    mustChangePassword: Boolean(profile?.must_change_password),
    role: profile?.role ?? null,
    accountStatus: profile?.account_status ?? null,
    permissions,
  };
}

async function refreshSession(refreshToken: string) {
  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    }
  );

  if (!response.ok) return null;
  return response.json();
}

const adminPagePermissions: Array<[string, string]> = [
  ["/portal/admin/accounts", "accounts.manage"],
  ["/portal/admin/users", "users.manage"],
  ["/portal/admin/masterlist", "bulk_import.manage"],
  ["/portal/admin/school-setup", "school_setup.manage"],
  ["/portal/admin/teaching", "teaching.manage"],
  ["/portal/admin/schedules", "schedules.manage"],
  ["/portal/admin/attendance", "attendance.manage"],
  ["/portal/admin/reports", "reports.view"],
  ["/portal/admin/password-resets", "password_resets.manage"],
  ["/portal/admin/sf10", "sf10.manage"],
  ["/portal/admin/teacher-profiles", "hr.manage"],
];

function delegatedPermissionFor(pathname: string) {
  return adminPagePermissions.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/")
  )?.[1] ?? null;
}

function destination(request: NextRequest, state: AccessState) {
  const pathname = request.nextUrl.pathname;
  const onChangePage = pathname === "/change-password";
  const onAdminPage = pathname.startsWith("/portal/admin/");

  const studentTeacherOnly =
    pathname === "/portal/grades" || pathname === "/portal/attendance";
  const teacherOnly =
    pathname === "/portal/teacher-profile" ||
    pathname === "/portal/my-students";
  const announcementsPage = pathname === "/portal/announcements";
  const resourcesPage = pathname === "/portal/resources";

  if (state.mustChangePassword && !onChangePage) {
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  if (!state.mustChangePassword && onChangePage) {
    return NextResponse.redirect(new URL("/portal", request.url));
  }

  if (
    studentTeacherOnly &&
    state.role !== "student" &&
    state.role !== "teacher"
  ) {
    const url = new URL("/portal", request.url);
    url.searchParams.set("reason", "forbidden");
    return NextResponse.redirect(url);
  }

  if (teacherOnly && state.role !== "teacher") {
    const url = new URL("/portal", request.url);
    url.searchParams.set("reason", "forbidden");
    return NextResponse.redirect(url);
  }

  if (
    announcementsPage &&
    state.role === "staff_administrator" &&
    !state.permissions.includes("announcements.manage")
  ) {
    const url = new URL("/portal", request.url);
    url.searchParams.set("reason", "forbidden");
    return NextResponse.redirect(url);
  }

  if (
    resourcesPage &&
    state.role === "staff_administrator" &&
    !state.permissions.includes("resources.manage")
  ) {
    const url = new URL("/portal", request.url);
    url.searchParams.set("reason", "forbidden");
    return NextResponse.redirect(url);
  }

  if (onAdminPage && state.role !== "administrator") {
    const requiredPermission = delegatedPermissionFor(pathname);
    const allowed =
      state.role === "staff_administrator" &&
      Boolean(requiredPermission) &&
      state.permissions.includes(String(requiredPermission));

    if (!allowed) {
      const url = new URL("/portal", request.url);
      url.searchParams.set("reason", "forbidden");
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get("anhs-access-token")?.value;
  const refreshToken = request.cookies.get("anhs-refresh-token")?.value;

  if (accessToken) {
    const state = await accessState(accessToken);
    if (state.valid) return destination(request, state);
  }

  if (refreshToken) {
    const session = await refreshSession(refreshToken);

    if (session?.access_token && session?.refresh_token) {
      const state = await accessState(session.access_token);
      if (state.valid) {
        const response = destination(request, state);
        const secure = process.env.NODE_ENV === "production";

        response.cookies.set("anhs-access-token", session.access_token, {
          httpOnly: true,
          secure,
          sameSite: "lax",
          path: "/",
          maxAge: Number(session.expires_in ?? 3600),
        });

        response.cookies.set("anhs-refresh-token", session.refresh_token, {
          httpOnly: true,
          secure,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 60,
        });

        return response;
      }
    }
  }

  const loginUrl = new URL("/", request.url);
  loginUrl.searchParams.set("reason", "signin");
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete("anhs-access-token");
  response.cookies.delete("anhs-refresh-token");
  return response;
}

export const config = {
  matcher: ["/portal/:path*", "/change-password"],
};
