CREATE POLICY "customers can cancel pending order" ON public.orders
FOR UPDATE
TO anon, authenticated
USING (status = 'pending')
WITH CHECK (status = 'cancelled');