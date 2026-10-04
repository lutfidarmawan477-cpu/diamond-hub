
-- ===== Audit log =====
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit log" ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.audit_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_id := OLD.id::text; ELSE v_id := NEW.id::text; END IF;
  -- Only log changes made by admins (customer/guest actions go through RPCs logged separately)
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN
    INSERT INTO public.admin_audit_log(actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), lower(TG_OP), TG_TABLE_NAME, v_id,
      CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)
           ELSE jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW)) END);
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE EXECUTE ON FUNCTION public.audit_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER audit_packages AFTER INSERT OR UPDATE OR DELETE ON public.diamond_packages FOR EACH ROW EXECUTE FUNCTION public.audit_change();
CREATE TRIGGER audit_vouchers AFTER INSERT OR UPDATE OR DELETE ON public.vouchers FOR EACH ROW EXECUTE FUNCTION public.audit_change();
CREATE TRIGGER audit_orders AFTER UPDATE OR DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.audit_change();
CREATE TRIGGER audit_stock AFTER UPDATE ON public.diamond_stock FOR EACH ROW EXECUTE FUNCTION public.audit_change();

-- ===== Orders: remove client-side write paths and public read =====
DROP POLICY IF EXISTS "public read by invoice" ON public.orders;
DROP POLICY IF EXISTS "anyone can create order" ON public.orders;
DROP POLICY IF EXISTS "buyer can simulate pay own pending order" ON public.orders;
DROP POLICY IF EXISTS "guest can update own pending order" ON public.orders;
DROP POLICY IF EXISTS "buyer can update own pending order to failed" ON public.orders;
DROP POLICY IF EXISTS "anon can delete own pending order" ON public.orders;
DROP POLICY IF EXISTS "buyer can delete own order" ON public.orders;
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon;
REVOKE ALL ON public.orders FROM anon;
CREATE POLICY "users read own orders" ON public.orders FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Expire one order (by invoice) if its time has passed
CREATE OR REPLACE FUNCTION public.expire_order(_invoice text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.orders SET status = 'failed'
  WHERE invoice_no = _invoice AND status = 'pending' AND expires_at <= now();
$$;

-- Expire all of the caller's overdue orders
CREATE OR REPLACE FUNCTION public.expire_my_orders() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.orders SET status = 'failed'
  WHERE user_id = auth.uid() AND status = 'pending' AND expires_at <= now();
$$;

-- Cancel = hard delete, pending only. Invoice number acts as the order secret;
-- orders that belong to an account can only be cancelled by that account.
CREATE OR REPLACE FUNCTION public.cancel_order(_invoice text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  DELETE FROM public.orders
  WHERE invoice_no = _invoice AND status = 'pending'
    AND (user_id IS NULL OR user_id = auth.uid());
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END $$;

-- Admin-only payment confirmation with row lock (prevents double processing)
CREATE OR REPLACE FUNCTION public.admin_confirm_payment(_order_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_amount int; v_invoice text; v_stock bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT status, diamond_amount, invoice_no INTO v_status, v_amount, v_invoice
    FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'Only pending orders can be confirmed'; END IF;
  SELECT current_stock INTO v_stock FROM public.diamond_stock WHERE id = 1 FOR UPDATE;
  IF COALESCE(v_stock, 0) < v_amount THEN RAISE EXCEPTION 'Not enough diamond stock'; END IF;
  UPDATE public.orders SET status = 'success' WHERE id = _order_id;
  INSERT INTO public.admin_audit_log(actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'confirm_payment', 'orders', _order_id::text, jsonb_build_object('invoice_no', v_invoice));
  RETURN v_invoice;
END $$;

-- Prevent anyone other than admins/server from changing order status/amounts directly
CREATE OR REPLACE FUNCTION public.guard_order_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IN ('paid','success') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Completed orders cannot change status';
  END IF;
  IF NEW.total IS DISTINCT FROM OLD.total OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
     OR NEW.fee IS DISTINCT FROM OLD.fee OR NEW.discount IS DISTINCT FROM OLD.discount
     OR NEW.diamond_amount IS DISTINCT FROM OLD.diamond_amount OR NEW.invoice_no IS DISTINCT FROM OLD.invoice_no THEN
    RAISE EXCEPTION 'Order amounts cannot be changed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_order_update BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_order_update();

-- ===== Profiles: customers cannot edit their own spend/level =====
REVOKE INSERT, UPDATE ON public.profiles FROM authenticated, anon;
GRANT INSERT (id, full_name, phone, whatsapp) ON public.profiles TO authenticated;
GRANT UPDATE (full_name, phone, whatsapp) ON public.profiles TO authenticated;

-- ===== Vouchers: no anonymous browsing of codes =====
DROP POLICY IF EXISTS "anyone reads active vouchers" ON public.vouchers;
REVOKE ALL ON public.vouchers FROM anon;
CREATE POLICY "signed-in users read active vouchers" ON public.vouchers FOR SELECT TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

-- Redemptions are written by the server only
DROP POLICY IF EXISTS "user inserts own redemption" ON public.voucher_redemptions;
REVOKE INSERT, UPDATE, DELETE ON public.voucher_redemptions FROM authenticated, anon;

-- ===== Function execute privileges =====
REVOKE EXECUTE ON FUNCTION public.admin_add_stock(bigint, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_customers() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_confirm_payment(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.expire_my_orders() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.on_order_paid() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_order_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_stock(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_customers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_confirm_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_my_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_order(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(text) TO anon, authenticated;
