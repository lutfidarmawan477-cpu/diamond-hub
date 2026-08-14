import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Printer } from "lucide-react";
import { getOrderByInvoice } from "@/lib/storefront.functions";
import { formatIDR } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import diamondLogo from "@/assets/diamond.png";
import { useSession } from "@/hooks/useSession";

const ADMIN_WA = "6289891103550".slice(0, 0) + "628989110355";

const orderQO = (invoice: string) =>
  queryOptions({
    queryKey: ["order", invoice],
    queryFn: () => getOrderByInvoice({ data: { invoice_no: invoice } }),
  });

export const Route = createFileRoute("/invoice/$invoice")({
  head: ({ params }) => ({
    meta: [
      { title: `Invoice ${params.invoice} — DiamondHub` },
      { name: "description", content: "Mobile Legends diamond top up invoice details." },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(orderQO(params.invoice)),
  errorComponent: ({ error }) => <div className="container mx-auto p-10 text-center">Failed to load: {error.message}</div>,
  notFoundComponent: () => <div className="container mx-auto p-10 text-center">Invoice not found</div>,
  component: InvoicePage,
});

function displayStatus(s: string) {
  if (s === "paid") return "success";
  if (s === "expired") return "failed";
  return s;
}

/** WhatsApp confirmation message built from the current order. */
function buildWaMessage(o: {
  game_user_id: string;
  zone_id: string;
  nickname: string | null;
  package_name: string;
  payment_method_name: string;
  subtotal: number;
  fee: number;
  total: number;
  invoice_no: string;
}) {
  return [
    `INVOICE  : ${o.invoice_no}`,
    "",
    "DATA CUSTOMER",
    "-------------",
    `USER ID  : ${o.game_user_id}`,
    `ZONE ID  : ${o.zone_id}`,
    `NICKNAME : ${o.nickname ?? "-"}`,
    "-------------",
    "",
    "ORDER DETAILS",
    "-------------",
    `PACKAGE  : ${o.package_name}`,
    `PAYMENT  : ${o.payment_method_name}`,
    `SUBTOTAL : ${formatIDR(o.subtotal)}`,
    `FEE      : ${formatIDR(o.fee)}`,
    `TOTAL    : ${formatIDR(o.total)}`,
    "-------------",
  ].join("\n");
}


function InvoicePage() {
  const { invoice } = Route.useParams();
  const { data: order, refetch } = useSuspenseQuery(orderQO(invoice));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const loggedIn = useSession();
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const autoExpiredRef = useRef(false);


  if (!order) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl">Invoice not found</h1>
        <Link to="/" className="mt-4 inline-block text-gold underline">Back to home</Link>
      </div>
    );
  }

  const expires = new Date(order.expires_at).getTime();
  const [remaining, setRemaining] = useState(() => Math.max(0, expires - Date.now()));
  const status = displayStatus(order.status);
  const isPending = order.status === "pending";
  const isSuccess = status === "success";
  const isFailed = status === "failed";

  useEffect(() => {
    if (!isPending) return;
    const i = setInterval(() => setRemaining(Math.max(0, expires - Date.now())), 1000);
    return () => clearInterval(i);
  }, [expires, isPending]);

  // Auto-cancel to "failed" when countdown hits zero.
  useEffect(() => {
    if (!isPending) return;
    if (remaining > 0) return;
    if (autoExpiredRef.current) return;
    if (paying) return;
    autoExpiredRef.current = true;
    (async () => {
      await supabase.from("orders").update({ status: "failed" }).eq("invoice_no", order.invoice_no).eq("status", "pending");
      await queryClient.invalidateQueries({ queryKey: ["order", invoice] });
      refetch();
    })();
  }, [remaining, isPending, order.invoice_no, invoice, queryClient, refetch, paying]);

  // Lock scroll when success modal open
  useEffect(() => {
    if (!showSuccess) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [showSuccess]);

  const mm = Math.floor(remaining / 60000).toString().padStart(2, "0");
  const ss = Math.floor((remaining % 60000) / 1000).toString().padStart(2, "0");

  const statusColor: Record<string, string> = {
    pending: "bg-gold/20 text-gold border-gold/40",
    success: "bg-success/20 text-success border-success/40",
    failed: "bg-destructive/20 text-destructive border-destructive/40",
  };

  const handlePay = async () => {
    if (paying || isSuccess) return;
    setPaying(true);
    try {
      await simulatePayment(order.invoice_no);
      await queryClient.invalidateQueries({ queryKey: ["order", invoice] });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await refetch();
      setShowSuccess(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const cancelOrder = async () => {
    if (isSuccess) return;
    if (!confirm("Cancel this order? It will be permanently removed from your transaction history.")) return;
    setCancelling(true);
    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("invoice_no", order.invoice_no);
    setCancelling(false);
    if (error) return toast.error(error.message);
    toast.success("Order cancelled and removed");
    await queryClient.invalidateQueries({ queryKey: ["order", invoice] });
    await queryClient.invalidateQueries({ queryKey: ["orders"] });
    navigate({ to: loggedIn ? "/dashboard" : "/", replace: true });
  };

  const paidDate = new Date(order.updated_at ?? order.created_at).toLocaleString("en-US");

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="card-premium rounded-2xl p-6 md:p-8 print-area">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Invoice Number</div>
            <div className="font-display text-xl">{order.invoice_no}</div>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs uppercase ${statusColor[status] ?? ""}`}>
            {status}
          </span>
        </div>

        {isPending && remaining > 0 && (
          <div className="mt-6 rounded-xl bg-primary/10 border border-primary/30 p-5 text-center">
            <div className="text-sm text-muted-foreground">Complete payment within</div>
            <div className="font-display text-4xl gold-text mt-1">{mm}:{ss}</div>
            <div className="mt-3 text-sm">Total: <span className="font-bold gold-text">{formatIDR(order.total)}</span></div>
            <div className="mt-4 mx-auto w-40 h-40 sm:w-48 sm:h-48 rounded-lg bg-white p-2 border border-border">
              <img
                src={dummyQr}
                alt="Payment QR Code (demo)"
                width={512}
                height={512}
                loading="lazy"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">Scan or Pay with {order.payment_method_name}</div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Demo — no real payment</div>
            <button
              type="button"
              className="mt-4 inline-flex items-center gap-2 rounded-md btn-gold px-6 py-2.5 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
              onClick={handlePay}
              disabled={paying}
            >
              {paying && <Loader2 className="h-4 w-4 animate-spin" />}
              {paying ? "Processing your payment..." : "Pay Now"}
            </button>
            {paying && (
              <div className="mt-2 text-xs text-muted-foreground">
                Please wait while we verify your payment...
              </div>
            )}
          </div>
        )}

        {isFailed && (
          <div className="mt-6 rounded-xl bg-destructive/10 border border-destructive/30 p-4 text-center text-sm text-destructive">
            This order has been cancelled or expired. Payment is no longer available. Please create a new order to top up again.
          </div>
        )}

        {isSuccess && (
          <div className="mt-6 rounded-xl bg-success/10 border border-success/30 p-4 text-center text-sm text-success">
            Payment received. Your diamonds have been delivered.
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Block title="ML Account">
            <Row label="User ID" value={order.game_user_id} />
            <Row label="Zone ID" value={order.zone_id} />
            <Row label="Nickname" value={order.nickname ?? "—"} />
          </Block>
          <Block title="Order Details">
            <Row label="Package" value={order.package_name} />
            <Row label="Payment" value={order.payment_method_name} />
            <Row label="Subtotal" value={formatIDR(order.subtotal)} />
            <Row label="Fee" value={formatIDR(order.fee)} />
            <Row label="Total" value={formatIDR(order.total)} highlight />
          </Block>
          <Block title="Buyer">
            <Row label="Name" value={order.buyer_name} />
            <Row label="WhatsApp" value={order.buyer_whatsapp} />
            <Row label="Email" value={order.buyer_email} />
          </Block>
          <Block title="Timing">
            <Row label="Created" value={new Date(order.created_at).toLocaleString("en-US")} />
            <Row label="Expires" value={new Date(order.expires_at).toLocaleString("en-US")} />
          </Block>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 no-print">
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:border-primary transition">
            <Printer className="h-4 w-4" /> Print
          </button>
          {loggedIn ? (
            <Link to="/dashboard" className="rounded-md border border-border px-4 py-2 text-sm hover:border-primary transition">Back to Dashboard</Link>
          ) : (
            <Link to="/" className="rounded-md border border-border px-4 py-2 text-sm hover:border-primary transition">Back to Home</Link>
          )}
          {!isSuccess && (
            <button
              onClick={cancelOrder}
              disabled={cancelling || paying}
              className="rounded-md border border-destructive/60 text-destructive px-4 py-2 text-sm hover:bg-destructive/10 transition disabled:opacity-50"
            >
              {cancelling ? "Cancelling…" : "Cancel Order"}
            </button>
          )}
          {isSuccess && (
            <Link to="/topup" className="rounded-md btn-gold px-4 py-2 text-sm">Top Up Again</Link>
          )}
          {isFailed && (
            <Link to="/topup" className="rounded-md btn-gold px-4 py-2 text-sm">Create New Order</Link>
          )}
        </div>

      </div>

      {showSuccess && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowSuccess(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-[95%] max-w-[500px] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 flex flex-col overflow-hidden card-premium rounded-2xl shadow-2xl">
            <button
              type="button"
              onClick={() => setShowSuccess(false)}
              aria-label="Close"
              className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="p-6 pt-8 text-center shrink-0">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/15 border border-success/40 mb-3">
                <CheckCircle2 className="h-9 w-9 text-success" />
              </div>
              <h2 className="font-display text-2xl font-bold">Payment Successful</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Thank you for your purchase. Your payment has been successfully processed.
              </p>
            </div>
            <div className="px-6 pb-2 overflow-y-auto min-h-0">
              <div className="rounded-xl border border-border p-4 space-y-1">
                <Row label="Invoice" value={order.invoice_no} />
                <Row label="Product" value={order.package_name} />
                <Row label="User ID" value={order.game_user_id} />
                <Row label="Server ID" value={order.zone_id} />
                <Row label="Payment Method" value={order.payment_method_name} />
                <Row label="Payment Date" value={paidDate} />
                <Row label="Total Payment" value={formatIDR(order.total)} highlight />
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className="rounded-full border border-success/40 bg-success/15 text-success px-2 py-0.5 text-[10px] uppercase font-semibold">Success</span>
                </div>
              </div>
            </div>
            <div className="p-6 pt-4 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end shrink-0 border-t border-border/40 mt-3">
              <button
                type="button"
                onClick={() => setShowSuccess(false)}
                className="rounded-md border border-border px-4 py-2 text-sm hover:border-primary transition"
              >
                Close
              </button>
              <Link
                to={loggedIn ? "/dashboard" : "/"}
                className="rounded-md btn-gold px-4 py-2 text-sm text-center"
              >
                {loggedIn ? "Back to Dashboard" : "Back to Home"}
              </Link>

            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="text-sm font-semibold mb-2">{title}</div>
      {children}
    </div>
  );
}
function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between py-1 text-sm gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right break-all ${highlight ? "font-bold gold-text" : "font-medium"}`}>{value}</span>
    </div>
  );
}
