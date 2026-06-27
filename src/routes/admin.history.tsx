import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminSidebar } from "@/components/AdminSidebar";
import { toast } from "sonner";

type Row = { id: string; email: string; user_agent: string | null; created_at: string };

export const Route = createFileRoute("/admin/history")({
  head: () => ({ meta: [{ title: "Login History — Admin" }] }),
  component: AdminHistory,
});

function AdminHistory() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { navigate({ to: "/auth", replace: true }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", s.session.user.id);
      const admin = (roles ?? []).some((r) => r.role === "admin");
      if (!admin) { navigate({ to: "/dashboard", replace: true }); return; }
      setIsAdmin(admin);
      if (admin) {
        const { data, error } = await supabase
          .from("login_history")
          .select("id,email,user_agent,created_at")
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) toast.error(error.message);
        setRows((data as Row[]) ?? []);
      }
    })();
  }, [navigate]);

  if (isAdmin === null) return <div className="container mx-auto p-10 text-center">Memuat…</div>;
  if (!isAdmin) return <div className="container mx-auto p-10 text-center">Akses ditolak</div>;

  return (
    <div className="min-h-screen flex flex-col bg-background md:flex-row">
      <AdminSidebar />
      <main className="flex-1 p-6">
        <h1 className="font-display text-2xl mb-6">Login History</h1>
        <div className="card-premium rounded-xl p-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b border-border">
              <tr><th className="py-2">Waktu</th><th>Email</th><th>Perangkat</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="py-3 text-xs">{new Date(r.created_at).toLocaleString("id-ID")}</td>
                  <td>{r.email}</td>
                  <td className="text-xs text-muted-foreground truncate max-w-[420px]">{r.user_agent ?? "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">Belum ada data</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
