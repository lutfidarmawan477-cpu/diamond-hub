import { createFileRoute } from "@tanstack/react-router";
import { orderQO, InvoicePage } from "@/components/pages/InvoicePage";

export const Route = createFileRoute("/customer/payment/$invoice")({
  head: ({ params }) => ({
    meta: [
      { title: `Invoice ${params.invoice} — DiamondHub` },
      { name: "description", content: "Mobile Legends diamond top up invoice details." },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(orderQO(params.invoice)),
  errorComponent: ({ error }) => <div className="container mx-auto p-10 text-center">Failed to load: {error instanceof Error ? error.message : String(error)}</div>,
  notFoundComponent: () => <div className="container mx-auto p-10 text-center">Invoice not found</div>,
  component: InvoiceRoute,
});

function InvoiceRoute() {
  const { invoice } = Route.useParams();
  return <InvoicePage invoice={invoice} />;
}
