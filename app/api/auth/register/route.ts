import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Public registration is closed. Contact the school administrator for a portal account.",
    },
    { status: 403, headers: { "Cache-Control": "no-store" } }
  );
}
