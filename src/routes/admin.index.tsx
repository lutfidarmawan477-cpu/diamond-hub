import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatIDR } from "@/lib/format";
import { toast } from "sonner";
import { AdminSidebar } from "@/components/AdminSidebar";
import { usePolling } from "@/hooks/usePolling";

type Order = {
  id: string; invoice_no: string; package_name: string; diamond_amount: number;
  total: number; status: string; created_at: string; payment_method_name: string;
  buyer_name: string; buyer_email: string; game_user_id: string; zone_id: string;
  user_id: string | null;
};

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin — DiamondHub" }] }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const loadOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("id,invoice_no,package_name,diamond_amount,total,status,created_at,payment_method_name,buyer_name,buyer_email,game_user_id,zone_id,user_id")
      .order("created_at", { ascending: false }).limit(200);
    if (error) toast.error(error.message);
    setOrders((data as Order[]) ?? []);
  };

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { navigate({ to: "/auth", replace: true }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", s.session.user.id);
      const admin = (roles ?? []).some((r) => r.role === "admin");
      if (!admin) { navigate({ to: "/dashboard", replace: true }); return; }
      setIsAdmin(admin);
      await loadOrders();
    })();
  }, [navigate]);

  usePolling(() => { if (isAdmin) void loadOrders(); }, 8000);

  if (isAdmin === null) {
    return <div className="container mx-auto p-10 text-center">Loading…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="container mx-auto max-w-md p-10 text-center">
        <h1 className="font-display text-2xl">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">Customer accounts cannot access the admin area.</p>
        <Link to="/dashboard" className="mt-4 inline-block text-gold underline">Back to Dashboard</Link>
      </div>
    );
  }

  const matchesStatus = (o: Order) => {
    if (filter === "all") return true;
    if (filter === "success") return o.status === "success" || o.status === "paid";
    if (filter === "failed") return o.status === "failed" || o.status === "expired";
    return o.status === filter;
  };
  const filtered = orders.filter((o) => matchesStatus(o) && (
    !search || o.invoice_no.toLowerCase().includes(search.toLowerCase()) || o.buyer_email.toLowerCase().includes(search.toLowerCase())
  ));

  const statusBadge = (s: string) => {
    const st = s === "paid" ? "success" : s === "expired" ? "failed" : s;
    const color =
      st === "success" ? "bg-success/20 text-success border-success/40"
      : st === "pending" ? "bg-gold/20 text-gold border-gold/40"
      : "bg-destructive/20 text-destructive border-destructive/40";
    return <span className={`rounded-full border px-2 py-0.5 text-xs uppercase ${color}`}>{st}</span>;
  };

  const stats = {
    total: orders.length,
    success: orders.filter((o) => o.status === "success" || o.status === "paid").length,
    pending: orders.filter((o) => o.status === "pending").length,
    failed: orders.filter((o) => o.status === "failed" || o.status === "expired").length,
    revenue: orders.filter((o) => o.status === "success" || o.status === "paid").reduce((a, b) => a + b.total, 0),
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col md:flex-row">
        <AdminSidebar />

        <main className="flex-1 p-4 sm:p-6 min-w-0">
          <h1 className="font-display text-2xl mb-6">Admin Dashboard</h1>

          {/* Statistics cards — one mobile-style card design across all breakpoints */}
          <div className="mb-6 flex gap-3 overflow-x-auto pb-2 snap-x">
            <Stat label="Total Orders" value={stats.total.toString()} />
            <Stat label="Successful" value={stats.success.toString()} />
            <Stat label="Pending" value={stats.pending.toString()} />
            <Stat label="Failed" value={stats.failed.toString()} />
            <Stat label="Revenue" value={formatIDR(stats.revenue)} />
          </div>



          <div className="card-premium rounded-xl p-5">
            <h2 className="font-display text-lg mb-4">Purchase History</h2>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <input className="rounded-md bg-input border border-border px-3 py-2 text-sm flex-1 min-w-[180px]"
                placeholder="Search invoice / email…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="rounded-md bg-input border border-border px-3 py-2 text-sm"
                value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className="hidden md:block table-scroll">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2 pr-3">Invoice</th>
                    <th className="pr-3">Buyer</th>
                    <th className="pr-3">Package</th>
                    <th className="pr-3">ID</th>
                    <th className="pr-3">Server</th>
                    <th className="pr-3">Total</th>
                    <th className="pr-3">Date &amp; Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o.id} className="border-b border-border/60">
                      <td className="py-3 pr-3 font-mono text-xs"><Link to="/invoice/$invoice" params={{ invoice: o.invoice_no }} className="text-gold underline">{o.invoice_no}</Link></td>
                      <td className="pr-3">
                        {o.buyer_name}
                        <div className="text-xs text-muted-foreground">{o.buyer_email}</div>
                        {!o.user_id && (
                          <span className="mt-1 inline-block rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">Guest</span>
                        )}
                      </td>
                      <td className="pr-3">{o.package_name}</td>
                      <td className="pr-3 font-mono text-xs">{o.game_user_id}</td>
                      <td className="pr-3 font-mono text-xs">{o.zone_id}</td>
                      <td className="pr-3 gold-text font-semibold whitespace-nowrap">{formatIDR(o.total)}</td>
                      <td className="pr-3 text-xs whitespace-nowrap">{formatWib(o.created_at)}</td>
                      <td>{statusBadge(o.status)}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No data</td></tr>}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden table-scroll">
              {filtered.map((o) => (
                <div key={o.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link to="/invoice/$invoice" params={{ invoice: o.invoice_no }} className="font-mono text-[11px] text-gold underline truncate">{o.invoice_no}</Link>
                    {statusBadge(o.status)}
                  </div>
                  <div className="mt-1 text-sm font-medium truncate">{o.package_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{o.buyer_name} · {o.buyer_email}</div>
                  {!o.user_id && (
                    <span className="mt-1 inline-block rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">Guest</span>
                  )}
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div className="text-muted-foreground">ID</div>
                    <div className="text-right font-mono">{o.game_user_id}</div>
                    <div className="text-muted-foreground">Server</div>
                    <div className="text-right font-mono">{o.zone_id}</div>
                    <div className="text-muted-foreground">Date &amp; Time</div>
                    <div className="text-right">{formatWib(o.created_at)}</div>
                  </div>
                  <div className="mt-2 gold-text font-semibold">{formatIDR(o.total)}</div>
                </div>
              ))}
              {filtered.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No data</div>}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/** DD/MM/YYYY HH:mm WIB */
function formatWib(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")} WIB`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-premium rounded-xl p-5 min-w-[170px] flex-1 shrink-0 snap-start">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-2xl gold-text mt-1 whitespace-nowrap">{value}</div>
    </div>
  );
}

