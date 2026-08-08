-- Keep purchase history intact when a voucher is deleted
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS voucher_code text;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_voucher_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_voucher_id_fkey
  FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE SET NULL;

ALTER TABLE public.voucher_redemptions DROP CONSTRAINT IF EXISTS voucher_redemptions_voucher_id_fkey;
ALTER TABLE public.voucher_redemptions ADD CONSTRAINT voucher_redemptions_voucher_id_fkey
  FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE CASCADE;

-- Guest checkout: allow anonymous buyers to progress their own guest orders
DROP POLICY IF EXISTS "guest can update own pending order" ON public.orders;
CREATE POLICY "guest can update own pending order"
ON public.orders FOR UPDATE TO anon
USING (status = 'pending' AND user_id IS NULL)
WITH CHECK (status IN ('paid','failed'));

DROP POLICY IF EXISTS "anon can delete own pending order" ON public.orders;
CREATE POLICY "anon can delete own pending order"
ON public.orders FOR DELETE TO anon
USING (status = 'pending' AND user_id IS NULL);