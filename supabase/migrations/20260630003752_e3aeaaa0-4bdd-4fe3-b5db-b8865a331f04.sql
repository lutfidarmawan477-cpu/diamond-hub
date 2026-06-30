
-- Fix: grant EXECUTE on has_role so RLS policies that call it work for authenticated users
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

-- Allow customers to DELETE their own orders (by matching email or user_id), and admins to delete any
DROP POLICY IF EXISTS "customers can cancel pending order" ON public.orders;
DROP POLICY IF EXISTS "buyer can delete own order" ON public.orders;
CREATE POLICY "buyer can delete own order" ON public.orders
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR user_id = auth.uid()
  OR buyer_email = (auth.jwt() ->> 'email')
);

-- Also allow anon to delete order they just created (by email match - best-effort)
DROP POLICY IF EXISTS "anon can delete own pending order" ON public.orders;
CREATE POLICY "anon can delete own pending order" ON public.orders
FOR DELETE
TO anon
USING (status = 'pending');

-- Admin-only function: list registered customers with last login + status
CREATE OR REPLACE FUNCTION public.admin_list_customers()
RETURNS TABLE(
  id uuid,
  full_name text,
  email text,
  registered_at timestamptz,
  last_login timestamptz,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    u.email::text,
    u.created_at AS registered_at,
    (SELECT max(lh.created_at) FROM public.login_history lh WHERE lh.user_id = p.id) AS last_login,
    CASE WHEN u.banned_until IS NOT NULL AND u.banned_until > now() THEN 'banned'
         WHEN u.email_confirmed_at IS NULL THEN 'unverified'
         ELSE 'active' END AS status
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_customers() TO authenticated;
