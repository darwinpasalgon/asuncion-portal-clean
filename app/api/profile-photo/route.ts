import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function authHeaders(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
  };
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function getRows(path: string, token: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json().catch(() => []);
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
  );
  const profile = profiles?.[0];

  if (!profile || profile.account_status !== "active" || !profile.role) {
    return null;
  }

  return { token, userId, profile };
}

async function removeStorageObject(path: string, token: string) {
  if (!path) return true;
  try {
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/profile-photos`,
      {
        method: "DELETE",
        headers: {
          ...authHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefixes: [path] }),
        cache: "no-store",
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const auth = await identity(request);
  if (!auth) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const targetUserId =
    request.nextUrl.searchParams.get("userId")?.trim() || auth.userId;

  if (!validUuid(targetUserId)) {
    return NextResponse.json({ error: "Invalid profile." }, { status: 400 });
  }

  const rows = await getRows(
    `profile_photos?user_id=eq.${encodeURIComponent(
      targetUserId
    )}&select=object_path,mime_type,updated_at&limit=1`,
    auth.token
  );

  const photo = rows?.[0];
  if (!photo?.object_path) {
    return NextResponse.json({ error: "No profile photo." }, { status: 404 });
  }

  const fileResponse = await fetch(
    `${SUPABASE_URL}/storage/v1/object/authenticated/profile-photos/${encodeStoragePath(
      String(photo.object_path)
    )}`,
    {
      headers: authHeaders(auth.token),
      cache: "no-store",
    }
  );

  if (!fileResponse.ok) {
    return NextResponse.json(
      { error: "Unable to open the profile photo." },
      { status: 403 }
    );
  }

  return new NextResponse(await fileResponse.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": String(photo.mime_type || "image/webp"),
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await identity(request);
  if (!auth) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Upload an image file." }, { status: 400 });
  }

  const form = await request.formData();
  const value = form.get("file");

  if (!(value instanceof File) || value.size <= 0) {
    return NextResponse.json({ error: "Choose a profile photo." }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(value.type)) {
    return NextResponse.json(
      { error: "Use a JPG, PNG, or WebP image." },
      { status: 400 }
    );
  }

  if (value.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Profile photos must be 2 MB or smaller." },
      { status: 400 }
    );
  }

  const oldRows = await getRows(
    `profile_photos?user_id=eq.${encodeURIComponent(
      auth.userId
    )}&select=object_path&limit=1`,
    auth.token
  );
  const oldPath = String(oldRows?.[0]?.object_path ?? "");

  const extension = EXTENSIONS[value.type] ?? "webp";
  const objectPath = `${auth.userId}/${crypto.randomUUID()}.${extension}`;

  const uploadResponse = await fetch(
    `${SUPABASE_URL}/storage/v1/object/profile-photos/${encodeStoragePath(
      objectPath
    )}`,
    {
      method: "POST",
      headers: {
        ...authHeaders(auth.token),
        "Content-Type": value.type,
        "x-upsert": "false",
      },
      body: await value.arrayBuffer(),
      cache: "no-store",
    }
  );

  if (!uploadResponse.ok) {
    return NextResponse.json(
      { error: "Unable to upload the profile photo." },
      { status: 400 }
    );
  }

  const updatedAt = new Date().toISOString();
  const metadataResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/profile_photos?on_conflict=user_id`,
    {
      method: "POST",
      headers: {
        ...authHeaders(auth.token),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify([
        {
          user_id: auth.userId,
          object_path: objectPath,
          mime_type: value.type,
          file_size: value.size,
          updated_at: updatedAt,
        },
      ]),
      cache: "no-store",
    }
  );

  const metadata = await metadataResponse.json().catch(() => []);
  if (!metadataResponse.ok || !metadata?.[0]) {
    await removeStorageObject(objectPath, auth.token);
    return NextResponse.json(
      { error: "Unable to save the profile photo." },
      { status: 400 }
    );
  }

  if (oldPath && oldPath !== objectPath) {
    await removeStorageObject(oldPath, auth.token);
  }

  return NextResponse.json({
    ok: true,
    has_profile_photo: true,
    profile_photo_updated_at: metadata[0].updated_at ?? updatedAt,
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await identity(request);
  if (!auth) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const targetUserId = String(body?.userId ?? auth.userId).trim();

  if (!validUuid(targetUserId)) {
    return NextResponse.json({ error: "Invalid profile." }, { status: 400 });
  }

  const removingOtherUser = targetUserId !== auth.userId;
  if (removingOtherUser && auth.profile.role !== "administrator") {
    return NextResponse.json(
      { error: "Super Administrator access required." },
      { status: 403 }
    );
  }

  const rows = await getRows(
    `profile_photos?user_id=eq.${encodeURIComponent(
      targetUserId
    )}&select=object_path&limit=1`,
    auth.token
  );
  const photo = rows?.[0];

  if (!photo?.object_path) {
    return NextResponse.json({ ok: true, removed: false });
  }

  const deleteMetadata = await fetch(
    `${SUPABASE_URL}/rest/v1/profile_photos?user_id=eq.${encodeURIComponent(
      targetUserId
    )}`,
    {
      method: "DELETE",
      headers: {
        ...authHeaders(auth.token),
        Prefer: "return=representation",
      },
      cache: "no-store",
    }
  );
  const deleted = await deleteMetadata.json().catch(() => []);

  if (!deleteMetadata.ok || !Array.isArray(deleted) || deleted.length === 0) {
    return NextResponse.json(
      { error: "Unable to remove the profile photo." },
      { status: 403 }
    );
  }

  await removeStorageObject(String(photo.object_path), auth.token);

  return NextResponse.json({ ok: true, removed: true });
}
