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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Pendaftaran berhasil!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Selamat datang kembali!");
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

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
