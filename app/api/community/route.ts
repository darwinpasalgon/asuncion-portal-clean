import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

type Role = "student" | "teacher" | "administrator" | "staff_administrator";
type RoomType = "school" | "grade" | "section";

type Profile = {
  id: string;
  full_name: string;
  role: Role;
  account_status: string;
};

type Room = {
  key: string;
  type: RoomType;
  label: string;
  description: string;
  grade_level: number | null;
  section_id: string | null;
  unread_count?: number;
};

type ReadState = {
  user_id: string;
  room_key: string;
  room_type: RoomType;
  grade_level: number | null;
  section_id: string | null;
  last_read_at: string;
  updated_at: string;
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

async function rest(path: string, token: string, init: RequestInit = {}) {
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

function roomKey(type: RoomType, gradeLevel: number | null, sectionId: string | null) {
  if (type === "school") return "school";
  if (type === "grade") return `grade:${gradeLevel}`;
  return `section:${sectionId}`;
}

function gradeLabel(gradeLevel: number, labels: Map<number, string>) {
  return labels.get(gradeLevel) ?? (gradeLevel === 0 ? "ALS A&E" : `Grade ${gradeLevel}`);
}

async function activeSchoolYearId(token: string) {
  const response = await rest(
    "school_years?is_active=eq.true&select=id&order=start_year.desc&limit=1",
    token
  );
  const rows = response.ok ? await response.json().catch(() => []) : [];
  return String(rows?.[0]?.id ?? "");
}

async function accessibleRooms(
  token: string,
  userId: string,
  profile: Profile
): Promise<Room[]> {
  const [gradesResponse, sectionsResponse] = await Promise.all([
    rest(
      "grade_levels?select=grade_level,label,sort_order&order=sort_order.asc,grade_level.asc",
      token
    ),
    rest(
      "sections?is_active=eq.true&select=id,grade_level,name&order=grade_level.asc,name.asc",
      token
    ),
  ]);

  const grades = gradesResponse.ok
    ? ((await gradesResponse.json().catch(() => [])) as Array<{
        grade_level: number;
        label: string;
      }>)
    : [];
  const sections = sectionsResponse.ok
    ? ((await sectionsResponse.json().catch(() => [])) as Array<{
        id: string;
        grade_level: number;
        name: string;
      }>)
    : [];

  const labels = new Map(
    grades.map((item) => [Number(item.grade_level), String(item.label)] as const)
  );
  const allowedGrades = new Set<number>();
  const allowedSections = new Set<string>();

  if (profile.role === "administrator") {
    for (const grade of grades) allowedGrades.add(Number(grade.grade_level));
    for (const section of sections) allowedSections.add(section.id);
  } else {
    const schoolYearId = await activeSchoolYearId(token);

    if (schoolYearId && profile.role === "student") {
      const response = await rest(
        `student_enrollments?student_id=eq.${encodeURIComponent(
          userId
        )}&school_year_id=eq.${encodeURIComponent(
          schoolYearId
        )}&enrollment_status=eq.active&select=grade_level,section_id`,
        token
      );
      const rows = response.ok ? await response.json().catch(() => []) : [];
      for (const row of rows ?? []) {
        const grade = Number(row.grade_level);
        if (Number.isInteger(grade)) allowedGrades.add(grade);
        if (row.section_id) allowedSections.add(String(row.section_id));
      }
    }

    if (schoolYearId && profile.role === "teacher") {
      const [assignmentsResponse, adviserResponse, headResponse] =
        await Promise.all([
          rest(
            `teacher_assignments?school_year_id=eq.${encodeURIComponent(
              schoolYearId
            )}&is_active=eq.true&select=grade_level,section_id`,
            token
          ),
          rest(
            `section_advisers?school_year_id=eq.${encodeURIComponent(
              schoolYearId
            )}&is_active=eq.true&select=section_id`,
            token
          ),
          rest(
            `grade_level_heads?profile_id=eq.${encodeURIComponent(
              userId
            )}&select=grade_level`,
            token
          ),
        ]);

      const assignments = assignmentsResponse.ok
        ? await assignmentsResponse.json().catch(() => [])
        : [];
      const adviserRows = adviserResponse.ok
        ? await adviserResponse.json().catch(() => [])
        : [];
      const headRows = headResponse.ok
        ? await headResponse.json().catch(() => [])
        : [];

      for (const row of assignments ?? []) {
        const grade = Number(row.grade_level);
        if (Number.isInteger(grade)) allowedGrades.add(grade);
      }

      for (const row of adviserRows ?? []) {
        if (row.section_id) allowedSections.add(String(row.section_id));
      }

      for (const row of headRows ?? []) {
        const grade = Number(row.grade_level);
        if (Number.isInteger(grade)) allowedGrades.add(grade);
      }

      for (const section of sections) {
        if (allowedSections.has(section.id)) {
          allowedGrades.add(Number(section.grade_level));
        }
      }
    }
  }

  const rooms: Room[] = [
    {
      key: "school",
      type: "school",
      label: "School-Wide",
      description: "All active ANHS portal members",
      grade_level: null,
      section_id: null,
    },
  ];

  for (const grade of grades) {
    const level = Number(grade.grade_level);
    if (!allowedGrades.has(level)) continue;
    const label = gradeLabel(level, labels);
    rooms.push({
      key: roomKey("grade", level, null),
      type: "grade",
      label,
      description: `${label} grade-wide chat`,
      grade_level: level,
      section_id: null,
    });
  }

  for (const section of sections) {
    if (!allowedSections.has(section.id)) continue;
    const level = Number(section.grade_level);
    const grade = gradeLabel(level, labels);
    rooms.push({
      key: roomKey("section", level, section.id),
      type: "section",
      label: section.name,
      description: `${grade} · ${section.name}`,
      grade_level: level,
      section_id: section.id,
    });
  }

  return rooms;
}

function roomParams(room: Room) {
  return {
    room_type: room.type,
    grade_level: room.grade_level,
    section_id: room.section_id,
  };
}

async function unreadCounts(token: string) {
  const response = await rest("rpc/community_room_unread_counts", token, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!response.ok) return new Map<string, number>();

  const rows = (await response.json().catch(() => [])) as Array<{
    room_type: RoomType;
    grade_level: number | null;
    section_id: string | null;
    unread_count: number | string;
  }>;

  return new Map(
    (rows ?? []).map((row) => [
      roomKey(row.room_type, row.grade_level, row.section_id),
      Number(row.unread_count) || 0,
    ])
  );
}

async function ensureReadState(
  token: string,
  userId: string,
  room: Room
): Promise<ReadState | null> {
  const currentResponse = await rest(
    `community_room_read_state?user_id=eq.${encodeURIComponent(
      userId
    )}&room_key=eq.${encodeURIComponent(
      room.key
    )}&select=user_id,room_key,room_type,grade_level,section_id,last_read_at,updated_at&limit=1`,
    token
  );
  const current = currentResponse.ok
    ? await currentResponse.json().catch(() => [])
    : [];

  if (current?.[0]) return current[0] as ReadState;

  const now = new Date().toISOString();
  const insertResponse = await rest(
    "community_room_read_state?on_conflict=user_id,room_key",
    token,
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify([
        {
          user_id: userId,
          ...roomParams(room),
          last_read_at: now,
          updated_at: now,
        },
      ]),
    }
  );
  if (!insertResponse.ok) return null;
  const inserted = await insertResponse.json().catch(() => []);
  return (inserted?.[0] as ReadState | undefined) ?? null;
}

function roomFilter(room: Room) {
  if (room.type === "school") return "room_type=eq.school";
  if (room.type === "grade") {
    return `room_type=eq.grade&grade_level=eq.${room.grade_level}`;
  }
  return `room_type=eq.section&section_id=eq.${encodeURIComponent(
    room.section_id ?? ""
  )}`;
}

export async function GET(request: NextRequest) {
  const auth = await identity(request);
  if (!auth) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { token, userId, profile } = auth;
  const counts = await unreadCounts(token);
  const totalUnread = Array.from(counts.values()).reduce(
    (sum, value) => sum + value,
    0
  );

  if (request.nextUrl.searchParams.get("summary") === "1") {
    return NextResponse.json({ unread_count: totalUnread });
  }

  const rooms = await accessibleRooms(token, userId, profile);
  const requestedRoom = request.nextUrl.searchParams.get("room") ?? "school";
  const selectedRoom =
    rooms.find((room) => room.key === requestedRoom) ?? rooms[0]!;

  const readState = await ensureReadState(token, userId, selectedRoom);
  const lastReadAt = readState?.last_read_at ?? new Date().toISOString();
  const onlineSince = new Date(Date.now() - 60_000).toISOString();

  const requests = [
    rest(
      `community_messages?${roomFilter(
        selectedRoom
      )}&select=id,user_id,sender_name,sender_role,body,room_type,grade_level,section_id,created_at&order=created_at.desc&limit=100`,
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
  ];

  if (profile.role === "administrator") {
    requests.push(
      rest(
        "community_reports?status=eq.pending&select=id,message_id,reported_user_id,reporter_id,reporter_name,sender_name,sender_role,message_body,reason,status,room_type,grade_level,section_id,created_at&order=created_at.desc&limit=50",
        token
      )
    );
  }

  const responses = await Promise.all(requests);
  const [messagesResponse, presenceResponse, muteResponse, reportsResponse] =
    responses;

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
  const rawReports =
    profile.role === "administrator" && reportsResponse?.ok
      ? await reportsResponse.json().catch(() => [])
      : [];

  const visibleUserIds = Array.from(
    new Set<string>([
      userId,
      ...(messages ?? []).map((item: { user_id?: string }) =>
        String(item.user_id ?? "")
      ),
      ...(online ?? []).map((item: { user_id?: string }) =>
        String(item.user_id ?? "")
      ),
    ].filter(Boolean))
  );

  const photoResponse =
    visibleUserIds.length > 0
      ? await rest(
          `profile_photos?user_id=in.(${visibleUserIds
            .map((id) => encodeURIComponent(id))
            .join(",")})&select=user_id,updated_at`,
          token
        )
      : null;
  const photoRows = photoResponse?.ok
    ? await photoResponse.json().catch(() => [])
    : [];
  const photoMap = new Map<string, string>(
    (photoRows ?? []).map((item: { user_id: string; updated_at: string }) => [
      String(item.user_id),
      String(item.updated_at),
    ])
  );

  const messagesWithPhotos = (messages ?? []).map(
    (item: { user_id: string; [key: string]: unknown }) => ({
      ...item,
      has_profile_photo: photoMap.has(String(item.user_id)),
      profile_photo_updated_at: photoMap.get(String(item.user_id)) ?? null,
    })
  );
  const onlineWithPhotos = (online ?? []).map(
    (item: { user_id: string; [key: string]: unknown }) => ({
      ...item,
      has_profile_photo: photoMap.has(String(item.user_id)),
      profile_photo_updated_at: photoMap.get(String(item.user_id)) ?? null,
    })
  );

  const ownMute = (mutes ?? []).find(
    (item: { user_id?: string }) => item.user_id === userId
  );
  const activeMute =
    ownMute &&
    (!ownMute.muted_until ||
      new Date(String(ownMute.muted_until)).getTime() > Date.now())
      ? ownMute
      : null;

  const roomMap = new Map(rooms.map((room) => [room.key, room] as const));
  const reports = (rawReports ?? []).map(
    (report: {
      room_type: RoomType;
      grade_level: number | null;
      section_id: string | null;
      [key: string]: unknown;
    }) => {
      const key = roomKey(
        report.room_type,
        report.grade_level,
        report.section_id
      );
      return {
        ...report,
        room_key: key,
        room_label: roomMap.get(key)?.description ?? "Community Chat",
      };
    }
  );

  return NextResponse.json({
    me: {
      id: userId,
      full_name: profile.full_name,
      role: profile.role,
      is_admin: profile.role === "administrator",
      has_profile_photo: photoMap.has(userId),
      profile_photo_updated_at: photoMap.get(userId) ?? null,
    },
    room: selectedRoom,
    rooms: rooms.map((room) => ({
      ...room,
      unread_count: counts.get(room.key) ?? 0,
    })),
    messages: messagesWithPhotos.reverse(),
    online: onlineWithPhotos,
    muted: activeMute,
    mutes: profile.role === "administrator" ? mutes ?? [] : [],
    reports,
    unread_count: totalUnread,
    read_state: {
      room_key: selectedRoom.key,
      last_read_at: lastReadAt,
    },
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

  if (action === "mark_read") {
    const rooms = await accessibleRooms(token, userId, profile);
    const requestedRoom = String(body?.roomKey ?? "school");
    const room = rooms.find((item) => item.key === requestedRoom);
    if (!room) {
      return NextResponse.json(
        { error: "You do not have access to this chatroom." },
        { status: 403 }
      );
    }

    const supplied = String(body?.lastReadAt ?? "");
    const suppliedDate = new Date(supplied);
    if (!supplied || Number.isNaN(suppliedDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid read marker." },
        { status: 400 }
      );
    }

    const state = await ensureReadState(token, userId, room);
    const currentDate = new Date(
      state?.last_read_at ?? "1970-01-01T00:00:00.000Z"
    );
    const now = new Date();
    const candidate =
      suppliedDate.getTime() > now.getTime() ? now : suppliedDate;
    const nextDate =
      candidate.getTime() > currentDate.getTime() ? candidate : currentDate;

    const response = await rest(
      `community_room_read_state?user_id=eq.${encodeURIComponent(
        userId
      )}&room_key=eq.${encodeURIComponent(room.key)}`,
      token,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          last_read_at: nextDate.toISOString(),
          updated_at: now.toISOString(),
        }),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to save the read position." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      room_key: room.key,
      last_read_at: nextDate.toISOString(),
    });
  }

  if (action === "send") {
    const message = String(body?.message ?? "").trim();
    if (!message || message.length > 1000) {
      return NextResponse.json(
        { error: "Message must contain 1 to 1000 characters." },
        { status: 400 }
      );
    }

    const rooms = await accessibleRooms(token, userId, profile);
    const requestedRoom = String(body?.roomKey ?? "school");
    const room = rooms.find((item) => item.key === requestedRoom);
    if (!room) {
      return NextResponse.json(
        { error: "You do not have access to this chatroom." },
        { status: 403 }
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
          ...roomParams(room),
        },
      ]),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const text = JSON.stringify(result).toLowerCase();
      const muted = text.includes("muted");
      const rateLimited = text.includes("rate limit");
      const denied = text.includes("access denied");
      return NextResponse.json(
        {
          error: muted
            ? "You are temporarily muted from Community Chat."
            : rateLimited
              ? "You are sending messages too quickly. Please try again shortly."
              : denied
                ? "You do not have access to this chatroom."
                : "Unable to send the message.",
        },
        { status: muted || denied ? 403 : 400 }
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

  if (action === "report") {
    const messageId = String(body?.messageId ?? "");
    const reason = String(body?.reason ?? "").trim();

    if (!validUuid(messageId)) {
      return NextResponse.json({ error: "Invalid message." }, { status: 400 });
    }
    if (reason.length < 3 || reason.length > 500) {
      return NextResponse.json(
        { error: "Please provide a brief reason for the report." },
        { status: 400 }
      );
    }

    const response = await rest("community_reports", token, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([
        {
          message_id: messageId,
          reporter_id: userId,
          reason,
        },
      ]),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const duplicate =
        String(result?.code ?? "") === "23505" ||
        JSON.stringify(result).toLowerCase().includes("duplicate");
      return NextResponse.json(
        {
          error: duplicate
            ? "You already reported this message."
            : "Unable to submit the report.",
        },
        { status: duplicate ? 409 : 400 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "dismiss_report" || action === "remove_reported_message") {
    if (profile.role !== "administrator") {
      return NextResponse.json(
        { error: "Super Administrator access required." },
        { status: 403 }
      );
    }

    const reportId = String(body?.reportId ?? "");
    if (!validUuid(reportId)) {
      return NextResponse.json({ error: "Invalid report." }, { status: 400 });
    }

    const reportResponse = await rest(
      `community_reports?id=eq.${encodeURIComponent(
        reportId
      )}&status=eq.pending&select=id,message_id&limit=1`,
      token
    );
    const reportRows = reportResponse.ok
      ? await reportResponse.json().catch(() => [])
      : [];
    const report = reportRows?.[0];

    if (!report) {
      return NextResponse.json(
        { error: "This report is no longer pending." },
        { status: 409 }
      );
    }

    if (action === "remove_reported_message" && report.message_id) {
      const relatedResponse = await rest(
        `community_reports?message_id=eq.${encodeURIComponent(
          report.message_id
        )}&status=eq.pending&select=id`,
        token
      );
      const related = relatedResponse.ok
        ? await relatedResponse.json().catch(() => [])
        : [];

      const deleteResponse = await rest(
        `community_messages?id=eq.${encodeURIComponent(report.message_id)}`,
        token,
        {
          method: "DELETE",
          headers: { Prefer: "return=representation" },
        }
      );
      if (!deleteResponse.ok) {
        return NextResponse.json(
          { error: "Unable to remove the reported message." },
          { status: 400 }
        );
      }

      const reviewedAt = new Date().toISOString();
      for (const item of related ?? []) {
        await rest(
          `community_reports?id=eq.${encodeURIComponent(item.id)}`,
          token,
          {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
              status: "removed",
              reviewed_by: userId,
              reviewed_at: reviewedAt,
            }),
          }
        );
      }

      return NextResponse.json({ ok: true });
    }

    const response = await rest(
      `community_reports?id=eq.${encodeURIComponent(reportId)}`,
      token,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          status: "dismissed",
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        }),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to dismiss the report." },
        { status: 400 }
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
        : NextResponse.json(
            { error: "Unable to unmute this user." },
            { status: 400 }
          );
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
