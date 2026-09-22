import { NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

function normalizePhone(input: string) {
  const raw = input.replace(/[\s()-]/g, "");
  if (/^09\d{9}$/.test(raw)) return `+63${raw.slice(1)}`;
  if (/^639\d{9}$/.test(raw)) return `+${raw}`;
  if (/^\+\d{8,15}$/.test(raw)) return raw;
  return null;
}

export async function POST(request: Request) {
  let body: {
    role?: "student" | "teacher";
    fullName?: string;
    lrn?: string;
    email?: string;
    phone?: string;
    password?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const role = body.role === "teacher" ? "teacher" : "student";
  const fullName = String(body.fullName ?? "").trim();
  const lrn = String(body.lrn ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const phone = normalizePhone(String(body.phone ?? "").trim());

  if (!fullName || !email || !phone) {
    return NextResponse.json(
      { error: "Complete your name, email address, and mobile number." },
      { status: 400 }
    );
  }

  if (role === "student" && !/^\d{12}$/.test(lrn)) {
    return NextResponse.json(
      { error: "Student LRN must contain exactly 12 digits." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Use a password with at least 8 characters." },
      { status: 400 }
    );
  }

  const signup = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      data: {
        full_name: fullName,
        recovery_phone: phone,
        requested_role: role,
        lrn: role === "student" ? lrn : null,
      },
    }),
    cache: "no-store",
  });

  const result = await signup.json().catch(() => ({}));

  if (!signup.ok) {
    const detail = String(
      result?.msg ?? result?.error_description ?? result?.message ?? ""
    ).toLowerCase();

    const message = detail.includes("already")
      ? "An account with that email or LRN may already exist."
      : "We could not create the account. Check your information and try again.";

    return NextResponse.json({ error: message }, { status: signup.status || 400 });
  }

  return NextResponse.json({
    ok: true,
    message:
      "Account created. Your account is pending school verification.",
  });
}
