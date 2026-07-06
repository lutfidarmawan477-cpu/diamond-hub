import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { getStorefront, createOrder, validateVoucher } from "@/lib/storefront.functions";
import { validateMlAccount } from "@/lib/ml-validate.functions";
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

type MlCheckState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "valid"; nickname: string }
  | { status: "invalid" };

function TopupPage() {
  const { data } = useSuspenseQuery(storefrontQO);
  const navigate = useNavigate();
  const loggedIn = useSession();
  useEffect(() => {
    if (loggedIn === false) navigate({ to: "/auth", replace: true });
  }, [loggedIn, navigate]);

  const [userId, setUserId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [mlCheck, setMlCheck] = useState<MlCheckState>({ status: "idle" });
  const [pkgId, setPkgId] = useState<string | null>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState("");
  const [buyerWa, setBuyerWa] = useState<string | undefined>(undefined);
  const [buyerEmail, setBuyerEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherState, setVoucherState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "valid"; discount: number; name: string; percent: number }
    | { status: "invalid"; message: string }
  >({ status: "idle" });

  // Reset ML check when inputs change
  useEffect(() => {
    setMlCheck({ status: "idle" });
  }, [userId, zoneId]);

  // Reset voucher when package changes
  useEffect(() => {
    setVoucherState({ status: "idle" });
  }, [pkgId]);

  const pkg = data.packages.find((p) => p.id === pkgId);
  const pay = data.payments.find((p) => p.id === payId);
  const subtotal = pkg?.price ?? 0;
  const fee = pay?.fee ?? 0;
  const discount = voucherState.status === "valid" ? voucherState.discount : 0;
  const total = Math.max(0, subtotal + fee - discount);

  const outOfStock = pkg ? (data.stock ?? 0) < pkg.diamond_amount : false;

  const phoneValid = !!buyerWa && isValidPhoneNumber(buyerWa);
  const phoneTouched = !!buyerWa && buyerWa.length > 3;
  const mlValid = mlCheck.status === "valid";
  const nickname = mlCheck.status === "valid" ? mlCheck.nickname : null;

  const applyVoucher = async () => {
    if (!voucherCode.trim()) return toast.error("Please enter a voucher code");
    if (!pkgId) return toast.error("Please pick a package first");
    setVoucherState({ status: "loading" });
    try {
      const r = await validateVoucher({ data: { code: voucherCode.trim(), subtotal } });
      setVoucherState({ status: "valid", discount: r.discount, name: r.name, percent: r.percent });
      toast.success(`Voucher applied — saving ${formatIDR(r.discount)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid voucher";
      setVoucherState({ status: "invalid", message: msg });
      toast.error(msg);
    }
  };

  const checkNick = async () => {
    if (!userId || !zoneId) { toast.error("Please enter both User ID and Zone ID first"); return; }
    if (!/^\d+$/.test(userId) || !/^\d+$/.test(zoneId)) {
      setMlCheck({ status: "invalid" });
      return;
    }
    setMlCheck({ status: "loading" });
    try {
      const res = await validateMlAccount({ data: { userId, zoneId } });
      if (res.valid) {
        setMlCheck({ status: "valid", nickname: res.nickname });
        toast.success("Mobile Legends account found successfully.");
      } else {
        setMlCheck({ status: "invalid" });
      }
    } catch {
      setMlCheck({ status: "invalid" });
    }
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
          buyer_whatsapp: buyerWa ?? "",
          buyer_email: buyerEmail,
          voucher_code: voucherState.status === "valid" ? voucherCode.trim() : null,
        },
      }),
    onSuccess: (res) => {
      toast.success("Order created!");
      navigate({ to: "/invoice/$invoice", params: { invoice: res.invoice_no } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disabledReason = (() => {
    if (!mlValid) return "Please verify your Mobile Legends account first.";
    if (!phoneValid) return "Please enter a valid phone number.";
    if (!pkgId) return "Please choose a diamond package.";
    if (outOfStock) return "Sorry, this product is currently out of stock.";
    if (!payId) return "Please choose a payment method.";
    if (!buyerName || !buyerEmail) return "Please complete buyer information.";
    if (!agree) return "You must agree to the terms and conditions.";
    return null;
  })();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabledReason) return toast.error(disabledReason);
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
                <input
                  className={inputCls}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder="e.g. 123456789"
                  required
                />
              </Field>
              <Field label="Server ID (Zone ID)">
                <input
                  className={inputCls}
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder="e.g. 1234"
                  required
                />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={checkNick}
                disabled={mlCheck.status === "loading"}
                className="rounded-md border border-gold/50 bg-gold/10 text-gold px-4 py-2 text-sm hover:bg-gold/20 transition disabled:opacity-50 inline-flex items-center gap-2"
              >
                {mlCheck.status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
                {mlCheck.status === "loading" ? "Loading..." : "Check Nickname"}
              </button>
            </div>
            {mlCheck.status === "valid" && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">Mobile Legends account found successfully.</div>
                  <div className="text-xs opacity-90">Nickname: <span className="font-semibold">{mlCheck.nickname}</span></div>
                </div>
              </div>
            )}
            {mlCheck.status === "invalid" && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>User ID or Server ID not found. Please double-check the data you entered.</span>
              </div>
            )}
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
              <Field label="Name">
                <input className={inputCls} value={buyerName} onChange={(e) => setBuyerName(e.target.value)} required minLength={2} />
              </Field>
              <Field label="WhatsApp Number">
                <PhoneInput
                  international
                  defaultCountry="ID"
                  value={buyerWa}
                  onChange={setBuyerWa}
                  className="phone-input-custom"
                  placeholder="81234567890"
                />
                {phoneTouched && (
                  phoneValid ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Phone number is valid.
                    </p>
                  ) : (
                    <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {!buyerWa || buyerWa.length < 6
                        ? "Phone number is too short."
                        : buyerWa.length > 18
                          ? "Phone number is too long."
                          : "Please enter a valid phone number."}
                    </p>
                  )
                )}
              </Field>
              <Field label="Email">
                <input type="email" className={inputCls} value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} required />
              </Field>
              <Field label="Voucher Code (optional)"><input className={inputCls} placeholder="SAVE10" /></Field>
            </div>
            <label className="mt-4 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
              <span>I agree to the <Link to="/terms" className="text-gold underline hover:opacity-80">Terms & Conditions</Link> and confirm the User ID / Zone ID I entered are correct.</span>
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
            <button
              type="submit"
              disabled={mutation.isPending || !!disabledReason}
              className="mt-5 w-full rounded-md btn-gold py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? "Processing…" : "💎 Buy Now"}
            </button>
            {disabledReason && (
              <p className="mt-2 flex items-start gap-1 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{disabledReason}</span>
              </p>
            )}
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
