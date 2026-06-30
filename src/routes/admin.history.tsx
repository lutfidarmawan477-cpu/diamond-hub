import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminSidebar } from "@/components/AdminSidebar";
import { toast } from "sonner";

type Customer = {
  id: string;
  full_name: string | null;
  email: string;
  registered_at: string;
  last_login: string | null;
  status: string;
};

export const Route = createFileRoute("/admin/history")({
  head: () => ({ meta: [{ title: "Login History — Admin" }] }),
  component: AdminHistory,
});

function AdminHistory() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { navigate({ to: "/auth", replace: true }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", s.session.user.id);
      const admin = (roles ?? []).some((r) => r.role === "admin");
      if (!admin) { navigate({ to: "/dashboard", replace: true }); return; }
      setIsAdmin(admin);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_list_customers");
      if (error) toast.error(error.message);
      setRows((data as Customer[]) ?? []);
      setLoading(false);
    })();
  }, [navigate]);

  if (isAdmin === null) return <div className="container mx-auto p-10 text-center">Memuat…</div>;
  if (!isAdmin) return <div className="container mx-auto p-10 text-center">Akses ditolak</div>;

  const statusBadge = (s: string) => {
    const color =
      s === "active" ? "bg-success/20 text-success border-success/40"
      : s === "banned" ? "bg-destructive/20 text-destructive border-destructive/40"
      : "bg-muted text-muted-foreground border-border";
    return <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${color}`}>{s}</span>;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background md:flex-row animate-fade-in">
      <AdminSidebar />
      <main className="flex-1 p-6">
        <h1 className="font-display text-2xl mb-2">Riwayat Login</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Daftar akun customer terdaftar beserta waktu login terakhir.
        </p>
        <div className="card-premium rounded-xl p-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="py-2 pr-3">Nama</th>
                <th className="pr-3">Email</th>
                <th className="pr-3">Registrasi</th>
                <th className="pr-3">Login Terakhir</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 hover:bg-accent/30 transition">
                  <td className="py-3 pr-3">{r.full_name ?? "—"}</td>
                  <td className="pr-3">{r.email}</td>
                  <td className="pr-3 text-xs">{new Date(r.registered_at).toLocaleString("id-ID")}</td>
                  <td className="pr-3 text-xs">{r.last_login ? new Date(r.last_login).toLocaleString("id-ID") : "—"}</td>
                  <td>{statusBadge(r.status)}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Belum ada data</td></tr>
              )}
              {loading && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Memuat…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
