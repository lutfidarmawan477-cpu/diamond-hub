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
    const newOrder = Number(payload.sort_order) || 0;

    if (payload.id) {
      // Find previous sort_order for this row
      const prev = list.find((p) => p.id === payload.id);
      const oldOrder = prev ? Number(prev.sort_order) : newOrder;

      if (newOrder !== oldOrder) {
        // Move to a temp value first to avoid any transient collisions
        const tempOrder = -Math.abs(Date.now());
        const t = await supabase.from("diamond_packages").update({ sort_order: tempOrder }).eq("id", payload.id);
        if (t.error) return toast.error(t.error.message);

        if (newOrder < oldOrder) {
          // shift [newOrder .. oldOrder-1] up by 1
          const toShift = list.filter((p) => p.id !== payload.id && p.sort_order >= newOrder && p.sort_order < oldOrder);
          for (const p of toShift.sort((a, b) => b.sort_order - a.sort_order)) {
            const r = await supabase.from("diamond_packages").update({ sort_order: p.sort_order + 1 }).eq("id", p.id);
            if (r.error) return toast.error(r.error.message);
          }
        } else {
          // shift (oldOrder .. newOrder] down by 1
          const toShift = list.filter((p) => p.id !== payload.id && p.sort_order > oldOrder && p.sort_order <= newOrder);
          for (const p of toShift.sort((a, b) => a.sort_order - b.sort_order)) {
            const r = await supabase.from("diamond_packages").update({ sort_order: p.sort_order - 1 }).eq("id", p.id);
            if (r.error) return toast.error(r.error.message);
          }
        }
      }
      const { id, ...rest } = payload;
      const r = await supabase.from("diamond_packages").update({ ...rest, sort_order: newOrder }).eq("id", id);
      if (r.error) return toast.error(r.error.message);
    } else {
      // Insert: shift all rows with sort_order >= newOrder up by 1
      const toShift = list.filter((p) => p.sort_order >= newOrder);
      for (const p of toShift.sort((a, b) => b.sort_order - a.sort_order)) {
        const r = await supabase.from("diamond_packages").update({ sort_order: p.sort_order + 1 }).eq("id", p.id);
        if (r.error) return toast.error(r.error.message);
      }
      const { id: _id, ...rest } = payload;
      const r = await supabase.from("diamond_packages").insert({ ...rest, sort_order: newOrder });
      if (r.error) return toast.error(r.error.message);
    }
    toast.success("Saved");
    setEditing(null);
    await load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const target = list.find((p) => p.id === id);
    const { error } = await supabase.from("diamond_packages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (target) {
      // shift all rows with sort_order > target.sort_order down by 1
      const toShift = list.filter((p) => p.id !== id && p.sort_order > target.sort_order);
      for (const p of toShift.sort((a, b) => a.sort_order - b.sort_order)) {
        const r = await supabase.from("diamond_packages").update({ sort_order: p.sort_order - 1 }).eq("id", p.id);
        if (r.error) toast.error(r.error.message);
      }
    }
    await load();
  };

  if (isAdmin === null) return <div className="container mx-auto p-10 text-center">Loading…</div>;
  if (!isAdmin) return <div className="container mx-auto p-10 text-center">Access denied</div>;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 min-w-0">
        <div className="flex justify-between items-center gap-3 mb-6 flex-wrap">
          <h1 className="font-display text-2xl">Diamond Products</h1>
          <button onClick={() => setEditing({ ...empty })} className="rounded-md btn-gold px-3 py-2 text-sm whitespace-nowrap">+ Add Product</button>
        </div>

        <div className="card-premium rounded-xl p-4 sm:p-5">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2 pr-3">Name</th>
                  <th className="pr-3 text-right">Diamonds</th>
                  <th className="pr-3 text-right">Price</th>
                  <th className="pr-3">Badge</th>
                  <th className="pr-3 text-right">Order</th>
                  <th className="pr-3 text-center">Active</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 align-middle">
                    <td className="py-3 pr-3 max-w-[240px] truncate">{p.name}</td>
                    <td className="pr-3 text-right whitespace-nowrap">{p.diamond_amount}</td>
                    <td className="pr-3 text-right gold-text font-semibold whitespace-nowrap">{formatIDR(p.price)}</td>
                    <td className="pr-3">{p.badge ?? "—"}</td>
                    <td className="pr-3 text-right">{p.sort_order}</td>
                    <td className="pr-3 text-center">{p.active ? "✓" : "✗"}</td>
                    <td className="text-right whitespace-nowrap space-x-3">
                      <button onClick={() => setEditing(p)} className="text-gold underline text-xs">Edit</button>
                      <button onClick={() => remove(p.id)} className="text-destructive underline text-xs">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {list.map((p) => (
              <div key={p.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.diamond_amount} diamonds</div>
                  </div>
                  <div className="gold-text text-sm font-semibold whitespace-nowrap">{formatIDR(p.price)}</div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div className="text-muted-foreground">Badge</div>
                  <div className="text-right truncate">{p.badge ?? "—"}</div>
                  <div className="text-muted-foreground">Sort Order</div>
                  <div className="text-right">{p.sort_order}</div>
                  <div className="text-muted-foreground">Active</div>
                  <div className="text-right">{p.active ? "✓" : "✗"}</div>
                </div>
                <div className="mt-3 flex justify-end gap-4">
                  <button onClick={() => setEditing(p)} className="text-gold underline text-xs">Edit</button>
                  <button onClick={() => remove(p.id)} className="text-destructive underline text-xs">Delete</button>
                </div>
              </div>
            ))}
            {list.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No products</div>}
          </div>
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
