import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldCheck, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/login")({
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lockUntil = Number(sessionStorage.getItem("admin_lock") ?? 0);
    if (Date.now() < lockUntil) {
      return toast.error(`Too many attempts. Try again in ${Math.ceil((lockUntil - Date.now()) / 1000)}s.`);
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error("Invalid email or password.");
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      if (!(roles ?? []).some((r) => r.role === "admin")) {
        await supabase.auth.signOut();
        throw new Error("This account does not have admin access.");
      }
      try {
        await supabase.from("login_history").insert({ user_id: data.user.id, email: data.user.email ?? email, user_agent: navigator.userAgent });
      } catch { /* ignore */ }
      sessionStorage.removeItem("admin_fails");
      setEmail(""); setPassword("");
      toast.success("Welcome, admin!");
      navigate({ to: "/admin/dashboard", replace: true });
    } catch (err) {
      const fails = Number(sessionStorage.getItem("admin_fails") ?? 0) + 1;
      if (fails >= 5) {
        sessionStorage.setItem("admin_lock", String(Date.now() + 60_000));
        sessionStorage.setItem("admin_fails", "0");
      } else sessionStorage.setItem("admin_fails", String(fails));
      toast.error((err as Error).message);
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
          <form onSubmit={submit} className="mt-5 space-y-3">
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
        </div>
        <Link to="/" className="mt-4 inline-flex w-full items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-[18px] w-[18px]" /> Back to Home
        </Link>
      </div>
    </div>
  );
}
