import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminSidebar } from "@/components/AdminSidebar";
import { usePolling } from "@/hooks/usePolling";
import { PERIOD_OPTIONS, type Period, inPeriod, periodBuckets } from "@/lib/period";
import { exportCsv } from "@/lib/export-csv";
import { useAxisProps } from "@/lib/chart-axis";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type HistoryRow = {
  id: string;
  activity_type: "add" | "deduct";
  amount: number;
  admin_id: string | null;
  order_id: string | null;
  note: string | null;
  created_at: string;
};

export const Route = createFileRoute("/admin/diamond-stock")({
  head: () => ({
    meta: [
      { title: "Diamond Stock — DiamondHub Admin" },
      { name: "description", content: "Track diamond inventory, add stock and review add/deduct movement history." },
      { property: "og:title", content: "Diamond Stock — DiamondHub Admin" },
      { property: "og:description", content: "Track diamond inventory, add stock and review add/deduct movement history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminStock,
});

function AdminStock() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [stock, setStock] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "add" | "deduct">("all");
  const [period, setPeriod] = useState<Period>("month");
  const axis = useAxisProps(period);


  const load = async () => {
    const [s, h] = await Promise.all([
      supabase.from("diamond_stock").select("current_stock").eq("id", 1).maybeSingle(),
      supabase.from("diamond_stock_history").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setStock(s.data?.current_stock ?? 0);
    setHistory((h.data as HistoryRow[]) ?? []);
  };

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return navigate({ to: "/admin/login", replace: true });
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", sess.session.user.id);
      const admin = (roles ?? []).some((r) => r.role === "admin");
      if (!admin) return navigate({ to: "/customer/dashboard", replace: true });
      setIsAdmin(true);
      await load();
    })();
  }, [navigate]);

  usePolling(() => { if (isAdmin) void load(); }, 8000);

  const addStock = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Enter a positive amount");
    setSaving(true);
    const { data, error } = await supabase.rpc("admin_add_stock", { _amount: n, _note: note || undefined });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Stock added. New total: ${data}`);
    setAmount("");
    setNote("");
    await load();
  };

  const periodHistory = useMemo(
    () => history.filter((h) => inPeriod(h.created_at, period)),
    [history, period],
  );

  const chart = useMemo(() => {
    const { keys, keyOf } = periodBuckets(period, history.map((h) => h.created_at));
    const map = new Map(keys.map((k) => [k, { name: k, added: 0, deducted: 0 }]));
    for (const h of periodHistory) {
      const row = map.get(keyOf(new Date(h.created_at)));
      if (!row) continue;
      if (h.activity_type === "add") row.added += h.amount;
      else row.deducted += h.amount;
    }
    return Array.from(map.values());
  }, [periodHistory, history, period]);

  if (isAdmin === null) return <div className="container mx-auto p-10 text-center">Loading…</div>;

  const filtered = periodHistory.filter((h) => filter === "all" || h.activity_type === filter);

  const exportHistory = () => {
    exportCsv(
      `diamond-stock-history-${period}.csv`,
      ["Date", "Activity", "Amount", "Note"],
      filtered.map((h) => [
        new Date(h.created_at).toLocaleString("en-US"),
        h.activity_type === "add" ? "Add" : "Deduct",
        (h.activity_type === "add" ? "+" : "-") + h.amount,
        h.note ?? "",
      ]),
    );
  };


  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 min-w-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl">Diamond Stock</h1>
          <select
            className="rounded-md bg-input border border-border px-3 py-2 text-sm"
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
          >
            {PERIOD_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>


        <div className="grid gap-4 md:grid-cols-2 mb-6 items-stretch">
          <div className="card-premium rounded-xl p-4 sm:p-5 flex h-full flex-col">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Current Stock</div>
            <div className="mt-3 flex flex-1 flex-wrap items-baseline gap-2">
              <span className="text-3xl">💎</span>
              <span className="font-display text-3xl sm:text-4xl gold-text">{(stock ?? 0).toLocaleString("en-US")}</span>
              <span className="text-sm text-muted-foreground">Diamonds</span>
            </div>
          </div>
          <div className="card-premium rounded-xl p-4 sm:p-5 flex h-full flex-col">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Add Diamond</div>
            <div className="mt-3 grid flex-1 content-start gap-2">
              <input
                type="number"
                min={1}
                placeholder="Amount to add"
                className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <input
                placeholder="Note (optional)"
                className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                onClick={addStock}
                disabled={saving}
                className="mt-1 rounded-md btn-gold px-4 py-2 text-sm disabled:opacity-50 active:scale-95 transition"
              >
                {saving ? "Saving…" : "+ Add Stock"}
              </button>
            </div>
          </div>
        </div>

        <div className="card-premium rounded-xl p-4 sm:p-5 mb-6">
          <h2 className="font-display text-lg mb-3">Stock Movement</h2>
          <div className="h-[240px] lg:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={axis.tick} interval={axis.interval}
                  angle={axis.angle} textAnchor={axis.angle ? "end" : "middle"}
                  height={axis.height} minTickGap={axis.minTickGap} />
                <YAxis tick={axis.tick} width={48}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar name="Added" dataKey="added" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                <Bar name="Deducted" dataKey="deducted" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-premium rounded-xl p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg">Stock History</h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-md bg-input border border-border px-3 py-2 text-sm"
                value={filter}
                onChange={(e) => setFilter(e.target.value as "all" | "add" | "deduct")}
              >
                <option value="all">All</option>
                <option value="add">Add</option>
                <option value="deduct">Deduct</option>
              </select>
              <button onClick={exportHistory}
                className="rounded-md btn-gold px-4 py-2 text-sm active:scale-95 transition">
                Export Excel
              </button>
            </div>
          </div>

          {/* Desktop */}
          <div className="hidden md:block table-scroll">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="pr-3">Activity</th>
                  <th className="pr-3 text-right">Amount</th>
                  <th className="pr-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => (
                  <tr key={h.id} className="border-b border-border/60">
                    <td className="py-3 pr-3 text-xs">{new Date(h.created_at).toLocaleString("en-US")}</td>
                    <td className="pr-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs uppercase ${h.activity_type === "add" ? "bg-success/20 text-success border-success/40" : "bg-destructive/20 text-destructive border-destructive/40"}`}>
                        {h.activity_type === "add" ? "Add" : "Deduct"}
                      </span>
                    </td>
                    <td className="pr-3 text-right font-semibold">{h.activity_type === "add" ? "+" : "-"}{h.amount.toLocaleString("en-US")}</td>
                    <td className="pr-3 text-xs text-muted-foreground truncate max-w-[280px]">{h.note ?? "—"}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No history yet</td></tr>}
              </tbody>
            </table>
          </div>
          {/* Mobile */}
          <div className="grid gap-3 md:hidden table-scroll">
            {filtered.map((h) => (
              <div key={h.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs uppercase ${h.activity_type === "add" ? "bg-success/20 text-success border-success/40" : "bg-destructive/20 text-destructive border-destructive/40"}`}>
                    {h.activity_type === "add" ? "Add" : "Deduct"}
                  </span>
                  <span className="font-semibold text-sm">{h.activity_type === "add" ? "+" : "-"}{h.amount.toLocaleString("en-US")}</span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("en-US")}</div>
                {h.note && <div className="mt-1 text-xs">{h.note}</div>}
              </div>
            ))}
            {filtered.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No history yet</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
