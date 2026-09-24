import { NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

function normalizePhone(input: string) {
  const raw = input.replace(/[\s()-]/g, "");
  if (/^09\d{9}$/.test(raw)) return `+63${raw.slice(1)}`;
  if (/^639\d{9}$/.test(raw)) return `+${raw}`;
  if (/^\+\d{8,15}$/.test(raw)) return raw;
  return null;
}

function normalizeActivationCode(input: string) {
  return input.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

export async function POST(request: Request) {
  let body: {
    role?: "student" | "teacher";
    lrn?: string;
    email?: string;
    phone?: string;
    activationCode?: string;
    password?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const role = body.role === "teacher" ? "teacher" : "student";
  const lrn = String(body.lrn ?? "").trim();
  const emailInput = String(body.email ?? "").trim().toLowerCase();
  const phone = normalizePhone(String(body.phone ?? "").trim());
  const activationCode = normalizeActivationCode(String(body.activationCode ?? ""));
  const password = String(body.password ?? "");

  if (!phone) {
    return NextResponse.json(
      { error: "Enter a valid Philippine mobile number." },
      { status: 400 }
    );
  }

  if (!activationCode || activationCode.length < 8) {
    return NextResponse.json(
      { error: "Enter the activation code issued by the school." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Use a password with at least 8 characters." },
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
    role === "teacher" &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)
  ) {
    return NextResponse.json(
      { error: "Enter the email address registered in the school masterlist." },
      { status: 400 }
    );
  }

  const authEmail =
    role === "student"
      ? `student.${lrn}@asuncion-nhs.invalid`
      : emailInput;

  const signup = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: authEmail,
      password,
      data: {
        requested_role: role,
        recovery_phone: phone,
        activation_code: activationCode,
        lrn: role === "student" ? lrn : null,
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

    let message =
      "The activation details did not match the school masterlist, or the activation code has already been used.";

    if (detail.includes("already") || detail.includes("registered")) {
      message =
        "This school record already has a portal account. Try signing in or use Forgot password.";
    } else if (detail.includes("password")) {
      message =
        rawMessage || "The password does not meet the authentication requirements.";
    } else if (detail.includes("signup") && detail.includes("disabled")) {
      message = "Account activation is currently unavailable.";
    }

    return NextResponse.json(
      { error: message, authStatus: signup.status },
      { status: signup.status || 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message:
      "Your ANHS portal account has been activated. You can now sign in with your LRN or registered email.",
  });
}
