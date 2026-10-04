import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/packages")({
  beforeLoad: () => { throw redirect({ to: "/admin/manage-product", replace: true }); },
});
