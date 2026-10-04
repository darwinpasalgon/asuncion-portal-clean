import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

type Profile = {
  id: string;
  full_name: string;
  role: "student" | "teacher" | "administrator" | "staff_administrator";
  account_status: string;
};

function headers(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function identity(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) return null;

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: headers(token),
    cache: "no-store",
  });
  if (!userResponse.ok) return null;

  const user = await userResponse.json().catch(() => null);
  const userId = String(user?.id ?? "");
  if (!userId) return null;

  const profileResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(
      userId
    )}&select=id,full_name,role,account_status&limit=1`,
    { headers: headers(token), cache: "no-store" }
  );
  const profiles = await profileResponse.json().catch(() => []);
  const profile = profiles?.[0] as Profile | undefined;

  if (!profile || profile.account_status !== "active" || !profile.role) {
    return null;
  }

  return { token, userId, profile };
}

async function rest(
  path: string,
  token: string,
  init: RequestInit = {}
) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...headers(token),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function GET(request: NextRequest) {
  const auth = await identity(request);
  if (!auth) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { token, userId, profile } = auth;
  const onlineSince = new Date(Date.now() - 60_000).toISOString();

  const [messagesResponse, presenceResponse, muteResponse] = await Promise.all([
    rest(
      "community_messages?select=id,user_id,sender_name,sender_role,body,created_at&order=created_at.desc&limit=100",
      token
    ),
    rest(
      `community_presence?last_seen=gte.${encodeURIComponent(
        onlineSince
      )}&select=user_id,display_name,role,last_seen&order=display_name.asc`,
      token
    ),
    rest(
      "community_mutes?select=user_id,muted_until,reason,created_by,created_at",
      token
    ),
  ]);

  if (!messagesResponse.ok || !presenceResponse.ok) {
    return NextResponse.json(
      { error: "Unable to load My Community." },
      { status: 500 }
    );
  }

  const messages = await messagesResponse.json().catch(() => []);
  const online = await presenceResponse.json().catch(() => []);
  const mutes = muteResponse.ok
    ? await muteResponse.json().catch(() => [])
    : [];

  const ownMute = (mutes ?? []).find(
    (item: { user_id?: string }) => item.user_id === userId
  );
  const activeMute =
    ownMute &&
    (!ownMute.muted_until ||
      new Date(String(ownMute.muted_until)).getTime() > Date.now())
      ? ownMute
      : null;

  return NextResponse.json({
    me: {
      id: userId,
      full_name: profile.full_name,
      role: profile.role,
      is_admin: profile.role === "administrator",
    },
    messages: (messages ?? []).reverse(),
    online: online ?? [],
    muted: activeMute,
    mutes: profile.role === "administrator" ? mutes ?? [] : [],
  });
}

export async function POST(request: NextRequest) {
  const auth = await identity(request);
  if (!auth) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { token, userId, profile } = auth;
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");

  if (action === "heartbeat") {
    const response = await rest(
      "community_presence?on_conflict=user_id",
      token,
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([
          {
            user_id: userId,
            display_name: profile.full_name,
            role: profile.role,
            last_seen: new Date().toISOString(),
          },
        ]),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to update online status." },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "leave") {
    const response = await rest(
      `community_presence?user_id=eq.${encodeURIComponent(userId)}`,
      token,
      { method: "DELETE", headers: { Prefer: "return=minimal" } }
    );
    return NextResponse.json({ ok: response.ok });
  }

  if (action === "send") {
    const message = String(body?.message ?? "").trim();
    if (!message || message.length > 1000) {
      return NextResponse.json(
        { error: "Message must contain 1 to 1000 characters." },
        { status: 400 }
      );
    }

    const response = await rest("community_messages", token, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([
        {
          user_id: userId,
          sender_name: profile.full_name,
          sender_role: profile.role,
          body: message,
        },
      ]),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const text = JSON.stringify(result).toLowerCase();
      const muted = text.includes("muted");
      const rateLimited = text.includes("rate limit");
      return NextResponse.json(
        {
          error: muted
            ? "You are temporarily muted from Community Chat."
            : rateLimited
              ? "You are sending messages too quickly. Please try again shortly."
              : "Unable to send the message.",
        },
        { status: muted ? 403 : 400 }
      );
    }

    return NextResponse.json({ ok: true, message: result?.[0] ?? null });
  }

  if (action === "delete") {
    const messageId = String(body?.messageId ?? "");
    if (!validUuid(messageId)) {
      return NextResponse.json({ error: "Invalid message." }, { status: 400 });
    }

    const response = await rest(
      `community_messages?id=eq.${encodeURIComponent(messageId)}`,
      token,
      { method: "DELETE", headers: { Prefer: "return=representation" } }
    );
    const deleted = await response.json().catch(() => []);

    if (!response.ok || !Array.isArray(deleted) || deleted.length === 0) {
      return NextResponse.json(
        { error: "You are not allowed to remove this message." },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "mute" || action === "unmute") {
    if (profile.role !== "administrator") {
      return NextResponse.json(
        { error: "Super Administrator access required." },
        { status: 403 }
      );
    }

    const targetUserId = String(body?.userId ?? "");
    if (!validUuid(targetUserId) || targetUserId === userId) {
      return NextResponse.json(
        { error: "Select a valid community member." },
        { status: 400 }
      );
    }

    if (action === "unmute") {
      const response = await rest(
        `community_mutes?user_id=eq.${encodeURIComponent(targetUserId)}`,
        token,
        { method: "DELETE", headers: { Prefer: "return=minimal" } }
      );
      return response.ok
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: "Unable to unmute this user." }, { status: 400 });
    }

    const minutes = Math.min(1440, Math.max(5, Number(body?.minutes ?? 60)));
    const reason = String(body?.reason ?? "").trim().slice(0, 300);
    const mutedUntil = new Date(Date.now() + minutes * 60_000).toISOString();

    const response = await rest("community_mutes?on_conflict=user_id", token, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([
        {
          user_id: targetUserId,
          muted_until: mutedUntil,
          reason: reason || "Community moderation",
          created_by: userId,
        },
      ]),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to mute this user." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, muted_until: mutedUntil });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
