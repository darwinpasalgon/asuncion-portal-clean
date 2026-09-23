import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

function headers(token: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
  };
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function safeDownloadName(name: string) {
  return name.replace(/[\r\n"]/g, "_");
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!id) {
    return NextResponse.json({ error: "Announcement is required." }, { status: 400 });
  }

  const rowsResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/announcements?id=eq.${encodeURIComponent(
      id
    )}&select=attachment_path,attachment_name,attachment_mime_type&limit=1`,
    {
      headers: headers(token),
      cache: "no-store",
    }
  );

  if (!rowsResponse.ok) {
    return NextResponse.json({ error: "Unable to verify the attachment." }, { status: 403 });
  }

  const rows = await rowsResponse.json().catch(() => []);
  const item = rows?.[0];

  if (!item?.attachment_path || !item?.attachment_name) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  const fileResponse = await fetch(
    `${SUPABASE_URL}/storage/v1/object/authenticated/announcement-files/${encodeStoragePath(
      item.attachment_path
    )}`,
    {
      headers: headers(token),
      cache: "no-store",
    }
  );

  if (!fileResponse.ok) {
    return NextResponse.json({ error: "Unable to open the attachment." }, { status: 403 });
  }

  const bytes = await fileResponse.arrayBuffer();

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": item.attachment_mime_type || "application/octet-stream",
      "Content-Disposition": `inline; filename="${safeDownloadName(item.attachment_name)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
