import { NextRequest, NextResponse } from "next/server";
import { isSuperAdministrator } from "@/lib/admin-access";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

type Staff = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  position: string | null;
  admin_role: string | null;
  account_status: string;
  must_change_password: boolean | null;
};

export async function GET(request: NextRequest) {
  const token = request.cookies.get("anhs-access-token")?.value ?? "";
  if (!token || !(await isSuperAdministrator(token))) {
    return NextResponse.json(
      { error: "Super Administrator access required." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const staff: Staff[] = [];
    // Do not fetch auth password hashes, reset tokens, or credential histories.
    // The download is a login-name directory only.
    for (let offset = 0; offset < 10000; offset += 1000) {
      const params = new URLSearchParams({
        select: "id,full_name,email,role,position,admin_role,account_status,must_change_password",
        role: "in.(teacher,administrator,staff_administrator)",
        order: "full_name.asc",
      });
      const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?${params}`, {
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
          Range: `${offset}-${offset + 999}`,
        },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Unable to read the personnel login directory.");
      const page = await response.json();
      if (!Array.isArray(page)) throw new Error("Invalid personnel directory response.");
      staff.push(...(page as Staff[]));
      if (page.length < 1000) {
        return NextResponse.json(
          {
            staff: staff.map((person) => ({
              id: person.id,
              full_name: person.full_name ?? "",
              email: person.email ?? "",
              position: person.position ?? "",
              role: person.role,
              admin_role: person.admin_role ?? null,
              account_status: person.account_status,
              must_change_password: Boolean(person.must_change_password),
            })),
            note: "Login emails only. Original and existing passwords cannot be retrieved.",
          },
          { headers: { "Cache-Control": "private, no-store" } }
        );
      }
    }
    throw new Error("The personnel directory exceeded the safe listing limit.");
  } catch {
    return NextResponse.json(
      { error: "Unable to load the personnel login directory. No accounts were changed." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
