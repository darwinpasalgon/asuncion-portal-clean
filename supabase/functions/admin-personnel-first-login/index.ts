import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
function newTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  // Modulo bias is negligible for 60 symbols and randomly generated 18 bytes.
  const random = Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
  return "ANHS-" + random.slice(0, 9) + "-" + random.slice(9);
}
type Candidate = {
  id: string;
  full_name: string;
  email: string;
  role: "teacher" | "staff_administrator";
  position: string | null;
  must_change_password: boolean;
};
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !secret) return json({ error: "Personnel credentials service unavailable." }, 500);

  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return json({ error: "Super Administrator login required." }, 401);

  const supabase = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth?.user?.id) return json({ error: "Invalid login session." }, 401);
  const callerId = auth.user.id;
  const { data: adminProfile, error: adminError } = await supabase
    .from("profiles").select("id,role,account_status,admin_role").eq("id", callerId).maybeSingle();
  if (adminError || !adminProfile ||
      adminProfile.role !== "administrator" ||
      adminProfile.admin_role !== "super_administrator" ||
      adminProfile.account_status !== "active") {
    return json({ error: "Super Administrator permission required." }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");
  if (!["candidates", "issue"].includes(action)) return json({ error: "Invalid operation." }, 400);

  try {
    // Only active personnel whose first login is outstanding; exclude the
    // superadmin and anyone who has ever signed in. No current password is read.
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id,full_name,email,position,role,must_change_password,account_status")
      .in("role", ["teacher", "staff_administrator"])
      .eq("account_status", "active")
      .eq("must_change_password", true);
    if (profilesError) throw new Error("Could not load first-login personnel.");

    const authById = new Map<string, { id: string; last_sign_in_at?: string | null }>();
    for (let page = 1; page < 50; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error("Could not verify personnel sign-in history.");
      const users = data?.users ?? [];
      users.forEach(user => authById.set(user.id, { id: user.id, last_sign_in_at: user.last_sign_in_at }));
      if (users.length < 1000) break;
      if (page === 49) throw new Error("User directory is too large for this operation.");
    }
    const candidates: Candidate[] = (profiles ?? [])
      .filter(profile => {
        const account = authById.get(profile.id);
        return !!account && !account.last_sign_in_at && profile.id !== callerId;
      })
      .map(profile => ({
        id: String(profile.id),
        full_name: String(profile.full_name ?? ""),
        email: String(profile.email ?? ""),
        role: profile.role as Candidate["role"],
        position: profile.position ? String(profile.position) : null,
        must_change_password: true,
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

    if (action === "candidates") {
      return json({
        count: candidates.length,
        teacher_count: candidates.filter(p => p.role === "teacher").length,
        staff_count: candidates.filter(p => p.role === "staff_administrator").length,
      });
    }

    // The caller must explicitly confirm the CSV issuance in the portal.
    if (body.confirm !== "ISSUE_FIRST_LOGIN_PASSWORDS") {
      return json({ error: "Explicit confirmation is required before resetting passwords." }, 400);
    }
    const selected = body.scope === "all"
      ? candidates.map(person => person.id)
      : Array.isArray(body.user_ids) ? [...new Set(
          body.user_ids.filter((x: unknown) => typeof x === "string").map((x: string) => x.trim())
        )] : [];
    if (!selected.length || selected.length > 250) {
      return json({ error: "Select between 1 and 250 eligible personnel accounts." }, 400);
    }
    const allowed = new Map(candidates.map(item => [item.id, item]));
    const issued: Array<{
      user_id: string;
      full_name: string;
      email: string;
      position: string;
      role: string;
      temporary_password: string;
    }> = [];
    const errors: Array<{ user_id: string; message: string }> = [];
    for (const id of selected) {
      const person = allowed.get(id);
      if (!person) {
        errors.push({ user_id: id, message: "Not eligible: account has signed in or is not awaiting first login." });
        continue;
      }
      // Verify again immediately before changing each password.
      const { data: authUser, error: checkError } = await supabase.auth.admin.getUserById(id);
      if (checkError || !authUser?.user || authUser.user.last_sign_in_at) {
        errors.push({ user_id: id, message: "Account sign-in status changed or could not be verified." });
        continue;
      }
      const password = newTemporaryPassword();
      const { error: resetError } = await supabase.auth.admin.updateUserById(id, {
        password,
        user_metadata: {
          ...(authUser.user.user_metadata ?? {}),
          first_login_credential_generated_at: new Date().toISOString(),
        },
      });
      if (resetError) {
        errors.push({ user_id: id, message: "Unable to issue a temporary password." });
        continue;
      }
      // Existing first-login flag is true; clear stale expiry so the new
      // password is usable until the user signs in and changes it.
      const { error: updateError } = await supabase.from("profiles")
        .update({ must_change_password: true, temp_password_expires_at: null })
        .eq("id", id).eq("must_change_password", true);
      if (updateError) {
        // Still return this freshly issued credential so it is never lost.
        errors.push({ user_id: id, message: "Password issued, but the profile flag needs administrator review." });
      }
      issued.push({
        user_id: id,
        full_name: person.full_name,
        email: person.email,
        position: person.position ?? "",
        role: person.role,
        temporary_password: password,
      });
    }
    return json({ issued, errors, count: issued.length }, issued.length ? 200 : 409);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to generate first-login credentials." }, 500);
  }
});
