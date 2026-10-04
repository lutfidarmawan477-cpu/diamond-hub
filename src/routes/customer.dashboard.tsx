import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/pages/DashboardPage";

export const Route = createFileRoute("/customer/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — DiamondHub" }, { name: "robots", content: "noindex" }] }),
  component: DashboardPage,
});
