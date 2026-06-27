import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AdminSidebar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
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
    <aside className="flex w-full flex-col border-b border-border p-4 md:min-h-screen md:w-60 md:border-b-0 md:border-r">
      <div className="flex items-center gap-2 mb-6">
        <div className="grid h-9 w-9 place-items-center rounded-lg btn-gold">💎</div>
        <span className="font-display font-bold">Admin Panel</span>
      </div>
      <nav className="flex flex-wrap gap-1 text-sm md:flex-1 md:flex-col md:flex-nowrap">
        {item("/admin", "Dashboard", "📊")}
        {item("/admin/packages", "CRUD Barang", "💎")}
        {item("/admin/history", "Riwayat Login", "🕒")}
      </nav>
      <button
        onClick={signOut}
        className="mt-4 w-full rounded-md border border-border px-3 py-2 text-left text-sm transition hover:border-destructive hover:text-destructive md:w-auto"
      >
        ⎋ Keluar
      </button>
    </aside>
  );
}
