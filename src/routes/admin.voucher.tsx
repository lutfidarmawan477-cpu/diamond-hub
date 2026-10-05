import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminSidebar } from "@/components/AdminSidebar";
import { usePolling } from "@/hooks/usePolling";

type Voucher = {
  id: string;
  name: string;
  code: string;
  voucher_type: "public" | "member";
  member_level: string | null;
  discount_percent: number;
  usage_per_customer: number;
  start_date: string;
  end_date: string;
  active: boolean;
  description: string | null;
};

const NO_EXPIRY = "2099-12-31T23:59";

const empty: Voucher = {
  id: "", name: "", code: "", voucher_type: "public", member_level: null,
  discount_percent: 10, usage_per_customer: 1,
  start_date: new Date().toISOString().slice(0, 16),
  end_date: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 16),
  active: true, description: null,
};

export const Route = createFileRoute("/admin/voucher")({
  head: () => ({ meta: [{ title: "Manage Vouchers — Admin" }] }),
  component: AdminVouchers,
});

function isMemberVoucher(v: Voucher) {
  return v.voucher_type === "member";
}

function AdminVouchers() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [list, setList] = useState<Voucher[]>([]);
  const [editing, setEditing] = useState<Voucher | null>(null);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    const { data, error } = await supabase.from("vouchers").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setList((data as Voucher[]) ?? []);
  };

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return navigate({ to: "/admin/login", replace: true });
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", sess.session.user.id);
      const admin = (roles ?? []).some((r) => r.role === "admin");
      if (!admin) return navigate({ to: "/customer/dashboard", replace: true });
      setIsAdmin(true);
      await load();
    })();
  }, [navigate]);

  usePolling(() => { if (isAdmin && !editing) void load(); }, 10000);

  useEffect(() => {
    document.body.style.overflow = editing ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [editing]);

  const save = async () => {
    if (!editing) return;
    if (!editing.name || !editing.code) return toast.error("Name and code are required");
    const member = isMemberVoucher(editing);
    if (member && !editing.member_level) return toast.error("Select a member level");

    const payload = {
      name: editing.name,
      code: editing.code.trim().toUpperCase(),
      voucher_type: editing.voucher_type,
      member_level: member ? editing.member_level : null,
      discount_percent: Number(editing.discount_percent),
      max_discount: null,
      usage_per_customer: member ? Number(editing.usage_per_customer) : 1,
      // Member vouchers never expire — they are only limited by Active status.
      start_date: member ? new Date(0).toISOString() : new Date(editing.start_date).toISOString(),
      end_date: member ? new Date(NO_EXPIRY).toISOString() : new Date(editing.end_date).toISOString(),
      active: editing.active,
      description: editing.description || null,
    };

    const r = editing.id
      ? await supabase.from("vouchers").update(payload).eq("id", editing.id)
      : await supabase.from("vouchers").insert(payload);
    if (r.error) return toast.error(r.error.message);
    toast.success("Saved");
    setEditing(null);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this voucher?")) return;
    const { error } = await supabase.from("vouchers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await load();
  };

  const statusOf = (v: Voucher) => {
    const now = Date.now();
    if (!v.active) return { key: "inactive", label: "Inactive", cls: "bg-muted text-muted-foreground border-border" };
    if (!isMemberVoucher(v) && new Date(v.end_date).getTime() < now) {
      return { key: "expired", label: "Expired", cls: "bg-destructive/20 text-destructive border-destructive/40" };
    }
    if (!isMemberVoucher(v) && new Date(v.start_date).getTime() > now) {
      return { key: "scheduled", label: "Scheduled", cls: "bg-gold/20 text-gold border-gold/40" };
    }
    return { key: "active", label: "Active", cls: "bg-success/20 text-success border-success/40" };
  };

  if (isAdmin === null) return <div className="container mx-auto p-10 text-center">Loading…</div>;

  const filtered = list.filter((v) => {
    if (filter === "all") return true;
    if (filter === "member") return v.voucher_type === "member";
    if (filter === "public") return v.voucher_type === "public";
    return statusOf(v).key === filter;
  });

  const validity = (v: Voucher) => (isMemberVoucher(v) ? "No expiry" : new Date(v.end_date).toLocaleDateString("en-US"));

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 min-w-0">
        <div className="flex justify-between items-center gap-3 mb-6 flex-wrap">
          <h1 className="font-display text-2xl">Manage Vouchers</h1>
          <button onClick={() => setEditing({ ...empty })} className="rounded-md btn-gold px-3 py-2 text-sm active:scale-95 transition">+ Add Voucher</button>
        </div>

        <div className="card-premium rounded-xl p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{filtered.length} voucher(s)</span>
            <select
              className="rounded-md bg-input border border-border px-3 py-2 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="inactive">Inactive</option>
              <option value="member">Member Voucher</option>
              <option value="public">Public Voucher</option>
            </select>
          </div>
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2 pr-3">Name</th>
                  <th className="pr-3">Code</th>
                  <th className="pr-3">Type</th>
                  <th className="pr-3 text-right">Discount</th>
                  <th className="pr-3">Valid Until</th>
                  <th className="pr-3">Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => {
                  const st = statusOf(v);
                  return (
                    <tr key={v.id} className="border-b border-border/60">
                      <td className="py-3 pr-3 max-w-[200px] truncate">{v.name}</td>
                      <td className="pr-3 font-mono text-xs">{v.code}</td>
                      <td className="pr-3 capitalize">{v.voucher_type}{v.voucher_type === "member" && ` (${v.member_level})`}</td>
                      <td className="pr-3 text-right">{v.discount_percent}%</td>
                      <td className="pr-3 text-xs">{validity(v)}</td>
                      <td className="pr-3"><span className={`rounded-full border px-2 py-0.5 text-xs uppercase ${st.cls}`}>{st.label}</span></td>
                      <td className="text-right whitespace-nowrap space-x-3">
                        <button onClick={() => setEditing({ ...v, start_date: v.start_date.slice(0, 16), end_date: v.end_date.slice(0, 16) })} className="text-gold underline text-xs">Edit</button>
                        <button onClick={() => remove(v.id)} className="text-destructive underline text-xs">Delete</button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No vouchers yet</td></tr>}
              </tbody>
            </table>
          </div>
          {/* Mobile */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((v) => {
              const st = statusOf(v);
              return (
                <div key={v.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{v.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{v.code}</div>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div className="text-muted-foreground">Type</div><div className="text-right capitalize">{v.voucher_type}{v.voucher_type === "member" && ` (${v.member_level})`}</div>
                    <div className="text-muted-foreground">Discount</div><div className="text-right">{v.discount_percent}%</div>
                    <div className="text-muted-foreground">Valid Until</div><div className="text-right">{validity(v)}</div>
                  </div>
                  <div className="mt-3 flex justify-end gap-4">
                    <button onClick={() => setEditing({ ...v, start_date: v.start_date.slice(0, 16), end_date: v.end_date.slice(0, 16) })} className="text-gold underline text-xs">Edit</button>
                    <button onClick={() => remove(v.id)} className="text-destructive underline text-xs">Delete</button>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No vouchers yet</div>}
          </div>
        </div>

        {editing && typeof document !== "undefined" && createPortal(
          <>
            <div className="fixed inset-0 z-[100] bg-black/70" onClick={() => setEditing(null)} />
            <div className="fixed left-1/2 top-1/2 z-[101] w-[95%] max-w-[560px] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 flex flex-col overflow-hidden card-premium rounded-2xl shadow-2xl">
              <div className="p-6 pb-3 shrink-0">
                <h2 className="font-display text-lg">{editing.id ? "Edit Voucher" : "Add Voucher"}</h2>
              </div>
              <div className="px-6 space-y-3 overflow-y-auto min-h-0">
                <Field label="Voucher Name"><input className={ic} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Voucher Code"><input className={ic} value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} /></Field>
                  <Field label="Type">
                    <select className={ic} value={editing.voucher_type} onChange={(e) => setEditing({ ...editing, voucher_type: e.target.value as "public" | "member" })}>
                      <option value="public">Public</option>
                      <option value="member">Member</option>
                    </select>
                  </Field>
                  {editing.voucher_type === "member" && (
                    <Field label="Member Level">
                      <select className={ic} value={editing.member_level ?? ""} onChange={(e) => setEditing({ ...editing, member_level: e.target.value || null })}>
                        <option value="">Select…</option>
                        <option value="bronze">Bronze</option>
                        <option value="silver">Silver</option>
                        <option value="gold">Gold</option>
                        <option value="diamond">Diamond</option>
                      </select>
                    </Field>
                  )}
                  {editing.voucher_type === "member" && (
                    <Field label="Max Usage per Customer"><input type="number" min={1} className={ic} value={editing.usage_per_customer} onChange={(e) => setEditing({ ...editing, usage_per_customer: Number(e.target.value) })} /></Field>
                  )}
                  <Field label="Discount %"><input type="number" min={1} max={100} className={ic} value={editing.discount_percent} onChange={(e) => setEditing({ ...editing, discount_percent: Number(e.target.value) })} /></Field>
                  {editing.voucher_type === "public" && (
                    <>
                      <Field label="Start Date"><input type="datetime-local" className={ic} value={editing.start_date} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} /></Field>
                      <Field label="End Date"><input type="datetime-local" className={ic} value={editing.end_date} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} /></Field>
                    </>
                  )}
                </div>
                {editing.voucher_type === "member" && (
                  <p className="text-xs text-muted-foreground">
                    Member vouchers have no start or end date — they stay available while Active and until the customer's usage limit runs out.
                  </p>
                )}
                <Field label="Description (optional)">
                  <textarea rows={2} className={ic} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active
                </label>
              </div>
              <div className="p-6 pt-4 flex gap-2 justify-end shrink-0 border-t border-border/40 mt-3">
                <button onClick={() => setEditing(null)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>
                <button onClick={save} className="rounded-md btn-gold px-4 py-2 text-sm active:scale-95 transition">Save</button>
              </div>
            </div>
          </>,
          document.body,
        )}
      </main>
    </div>
  );
}

const ic = "w-full rounded-md bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs text-muted-foreground">{label}</span>{children}</label>;
}
