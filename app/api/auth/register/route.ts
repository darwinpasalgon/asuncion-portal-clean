import { NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

const SECTION_OPTIONS: Record<number, readonly string[]> = {
  7: ["Dahlia", "Daisy", "Gumamela", "Jasmine", "Rosal", "Rose", "Sampaguita", "Santan", "Sunflower", "Vanda", "Waterlily", "Zinnia"],
  8: ["Acacia", "Almasiga", "Apitong", "Dao", "Falcata", "Gemelina", "Lawaan", "Mahogany", "Molave", "Narra", "Yakal"],
  9: ["Aguinaldo", "Aquino", "Arroyo", "Macapagal", "Magsaysay", "Marcos", "Osmeña", "Quezon", "Quirino", "Roxas"],
  10: ["Bonifacio", "Burgos", "Del Pilar", "Gomez", "Jacinto", "Lapu-Lapu", "Luna", "Rizal", "Zamora"],
  11: [],
  12: [],
};

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
    gradeLevel?: number | string;
    section?: string | null;
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
  const gradeLevel = Number(body.gradeLevel ?? 0);
  const requestedSection = String(body.section ?? "").trim();
  const allowedSections = SECTION_OPTIONS[gradeLevel] ?? [];
  const section =
    role === "student" && allowedSections.length > 0 ? requestedSection : null;

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

  if (
    role === "student" &&
    (!Number.isInteger(gradeLevel) || gradeLevel < 7 || gradeLevel > 12)
  ) {
    return NextResponse.json(
      { error: "Select your current grade level." },
      { status: 400 }
    );
  }

  if (
    role === "student" &&
    allowedSections.length > 0 &&
    !allowedSections.includes(requestedSection)
  ) {
    return NextResponse.json(
      { error: "Select a valid section for your grade level." },
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
        grade_level: role === "student" ? gradeLevel : null,
        section: role === "student" ? section : null,
      },
    }),
    cache: "no-store",
  });

  const result = await signup.json().catch(() => ({}));

  if (!signup.ok) {
    const rawMessage = String(
      result?.msg ?? result?.error_description ?? result?.message ?? ""
    ).trim();
    const detail = rawMessage.toLowerCase();

    let message = "We could not create the account. Check your information and try again.";

    if (detail.includes("already") || detail.includes("registered")) {
      message = "An account with that email or LRN may already exist.";
    } else if (detail.includes("email address not authorized")) {
      message = "Supabase is still requiring email confirmation. Turn off Confirm email under Authentication → Providers → Email, then try again.";
    } else if (detail.includes("signup") && detail.includes("disabled")) {
      message = "New account registration is disabled in Supabase Authentication settings.";
    } else if (detail.includes("password")) {
      message = rawMessage || "The password does not meet the authentication requirements.";
    } else if (detail.includes("email")) {
      message = rawMessage || "The email address was rejected by the authentication service.";
    } else if (rawMessage) {
      message = rawMessage;
    }

    return NextResponse.json(
      { error: message, authStatus: signup.status },
      { status: signup.status || 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message:
      "Account created. Your account is pending school verification.",
  });
}
