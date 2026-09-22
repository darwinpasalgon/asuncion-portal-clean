import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

async function validAccessToken(token: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  return response.ok;
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

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get("anhs-access-token")?.value;
  const refreshToken = request.cookies.get("anhs-refresh-token")?.value;

  if (accessToken && (await validAccessToken(accessToken))) {
    return NextResponse.next();
  }

  if (refreshToken) {
    const session = await refreshSession(refreshToken);

    if (session?.access_token && session?.refresh_token) {
      const response = NextResponse.next();
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

  const loginUrl = new URL("/", request.url);
  loginUrl.searchParams.set("reason", "signin");
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete("anhs-access-token");
  response.cookies.delete("anhs-refresh-token");
  return response;
}

export const config = {
  matcher: ["/portal/:path*"],
};
