import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);
const CATEGORIES = new Set([
  "lesson_material",
  "activity_sheet",
  "reviewer",
  "reference",
  "module",
  "video_link",
  "other",
]);

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

async function identity(request: NextRequest) {
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

async function activeYear(token: string) {
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
  return cleaned || "resource-file";
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function validExternalUrl(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function removeStorageObject(path: string, token: string) {
  await fetch(
    `${SUPABASE_URL}/storage/v1/object/learning-resources/${encodeStoragePath(path)}`,
    { method: "DELETE", headers: authHeaders(token), cache: "no-store" }
  ).catch(() => null);
}

export async function GET(request: NextRequest) {
  const auth = await identity(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { token, profile } = auth;

  try {
    const year = await activeYear(token);
    if (!year) {
      return NextResponse.json({
        profile,
        activeYear: null,
        resources: [],
        assignments: [],
        sections: [],
        subjects: [],
      });
    }

    const [resources, assignments, sections, subjects] = await Promise.all([
      getRows(
        `learning_resources?school_year_id=eq.${encodeURIComponent(
          year.id
        )}&select=id,school_year_id,resource_scope,teacher_assignment_id,term_no,category,title,description,external_url,status,published_at,created_by,posted_by_name,attachment_path,attachment_name,attachment_mime_type,attachment_size,created_at,updated_at&order=created_at.desc`,
        token
      ),
      getRows(
        `teacher_assignments?school_year_id=eq.${encodeURIComponent(
          year.id
        )}&is_active=eq.true&select=id,teacher_id,grade_level,section_id,subject_id&order=grade_level.asc`,
        token
      ),
      getRows(
        "sections?select=id,grade_level,name&order=grade_level.asc,name.asc",
        token
      ),
      getRows(
        "subjects?select=id,grade_level,name,code&order=grade_level.asc,name.asc",
        token
      ),
    ]);

    return NextResponse.json({
      profile,
      activeYear: year,
      resources,
      assignments,
      sections,
      subjects,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load learning resources." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await identity(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { token, userId, profile } = auth;
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    if (!["teacher", "administrator"].includes(String(profile.role))) {
      return NextResponse.json({ error: "Posting access required." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const action = String(body?.action ?? "");
    const id = String(body?.id ?? "");

    if (!id || !["publish", "draft", "archive"].includes(action)) {
      return NextResponse.json({ error: "Invalid resource action." }, { status: 400 });
    }

    const rows = await getRows(
      `learning_resources?id=eq.${encodeURIComponent(
        id
      )}&select=id,created_by,resource_scope,teacher_assignment_id&limit=1`,
      token
    ).catch(() => []);

    if (!rows?.[0]) {
      return NextResponse.json({ error: "Resource not found." }, { status: 404 });
    }

    if (profile.role !== "administrator" && rows[0].created_by !== userId) {
      return NextResponse.json(
        { error: "You can only update resources that you posted." },
        { status: 403 }
      );
    }

    const status =
      action === "publish" ? "published" : action === "archive" ? "archived" : "draft";

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/learning_resources?id=eq.${encodeURIComponent(id)}`,
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
      return NextResponse.json({ error: "Unable to update the resource." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, resource: result[0] });
  }

  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Invalid request format." }, { status: 400 });
  }

  if (!["teacher", "administrator"].includes(String(profile.role))) {
    return NextResponse.json({ error: "Posting access required." }, { status: 403 });
  }

  const form = await request.formData();
  const year = await activeYear(token).catch(() => null);
  if (!year) {
    return NextResponse.json(
      { error: "No active school year is configured." },
      { status: 409 }
    );
  }

  const id = crypto.randomUUID();
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const category = String(form.get("category") ?? "");
  const requestedScope = String(form.get("resourceScope") ?? "");
  const assignmentIdRaw = String(form.get("assignmentId") ?? "");
  const termRaw = String(form.get("termNo") ?? "");
  const status = String(form.get("status") ?? "") === "published" ? "published" : "draft";
  const externalUrlRaw = String(form.get("externalUrl") ?? "").trim();
  const fileValue = form.get("file");

  if (title.length < 2 || title.length > 180) {
    return NextResponse.json(
      { error: "Title must contain 2 to 180 characters." },
      { status: 400 }
    );
  }

  if (description.length > 10000) {
    return NextResponse.json(
      { error: "Description must be 10,000 characters or fewer." },
      { status: 400 }
    );
  }

  if (!CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Select a resource category." }, { status: 400 });
  }

  let resourceScope = requestedScope;
  let teacherAssignmentId: string | null = null;

  if (profile.role === "teacher") {
    resourceScope = "class";
    teacherAssignmentId = assignmentIdRaw || null;
  } else if (resourceScope === "class") {
    teacherAssignmentId = assignmentIdRaw || null;
  } else {
    resourceScope = "school";
  }

  if (!["school", "class"].includes(resourceScope)) {
    return NextResponse.json({ error: "Select a resource audience." }, { status: 400 });
  }

  if (resourceScope === "class") {
    if (!teacherAssignmentId) {
      return NextResponse.json({ error: "Select an assigned class." }, { status: 400 });
    }

    const assignmentRows = await getRows(
      `teacher_assignments?id=eq.${encodeURIComponent(
        teacherAssignmentId
      )}&school_year_id=eq.${encodeURIComponent(
        year.id
      )}&is_active=eq.true&select=id&limit=1`,
      token
    ).catch(() => []);

    if (!assignmentRows?.[0]) {
      return NextResponse.json(
        { error: "Select a class assignment available to your account." },
        { status: 403 }
      );
    }
  } else if (profile.role !== "administrator") {
    return NextResponse.json(
      { error: "Only an Administrator can post a school-wide resource." },
      { status: 403 }
    );
  }

  const termNo = termRaw ? Number(termRaw) : null;
  if (termNo !== null && ![1, 2, 3].includes(termNo)) {
    return NextResponse.json({ error: "Select Term 1, 2, or 3." }, { status: 400 });
  }

  const externalUrl = externalUrlRaw ? validExternalUrl(externalUrlRaw) : null;
  if (externalUrlRaw && !externalUrl) {
    return NextResponse.json(
      { error: "External link must use http:// or https://." },
      { status: 400 }
    );
  }

  let attachmentPath: string | null = null;
  let attachmentName: string | null = null;
  let attachmentMimeType: string | null = null;
  let attachmentSize: number | null = null;

  if (fileValue instanceof File && fileValue.size > 0) {
    if (!ALLOWED_MIME_TYPES.has(fileValue.type)) {
      return NextResponse.json(
        { error: "Upload a supported PDF, Office document, text file, or image." },
        { status: 400 }
      );
    }

    if (fileValue.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Resource files must be 10 MB or smaller." },
        { status: 400 }
      );
    }

    attachmentName = fileValue.name;
    attachmentMimeType = fileValue.type;
    attachmentSize = fileValue.size;
    attachmentPath = `${userId}/${id}/${Date.now()}-${safeFileName(fileValue.name)}`;

    const upload = await fetch(
      `${SUPABASE_URL}/storage/v1/object/learning-resources/${encodeStoragePath(
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

    if (!upload.ok) {
      return NextResponse.json(
        { error: "Unable to upload the resource file." },
        { status: 400 }
      );
    }
  }

  if (!attachmentPath && !externalUrl) {
    return NextResponse.json(
      { error: "Add a file or an external link to this resource." },
      { status: 400 }
    );
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/learning_resources`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      id,
      school_year_id: year.id,
      resource_scope: resourceScope,
      teacher_assignment_id: teacherAssignmentId,
      term_no: termNo,
      category,
      title,
      description: description || null,
      external_url: externalUrl,
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
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
      { error: "Unable to create the learning resource." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, resource: result[0] });
}
