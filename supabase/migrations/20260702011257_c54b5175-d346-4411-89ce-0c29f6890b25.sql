CREATE OR REPLACE FUNCTION public.admin_list_customers()
 RETURNS TABLE(id uuid, full_name text, email text, registered_at timestamp with time zone, last_login timestamp with time zone, status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  WHERE NOT public.has_role(p.id, 'admin'::app_role)
  ORDER BY u.created_at DESC;
END;
$function$;