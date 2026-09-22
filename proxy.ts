import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

type AccessState = { valid: boolean; mustChangePassword: boolean };

async function accessState(token: string): Promise<AccessState> {
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!userResponse.ok) return { valid: false, mustChangePassword: false };
  const user = await userResponse.json().catch(() => null);
  if (!user?.id) return { valid: false, mustChangePassword: false };

  const profileResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=must_change_password&limit=1`,
    {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!profileResponse.ok) return { valid: false, mustChangePassword: false };
  const profiles = await profileResponse.json().catch(() => []);
  return {
    valid: true,
    mustChangePassword: Boolean(profiles?.[0]?.must_change_password),
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

function destination(request: NextRequest, state: AccessState) {
  const onChangePage = request.nextUrl.pathname === "/change-password";
  if (state.mustChangePassword && !onChangePage) {
    return NextResponse.redirect(new URL("/change-password", request.url));
  }
  if (!state.mustChangePassword && onChangePage) {
    return NextResponse.redirect(new URL("/portal", request.url));
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
