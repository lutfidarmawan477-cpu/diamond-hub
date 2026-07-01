import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getStorefront, createOrder } from "@/lib/storefront.functions";
import { formatIDR } from "@/lib/format";
import { useSession } from "@/hooks/useSession";

const storefrontQO = queryOptions({ queryKey: ["storefront"], queryFn: () => getStorefront() });

export const Route = createFileRoute("/topup")({
  head: () => ({
    meta: [
      { title: "Top Up Mobile Legends Diamond — DiamondHub" },
      { name: "description", content: "Top up Mobile Legends diamonds. Choose a package, enter your User ID & Zone ID, pay — diamonds delivered instantly." },
      { property: "og:title", content: "Mobile Legends Diamond Top Up" },
      { property: "og:description", content: "Pick an ML diamond package and pay with e-wallet, bank transfer, or QRIS." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(storefrontQO),
  errorComponent: ({ error }) => <div className="container mx-auto p-10 text-center">Failed to load: {error.message}</div>,
  notFoundComponent: () => <div className="container mx-auto p-10 text-center">Not found</div>,
  component: TopupPage,
});

function TopupPage() {
  const { data } = useSuspenseQuery(storefrontQO);
  const navigate = useNavigate();
  const loggedIn = useSession();
  useEffect(() => {
    if (loggedIn === false) navigate({ to: "/auth", replace: true });
  }, [loggedIn, navigate]);
  const [userId, setUserId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [nickname, setNickname] = useState<string | null>(null);
  const [pkgId, setPkgId] = useState<string | null>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState("");
  const [buyerWa, setBuyerWa] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [agree, setAgree] = useState(false);

  const pkg = data.packages.find((p) => p.id === pkgId);
  const pay = data.payments.find((p) => p.id === payId);
  const subtotal = pkg?.price ?? 0;
  const fee = pay?.fee ?? 0;
  const total = subtotal + fee;

  const checkNick = () => {
    if (!userId || !zoneId) { toast.error("Please enter both User ID and Zone ID first"); return; }
    setNickname("Player" + userId.slice(-4));
    toast.success("Nickname found!");
  };

  const mutation = useMutation({
    mutationFn: () =>
      createOrder({
        data: {
          game_user_id: userId,
          zone_id: zoneId,
          nickname,
          package_id: pkgId!,
          payment_method_id: payId!,
          buyer_name: buyerName,
          buyer_whatsapp: buyerWa,
          buyer_email: buyerEmail,
        },
      }),
    onSuccess: (res) => {
      toast.success("Order created!");
      navigate({ to: "/invoice/$invoice", params: { invoice: res.invoice_no } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgId) return toast.error("Please choose a diamond package");
    if (!payId) return toast.error("Please choose a payment method");
    if (!agree) return toast.error("You must agree to the terms and conditions");
    mutation.mutate();
  };

  const groupedPay = data.payments.reduce<Record<string, typeof data.payments>>((acc, p) => {
    (acc[p.type] ??= []).push(p);
    return acc;
  }, {});
  const typeLabel: Record<string, string> = { ewallet: "E-Wallet", qris: "QRIS", va: "Virtual Account", bank: "Bank Transfer" };

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold">Top Up <span className="gold-text">Mobile Legends Diamonds</span></h1>
        <p className="text-muted-foreground mt-1">Fill in your details, pick a package, pay — diamonds delivered instantly.</p>
      </div>

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Account */}
          <Card step="1" title="Account Details">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="User ID">
                <input className={inputCls} value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="e.g. 123456789" required />
              </Field>
              <Field label="Zone ID">
                <input className={inputCls} value={zoneId} onChange={(e) => setZoneId(e.target.value)} placeholder="e.g. 1234" required />
              </Field>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button type="button" onClick={checkNick} className="rounded-md border border-gold/50 bg-gold/10 text-gold px-4 py-2 text-sm hover:bg-gold/20 transition">
                Check Nickname
              </button>
              {nickname && <span className="text-sm text-success">✓ {nickname}</span>}
            </div>
          </Card>

          {/* 2. Package */}
          <Card step="2" title="Choose Diamond Amount">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {data.packages.map((p) => {
                const selected = p.id === pkgId;
                return (
                  <button type="button" key={p.id} onClick={() => setPkgId(p.id)}
                    className={`text-left rounded-xl p-4 border transition relative ${selected ? "border-gold glow-ring bg-primary/20" : "border-border card-premium hover:border-primary/60"}`}>
                    {p.badge && <span className="absolute -top-2 right-3 rounded-full btn-gold px-2 py-0.5 text-[10px]">{p.badge}</span>}
                    <div className="text-2xl">💎</div>
                    <div className="font-display mt-1">{p.name}</div>
                    <div className="gold-text font-bold mt-1">{formatIDR(p.price)}</div>
                    {p.original_price && <div className="text-xs text-muted-foreground line-through">{formatIDR(p.original_price)}</div>}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* 3. Payment */}
          <Card step="3" title="Payment Method">
            <div className="space-y-4">
              {Object.entries(groupedPay).map(([type, list]) => (
                <div key={type}>
                  <div className="mb-2 text-sm font-semibold text-muted-foreground">{typeLabel[type] ?? type}</div>
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {list.map((p) => {
                      const selected = p.id === payId;
                      return (
                        <button type="button" key={p.id} onClick={() => setPayId(p.id)}
                          className={`rounded-lg px-3 py-3 text-left border text-sm transition ${selected ? "border-gold bg-primary/20" : "border-border card-premium hover:border-primary/60"}`}>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">Fee {formatIDR(p.fee)}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 4. Buyer */}
          <Card step="4" title="Buyer Information">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name"><input className={inputCls} value={buyerName} onChange={(e) => setBuyerName(e.target.value)} required minLength={2} /></Field>
              <Field label="WhatsApp Number"><input className={inputCls} value={buyerWa} onChange={(e) => setBuyerWa(e.target.value)} placeholder="08xx" required /></Field>
              <Field label="Email"><input type="email" className={inputCls} value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} required /></Field>
              <Field label="Voucher Code (optional)"><input className={inputCls} placeholder="SAVE10" /></Field>
            </div>
            <label className="mt-4 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
              <span>I agree to the <span className="text-gold underline">Terms & Conditions</span> and confirm the User ID / Zone ID I entered are correct.</span>
            </label>
          </Card>
        </div>

        {/* SUMMARY */}
        <aside className="lg:col-span-1">
          <div className="card-premium rounded-xl p-5 sticky top-24">
            <h3 className="font-display text-lg mb-4">Summary</h3>
            <SumRow label="User ID" value={userId || "—"} />
            <SumRow label="Zone ID" value={zoneId || "—"} />
            <SumRow label="Nickname" value={nickname ?? "—"} />
            <hr className="my-3 border-border" />
            <SumRow label="Package" value={pkg?.name ?? "—"} />
            <SumRow label="Payment" value={pay?.name ?? "—"} />
            <hr className="my-3 border-border" />
            <SumRow label="Subtotal" value={formatIDR(subtotal)} />
            <SumRow label="Fee" value={formatIDR(fee)} />
            <div className="mt-3 flex justify-between font-display text-lg">
              <span>Total</span>
              <span className="gold-text">{formatIDR(total)}</span>
            </div>
            <button type="submit" disabled={mutation.isPending}
              className="mt-5 w-full rounded-md btn-gold py-3 text-sm disabled:opacity-50">
              {mutation.isPending ? "Processing…" : "💎 Buy Now"}
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
}

const inputCls = "w-full rounded-md bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs text-muted-foreground">{label}</span>{children}</label>;
}
function Card({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <section className="card-premium rounded-xl p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg btn-gold font-display text-sm">{step}</span>
        <h2 className="font-display text-lg">{title}</h2>
      </div>
      {children}
    </section>
  );
}
function SumRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between py-1 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium text-right max-w-[60%] truncate">{value}</span></div>;
}
