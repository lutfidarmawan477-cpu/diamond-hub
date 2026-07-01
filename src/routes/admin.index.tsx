import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatIDR } from "@/lib/format";
import { toast } from "sonner";
import { AdminSidebar } from "@/components/AdminSidebar";

type Order = {
  id: string; invoice_no: string; package_name: string; diamond_amount: number;
  total: number; status: string; created_at: string; payment_method_name: string;
  buyer_name: string; buyer_email: string; game_user_id: string;
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

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { navigate({ to: "/auth", replace: true }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", s.session.user.id);
      const admin = (roles ?? []).some((r) => r.role === "admin");
      if (!admin) { navigate({ to: "/dashboard", replace: true }); return; }
      setIsAdmin(admin);
      if (admin) {
        const { data, error } = await supabase
          .from("orders").select("id,invoice_no,package_name,diamond_amount,total,status,created_at,payment_method_name,buyer_name,buyer_email,game_user_id")
          .order("created_at", { ascending: false }).limit(200);
        if (error) toast.error(error.message);
        setOrders((data as Order[]) ?? []);
      }
    })();
  }, [navigate]);

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

  const filtered = orders.filter((o) => (filter === "all" || o.status === filter) && (
    !search || o.invoice_no.toLowerCase().includes(search.toLowerCase()) || o.buyer_email.toLowerCase().includes(search.toLowerCase())
  ));

  const stats = {
    total: orders.length,
    success: orders.filter((o) => o.status === "success" || o.status === "paid").length,
    pending: orders.filter((o) => o.status === "pending").length,
    revenue: orders.filter((o) => o.status === "success" || o.status === "paid").reduce((a, b) => a + b.total, 0),
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col md:flex-row">
        <AdminSidebar />

        <main className="flex-1 p-6">
          <h1 className="font-display text-2xl mb-6">Admin Dashboard</h1>

          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Stat label="Total Orders" value={stats.total.toString()} />
            <Stat label="Successful" value={stats.success.toString()} />
            <Stat label="Pending" value={stats.pending.toString()} />
            <Stat label="Revenue" value={formatIDR(stats.revenue)} />
          </div>

          <div className="card-premium rounded-xl p-5">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <input className="rounded-md bg-input border border-border px-3 py-2 text-sm flex-1 min-w-[180px]"
                placeholder="Search invoice / email…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="rounded-md bg-input border border-border px-3 py-2 text-sm"
                value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground border-b border-border">
                  <tr><th className="py-2">Invoice</th><th>Buyer</th><th>Package</th><th>Total</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o.id} className="border-b border-border/60">
                      <td className="py-3 font-mono text-xs"><Link to="/invoice/$invoice" params={{ invoice: o.invoice_no }} className="text-gold underline">{o.invoice_no}</Link></td>
                      <td>{o.buyer_name}<div className="text-xs text-muted-foreground">{o.buyer_email}</div></td>
                      <td>{o.package_name}<div className="text-xs text-muted-foreground">ID: {o.game_user_id}</div></td>
                      <td className="gold-text font-semibold">{formatIDR(o.total)}</td>
                      <td>
                        <span className="rounded-full border border-border px-2 py-0.5 text-xs uppercase">{o.status}</span>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-premium rounded-xl p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-2xl gold-text mt-1">{value}</div>
    </div>
  );
}
