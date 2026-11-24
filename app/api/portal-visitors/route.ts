import type { NextRequest } from "next/server";
import { portalVisitorsResponse } from "@/lib/portal-visitors";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return portalVisitorsResponse(request.cookies.get("anhs-access-token")?.value ?? "", {
    url: SUPABASE_URL,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,
  });
}

