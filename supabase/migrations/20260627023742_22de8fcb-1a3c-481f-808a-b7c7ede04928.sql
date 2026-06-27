
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "anyone can create order" ON public.orders;
CREATE POLICY "anyone can create order" ON public.orders FOR INSERT TO anon, authenticated
WITH CHECK (
  length(buyer_name) > 0
  AND length(buyer_whatsapp) > 0
  AND length(buyer_email) > 0
  AND length(game_user_id) > 0
  AND length(zone_id) > 0
  AND total > 0
);
