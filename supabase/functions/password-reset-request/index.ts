import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return json({ error: "Reset service unavailable." }, 500);

  const body = await req.json().catch(() => ({}));
  const identifier = String(body.identifier ?? "").trim().toLowerCase();

  if (!identifier) {
    return json({ error: "Enter your LRN or registered email address." }, 400);
  }

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = admin
    .from("profiles")
    .select("id,account_status")
    .limit(1);

  if (/^\d{12}$/.test(identifier)) {
    query = query.eq("lrn", identifier);
  } else if (identifier.includes("@")) {
    query = query.ilike("email", identifier);
  } else {
    return json({
      ok: true,
      message: "If the account is active, the reset request has been submitted. Please contact the school administrator to verify your identity.",
    });
  }

  const { data: profile, error: profileError } = await query.maybeSingle();

  if (profileError) {
    return json({ error: "Password reset service could not verify the account record." }, 500);
  }

  if (profile?.account_status === "active") {
    const { data: existing, error: existingError } = await admin
      .from("password_reset_requests")
      .select("id")
      .eq("user_id", profile.id)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return json({ error: "Password reset request could not be checked." }, 500);
    }

    if (!existing) {
      const { error: insertError } = await admin
        .from("password_reset_requests")
        .insert({ user_id: profile.id });

      if (insertError) {
        return json({ error: "Password reset request could not be submitted." }, 500);
      }
    }
  }

  return json({
    ok: true,
    message: "If the account is active, the reset request has been submitted. Please contact the school administrator to verify your identity.",
  });
});
