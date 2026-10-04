import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/vouchers")({
  beforeLoad: () => { throw redirect({ to: "/admin/voucher", replace: true }); },
});
