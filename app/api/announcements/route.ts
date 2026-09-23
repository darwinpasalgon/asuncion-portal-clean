import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_SIZE = 4 * 1024 * 1024;

function authHeaders(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
  };
}

async function getRows(path: string, token: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Query failed.");
  return response.json();
}

async function getIdentity(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) return null;

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!userResponse.ok) return null;

  const user = await userResponse.json().catch(() => null);
  const userId = String(user?.id ?? "");
  if (!userId) return null;

  const profiles = await getRows(
    `profiles?id=eq.${encodeURIComponent(
      userId
    )}&select=id,full_name,role,account_status&limit=1`,
    token
  ).catch(() => []);

  const profile = profiles?.[0];
  if (
    !profile ||
    profile.account_status !== "active" ||
    !["student", "teacher", "administrator"].includes(String(profile.role))
  ) {
    return null;
  }

  return { token, userId, profile };
}

async function getActiveYear(token: string) {
  const rows = await getRows(
    "school_years?is_active=eq.true&select=id,name&limit=1",
    token
  );
  return rows?.[0] ?? null;
}

function safeFileName(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "memorandum-file";
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function removeStorageObject(path: string, token: string) {
  await fetch(
    `${SUPABASE_URL}/storage/v1/object/announcement-files/${encodeStoragePath(path)}`,
    {
      method: "DELETE",
      headers: authHeaders(token),
      cache: "no-store",
    }
  ).catch(() => null);
}

export async function GET(request: NextRequest) {
  const identity = await getIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { token, profile } = identity;

  try {
    const activeYear = await getActiveYear(token);
    if (!activeYear) {
      return NextResponse.json({
        profile,
        activeYear: null,
        announcements: [],
        grades: [],
        sections: [],
        allowedSections: [],
      });
    }

    const [announcements, grades, sections] = await Promise.all([
      getRows(
        `announcements?school_year_id=eq.${encodeURIComponent(
          activeYear.id
        )}&select=id,school_year_id,announcement_type,title,body,memo_number,memo_date,audience_scope,target_grade,target_section_id,status,published_at,expires_at,created_by,posted_by_name,attachment_path,attachment_name,attachment_mime_type,attachment_size,created_at,updated_at&order=created_at.desc`,
        token
      ),
      getRows(
        "grade_levels?select=grade_level,label,sort_order&order=sort_order.asc",
        token
      ),
      getRows(
        "sections?is_active=eq.true&select=id,grade_level,name&order=grade_level.asc,name.asc",
        token
      ),
    ]);

    let allowedSections = sections ?? [];

    if (profile.role === "teacher") {
      const [assignments, adviserRows] = await Promise.all([
        getRows(
          `teacher_assignments?school_year_id=eq.${encodeURIComponent(
            activeYear.id
          )}&teacher_id=eq.${encodeURIComponent(
            profile.id
          )}&is_active=eq.true&select=section_id`,
          token
        ),
        getRows(
          `section_advisers?school_year_id=eq.${encodeURIComponent(
            activeYear.id
          )}&teacher_id=eq.${encodeURIComponent(
            profile.id
          )}&is_active=eq.true&select=section_id`,
          token
        ),
      ]);

      const ids = new Set<string>([
        ...(assignments ?? []).map((item: { section_id: string }) => item.section_id),
        ...(adviserRows ?? []).map((item: { section_id: string }) => item.section_id),
      ]);

      allowedSections = (sections ?? []).filter((section: { id: string }) =>
        ids.has(section.id)
      );
    }

    return NextResponse.json({
      profile,
      activeYear,
      announcements,
      grades,
      sections,
      allowedSections,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load announcements." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const identity = await getIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { token, userId, profile } = identity;
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);
    const action = String(body?.action ?? "");
    const id = String(body?.id ?? "");

    if (!id || !["publish", "draft", "archive"].includes(action)) {
      return NextResponse.json({ error: "Invalid announcement action." }, { status: 400 });
    }

    if (!["teacher", "administrator"].includes(String(profile.role))) {
      return NextResponse.json({ error: "Posting access required." }, { status: 403 });
    }

    const rows = await getRows(
      `announcements?id=eq.${encodeURIComponent(
        id
      )}&select=id,created_by,announcement_type&limit=1`,
      token
    ).catch(() => []);

    if (!rows?.[0]) {
      return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
    }

    if (profile.role !== "administrator" && rows[0].created_by !== userId) {
      return NextResponse.json(
        { error: "You can only update announcements that you posted." },
        { status: 403 }
      );
    }

    const status = action === "publish" ? "published" : action === "archive" ? "archived" : "draft";
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/announcements?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          ...authHeaders(token),
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          status,
          published_at: status === "published" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }),
        cache: "no-store",
      }
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.[0]) {
      return NextResponse.json(
        { error: "Unable to update the announcement." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, announcement: result[0] });
  }

  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Invalid request format." }, { status: 400 });
  }

  if (!["teacher", "administrator"].includes(String(profile.role))) {
    return NextResponse.json({ error: "Posting access required." }, { status: 403 });
  }

  const form = await request.formData();
  const activeYear = await getActiveYear(token).catch(() => null);
  if (!activeYear) {
    return NextResponse.json(
      { error: "No active school year is configured." },
      { status: 409 }
    );
  }

  const id = crypto.randomUUID();
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const requestedType = String(form.get("announcementType") ?? "announcement");
  const requestedScope = String(form.get("audienceScope") ?? "");
  const requestedStatus = String(form.get("status") ?? "draft");
  const targetGradeRaw = String(form.get("targetGrade") ?? "");
  const targetSectionIdRaw = String(form.get("targetSectionId") ?? "");
  const memoNumber = String(form.get("memoNumber") ?? "").trim();
  const memoDateRaw = String(form.get("memoDate") ?? "");
  const expiresAtRaw = String(form.get("expiresAt") ?? "");
  const fileValue = form.get("file");

  if (title.length < 2 || title.length > 180) {
    return NextResponse.json(
      { error: "Title must contain 2 to 180 characters." },
      { status: 400 }
    );
  }

  if (body.length > 10000) {
    return NextResponse.json(
      { error: "Message must be 10,000 characters or fewer." },
      { status: 400 }
    );
  }

  const announcementType =
    profile.role === "administrator" && requestedType === "memorandum"
      ? "memorandum"
      : "announcement";

  if (requestedType === "memorandum" && profile.role !== "administrator") {
    return NextResponse.json(
      { error: "Only an Administrator / Principal account can post a memorandum." },
      { status: 403 }
    );
  }

  let audienceScope = requestedScope;
  let targetGrade: number | null = null;
  let targetSectionId: string | null = null;

  if (profile.role === "teacher") {
    audienceScope = "section";
    targetSectionId = targetSectionIdRaw || null;

    if (!targetSectionId) {
      return NextResponse.json(
        { error: "Select one of your assigned sections." },
        { status: 400 }
      );
    }

    const allowed = await getRows(
      `sections?id=eq.${encodeURIComponent(targetSectionId)}&select=id&limit=1`,
      token
    ).catch(() => []);

    if (!allowed?.[0]) {
      return NextResponse.json(
        { error: "You can only post to a section assigned to you." },
        { status: 403 }
      );
    }
  } else {
    if (!["school", "grade", "section"].includes(audienceScope)) {
      return NextResponse.json({ error: "Select an audience." }, { status: 400 });
    }

    if (audienceScope === "grade") {
      targetGrade = Number(targetGradeRaw);
      if (!Number.isInteger(targetGrade) || targetGrade < 7 || targetGrade > 12) {
        return NextResponse.json(
          { error: "Select a valid grade level." },
          { status: 400 }
        );
      }
    }

    if (audienceScope === "section") {
      targetSectionId = targetSectionIdRaw || null;
      if (!targetSectionId) {
        return NextResponse.json(
          { error: "Select a section." },
          { status: 400 }
        );
      }
    }
  }

  const status = requestedStatus === "published" ? "published" : "draft";
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return NextResponse.json({ error: "Enter a valid expiration date." }, { status: 400 });
  }

  const memoDate =
    announcementType === "memorandum" && memoDateRaw ? memoDateRaw : null;

  let attachmentPath: string | null = null;
  let attachmentName: string | null = null;
  let attachmentMimeType: string | null = null;
  let attachmentSize: number | null = null;

  if (fileValue instanceof File && fileValue.size > 0) {
    if (profile.role !== "administrator") {
      return NextResponse.json(
        { error: "Only an Administrator / Principal can upload memorandum files." },
        { status: 403 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(fileValue.type)) {
      return NextResponse.json(
        { error: "Upload a PDF, JPG, PNG, or WebP file only." },
        { status: 400 }
      );
    }

    if (fileValue.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "The memorandum file must be 4 MB or smaller." },
        { status: 400 }
      );
    }

    attachmentName = fileValue.name;
    attachmentMimeType = fileValue.type;
    attachmentSize = fileValue.size;
    attachmentPath = `${id}/${Date.now()}-${safeFileName(fileValue.name)}`;

    const uploadResponse = await fetch(
      `${SUPABASE_URL}/storage/v1/object/announcement-files/${encodeStoragePath(
        attachmentPath
      )}`,
      {
        method: "POST",
        headers: {
          ...authHeaders(token),
          "Content-Type": fileValue.type,
          "x-upsert": "false",
        },
        body: await fileValue.arrayBuffer(),
        cache: "no-store",
      }
    );

    if (!uploadResponse.ok) {
      return NextResponse.json(
        { error: "Unable to upload the memorandum file." },
        { status: 400 }
      );
    }
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/announcements`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      id,
      school_year_id: activeYear.id,
      announcement_type: announcementType,
      title,
      body: body || null,
      memo_number: announcementType === "memorandum" ? memoNumber || null : null,
      memo_date: memoDate,
      audience_scope: audienceScope,
      target_grade: targetGrade,
      target_section_id: targetSectionId,
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
      expires_at: expiresAt ? expiresAt.toISOString() : null,
      created_by: userId,
      posted_by_name: profile.full_name,
      attachment_path: attachmentPath,
      attachment_name: attachmentName,
      attachment_mime_type: attachmentMimeType,
      attachment_size: attachmentSize,
    }),
    cache: "no-store",
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result?.[0]) {
    if (attachmentPath) {
      await removeStorageObject(attachmentPath, token);
    }
    return NextResponse.json(
      { error: "Unable to create the announcement." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, announcement: result[0] });
}
