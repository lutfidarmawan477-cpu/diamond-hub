import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Masuk / Daftar — DiamondHub" },
      { name: "description", content: "Masuk atau daftar akun DiamondHub untuk melacak transaksi dan poin." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        await redirectByRole(data.session.user.id);
      }
      setCheckingSession(false);
    });
  }, []);

  const redirectByRole = async (userId: string) => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    navigate({ to: isAdmin ? "/admin" : "/dashboard", replace: true });
  };

  const trackLogin = async (userId: string, userEmail: string) => {
    try {
      await supabase.from("login_history").insert({
        user_id: userId,
        email: userEmail,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });
    } catch { /* ignore */ }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Pendaftaran berhasil!");
        if (data.session) {
          await trackLogin(data.session.user.id, data.session.user.email ?? email);
          await redirectByRole(data.session.user.id);
        } else navigate({ to: "/dashboard" });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Selamat datang kembali!");
        await trackLogin(data.user.id, data.user.email ?? email);
        await redirectByRole(data.user.id);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };


  if (checkingSession) {
    return <div className="container mx-auto px-4 py-16 text-center text-sm text-muted-foreground">Mengalihkan…</div>;
  }

  return (
    <div className="container mx-auto max-w-md px-4 py-16">
      <div className="card-premium rounded-2xl p-6">
        <h1 className="font-display text-2xl text-center">{mode === "login" ? "Masuk" : "Daftar"}</h1>
        <div className="mt-4 flex rounded-lg border border-border p-1 text-sm">
          <button onClick={() => setMode("login")} className={`flex-1 rounded-md py-2 transition ${mode === "login" ? "btn-gold" : ""}`}>Masuk</button>
          <button onClick={() => setMode("signup")} className={`flex-1 rounded-md py-2 transition ${mode === "signup" ? "btn-gold" : ""}`}>Daftar</button>
        </div>
        <form onSubmit={submit} className="mt-5 space-y-3">
          {mode === "signup" && (
            <input className={inputCls} placeholder="Nama lengkap" value={name} onChange={(e) => setName(e.target.value)} required />
          )}
          <input className={inputCls} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className={inputCls} type="password" placeholder="Password (min. 6 karakter)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
          <button disabled={loading} className="w-full rounded-md btn-gold py-3 text-sm disabled:opacity-50">
            {loading ? "Memproses…" : mode === "login" ? "Masuk" : "Daftar"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-md bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary";
