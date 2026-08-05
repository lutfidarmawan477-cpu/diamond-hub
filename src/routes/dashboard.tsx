import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatIDR } from "@/lib/format";
import { toast } from "sonner";
import { computeLevel, LEVEL_META, nextLevelInfo, type MemberLevel } from "@/lib/member";
import { Copy, Ticket } from "lucide-react";

type Order = {
  id: string; invoice_no: string; package_name: string; diamond_amount: number;
  total: number; status: string; created_at: string; payment_method_name: string;
  expires_at: string;
};

type MyVoucher = {
  id: string;
  name: string;
  code: string;
  discount_percent: number;
  max_discount: number | null;
  usage_per_customer: number;
  member_level: string | null;
  end_date: string;
  used: number;
};

const ALLOWED_STATUSES = ["success", "paid", "pending", "failed"] as const;

function displayStatus(s: string) {
  if (s === "paid") return "success";
  return s;
}

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — DiamondHub" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [totalSpentDb, setTotalSpentDb] = useState<number>(0);
  const [level, setLevel] = useState<MemberLevel>("bronze");
  const [myVouchers, setMyVouchers] = useState<MyVoucher[]>([]);
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
      const userEmail = s.session.user.email ?? "";
      const userId = s.session.user.id;
      setEmail(userEmail);

      const [ordersRes, profRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id,invoice_no,package_name,diamond_amount,total,status,created_at,payment_method_name,expires_at")
          .or(`user_id.eq.${userId},and(user_id.is.null,buyer_email.eq.${userEmail})`)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("profiles").select("total_spent,member_level").eq("id", userId).maybeSingle(),
      ]);
      if (ordersRes.error) toast.error(ordersRes.error.message);

      // Auto-expire any pending orders whose countdown has passed.
      const now = Date.now();
      const rows = (ordersRes.data as Order[]) ?? [];
      const expired = rows.filter((o) => o.status === "pending" && new Date(o.expires_at).getTime() <= now);
      if (expired.length > 0) {
        await Promise.all(
          expired.map((o) =>
            supabase.from("orders").update({ status: "failed" }).eq("id", o.id).eq("status", "pending"),
          ),
        );
        expired.forEach((o) => (o.status = "failed"));
      }
      setOrders(rows.filter((o) => ALLOWED_STATUSES.includes(o.status as typeof ALLOWED_STATUSES[number])));

      const spent = profRes.data?.total_spent ?? 0;
      setTotalSpentDb(spent);
      const derivedLevel = (profRes.data?.member_level as MemberLevel) ?? computeLevel(spent);
      setLevel(derivedLevel);

      // Load member vouchers for this level
      const nowIso = new Date().toISOString();
      const [vRes, redRes] = await Promise.all([
        supabase
          .from("vouchers")
          .select("*")
          .eq("active", true)
          .eq("voucher_type", "member")
          .eq("member_level", derivedLevel)
          .lte("start_date", nowIso)
          .gte("end_date", nowIso),
        supabase.from("voucher_redemptions").select("voucher_id").eq("user_id", userId),
      ]);
      const counts: Record<string, number> = {};
      (redRes.data ?? []).forEach((r) => { counts[r.voucher_id] = (counts[r.voucher_id] ?? 0) + 1; });
      const mv: MyVoucher[] = ((vRes.data ?? []) as unknown as Omit<MyVoucher, "used">[])
        .map((v) => ({ ...v, used: counts[v.id] ?? 0 }))
        .filter((v) => v.used < v.usage_per_customer);
      setMyVouchers(mv);

      setLoading(false);
    })();
  }, [navigate]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const totalOrders = orders?.length ?? 0;
  const paidTotal = orders?.filter((o) => o.status === "success" || o.status === "paid").reduce((a, b) => a + b.total, 0) ?? 0;
  const totalSpent = Math.max(totalSpentDb, paidTotal);
  const meta = LEVEL_META[level];
  const next = nextLevelInfo(level, totalSpent);

  const statusBadge = (s: string) => {
    const st = displayStatus(s);
    const color =
      st === "success" ? "bg-success/20 text-success border-success/40"
      : st === "pending" ? "bg-gold/20 text-gold border-gold/40"
      : "bg-destructive/20 text-destructive border-destructive/40";
    return <span className={`rounded-full border px-2 py-0.5 text-xs uppercase ${color}`}>{st}</span>;
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Voucher code copied");
  };

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        <button onClick={signOut} className="rounded-md border border-border px-4 py-2 text-sm hover:border-destructive transition">Sign Out</button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Total Transactions" value={totalOrders.toString()} />
        <StatCard label="Total Spent" value={formatIDR(totalSpent)} />
        <div className="card-premium rounded-xl p-5">
          <div className="text-xs text-muted-foreground">Member Level</div>
          <div className={`font-display text-2xl mt-1 ${meta.color}`}>{meta.icon} {meta.label}</div>
          {next ? (
            <div className="mt-3">
              <div className="h-2 rounded-full bg-primary/20 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-gold to-primary transition-all" style={{ width: `${next.progress}%` }} />
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                {formatIDR(totalSpent)} / {formatIDR(next.target)} to {LEVEL_META[next.next].label}
              </div>
            </div>
          ) : (
            <div className="mt-3 text-xs text-gold">🎉 You've reached the highest membership level.</div>
          )}
        </div>
      </div>

      {/* MY VOUCHERS */}
      <div className="mt-8 card-premium rounded-xl p-4 sm:p-5">
        <div className="flex justify-between items-center gap-3 mb-4 flex-wrap">
          <h2 className="font-display text-lg inline-flex items-center gap-2"><Ticket className="h-5 w-5 text-gold" /> My Vouchers</h2>
          <Link to="/vouchers" className="text-xs text-gold underline">Browse all</Link>
        </div>
        {myVouchers.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No member vouchers available for your level yet.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {myVouchers.map((v) => (
              <div key={v.id} className="rounded-lg border border-gold/30 bg-gold/5 p-3 flex items-center gap-3">
                <div className="text-center px-2">
                  <div className="gold-text font-display text-xl leading-none">{v.discount_percent}%</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Off</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{v.name}</div>
                  <div className="font-mono text-xs text-gold">{v.code}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Remaining {v.usage_per_customer - v.used}/{v.usage_per_customer} • Expires {new Date(v.end_date).toLocaleDateString("en-US")}
                  </div>
                </div>
                <button onClick={() => copyCode(v.code)} className="rounded-md btn-gold px-2 py-1 text-xs inline-flex items-center gap-1">
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 card-premium rounded-xl p-4 sm:p-5">
        <div className="flex justify-between items-center gap-3 mb-4 flex-wrap">
          <h2 className="font-display text-lg">Transaction History</h2>
          <Link to="/topup" className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md btn-gold px-3 py-2 text-xs">+ Top Up</Link>
        </div>
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!loading && (orders?.length ?? 0) === 0 && <div className="text-sm text-muted-foreground">No transactions yet.</div>}
        {!loading && orders && orders.length > 0 && (
          <>
            {/* Mobile card list */}
            <div className="grid gap-3 md:hidden table-scroll">
              {orders.map((o) => (
                <div key={o.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-muted-foreground truncate">{o.invoice_no}</div>
                      <div className="text-sm font-medium truncate">{o.package_name}</div>
                    </div>
                    {statusBadge(o.status)}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div className="text-muted-foreground">Payment</div>
                    <div className="text-right truncate">{o.payment_method_name}</div>
                    <div className="text-muted-foreground">Total</div>
                    <div className="text-right gold-text font-semibold">{formatIDR(o.total)}</div>
                    <div className="text-muted-foreground">Date</div>
                    <div className="text-right">{new Date(o.created_at).toLocaleDateString("en-US")}</div>
                  </div>
                  <Link
                    to="/invoice/$invoice"
                    params={{ invoice: o.invoice_no }}
                    className="mt-3 block w-full rounded-md border border-primary/60 bg-primary/10 px-3 py-1.5 text-center text-xs font-semibold hover:bg-primary/20 transition"
                  >
                    View Details
                  </Link>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block table-scroll">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground border-b border-border">
                  <tr><th className="py-2">Invoice</th><th>Package</th><th>Payment</th><th>Total</th><th>Status</th><th>Date</th><th></th></tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-border/60">
                      <td className="py-3 font-mono text-xs">{o.invoice_no}</td>
                      <td>{o.package_name}</td>
                      <td>{o.payment_method_name}</td>
                      <td className="gold-text font-semibold">{formatIDR(o.total)}</td>
                      <td>{statusBadge(o.status)}</td>
                      <td className="text-muted-foreground text-xs">{new Date(o.created_at).toLocaleDateString("en-US")}</td>
                      <td>
                        <Link
                          to="/invoice/$invoice"
                          params={{ invoice: o.invoice_no }}
                          className="rounded-md border border-primary/60 bg-primary/10 px-3 py-1 text-xs font-semibold hover:bg-primary/20 transition"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
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
