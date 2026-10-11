import { Button } from "@/components/ui/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { getOrderByInvoice } from "@/lib/storefront.functions";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({ inv: z.string().optional() });

export const Route = createFileRoute("/tracking")({
  head: () => ({
    meta: [
      { title: "Track Order — DiamondHub" },
      { name: "description", content: "Check your Mobile Legends diamond top up transaction status using your invoice number." },
    ],
  }),
  validateSearch: (s) => searchSchema.parse(s),
  component: TrackingPage,
});

function TrackingPage() {
  const navigate = useNavigate();
  const { inv } = Route.useSearch();
  const [invoice, setInvoice] = useState(inv ?? "");

  const m = useMutation({
    mutationFn: (i: string) => getOrderByInvoice({ data: { invoice_no: i } }),
    onSuccess: (data, i) => {
      if (!data) toast.error("Invoice not found");
      else navigate({ to: "/invoice/$invoice", params: { invoice: i } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="container mx-auto max-w-xl px-4 py-16">
      <h1 className="font-display text-3xl font-bold text-center">Track <span className="gold-text">Order</span></h1>
      <p className="mt-2 text-center text-muted-foreground">Enter your invoice number to view the transaction status.</p>
      <form className="card-premium mt-8 rounded-lg p-6 space-y-3"
        onSubmit={(e) => { e.preventDefault(); if (invoice.trim()) m.mutate(invoice.trim()); }}>
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Invoice Number</span>
          <input className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary"
            placeholder="DH..." value={invoice} onChange={(e) => setInvoice(e.target.value)} />
        </label>
        <Button variant="legacy" size="legacy" disabled={m.isPending} className="w-full rounded-md btn-gold py-3 text-sm disabled:opacity-50">
          {m.isPending ? "Checking…" : "Check Status"}
        </Button>
      </form>
    </div>
  );
}
