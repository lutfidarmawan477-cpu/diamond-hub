import { createFileRoute } from "@tanstack/react-router";
import { storefrontQO, TopupPage } from "@/components/pages/TopupPage";

export const Route = createFileRoute("/customer/topup")({
  head: () => ({
    // customer area

    meta: [
      { title: "Top Up Mobile Legends Diamond — DiamondHub" },
      { name: "description", content: "Top up Mobile Legends diamonds. Choose a package, enter your User ID & Zone ID, pay — diamonds delivered instantly." },
      { property: "og:title", content: "Mobile Legends Diamond Top Up" },
      { property: "og:description", content: "Pick an ML diamond package and pay with e-wallet, bank transfer, or QRIS." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(storefrontQO),
  errorComponent: ({ error }) => <div className="container mx-auto p-10 text-center">Failed to load: {error instanceof Error ? error.message : String(error)}</div>,
  notFoundComponent: () => <div className="container mx-auto p-10 text-center">Not found</div>,
  component: TopupPage,
});
