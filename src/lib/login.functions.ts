import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

// Admin sign-in with server-side attempt limits per account:
// 3 tries per round, 1-minute pause between rounds, blocked after 2 rounds.
export const adminSignIn = createServerFn({ method: "POST" })
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data }) => {
    const { getRequestIP } = await import("@tanstack/react-start/server");
    const ip = getRequestIP({ xForwardedFor: true }) ?? null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("admin_login_attempts").select("*").eq("email", data.email).maybeSingle();
    if (row?.blocked) return { error: "Admin sign-in is blocked for this account." };
    if (row?.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
      const s = Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 1000);
      return { error: `Too many attempts. Try again in ${s}s.` };
    }

    const res = await trySignIn(data.email, data.password);
    if (res.ok && res.isAdmin) {
      await supabaseAdmin.from("admin_login_attempts").upsert({
        email: data.email, fails: 0, sessions_used: 0, locked_until: null, blocked: false, last_ip: ip, updated_at: new Date().toISOString(),
      });
      return { access_token: res.session.access_token, refresh_token: res.session.refresh_token };
    }
    if (res.ok) await res.client.auth.signOut();

    const { data: r } = await supabaseAdmin.rpc("admin_login_register_failure", { _email: data.email, _ip: ip ?? "" });
    const st = r as unknown as { fails: number; sessions_used: number; blocked: boolean } | null;
    if (st?.blocked) return { error: "Too many failed attempts. Admin sign-in is now blocked for this account." };
    if (st && st.fails === 0) return { error: "Too many attempts. Try again in 60s." };
    const left = st ? 3 - st.fails : 0;
    return { error: `${GENERIC} ${left} attempt${left === 1 ? "" : "s"} left.` };
  });
