import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const getStorefront = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [pkgs, pays] = await Promise.all([
    sb.from("diamond_packages").select("*").eq("active", true).order("sort_order"),
    sb.from("payment_methods").select("*").eq("active", true).order("sort_order"),
  ]);
  if (pkgs.error) throw new Error(pkgs.error.message);
  if (pays.error) throw new Error(pays.error.message);
  return { packages: pkgs.data ?? [], payments: pays.data ?? [] };
});

const orderSchema = z.object({
  game_user_id: z.string().trim().min(3).max(32),
  zone_id: z.string().trim().min(1).max(16),
  nickname: z.string().trim().max(64).optional().nullable(),
  package_id: z.string().uuid(),
  payment_method_id: z.string().uuid(),
  buyer_name: z.string().trim().min(2).max(80),
  buyer_whatsapp: z.string().trim().min(8).max(20),
  buyer_email: z.string().trim().email().max(120),
});

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orderSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const [pkg, pay] = await Promise.all([
      sb.from("diamond_packages").select("id,name,diamond_amount,price,active").eq("id", data.package_id).maybeSingle(),
      sb.from("payment_methods").select("id,name,fee,active").eq("id", data.payment_method_id).maybeSingle(),
    ]);
    if (pkg.error || !pkg.data || !pkg.data.active) throw new Error("Package not found");
    if (pay.error || !pay.data || !pay.data.active) throw new Error("Payment method not found");

    const subtotal = pkg.data.price;
    const fee = pay.data.fee;
    const total = subtotal + fee;
    const invoice_no = "DH" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

    const insert = await sb.from("orders").insert({
      invoice_no,
      user_id: context.userId,
      game_user_id: data.game_user_id,
      zone_id: data.zone_id,
      nickname: data.nickname ?? null,
      package_id: pkg.data.id,
      package_name: pkg.data.name,
      diamond_amount: pkg.data.diamond_amount,
      payment_method_id: pay.data.id,
      payment_method_name: pay.data.name,
      subtotal, fee, total,
      buyer_name: data.buyer_name,
      buyer_whatsapp: data.buyer_whatsapp,
      buyer_email: data.buyer_email,
      status: "pending",
    }).select("invoice_no").single();
    if (insert.error) throw new Error(insert.error.message);
    return { invoice_no: insert.data.invoice_no };
  });

export const getOrderByInvoice = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ invoice_no: z.string().trim().min(4).max(40) }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const r = await sb.from("orders").select("*").eq("invoice_no", data.invoice_no).maybeSingle();
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
