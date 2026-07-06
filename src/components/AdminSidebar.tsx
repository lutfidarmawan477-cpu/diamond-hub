import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LayoutDashboard, Package, History, LogOut, Boxes, Ticket, type LucideIcon } from "lucide-react";

export function AdminSidebar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate({ to: "/auth", replace: true });
  };

  const item = (to: string, label: string, Icon: LucideIcon) => {
    const active = pathname === to;
    return (
      <Link
        to={to}
        className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${active ? "bg-primary/20 text-foreground" : "hover:bg-accent text-muted-foreground hover:text-foreground"}`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <aside className="flex w-full flex-col border-b border-border p-4 md:min-h-screen md:w-60 md:border-b-0 md:border-r">
      <div className="flex items-center gap-2 mb-6">
        <div className="grid h-9 w-9 place-items-center rounded-lg btn-gold">💎</div>
        <span className="font-display font-bold">Admin Page</span>
      </div>
      <nav className="flex flex-wrap gap-1 text-sm md:flex-1 md:flex-col md:flex-nowrap">
        {item("/admin", "Dashboard", LayoutDashboard)}
        {item("/admin/packages", "Manage Products", Package)}
        {item("/admin/stock", "Diamond Stock", Boxes)}
        {item("/admin/vouchers", "Vouchers", Ticket)}
        {item("/admin/history", "Login History", History)}
      </nav>
      <button
        onClick={signOut}
        className="mt-4 inline-flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm transition hover:border-destructive hover:text-destructive md:w-auto"
      >
        <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
        <span>Sign Out</span>
      </button>
    </aside>
  );
}
