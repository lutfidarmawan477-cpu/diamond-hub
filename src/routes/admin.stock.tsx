import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/stock")({
  beforeLoad: () => { throw redirect({ to: "/admin/diamond-stock", replace: true }); },
});
