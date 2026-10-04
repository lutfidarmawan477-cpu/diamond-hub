import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/history")({
  beforeLoad: () => { throw redirect({ to: "/admin/login-history", replace: true }); },
});
