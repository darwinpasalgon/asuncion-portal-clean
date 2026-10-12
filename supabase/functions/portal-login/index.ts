import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey =
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !publishableKey || !serviceRole) {
    return json({ error: "Authentication service is not configured." }, 500);
  }

  let payload: { identifier?: string; password?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const identifier = String(payload.identifier ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "");

  if (!identifier || !password) {
    return json({ error: "Enter your LRN or email and password." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let profileQuery = admin
    .from("profiles")
    .select("id,email,account_status,role,requested_role,must_change_password,temp_password_expires_at")
    .limit(1);

  if (/^\d{12}$/.test(identifier)) {
    profileQuery = profileQuery.eq("lrn", identifier);
  } else if (identifier.includes("@")) {
    profileQuery = profileQuery.eq("email", identifier);
  } else {
    return json({ error: "Invalid LRN/email or password." }, 401);
  }

  const { data: profile, error: profileError } = await profileQuery.maybeSingle();

  if (profileError || !profile) {
    return json({ error: "Invalid LRN/email or password." }, 401);
  }

  const auth = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await auth.auth.signInWithPassword({
    email: profile.email,
    password,
  });

  if (error || !data.session) {
    return json({ error: "Invalid LRN/email or password." }, 401);
  }

  if (profile.account_status !== "active") {
    await auth.auth.signOut();
    const message =
      profile.account_status === "suspended"
        ? "This account is suspended. Please contact the school administrator."
        : "Your account is still waiting for school verification.";
    return json({ error: message, code: "ACCOUNT_NOT_ACTIVE" }, 403);
  }

  if (
    profile.must_change_password &&
    profile.temp_password_expires_at &&
    new Date(profile.temp_password_expires_at).getTime() <= Date.now()
  ) {
    await auth.auth.signOut();
    return json({
      error: "Your temporary password has expired. Submit another administrator reset request.",
      code: "TEMP_PASSWORD_EXPIRED",
    }, 403);
  }

  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    user: { id: data.user.id },
    profile: {
      role: profile.role ?? profile.requested_role,
      account_status: profile.account_status,
      must_change_password: Boolean(profile.must_change_password),
    },
  });
});
