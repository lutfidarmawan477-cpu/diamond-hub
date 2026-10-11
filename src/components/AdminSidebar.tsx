import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LayoutDashboard, Package, History, LogOut, Boxes, Ticket, Menu, X, Diamond, type LucideIcon } from "lucide-react";

const NAV_ITEMS: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: "/BB75TB170PILL/DASHBOARD", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/BB75TB170PILL/MANAGE-PRODUCT", label: "Manage Products", Icon: Package },
  { to: "/BB75TB170PILL/DIAMOND-STOCK", label: "Diamond Stock", Icon: Boxes },
  { to: "/BB75TB170PILL/VOUCHERS", label: "Vouchers", Icon: Ticket },
  { to: "/BB75TB170PILL/LOGIN-HISTORY", label: "Login History", Icon: History },
];

export function AdminSidebar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate({ to: "/BB75TB170PILL", replace: true });
  };

  const item = (to: string, label: string, Icon: LucideIcon, onNavigate?: () => void) => {
    const active = pathname === to;
    return (
      <Link
        key={to}
        to={to}
        onClick={onNavigate}
        className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${active ? "bg-primary/20 text-foreground" : "hover:bg-accent text-muted-foreground hover:text-foreground"}`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* ===== Mobile: hamburger menu (hidden on md and up) ===== */}
      <div className="md:hidden">
        <Button variant="legacy" size="legacy"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          className="fixed right-3 top-3 z-50 grid h-11 w-11 place-items-center rounded-full border border-border bg-card/95 text-foreground shadow-lg transition active:scale-95"
        >
          {mobileOpen ? <X className="h-5 w-5" strokeWidth={2} /> : <Menu className="h-5 w-5" strokeWidth={2} />}
        </Button>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-overlay animate-fade-in" onClick={() => setMobileOpen(false)} />
            {/* Panel */}
            <aside className="absolute right-3 top-16 w-64 rounded-lg border border-border bg-card p-4 shadow-2xl animate-slide-up">
              <div className="mb-4 flex items-center gap-2">
                <Diamond className="h-6 w-6 text-gold" strokeWidth={1.6} />
                <span className="font-display font-bold">Admin Page</span>
              </div>
              <nav className="flex flex-col gap-1 text-sm">
                {NAV_ITEMS.map(({ to, label, Icon }) => item(to, label, Icon, () => setMobileOpen(false)))}
              </nav>
              <Button variant="legacy" size="legacy"
                onClick={() => {
                  setMobileOpen(false);
                  void signOut();
                }}
                className="mt-4 inline-flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm transition hover:border-destructive hover:text-destructive"
              >
                <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
                <span>Sign Out</span>
              </Button>
            </aside>
          </div>
        )}
      </div>

      {/* ===== Desktop / Tablet sidebar (unchanged) ===== */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:self-start md:flex-col md:overflow-y-auto md:border-r md:border-border md:p-4">
        <div className="mb-6 flex items-center gap-2">
          <Diamond className="h-6 w-6 text-gold" strokeWidth={1.6} />
          <span className="font-display font-bold">Admin Page</span>
        </div>
        <nav className="flex flex-1 flex-col flex-nowrap gap-1 text-sm">
          {NAV_ITEMS.map(({ to, label, Icon }) => item(to, label, Icon))}
        </nav>
        <Button variant="legacy" size="legacy"
          onClick={signOut}
          className="mt-4 inline-flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm transition hover:border-destructive hover:text-destructive md:w-auto"
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
          <span>Sign Out</span>
        </Button>
      </aside>
    </>
  );
}
