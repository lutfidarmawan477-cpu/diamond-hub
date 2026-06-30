import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getOrderByInvoice } from "@/lib/storefront.functions";
import { formatIDR } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const orderQO = (invoice: string) =>
  queryOptions({
    queryKey: ["order", invoice],
    queryFn: () => getOrderByInvoice({ data: { invoice_no: invoice } }),
  });

export const Route = createFileRoute("/invoice/$invoice")({
  head: ({ params }) => ({
    meta: [
      { title: `Invoice ${params.invoice} — DiamondHub` },
      { name: "description", content: "Detail invoice top up diamond Mobile Legends." },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(orderQO(params.invoice)),
  errorComponent: ({ error }) => <div className="container mx-auto p-10 text-center">Gagal memuat: {error.message}</div>,
  notFoundComponent: () => <div className="container mx-auto p-10 text-center">Invoice tidak ditemukan</div>,
  component: InvoicePage,
});

function InvoicePage() {
  const { invoice } = Route.useParams();
  const { data: order } = useSuspenseQuery(orderQO(invoice));
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState(false);

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl">Invoice tidak ditemukan</h1>
        <Link to="/" className="mt-4 inline-block text-gold underline">Kembali</Link>
      </div>
    );
  }

  const expires = new Date(order.expires_at).getTime();
  const [remaining, setRemaining] = useState(() => Math.max(0, expires - Date.now()));
  useEffect(() => {
    const i = setInterval(() => setRemaining(Math.max(0, expires - Date.now())), 1000);
    return () => clearInterval(i);
  }, [expires]);
  const mm = Math.floor(remaining / 60000).toString().padStart(2, "0");
  const ss = Math.floor((remaining % 60000) / 1000).toString().padStart(2, "0");

  const statusColor: Record<string, string> = {
    pending: "bg-gold/20 text-gold border-gold/40",
    paid: "bg-success/20 text-success border-success/40",
    success: "bg-success/20 text-success border-success/40",
    failed: "bg-destructive/20 text-destructive border-destructive/40",
    expired: "bg-muted text-muted-foreground border-border",
  };

  const isPending = order.status === "pending";
  const isSuccess = order.status === "success" || order.status === "paid";

  const cancelOrder = async () => {
    if (!confirm("Batalkan pesanan ini?")) return;
    setCancelling(true);
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("invoice_no", order.invoice_no);
    setCancelling(false);
    if (error) return toast.error(error.message);
    toast.success("Pesanan dibatalkan");
    await queryClient.invalidateQueries({ queryKey: ["order", invoice] });
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="card-premium rounded-2xl p-6 md:p-8 print-area">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Nomor Invoice</div>
            <div className="font-display text-xl">{order.invoice_no}</div>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs uppercase ${statusColor[order.status] ?? ""}`}>
            {order.status}
          </span>
        </div>

        {isPending && (
          <div className="mt-6 rounded-xl bg-primary/10 border border-primary/30 p-5 text-center">
            <div className="text-sm text-muted-foreground">Selesaikan pembayaran dalam</div>
            <div className="font-display text-4xl gold-text mt-1">{mm}:{ss}</div>
            <div className="mt-3 text-sm">Total: <span className="font-bold gold-text">{formatIDR(order.total)}</span></div>
            <div className="mt-3 mx-auto grid h-40 w-40 place-items-center rounded-lg bg-card border border-border text-xs text-muted-foreground">
              [ QR Code Pembayaran ]
            </div>
            <div className="mt-2 text-xs text-muted-foreground">Bayar via {order.payment_method_name}</div>
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Block title="Detail Akun ML">
            <Row label="User ID" value={order.game_user_id} />
            <Row label="Zone ID" value={order.zone_id} />
            <Row label="Nickname" value={order.nickname ?? "—"} />
          </Block>
          <Block title="Detail Pesanan">
            <Row label="Paket" value={order.package_name} />
            <Row label="Pembayaran" value={order.payment_method_name} />
            <Row label="Subtotal" value={formatIDR(order.subtotal)} />
            <Row label="Fee" value={formatIDR(order.fee)} />
            <Row label="Total" value={formatIDR(order.total)} highlight />
          </Block>
          <Block title="Pembeli">
            <Row label="Nama" value={order.buyer_name} />
            <Row label="WhatsApp" value={order.buyer_whatsapp} />
            <Row label="Email" value={order.buyer_email} />
          </Block>
          <Block title="Waktu">
            <Row label="Dibuat" value={new Date(order.created_at).toLocaleString("id-ID")} />
            <Row label="Kedaluwarsa" value={new Date(order.expires_at).toLocaleString("id-ID")} />
          </Block>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 no-print">
          <button onClick={() => window.print()} className="rounded-md border border-border px-4 py-2 text-sm hover:border-primary transition">🖨 Cetak</button>
          <Link to="/tracking" search={{ inv: order.invoice_no }} className="rounded-md border border-border px-4 py-2 text-sm hover:border-primary transition">Cek Status</Link>
          {isPending && (
            <button
              onClick={cancelOrder}
              disabled={cancelling}
              className="rounded-md border border-destructive/60 text-destructive px-4 py-2 text-sm hover:bg-destructive/10 transition disabled:opacity-50"
            >
              {cancelling ? "Membatalkan…" : "Batalkan Pesanan"}
            </button>
          )}
          {isSuccess ? (
            <Link to="/topup" className="rounded-md btn-gold px-4 py-2 text-sm">Top Up Lagi</Link>
          ) : (
            <button
              type="button"
              disabled
              title="Selesaikan transaksi ini dulu"
              className="rounded-md btn-gold px-4 py-2 text-sm opacity-50 cursor-not-allowed"
            >
              Top Up Lagi
            </button>
          )}
        </div>
      </div>
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
    <div className="flex justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "font-bold gold-text" : "font-medium"}>{value}</span>
    </div>
  );
}
