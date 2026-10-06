import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Customer area gate: only signed-in non-admin users.
// This only protects the screens; every admin data action is also checked by the database.
export const Route = createFileRoute("/customer")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", replace: true });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (isAdmin) throw redirect({ to: "/BB75TB170PILL/DASHBOARD", replace: true });
  },
  component: () => <Outlet />,
});
