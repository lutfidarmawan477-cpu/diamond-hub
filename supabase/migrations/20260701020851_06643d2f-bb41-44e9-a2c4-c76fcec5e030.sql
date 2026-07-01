
-- Allow buyer to cancel their own pending order by transitioning status to 'failed'
CREATE POLICY "buyer can update own pending order to failed"
ON public.orders
FOR UPDATE
TO authenticated, anon
USING (
  status = 'pending'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR user_id = auth.uid()
    OR buyer_email = (auth.jwt() ->> 'email'::text)
  )
)
WITH CHECK (
  status = 'failed'
);
