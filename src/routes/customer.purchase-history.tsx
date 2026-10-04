import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/pages/DashboardPage";

export const Route = createFileRoute("/customer/purchase-history")({
  head: () => ({ meta: [{ title: "Purchase History — DiamondHub" }, { name: "robots", content: "noindex" }] }),
  component: DashboardPage,
});
