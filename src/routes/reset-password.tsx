import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — DiamondHub" },
      { name: "description", content: "Set a new password for your DiamondHub account." },
      { property: "og:title", content: "Reset your DiamondHub password" },
      { property: "og:description", content: "Choose a new password to regain access to your DiamondHub account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const isRecovery = hash.includes("type=recovery");
    supabase.auth.getSession().then(({ data }) => {
      setValid(isRecovery || !!data.session);
      setReady(true);
    });
  }, []);

  const passwordValid = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValid) return toast.error("Password must be at least 8 characters and contain letters and numbers.");
    if (password !== confirm) return toast.error("Passwords do not match.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. Please sign in with your new password.");
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (!ready) {
    return <div className="container mx-auto px-4 py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!valid) {
    return (
      <div className="container mx-auto max-w-md px-4 py-16 text-center">
        <div className="card-premium rounded-2xl p-6">
          <h1 className="font-display text-xl">Reset link invalid or expired</h1>
          <p className="mt-2 text-sm text-muted-foreground">Please request a new password reset link.</p>
          <Link to="/auth" className="mt-5 inline-block rounded-md btn-gold px-5 py-2.5 text-sm">Back to Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-md px-4 py-16">
      <div className="card-premium rounded-2xl p-6 animate-scale-in">
        <KeyRound className="mx-auto h-9 w-9 text-gold" />
        <h1 className="mt-3 text-center font-display text-2xl">Set a new password</h1>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <div className="relative">
            <input
              className={`${inputCls} pr-10`}
              type={show ? "text" : "password"}
              placeholder="New password (min. 8 chars, letters & numbers)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition hover:text-foreground"
            >
              {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          </div>
          {password.length > 0 && !passwordValid && (
            <p className="text-xs text-destructive">Password must be at least 8 characters and contain letters and numbers.</p>
          )}
          <input
            className={inputCls}
            type={show ? "text" : "password"}
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {confirm.length > 0 && confirm !== password && (
            <p className="text-xs text-destructive">Passwords do not match.</p>
          )}
          <button disabled={saving} className="w-full rounded-md btn-gold py-3 text-sm disabled:opacity-50 active:scale-95 transition">
            {saving ? "Saving…" : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-md bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary";
