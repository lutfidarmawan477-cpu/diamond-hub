import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { adminSignIn } from "@/lib/login.functions";

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

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [google, setGoogle] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const read = async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      const isG = !!u && (u.app_metadata?.provider === "google" || (u.identities ?? []).some((i) => i.provider === "google"));
      setGoogle(isG ? u!.email ?? "Google account" : null);
    };
    read();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { read(); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const continueGoogle = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/BB75TB170PILL` });
    if (r.error) toast.error("Google sign-in failed.");
  };

  const signInFn = useServerFn(adminSignIn);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await signInFn({ data: { email: email.trim(), password } });
      if ("error" in res) throw new Error(res.error);
      const { data, error } = await supabase.auth.setSession(res);
      if (error || !data.user) throw new Error("Invalid login credentials.");
      try {
        await supabase.from("login_history").insert({ user_id: data.user.id, email: data.user.email ?? email, user_agent: navigator.userAgent });
      } catch { /* ignore */ }
      setEmail(""); setPassword("");
      toast.success("Welcome, admin!");
      navigate({ to: "/BB75TB170PILL/DASHBOARD", replace: true });
    } catch (err) {
      toast.error((err as Error).message || "Invalid login credentials.");
    } finally {
      setLoading(false);
    }
  };

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
            <span className="truncate text-muted-foreground">Google: <span className="text-foreground">{google}</span></span>
            <button type="button" onClick={() => supabase.auth.signOut()} className="text-gold underline">Switch</button>
          </div>
          <form onSubmit={submit} className="mt-3 space-y-3">
            <input className={inputCls} type="email" placeholder="Admin email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
