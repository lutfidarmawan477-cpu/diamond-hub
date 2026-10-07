import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({ email: z.string().trim().toLowerCase().email().max(255), password: z.string().min(1).max(200) });
const GENERIC = "Invalid login credentials.";

async function trySignIn(email: string, password: string) {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) return { ok: false as const, error };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.user.id);
  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  return { ok: true as const, isAdmin, session: data.session, client };
}

// Customer sign-in: admin accounts get the exact same generic error as a wrong password.
export const customerSignIn = createServerFn({ method: "POST" })
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data }) => {
    const res = await trySignIn(data.email, data.password);
    if (!res.ok) {
      if (res.error && /confirm/i.test(res.error.message)) {
        return { error: "Your email is not verified yet. Please open the verification link we emailed you." };
      }
      return { error: GENERIC };
    }
    if (res.isAdmin) {
      await res.client.auth.signOut();
      return { error: GENERIC };
    }
    return { access_token: res.session.access_token, refresh_token: res.session.refresh_token };
  });

// ---- Admin sign-in (2 steps) ----
// Step 1: the caller proves a Google account. The server reads the verified Google
// identity, issues a short-lived signed ticket, and removes any account that the
// Google sign-in just created so no empty customer records are left behind.
// Step 2: password only. The email always comes from the signed ticket; both the
// Google email and the password must match an admin account. Attempt limits are
// keyed on the Google account id (3 tries per round, 1-minute pause, blocked after 2 rounds).

async function signTicket(payload: { sub: string; email: string; exp: number }) {
  const { createHmac } = await import("crypto");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", process.env["ADMIN_TICKET_SECRET"]!).update(body).digest("base64url");
  return `${body}.${sig}`;
}
async function readTicket(ticket: string) {
  const { createHmac, timingSafeEqual } = await import("crypto");
  const [body, sig] = ticket.split(".");
  if (!body || !sig) return null;
  const exp = createHmac("sha256", process.env["ADMIN_TICKET_SECRET"]!).update(body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(exp);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const p = JSON.parse(Buffer.from(body, "base64url").toString()) as { sub: string; email: string; exp: number };
  return p.exp > Date.now() ? p : null;
}

export const adminGoogleStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: u } = await context.supabase.auth.getUser();
    const g = u.user?.identities?.find((i) => i.provider === "google");
    const sub = (g?.identity_data?.["sub"] as string | undefined) ?? g?.id;
    const email = ((g?.identity_data?.["email"] as string | undefined) ?? u.user?.email ?? "").toLowerCase();
    if (!u.user || !g || !sub || !email) return { error: "Please continue with Google first." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", u.user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) {
      const fresh = Date.now() - new Date(u.user.created_at).getTime() < 15 * 60_000;
      const onlyGoogle = (u.user.identities ?? []).every((i) => i.provider === "google");
      const { count } = await supabaseAdmin.from("orders").select("id", { count: "exact", head: true }).eq("user_id", u.user.id);
      if (fresh && onlyGoogle && !count) {
        await supabaseAdmin.from("login_history").delete().eq("user_id", u.user.id);
        await supabaseAdmin.from("profiles").delete().eq("id", u.user.id);
        await supabaseAdmin.from("user_roles").delete().eq("user_id", u.user.id);
        await supabaseAdmin.auth.admin.deleteUser(u.user.id);
      }
    }
    return { ticket: await signTicket({ sub, email, exp: Date.now() + 15 * 60_000 }), email };
  });

export const adminPasswordStep = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ ticket: z.string().min(10).max(2000), password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const t = await readTicket(data.ticket);
    if (!t) return { error: "Google verification expired. Please continue with Google again.", restart: true };
    const { getRequestIP } = await import("@tanstack/react-start/server");
    const ip = getRequestIP({ xForwardedFor: true }) ?? null;
    const key = `google:${t.sub}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("admin_login_attempts").select("*").eq("email", key).maybeSingle();
    if (row?.blocked) return { error: "Admin sign-in is blocked for this Google account." };
    if (row?.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
      const s = Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 1000);
      return { error: `Too many attempts. Try again in ${s}s.` };
    }

    const res = await trySignIn(t.email, data.password);
    if (res.ok && res.isAdmin && (res.session.user.email ?? "").toLowerCase() === t.email) {
      await supabaseAdmin.from("admin_login_attempts").upsert({
        email: key, fails: 0, sessions_used: 0, locked_until: null, blocked: false, last_ip: ip, updated_at: new Date().toISOString(),
      });
      return { access_token: res.session.access_token, refresh_token: res.session.refresh_token };
    }
    if (res.ok) await res.client.auth.signOut();

    const { data: r } = await supabaseAdmin.rpc("admin_login_register_failure", { _email: key, _ip: ip ?? "" });
    const st = r as unknown as { fails: number; sessions_used: number; blocked: boolean } | null;
    if (st?.blocked) return { error: "Too many failed attempts. Admin sign-in is now blocked for this account." };
    if (st && st.fails === 0) return { error: "Too many attempts. Try again in 60s." };
    const left = st ? 3 - st.fails : 0;
    return { error: `${GENERIC} ${left} attempt${left === 1 ? "" : "s"} left.` };
  });
