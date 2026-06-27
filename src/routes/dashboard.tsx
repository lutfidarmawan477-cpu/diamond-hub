import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatIDR } from "@/lib/format";
import { toast } from "sonner";

type Order = {
  id: string; invoice_no: string; package_name: string; diamond_amount: number;
  total: number; status: string; created_at: string; payment_method_name: string;
};

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — DiamondHub" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { navigate({ to: "/auth", replace: true }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", s.session.user.id);
      if ((roles ?? []).some((r) => r.role === "admin")) {
        navigate({ to: "/admin", replace: true });
        return;
      }
      setEmail(s.session.user.email ?? null);
      const { data, error } = await supabase
        .from("orders")
        .select("id,invoice_no,package_name,diamond_amount,total,status,created_at,payment_method_name")
        .eq("buyer_email", s.session.user.email ?? "")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) toast.error(error.message);
      setOrders((data as Order[]) ?? []);
      setLoading(false);
    })();
  }, [navigate]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const totalSpent = orders?.filter((o) => o.status === "success" || o.status === "paid").reduce((a, b) => a + b.total, 0) ?? 0;
  const totalOrders = orders?.length ?? 0;

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        <button onClick={signOut} className="rounded-md border border-border px-4 py-2 text-sm hover:border-destructive transition">Keluar</button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Total Transaksi" value={totalOrders.toString()} />
        <StatCard label="Total Pembelian" value={formatIDR(totalSpent)} />
        <StatCard label="Member Level" value="Bronze" />
      </div>

      <div className="mt-8 card-premium rounded-xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display text-lg">Riwayat Transaksi</h2>
          <Link to="/topup" className="rounded-md btn-gold px-4 py-2 text-xs">+ Top Up</Link>
        </div>
        {loading && <div className="text-sm text-muted-foreground">Memuat…</div>}
        {!loading && (orders?.length ?? 0) === 0 && <div className="text-sm text-muted-foreground">Belum ada transaksi.</div>}
        {!loading && orders && orders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b border-border">
                <tr><th className="py-2">Invoice</th><th>Paket</th><th>Pembayaran</th><th>Total</th><th>Status</th><th>Tanggal</th><th></th></tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-border/60">
                    <td className="py-3 font-mono text-xs">{o.invoice_no}</td>
                    <td>{o.package_name}</td>
                    <td>{o.payment_method_name}</td>
                    <td className="gold-text font-semibold">{formatIDR(o.total)}</td>
                    <td><span className="rounded-full border border-border px-2 py-0.5 text-xs">{o.status}</span></td>
                    <td className="text-muted-foreground text-xs">{new Date(o.created_at).toLocaleDateString("id-ID")}</td>
                    <td><Link to="/invoice/$invoice" params={{ invoice: o.invoice_no }} className="text-gold underline text-xs">Detail</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-premium rounded-xl p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-2xl gold-text mt-1">{value}</div>
    </div>
  );
}
