import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatIDR } from "@/lib/format";
import { toast } from "sonner";
import { AdminSidebar } from "@/components/AdminSidebar";
import { usePolling } from "@/hooks/usePolling";
import { PERIOD_OPTIONS, type Period, inPeriod, periodBuckets } from "@/lib/period";
import { exportCsv } from "@/lib/export-csv";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Order = {
  id: string; invoice_no: string; package_name: string; diamond_amount: number;
  total: number; status: string; created_at: string; payment_method_name: string;
  buyer_name: string; buyer_email: string; game_user_id: string; zone_id: string;
  user_id: string | null;
};

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — DiamondHub" },
      { name: "description", content: "Sales analytics, revenue charts and purchase history for DiamondHub administrators." },
      { property: "og:title", content: "Admin Dashboard — DiamondHub" },
      { property: "og:description", content: "Sales analytics, revenue charts and purchase history for DiamondHub administrators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const isPaid = (s: string) => s === "success" || s === "paid";
const isFailed = (s: string) => s === "failed" || s === "expired";

function AdminPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("month");
  const [confirming, setConfirming] = useState<string | null>(null);

  const loadOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("id,invoice_no,package_name,diamond_amount,total,status,created_at,payment_method_name,buyer_name,buyer_email,game_user_id,zone_id,user_id")
      .order("created_at", { ascending: false }).limit(500);
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

  const confirmPayment = async (o: Order) => {
    setConfirming(o.id);
    const { error } = await supabase.from("orders").update({ status: "paid" }).eq("id", o.id);
    setConfirming(null);
    if (error) return toast.error(error.message);
    toast.success(`Payment confirmed for ${o.invoice_no}`);
    await loadOrders();
  };

  const periodOrders = useMemo(
    () => orders.filter((o) => inPeriod(o.created_at, period)),
    [orders, period],
  );

  const chart = useMemo(() => {
    const { keys, keyOf } = periodBuckets(period, orders.map((o) => o.created_at));
    const map = new Map(keys.map((k) => [k, { name: k, revenue: 0, orders: 0 }]));
    for (const o of periodOrders) {
      const row = map.get(keyOf(new Date(o.created_at)));
      if (!row) continue;
      row.orders += 1;
      if (isPaid(o.status)) row.revenue += o.total;
    }
    return Array.from(map.values());
  }, [periodOrders, orders, period]);

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
    if (filter === "success") return isPaid(o.status);
    if (filter === "failed") return isFailed(o.status);
    return o.status === filter;
  };
  const filtered = periodOrders.filter((o) => matchesStatus(o) && (
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
    total: periodOrders.length,
    success: periodOrders.filter((o) => isPaid(o.status)).length,
    pending: periodOrders.filter((o) => o.status === "pending").length,
    failed: periodOrders.filter((o) => isFailed(o.status)).length,
    revenue: periodOrders.filter((o) => isPaid(o.status)).reduce((a, b) => a + b.total, 0),
  };

  const exportHistory = () => {
    exportCsv(
      `purchase-history-${period}.csv`,
      ["Invoice", "Buyer", "Email", "Type", "Package", "User ID", "Server", "Total", "Date & Time (WIB)", "Status"],
      filtered.map((o) => [
        o.invoice_no, o.buyer_name, o.buyer_email, o.user_id ? "Member" : "Guest",
        o.package_name, o.game_user_id, o.zone_id, o.total, formatWib(o.created_at), o.status,
      ]),
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col md:flex-row">
        <AdminSidebar />

        <main className="flex-1 p-4 sm:p-6 min-w-0">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-2xl">Admin Dashboard</h1>
            <select
              className="rounded-md bg-input border border-border px-3 py-2 text-sm"
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
            >
              {PERIOD_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          {/* Statistics cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Total Orders" value={stats.total.toString()} />
            <Stat label="Successful" value={stats.success.toString()} />
            <Stat label="Pending" value={stats.pending.toString()} />
            <Stat label="Failed" value={stats.failed.toString()} />
            <Stat label="Revenue" value={formatIDR(stats.revenue)} className="col-span-2 sm:col-span-1" />
          </div>


          {/* Sales analytics */}
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <div className="card-premium rounded-xl p-4 sm:p-5">
              <h2 className="font-display text-lg mb-3">Revenue</h2>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="var(--gold)" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={60}
                      tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => formatIDR(Number(v))}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="var(--gold)" strokeWidth={2} fill="url(#revFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card-premium rounded-xl p-4 sm:p-5">
              <h2 className="font-display text-lg mb-3">Orders</h2>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={36} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="orders" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
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
              <button onClick={exportHistory}
                className="rounded-md btn-gold px-4 py-2 text-sm active:scale-95 transition">
                Export Excel
              </button>
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
                    <th className="pr-3">Status</th>
                    <th>Action</th>
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
                      <td className="pr-3">{statusBadge(o.status)}</td>
                      <td>
                        {o.status === "pending" ? (
                          <button onClick={() => confirmPayment(o)} disabled={confirming === o.id}
                            className="rounded-md btn-gold px-3 py-1.5 text-xs whitespace-nowrap disabled:opacity-50 active:scale-95 transition">
                            {confirming === o.id ? "Saving…" : "Confirm Payment"}
                          </button>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-sm text-muted-foreground">No data</td></tr>}
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
                  {o.status === "pending" && (
                    <button onClick={() => confirmPayment(o)} disabled={confirming === o.id}
                      className="mt-2 w-full rounded-md btn-gold px-3 py-2 text-xs disabled:opacity-50 active:scale-95 transition">
                      {confirming === o.id ? "Saving…" : "Confirm Payment"}
                    </button>
                  )}
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

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`card-premium rounded-xl p-4 sm:p-5 min-w-0 ${className}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-xl sm:text-2xl gold-text mt-1 truncate">{value}</div>
    </div>
  );
}
