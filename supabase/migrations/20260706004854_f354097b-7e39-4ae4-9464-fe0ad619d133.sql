
-- =========================================
-- 1. DIAMOND STOCK
-- =========================================
CREATE TABLE public.diamond_stock (
  id INT PRIMARY KEY DEFAULT 1,
  current_stock BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT diamond_stock_single_row CHECK (id = 1)
);
GRANT SELECT ON public.diamond_stock TO anon, authenticated;
GRANT ALL ON public.diamond_stock TO service_role;
ALTER TABLE public.diamond_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read stock" ON public.diamond_stock FOR SELECT USING (true);
CREATE POLICY "admin manages stock" ON public.diamond_stock FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.diamond_stock (id, current_stock) VALUES (1, 100000);

CREATE TABLE public.diamond_stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('add','deduct')),
  amount BIGINT NOT NULL,
  admin_id UUID,
  order_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.diamond_stock_history TO authenticated;
GRANT ALL ON public.diamond_stock_history TO service_role;
ALTER TABLE public.diamond_stock_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads stock history" ON public.diamond_stock_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin inserts stock history" ON public.diamond_stock_history FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================
-- 2. PACKAGES: best_seller
-- =========================================
ALTER TABLE public.diamond_packages ADD COLUMN best_seller BOOLEAN NOT NULL DEFAULT false;

-- =========================================
-- 3. PROFILES: total_spent + member_level
-- =========================================
ALTER TABLE public.profiles ADD COLUMN total_spent BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN member_level TEXT NOT NULL DEFAULT 'bronze'
  CHECK (member_level IN ('bronze','silver','gold','diamond'));

-- backfill from existing paid orders
UPDATE public.profiles p SET total_spent = COALESCE(t.sum_total, 0)
FROM (
  SELECT user_id, SUM(total) AS sum_total FROM public.orders
  WHERE status IN ('paid','success') AND user_id IS NOT NULL GROUP BY user_id
) t WHERE p.id = t.user_id;

UPDATE public.profiles SET member_level = CASE
  WHEN total_spent >= 1000000 THEN 'diamond'
  WHEN total_spent >= 500000 THEN 'gold'
  WHEN total_spent >= 100000 THEN 'silver'
  ELSE 'bronze' END;

-- =========================================
-- 4. VOUCHERS
-- =========================================
CREATE TABLE public.vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  voucher_type TEXT NOT NULL CHECK (voucher_type IN ('public','member')),
  member_level TEXT CHECK (member_level IN ('bronze','silver','gold','diamond')),
  discount_percent NUMERIC NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  max_discount NUMERIC,
  usage_per_customer INT NOT NULL DEFAULT 1 CHECK (usage_per_customer > 0),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vouchers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.vouchers TO authenticated;
GRANT ALL ON public.vouchers TO service_role;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads active vouchers" ON public.vouchers FOR SELECT USING (true);
CREATE POLICY "admin manages vouchers" ON public.vouchers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER vouchers_updated_at BEFORE UPDATE ON public.vouchers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 5. VOUCHER REDEMPTIONS
-- =========================================
CREATE TABLE public.voucher_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  order_id UUID,
  discount_applied NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX voucher_redemptions_user_idx ON public.voucher_redemptions(user_id, voucher_id);
GRANT SELECT, INSERT ON public.voucher_redemptions TO authenticated;
GRANT ALL ON public.voucher_redemptions TO service_role;
ALTER TABLE public.voucher_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own redemptions" ON public.voucher_redemptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user inserts own redemption" ON public.voucher_redemptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- =========================================
-- 6. ORDERS: voucher_id + discount
-- =========================================
ALTER TABLE public.orders ADD COLUMN voucher_id UUID REFERENCES public.vouchers(id);
ALTER TABLE public.orders ADD COLUMN discount NUMERIC NOT NULL DEFAULT 0;

-- =========================================
-- 7. TRIGGER: on order paid/success
-- =========================================
CREATE OR REPLACE FUNCTION public.on_order_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_total BIGINT;
  v_new_level TEXT;
BEGIN
  IF NEW.status IN ('paid','success')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND (OLD.status NOT IN ('paid','success') OR OLD.status IS NULL) THEN

    -- decrement stock
    UPDATE public.diamond_stock SET current_stock = current_stock - NEW.diamond_amount, updated_at = now() WHERE id = 1;
    INSERT INTO public.diamond_stock_history (activity_type, amount, order_id, note)
    VALUES ('deduct', NEW.diamond_amount, NEW.id, 'Order ' || NEW.invoice_no);

    -- update total spent + level
    IF NEW.user_id IS NOT NULL THEN
      UPDATE public.profiles SET total_spent = total_spent + NEW.total WHERE id = NEW.user_id
        RETURNING total_spent INTO v_new_total;
      v_new_level := CASE
        WHEN v_new_total >= 1000000 THEN 'diamond'
        WHEN v_new_total >= 500000 THEN 'gold'
        WHEN v_new_total >= 100000 THEN 'silver'
        ELSE 'bronze' END;
      UPDATE public.profiles SET member_level = v_new_level WHERE id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_order_paid AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.on_order_paid();

-- =========================================
-- 8. Admin stock add function
-- =========================================
CREATE OR REPLACE FUNCTION public.admin_add_stock(_amount BIGINT, _note TEXT DEFAULT NULL)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_new BIGINT;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  UPDATE public.diamond_stock SET current_stock = current_stock + _amount, updated_at = now()
    WHERE id = 1 RETURNING current_stock INTO v_new;
  INSERT INTO public.diamond_stock_history (activity_type, amount, admin_id, note)
    VALUES ('add', _amount, auth.uid(), _note);
  RETURN v_new;
END;
$$;
