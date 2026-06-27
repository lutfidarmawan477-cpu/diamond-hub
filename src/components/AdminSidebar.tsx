import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AdminSidebar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Berhasil keluar");
    navigate({ to: "/auth", replace: true });
  };

  const item = (to: string, label: string, icon: string) => {
    const active = pathname === to;
    return (
      <Link
        to={to}
        className={`block rounded-md px-3 py-2 ${active ? "bg-primary/20 text-foreground" : "hover:bg-accent text-muted-foreground"}`}
      >
        <span className="mr-2">{icon}</span>
        {label}
      </Link>
    );
  };

  return (
    <aside className="hidden md:flex flex-col w-60 border-r border-border min-h-screen p-4">
      <div className="flex items-center gap-2 mb-6">
        <div className="grid h-9 w-9 place-items-center rounded-lg btn-gold">💎</div>
        <span className="font-display font-bold">Admin Panel</span>
      </div>
      <nav className="space-y-1 text-sm flex-1">
        {item("/admin", "Dashboard", "📊")}
        {item("/admin/packages", "Paket Diamond", "💎")}
        {item("/admin/history", "Login History", "🕒")}
      </nav>
      <button
        onClick={signOut}
        className="mt-4 w-full text-left rounded-md px-3 py-2 text-sm border border-border hover:border-destructive hover:text-destructive transition"
      >
        ⎋ Keluar
      </button>
    </aside>
  );
}
