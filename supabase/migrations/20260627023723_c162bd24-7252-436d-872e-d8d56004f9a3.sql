
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  whatsapp TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- roles
CREATE TYPE public.app_role AS ENUM ('admin', 'customer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- handle_new_user trigger: create profile + default customer role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- diamond packages
CREATE TABLE public.diamond_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  diamond_amount INTEGER NOT NULL,
  price INTEGER NOT NULL,
  original_price INTEGER,
  badge TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.diamond_packages TO anon, authenticated;
GRANT ALL ON public.diamond_packages TO service_role;
ALTER TABLE public.diamond_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read active packages" ON public.diamond_packages FOR SELECT TO anon, authenticated USING (active = TRUE);
CREATE POLICY "admins manage packages" ON public.diamond_packages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- payment methods
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- ewallet / bank / qris / va
  fee INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT ON public.payment_methods TO anon, authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read active payments" ON public.payment_methods FOR SELECT TO anon, authenticated USING (active = TRUE);
CREATE POLICY "admins manage payments" ON public.payment_methods FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  game_user_id TEXT NOT NULL,
  zone_id TEXT NOT NULL,
  nickname TEXT,
  package_id UUID NOT NULL REFERENCES public.diamond_packages(id),
  package_name TEXT NOT NULL,
  diamond_amount INTEGER NOT NULL,
  payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id),
  payment_method_name TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  fee INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_whatsapp TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending / paid / processing / success / failed / expired
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT SELECT, INSERT ON public.orders TO anon;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- guests can create orders
CREATE POLICY "anyone can create order" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (TRUE);
-- lookup by invoice for tracking (public read by invoice)
CREATE POLICY "public read by invoice" ON public.orders FOR SELECT TO anon, authenticated USING (TRUE);
-- owner update (e.g. cancel) — none for now; admins via service role
CREATE POLICY "admins manage orders" ON public.orders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- seed packages
INSERT INTO public.diamond_packages (name, diamond_amount, price, original_price, badge, sort_order) VALUES
  ('5 Diamond', 5, 1500, NULL, NULL, 1),
  ('12 Diamond', 12, 3500, NULL, NULL, 2),
  ('19 Diamond', 19, 5500, NULL, NULL, 3),
  ('28 Diamond', 28, 8000, NULL, NULL, 4),
  ('44 Diamond', 44, 12500, 13000, NULL, 5),
  ('59 Diamond', 59, 16500, NULL, NULL, 6),
  ('85 Diamond', 85, 23500, 24500, 'Hot', 7),
  ('170 Diamond', 170, 46500, NULL, NULL, 8),
  ('240 Diamond', 240, 65000, 67000, 'Best Seller', 9),
  ('296 Diamond', 296, 79000, NULL, NULL, 10),
  ('408 Diamond', 408, 108000, NULL, NULL, 11),
  ('568 Diamond', 568, 149000, 155000, 'Hot', 12),
  ('875 Diamond', 875, 225000, NULL, 'Popular', 13),
  ('2010 Diamond', 2010, 510000, 525000, 'Best Seller', 14),
  ('Weekly Diamond Pass', 0, 27500, NULL, 'Pass', 20),
  ('Twilight Pass', 0, 149000, NULL, 'Pass', 21);

-- seed payment methods
INSERT INTO public.payment_methods (code, name, type, fee, sort_order) VALUES
  ('dana','DANA','ewallet',1500,1),
  ('ovo','OVO','ewallet',1500,2),
  ('gopay','GoPay','ewallet',1500,3),
  ('shopeepay','ShopeePay','ewallet',1500,4),
  ('qris','QRIS','qris',1000,5),
  ('bca','BCA Virtual Account','va',4000,6),
  ('bri','BRI Virtual Account','va',4000,7),
  ('mandiri','Mandiri Virtual Account','va',4000,8),
  ('bni','BNI Virtual Account','va',4000,9);
