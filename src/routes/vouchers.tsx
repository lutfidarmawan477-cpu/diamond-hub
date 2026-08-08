import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatIDR } from "@/lib/format";
import { Copy, Check, Ticket } from "lucide-react";
import { toast } from "sonner";
import { usePolling } from "@/hooks/usePolling";


type Voucher = {
  id: string;
  name: string;
  code: string;
  voucher_type: "public" | "member";
  member_level: string | null;
  discount_percent: number;
  max_discount: number | null;
  usage_per_customer: number;
  start_date: string;
  end_date: string;
  active: boolean;
  description: string | null;
};

export const Route = createFileRoute("/vouchers")({
  head: () => ({
    meta: [
      { title: "Vouchers — DiamondHub" },
      { name: "description", content: "Browse active promo vouchers for Mobile Legends diamond top up." },
    ],
  }),
  component: VouchersPage,
});

function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, new Date(target).getTime() - now);
  const d = Math.floor(diff / 86400_000);
  const h = Math.floor((diff % 86400_000) / 3600_000);
  const m = Math.floor((diff % 3600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { expired: diff === 0, d, h, m, s };
}

function VoucherCard({ v, used }: { v: Voucher; used: boolean }) {
  const [copied, setCopied] = useState(false);
  const { expired, d, h, m, s } = useCountdown(v.end_date);
  const copy = () => {
    navigator.clipboard.writeText(v.code);
    setCopied(true);
    toast.success("Voucher code copied");
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="relative card-premium rounded-xl overflow-hidden flex">
      <div className="w-24 shrink-0 bg-gradient-to-b from-gold/30 to-gold/5 flex flex-col items-center justify-center border-r border-dashed border-border p-3">
        <Ticket className="h-6 w-6 text-gold mb-1" />
        <div className="gold-text font-display text-2xl leading-none">{v.discount_percent}%</div>
        <div className="text-[10px] text-muted-foreground uppercase mt-1">Off</div>
      </div>
      <div className="flex-1 p-4 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-display text-base truncate">{v.name}</div>
            {v.voucher_type === "member" && v.member_level && (
              <span className="mt-1 inline-block text-[10px] uppercase rounded-full border border-gold/40 bg-gold/10 text-gold px-2 py-0.5">
                {v.member_level} member
              </span>
            )}
          </div>
          {used && (
            <span className="rounded-full border border-muted-foreground/40 bg-muted text-muted-foreground px-2 py-0.5 text-[10px] uppercase">Used</span>
          )}
        </div>
        {v.max_discount && (
          <div className="mt-1 text-xs text-muted-foreground">Max discount {formatIDR(v.max_discount)}</div>
        )}
        <div className="mt-2 text-xs text-muted-foreground">
          {expired ? "Expired" : `Ends in ${d}d ${h}h ${m}m ${s}s`}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 rounded-md border border-dashed border-gold/50 bg-gold/5 px-3 py-2 font-mono text-sm text-gold truncate">
            {v.code}
          </div>
          <button
            onClick={copy}
            disabled={used || expired}
            className="rounded-md btn-gold px-3 py-2 text-xs inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

type VFilter = "all" | "public" | "member" | "used";

function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [level, setLevel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<VFilter>("all");

  const load = async () => {
    const nowIso = new Date().toISOString();
    const [v, s] = await Promise.all([
      supabase.from("vouchers").select("*").eq("active", true).lte("start_date", nowIso).gte("end_date", nowIso).order("end_date"),
      supabase.auth.getSession(),
    ]);
    const list = (v.data as Voucher[]) ?? [];

    let filtered = list;
    let usedSet = new Set<string>();
    let userLevel: string | null = null;

    if (s.data.session) {
      const uid = s.data.session.user.id;
      const [prof, redemp] = await Promise.all([
        supabase.from("profiles").select("member_level").eq("id", uid).maybeSingle(),
        supabase.from("voucher_redemptions").select("voucher_id").eq("user_id", uid),
      ]);
      userLevel = prof.data?.member_level ?? "bronze";
      const counts: Record<string, number> = {};
      (redemp.data ?? []).forEach((r) => { counts[r.voucher_id] = (counts[r.voucher_id] ?? 0) + 1; });
      // member vouchers are limited to the user's level; public vouchers are for everyone
      filtered = list.filter((it) => it.voucher_type === "public" || it.member_level === userLevel);
      usedSet = new Set(
        filtered
          .filter((it) => (counts[it.id] ?? 0) >= (it.voucher_type === "public" ? 1 : it.usage_per_customer))
          .map((it) => it.id),
      );
    } else {
      // guests only see public vouchers
      filtered = list.filter((it) => it.voucher_type === "public");
    }

    setLevel(userLevel);
    setVouchers(filtered);
    setUsedIds(usedSet);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);
  usePolling(() => { void load(); }, 8000);

  const visible = vouchers.filter((v) => {
    if (filter === "public") return v.voucher_type === "public";
    if (filter === "member") return v.voucher_type === "member";
    if (filter === "used") return usedIds.has(v.id);
    
    return true;
  });

  const filters: { key: VFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "public", label: "Public" },
    { key: "member", label: "Member" },
    { key: "used", label: "Used" },
    { key: "unused", label: "Unused" },
  ];

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold">Active <span className="gold-text">Vouchers</span></h1>
        <p className="mt-2 text-muted-foreground text-sm">Copy the code and use it at checkout.</p>
        {level && (
          <p className="mt-2 text-xs text-muted-foreground">Showing public + <span className="text-gold uppercase">{level}</span> member vouchers.</p>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-lg border px-4 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${
              filter === f.key
                ? "border-gold bg-gold/15 text-gold"
                : "border-primary/60 bg-primary/10 text-foreground hover:bg-primary/20"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-center text-sm text-muted-foreground">Loading vouchers…</div>}
      {!loading && visible.length === 0 && (
        <div className="card-premium rounded-xl p-10 text-center">
          <Ticket className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No vouchers match this filter right now.</p>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((v) => <VoucherCard key={v.id} v={v} used={usedIds.has(v.id)} />)}
      </div>

      <div className="mt-10 text-center">
        <Link to="/topup" className="rounded-md btn-gold px-6 py-3 text-sm">💎 Top Up Now</Link>
      </div>
    </div>
  );
}

