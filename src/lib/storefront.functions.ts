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
  const [pkgs, pays, stock] = await Promise.all([
    sb.from("diamond_packages").select("*").eq("active", true).order("sort_order"),
    sb.from("payment_methods").select("*").eq("active", true).order("sort_order"),
    sb.from("diamond_stock").select("current_stock").eq("id", 1).maybeSingle(),
  ]);
  if (pkgs.error) throw new Error(pkgs.error.message);
  if (pays.error) throw new Error(pays.error.message);
  return {
    packages: pkgs.data ?? [],
    payments: pays.data ?? [],
    stock: stock.data?.current_stock ?? 0,
  };
});

function computeDiscount(subtotal: number, percent: number, max: number | null) {
  const raw = Math.floor((subtotal * percent) / 100);
  return max != null ? Math.min(raw, max) : raw;
}

async function validateVoucherInternal(
  sb: ReturnType<typeof publicClient>,
  userId: string,
  code: string,
  subtotal: number,
) {
  const v = await sb.from("vouchers").select("*").eq("code", code.trim().toUpperCase()).maybeSingle();
  if (v.error) throw new Error(v.error.message);
  if (!v.data) throw new Error("Voucher code not found");
  const now = new Date();
  if (!v.data.active) throw new Error("This voucher is inactive");
  if (new Date(v.data.start_date) > now) throw new Error("This voucher is not yet active");
  if (new Date(v.data.end_date) < now) throw new Error("This voucher has expired");

  if (v.data.voucher_type === "member") {
    const p = await sb.from("profiles").select("member_level").eq("id", userId).maybeSingle();
    const level = p.data?.member_level ?? "bronze";
    if (level !== v.data.member_level) {
      throw new Error(`This voucher is only for ${v.data.member_level?.toUpperCase()} members`);
    }
  }

  const used = await sb
    .from("voucher_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("voucher_id", v.data.id)
    .eq("user_id", userId);
  if (used.error) throw new Error(used.error.message);
  const usedCount = used.count ?? 0;
  const limit = v.data.voucher_type === "public" ? 1 : v.data.usage_per_customer;
  if (usedCount >= limit) throw new Error("You have already used this voucher");

  const discount = computeDiscount(subtotal, Number(v.data.discount_percent), v.data.max_discount);
  return { voucher: v.data, discount, remaining: limit - usedCount - 1 };
}

export const validateVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ code: z.string().trim().min(1).max(40), subtotal: z.number().int().nonnegative() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await validateVoucherInternal(context.supabase as ReturnType<typeof publicClient>, context.userId, data.code, data.subtotal);
    return {
      valid: true as const,
      voucher_id: r.voucher.id,
      code: r.voucher.code,
      name: r.voucher.name,
      discount: r.discount,
      percent: Number(r.voucher.discount_percent),
      max_discount: r.voucher.max_discount,
    };
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
  voucher_code: z.string().trim().max(40).optional().nullable(),
});

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orderSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const [pkg, pay, stock] = await Promise.all([
      sb.from("diamond_packages").select("id,name,diamond_amount,price,active").eq("id", data.package_id).maybeSingle(),
      sb.from("payment_methods").select("id,name,fee,active").eq("id", data.payment_method_id).maybeSingle(),
      sb.from("diamond_stock").select("current_stock").eq("id", 1).maybeSingle(),
    ]);
    if (pkg.error || !pkg.data || !pkg.data.active) throw new Error("Package not found");
    if (pay.error || !pay.data || !pay.data.active) throw new Error("Payment method not found");

    const available = stock.data?.current_stock ?? 0;
    if (available < pkg.data.diamond_amount) {
      throw new Error("Sorry, this product is currently out of stock.");
    }

    const subtotal = pkg.data.price;
    const fee = pay.data.fee;

    let voucherId: string | null = null;
    let discount = 0;
    if (data.voucher_code && data.voucher_code.trim().length > 0) {
      const r = await validateVoucherInternal(
        sb as ReturnType<typeof publicClient>,
        context.userId,
        data.voucher_code,
        subtotal,
      );
      voucherId = r.voucher.id;
      discount = r.discount;
    }

    const total = Math.max(0, subtotal + fee - discount);
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
      voucher_id: voucherId,
      discount,
      buyer_name: data.buyer_name,
      buyer_whatsapp: data.buyer_whatsapp,
      buyer_email: data.buyer_email,
      status: "pending",
    }).select("id,invoice_no").single();
    if (insert.error) throw new Error(insert.error.message);

    if (voucherId) {
      await sb.from("voucher_redemptions").insert({
        voucher_id: voucherId,
        user_id: context.userId,
        order_id: insert.data.id,
        discount_applied: discount,
      });
    }
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
