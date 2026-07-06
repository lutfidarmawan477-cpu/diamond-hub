import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminSidebar } from "@/components/AdminSidebar";

type HistoryRow = {
  id: string;
  activity_type: "add" | "deduct";
  amount: number;
  admin_id: string | null;
  order_id: string | null;
  note: string | null;
  created_at: string;
};

export const Route = createFileRoute("/admin/stock")({
  head: () => ({ meta: [{ title: "Diamond Stock — Admin" }] }),
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

  const load = async () => {
    const [s, h] = await Promise.all([
      supabase.from("diamond_stock").select("current_stock").eq("id", 1).maybeSingle(),
      supabase.from("diamond_stock_history").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    if (s.error) toast.error(s.error.message);
    if (h.error) toast.error(h.error.message);
    setStock(s.data?.current_stock ?? 0);
    setHistory((h.data as HistoryRow[]) ?? []);
  };

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return navigate({ to: "/auth", replace: true });
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", sess.session.user.id);
      const admin = (roles ?? []).some((r) => r.role === "admin");
      if (!admin) return navigate({ to: "/dashboard", replace: true });
      setIsAdmin(true);
      await load();
    })();
  }, [navigate]);

  const addStock = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Enter a positive amount");
    setSaving(true);
    const { data, error } = await supabase.rpc("admin_add_stock", { _amount: n, _note: note || null });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Stock added. New total: ${data}`);
    setAmount("");
    setNote("");
    await load();
  };

  if (isAdmin === null) return <div className="container mx-auto p-10 text-center">Loading…</div>;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 min-w-0">
        <h1 className="font-display text-2xl mb-6">Diamond Stock</h1>

        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <div className="card-premium rounded-xl p-6">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Current Stock</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl">💎</span>
              <span className="font-display text-4xl gold-text">{(stock ?? 0).toLocaleString("en-US")}</span>
              <span className="text-sm text-muted-foreground">Diamonds</span>
            </div>
          </div>
          <div className="card-premium rounded-xl p-6">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Add Stock</div>
            <div className="grid gap-2">
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
                className="mt-1 rounded-md btn-gold px-4 py-2 text-sm disabled:opacity-50"
              >
                {saving ? "Saving…" : "+ Add Stock"}
              </button>
            </div>
          </div>
        </div>

        <div className="card-premium rounded-xl p-4 sm:p-5">
          <h2 className="font-display text-lg mb-4">Stock History</h2>
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
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
                {history.map((h) => (
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
                {history.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No history yet</td></tr>}
              </tbody>
            </table>
          </div>
          {/* Mobile */}
          <div className="grid gap-3 md:hidden">
            {history.map((h) => (
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
            {history.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No history yet</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
