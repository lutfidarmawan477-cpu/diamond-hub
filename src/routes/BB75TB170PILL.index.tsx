import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { adminGoogleStep, adminPasswordStep } from "@/lib/login.functions";

export const Route = createFileRoute("/BB75TB170PILL/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin Portal — DiamondHub" },
      { name: "description", content: "Restricted sign-in for DiamondHub administrators." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLoginPage,
});

const TICKET_KEY = "admin_google_ticket";
type Ticket = { ticket: string; email: string };

function AdminLoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null | undefined>(undefined);
  const googleStepFn = useServerFn(adminGoogleStep);
  const passwordStepFn = useServerFn(adminPasswordStep);

  useEffect(() => {
    let cancelled = false;
    let busy = false;
    const run = async () => {
      if (busy) return;
      busy = true;
      try {
        // Only treat a session as the Google identity step when this page started it.
        if (sessionStorage.getItem(PENDING_KEY)) {
          const { data } = await supabase.auth.getSession();
          const u = data.session?.user;
          if (u && (u.identities ?? []).some((i) => i.provider === "google")) {
            sessionStorage.removeItem(PENDING_KEY);
            try {
              const res = await googleStepFn();
              if ("ticket" in res) sessionStorage.setItem(TICKET_KEY, JSON.stringify(res));
            } catch { /* ignore */ }
            // The Google session is only used to prove identity; drop it right away.
            await supabase.auth.signOut({ scope: "local" });
          }
        }
        const saved = sessionStorage.getItem(TICKET_KEY);
        if (!cancelled) setTicket(saved ? (JSON.parse(saved) as Ticket) : null);
      } finally {
        busy = false;
      }
    };
    run();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // Defer: calling auth methods inside this callback can freeze the page.
      if (event === "SIGNED_IN" && sessionStorage.getItem(PENDING_KEY)) setTimeout(run, 0);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [googleStepFn]);

  const continueGoogle = async () => {
    sessionStorage.setItem(PENDING_KEY, "1");
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/BB75TB170PILL` });
    if (r.error) { sessionStorage.removeItem(PENDING_KEY); toast.error("Google sign-in failed."); }
  };

  const resetGoogle = () => { sessionStorage.removeItem(TICKET_KEY); setTicket(null); setPassword(""); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    setLoading(true);
    try {
      const res = await passwordStepFn({ data: { ticket: ticket.ticket, password } });
      if ("error" in res) {
        if ("restart" in res && res.restart) resetGoogle();
        throw new Error(res.error);
      }
      const { data, error } = await supabase.auth.setSession(res);
      if (error || !data.user) throw new Error("Invalid login credentials.");
      sessionStorage.removeItem(TICKET_KEY);
      try {
        await supabase.from("login_history").insert({ user_id: data.user.id, email: data.user.email ?? ticket.email, user_agent: navigator.userAgent });
      } catch { /* ignore */ }
      setPassword("");
      toast.success("Welcome, admin!");
      navigate({ to: "/BB75TB170PILL/DASHBOARD", replace: true });
    } catch (err) {
      toast.error((err as Error).message || "Invalid login credentials.");
    } finally {
      setLoading(false);
    }
  };

  const google = ticket === undefined ? undefined : ticket?.email ?? null;
  const inputCls = "w-full rounded-md bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="card-premium rounded-2xl p-6 animate-scale-in">
          <ShieldCheck className="mx-auto h-10 w-10 text-gold" />
          <h1 className="mt-3 text-center font-display text-2xl">Admin Portal</h1>
          <p className="mt-1 text-center text-xs text-muted-foreground">Authorized administrators only.</p>
          {google === undefined ? (
            <p className="mt-5 text-center text-sm text-muted-foreground">Loading…</p>
          ) : google === null ? (
            <div className="mt-5 space-y-3">
              <p className="text-center text-xs text-muted-foreground">Step 1: verify your Google account to continue.</p>
              <button onClick={continueGoogle} className="w-full rounded-md btn-gold py-3 text-sm active:scale-95 transition">Continue with Google</button>
            </div>
          ) : (
          <>
          <div className="mt-4 flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs">
            <span className="truncate text-muted-foreground">Email: <span className="text-foreground">{google}</span></span>
            <button type="button" onClick={resetGoogle} className="text-gold underline">Switch</button>
          </div>
          <form onSubmit={submit} className="mt-3 space-y-3">
            <p className="text-xs text-muted-foreground">Step 2: enter the admin password.</p>
            <div className="relative">
              <input className={`${inputCls} pr-10`} type={show ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
                {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </div>
            <button disabled={loading} className="w-full rounded-md btn-gold py-3 text-sm disabled:opacity-50 active:scale-95 transition">
              {loading ? "Verifying…" : "Sign In as Admin"}
            </button>
          </form>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
