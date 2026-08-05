import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, MailCheck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In / Sign Up — DiamondHub" },
      { name: "description", content: "Sign in or create your DiamondHub account to track your transactions and rewards." },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

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

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const passwordValid = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid) return toast.error("Please enter a valid email address.");
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setResetSent(true);
        toast.success("Password reset link sent. Please check your email.");
      } else if (mode === "signup") {
        if (!passwordValid) {
          throw new Error("Password must be at least 8 characters and contain letters and numbers.");
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          await trackLogin(data.session.user.id, data.session.user.email ?? email);
          await redirectByRole(data.session.user.id);
        } else {
          setSentTo(email.trim());
          toast.success("Verification email sent. Please confirm your email before signing in.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          if (/confirm/i.test(error.message)) {
            throw new Error("Your email is not verified yet. Please open the verification link we emailed you.");
          }
          throw error;
        }
        toast.success("Welcome back!");
        await trackLogin(data.user.id, data.user.email ?? email);
        await redirectByRole(data.user.id);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    if (!sentTo) return;
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: sentTo,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Verification email sent again.");
  };

  if (checkingSession) {
    return <div className="container mx-auto px-4 py-16 text-center text-sm text-muted-foreground">Redirecting…</div>;
  }

  if (sentTo) {
    return (
      <div className="container mx-auto max-w-md px-4 py-16">
        <div className="card-premium rounded-2xl p-6 text-center animate-scale-in">
          <MailCheck className="mx-auto h-10 w-10 text-gold" />
          <h1 className="font-display text-2xl mt-3">Verify your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a verification link to <span className="text-gold">{sentTo}</span>. Click the link to activate your
            account, then sign in.
          </p>
          <button
            onClick={resendVerification}
            disabled={loading}
            className="mt-5 w-full rounded-md border border-primary/60 bg-primary/10 py-2.5 text-sm font-semibold transition hover:bg-primary/20 active:scale-95 disabled:opacity-50"
          >
            {loading ? "Sending…" : "Resend verification email"}
          </button>
          <button
            onClick={() => { setSentTo(null); setMode("login"); setPassword(""); }}
            className="mt-3 w-full rounded-md btn-gold py-2.5 text-sm active:scale-95 transition"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-md px-4 py-16">
      <div className="card-premium rounded-2xl p-6">
        <h1 className="font-display text-2xl text-center">
          {mode === "login" ? "Sign In" : mode === "signup" ? "Sign Up" : "Forgot Password"}
        </h1>

        {mode !== "forgot" && (
          <div className="mt-4 flex rounded-lg border border-border p-1 text-sm">
            <button onClick={() => setMode("login")} className={`flex-1 rounded-md py-2 transition ${mode === "login" ? "btn-gold" : ""}`}>Sign In</button>
            <button onClick={() => setMode("signup")} className={`flex-1 rounded-md py-2 transition ${mode === "signup" ? "btn-gold" : ""}`}>Sign Up</button>
          </div>
        )}

        {mode === "forgot" && resetSent ? (
          <div className="mt-5 text-center">
            <MailCheck className="mx-auto h-9 w-9 text-gold" />
            <p className="mt-3 text-sm text-muted-foreground">
              A password reset link has been sent to <span className="text-gold">{email}</span>. Open it to set a new password.
            </p>
            <button
              onClick={() => { setResetSent(false); setMode("login"); }}
              className="mt-5 w-full rounded-md btn-gold py-2.5 text-sm active:scale-95 transition"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            {mode === "signup" && (
              <input className={inputCls} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
            )}
            <div>
              <input
                className={inputCls}
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {email.length > 0 && !emailValid && (
                <p className="mt-1 text-xs text-destructive">Please enter a valid email address.</p>
              )}
            </div>

            {mode !== "forgot" && (
              <div>
                <div className="relative">
                  <input
                    className={`${inputCls} pr-10`}
                    type={showPassword ? "text" : "password"}
                    placeholder={mode === "signup" ? "Password (min. 8 chars, letters & numbers)" : "Password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
                {mode === "signup" && password.length > 0 && !passwordValid && (
                  <p className="mt-1 text-xs text-destructive">
                    Password must be at least 8 characters and contain letters and numbers.
                  </p>
                )}
              </div>
            )}

            <button disabled={loading} className="w-full rounded-md btn-gold py-3 text-sm disabled:opacity-50 active:scale-95 transition">
              {loading ? "Processing…" : mode === "login" ? "Sign In" : mode === "signup" ? "Sign Up" : "Send Reset Link"}
            </button>

            {mode === "login" && (
              <button type="button" onClick={() => setMode("forgot")} className="w-full text-center text-xs text-gold underline">
                Forgot your password?
              </button>
            )}
            {mode === "forgot" && (
              <button type="button" onClick={() => setMode("login")} className="w-full text-center text-xs text-gold underline">
                Back to Sign In
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-md bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary";
