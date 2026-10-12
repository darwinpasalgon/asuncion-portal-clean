import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return json({ error: "Password service unavailable." }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "Unauthorized." }, 401);

  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  const userId = userResult?.user?.id;
  if (userError || !userId) return json({ error: "Unauthorized." }, 401);

  const body = await req.json().catch(() => ({}));
  const password = String(body.new_password ?? "");
  if (password.length < 8) return json({ error: "Use a password with at least 8 characters." }, 400);

  const { data: profile } = await admin
    .from("profiles")
    .select("must_change_password,temp_password_expires_at,account_status")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || profile.account_status !== "active") return json({ error: "Account is not active." }, 403);
  if (!profile.must_change_password) return json({ error: "A forced password change is not required." }, 400);
  if (profile.temp_password_expires_at && new Date(profile.temp_password_expires_at).getTime() <= Date.now()) {
    return json({ error: "The temporary password has expired. Request another administrator reset." }, 400);
  }

  const { error: passwordError } = await admin.auth.admin.updateUserById(userId, { password });
  if (passwordError) return json({ error: "Could not update the password." }, 500);

  await admin
    .from("profiles")
    .update({ must_change_password: false, temp_password_expires_at: null, updated_at: new Date().toISOString() })
    .eq("id", userId);

  return json({ ok: true, message: "Password updated successfully." });
});
