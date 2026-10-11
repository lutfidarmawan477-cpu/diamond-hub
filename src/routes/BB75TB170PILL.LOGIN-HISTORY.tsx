import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminSidebar } from "@/components/AdminSidebar";
import { toast } from "sonner";
import { usePolling, LEVEL_BADGE } from "@/hooks/usePolling";

type Customer = {
  id: string;
  full_name: string | null;
  email: string;
  registered_at: string;
  last_login: string | null;
  status: string;
  member_level: string | null;
};

export const Route = createFileRoute("/BB75TB170PILL/LOGIN-HISTORY")({
  head: () => ({ meta: [{ title: "Login History — Admin" }] }),
  component: AdminHistory,
});

function AdminHistory() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState("all");

  const load = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("admin_list_customers");
    if (error) toast.error(error.message);
    setRows((data as Customer[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { navigate({ to: "/BB75TB170PILL", replace: true }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", s.session.user.id);
      const admin = (roles ?? []).some((r) => r.role === "admin");
      if (!admin) { navigate({ to: "/customer/dashboard", replace: true }); return; }
      setIsAdmin(admin);
      await load();
    })();
  }, [navigate]);

  usePolling(() => { if (isAdmin) void load(); }, 10000);

  if (isAdmin === null) return <div className="container mx-auto p-10 text-center">Loading…</div>;
  if (!isAdmin) return <div className="container mx-auto p-10 text-center">Access denied</div>;

  const statusBadge = (s: string) => {
    const color =
      s === "active" ? "bg-success/20 text-success border-success/40"
      : s === "banned" ? "bg-destructive/20 text-destructive border-destructive/40"
      : "bg-muted text-muted-foreground border-border";
    return <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${color}`}>{s}</span>;
  };

  const levelBadge = (lvl: string | null) => {
    const l = (lvl ?? "bronze").toLowerCase();
    return <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${LEVEL_BADGE[l] ?? LEVEL_BADGE.bronze}`}>{l}</span>;
  };

  const filtered = rows.filter((r) => levelFilter === "all" || (r.member_level ?? "bronze").toLowerCase() === levelFilter);

  return (
    <div className="min-h-screen flex flex-col bg-background md:flex-row animate-fade-in">
      <AdminSidebar />
      <main className="admin-content flex-1 p-4 sm:p-6 min-w-0">
        <h1 className="font-display text-2xl mb-2">Login History</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Registered customer accounts and their most recent sign-in.
        </p>
        <div className="page-section">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{filtered.length} customers</span>
            <select
              className="rounded-md bg-input border border-border px-3 py-2 text-sm"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
            >
              <option value="all">All levels</option>
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="diamond">Diamond</option>
            </select>
          </div>
          {/* Desktop table */}
          <div className="hidden md:block table-scroll">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2 pr-3">Name</th>
                  <th className="pr-3">Email</th>
                  <th className="pr-3">Member Level</th>
                  <th className="pr-3">Registered</th>
                  <th className="pr-3">Last Login</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 hover:bg-accent/30 transition">
                    <td className="py-3 pr-3">{r.full_name ?? "—"}</td>
                    <td className="pr-3 break-all">{r.email}</td>
                    <td className="pr-3">{levelBadge(r.member_level)}</td>
                    <td className="pr-3 text-xs whitespace-nowrap">{new Date(r.registered_at).toLocaleString("en-US")}</td>
                    <td className="pr-3 text-xs whitespace-nowrap">{r.last_login ? new Date(r.last_login).toLocaleString("en-US") : "—"}</td>
                    <td>{statusBadge(r.status)}</td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Nothing to show yet</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Loading…</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden table-scroll">
            {filtered.map((r) => (
              <div key={r.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground break-all">{r.email}</div>
                  </div>
                  {statusBadge(r.status)}
                </div>
                <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs items-center">
                  <div className="text-muted-foreground">Member</div>
                  <div className="text-right">{levelBadge(r.member_level)}</div>
                  <div className="text-muted-foreground">Registered</div>
                  <div className="text-right">{new Date(r.registered_at).toLocaleString("en-US")}</div>
                  <div className="text-muted-foreground">Last Login</div>
                  <div className="text-right">{r.last_login ? new Date(r.last_login).toLocaleString("en-US") : "—"}</div>
                </div>
              </div>
            ))}
            {!loading && filtered.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Nothing to show yet</div>}
            {loading && <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
