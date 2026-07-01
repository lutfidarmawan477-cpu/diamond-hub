import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatIDR } from "@/lib/format";
import { toast } from "sonner";
import { AdminSidebar } from "@/components/AdminSidebar";

type Pkg = {
  id: string; name: string; diamond_amount: number; price: number;
  original_price: number | null; badge: string | null; sort_order: number; active: boolean;
};

export const Route = createFileRoute("/admin/packages")({
  head: () => ({ meta: [{ title: "Manage Products — Admin" }] }),
  component: AdminPackages,
});

const empty: Pkg = { id: "", name: "", diamond_amount: 0, price: 0, original_price: null, badge: null, sort_order: 0, active: true };

function AdminPackages() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [list, setList] = useState<Pkg[]>([]);
  const [editing, setEditing] = useState<Pkg | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from("diamond_packages").select("*").order("sort_order");
    if (error) toast.error(error.message);
    setList((data as Pkg[]) ?? []);
  };

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { navigate({ to: "/auth", replace: true }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", s.session.user.id);
      const admin = (roles ?? []).some((r) => r.role === "admin");
      if (!admin) { navigate({ to: "/dashboard", replace: true }); return; }
      setIsAdmin(admin);
      if (admin) await load();
    })();
  }, [navigate]);

  const save = async () => {
    if (!editing) return;
    const payload = { ...editing };
    let err;
    if (payload.id) {
      const { id, ...rest } = payload;
      const r = await supabase.from("diamond_packages").update(rest).eq("id", id);
      err = r.error;
    } else {
      const { id: _id, ...rest } = payload;
      const r = await supabase.from("diamond_packages").insert(rest);
      err = r.error;
    }
    if (err) return toast.error(err.message);
    toast.success("Saved");
    setEditing(null);
    await load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("diamond_packages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await load();
  };

  if (isAdmin === null) return <div className="container mx-auto p-10 text-center">Loading…</div>;
  if (!isAdmin) return <div className="container mx-auto p-10 text-center">Access denied</div>;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <AdminSidebar />
      <main className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-display text-2xl">Diamond Products</h1>
          <button onClick={() => setEditing({ ...empty })} className="rounded-md btn-gold px-4 py-2 text-sm">+ Add Product</button>
        </div>

        <div className="card-premium rounded-xl p-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b border-border">
              <tr><th className="py-2">Name</th><th>Diamonds</th><th>Price</th><th>Badge</th><th>Order</th><th>Active</th><th></th></tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="py-3">{p.name}</td>
                  <td>{p.diamond_amount}</td>
                  <td className="gold-text font-semibold">{formatIDR(p.price)}</td>
                  <td>{p.badge ?? "—"}</td>
                  <td>{p.sort_order}</td>
                  <td>{p.active ? "✓" : "✗"}</td>
                  <td className="space-x-2">
                    <button onClick={() => setEditing(p)} className="text-gold underline text-xs">Edit</button>
                    <button onClick={() => remove(p.id)} className="text-destructive underline text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editing && (
          <div className="fixed inset-0 bg-black/70 grid place-items-center p-4 z-50" onClick={() => setEditing(null)}>
            <div className="card-premium rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h2 className="font-display text-lg mb-4">{editing.id ? "Edit Product" : "Add Product"}</h2>
              <div className="space-y-3">
                <Field label="Name"><input className={ic} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Diamond Amount"><input type="number" className={ic} value={editing.diamond_amount} onChange={(e) => setEditing({ ...editing, diamond_amount: Number(e.target.value) })} /></Field>
                  <Field label="Sort Order"><input type="number" className={ic} value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></Field>
                  <Field label="Price"><input type="number" className={ic} value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></Field>
                  <Field label="Original Price (optional)"><input type="number" className={ic} value={editing.original_price ?? ""} onChange={(e) => setEditing({ ...editing, original_price: e.target.value ? Number(e.target.value) : null })} /></Field>
                </div>
                <Field label="Badge (optional)"><input className={ic} value={editing.badge ?? ""} onChange={(e) => setEditing({ ...editing, badge: e.target.value || null })} /></Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active
                </label>
              </div>
              <div className="mt-5 flex gap-2 justify-end">
                <button onClick={() => setEditing(null)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>
                <button onClick={save} className="rounded-md btn-gold px-4 py-2 text-sm">Save</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const ic = "w-full rounded-md bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs text-muted-foreground">{label}</span>{children}</label>;
}
