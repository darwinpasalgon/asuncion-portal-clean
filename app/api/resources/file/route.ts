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
    return NextResponse.json({ error: "Resource is required." }, { status: 400 });
  }

  const rowResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/learning_resources?id=eq.${encodeURIComponent(
      id
    )}&select=attachment_path,attachment_name,attachment_mime_type&limit=1`,
    { headers: headers(token), cache: "no-store" }
  );

  if (!rowResponse.ok) {
    return NextResponse.json({ error: "Unable to verify this resource." }, { status: 403 });
  }

  const rows = await rowResponse.json().catch(() => []);
  const resource = rows?.[0];

  if (!resource?.attachment_path || !resource?.attachment_name) {
    return NextResponse.json({ error: "Resource file not found." }, { status: 404 });
  }

  const fileResponse = await fetch(
    `${SUPABASE_URL}/storage/v1/object/authenticated/learning-resources/${encodeStoragePath(
      resource.attachment_path
    )}`,
    { headers: headers(token), cache: "no-store" }
  );

  if (!fileResponse.ok) {
    return NextResponse.json({ error: "Unable to open the resource file." }, { status: 403 });
  }

  return new NextResponse(await fileResponse.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": resource.attachment_mime_type || "application/octet-stream",
      "Content-Disposition": `inline; filename="${safeDownloadName(resource.attachment_name)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
