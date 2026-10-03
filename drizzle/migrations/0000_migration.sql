DROP POLICY IF EXISTS "buyer can delete own order" ON public.orders;
CREATE POLICY "buyer can delete own order" ON public.orders FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR (status = 'pending' AND (user_id = auth.uid() OR buyer_email = (auth.jwt() ->> 'email'))));