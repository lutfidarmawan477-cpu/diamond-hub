CREATE TABLE public.admin_login_attempts (
  email text PRIMARY KEY,
  fails int NOT NULL DEFAULT 0,
  sessions_used int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  blocked boolean NOT NULL DEFAULT false,
  last_ip text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_login_attempts TO service_role;
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.admin_login_register_failure(_email text, _ip text)
RETURNS public.admin_login_attempts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.admin_login_attempts;
BEGIN
  INSERT INTO public.admin_login_attempts(email) VALUES (_email) ON CONFLICT (email) DO NOTHING;
  SELECT * INTO r FROM public.admin_login_attempts WHERE email = _email FOR UPDATE;
  r.fails := r.fails + 1;
  IF r.fails >= 3 THEN
    r.fails := 0;
    r.sessions_used := r.sessions_used + 1;
    IF r.sessions_used >= 2 THEN r.blocked := true;
    ELSE r.locked_until := now() + interval '1 minute';
    END IF;
  END IF;
  UPDATE public.admin_login_attempts
     SET fails = r.fails, sessions_used = r.sessions_used, blocked = r.blocked,
         locked_until = r.locked_until, last_ip = _ip, updated_at = now()
   WHERE email = _email RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_login_register_failure(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_login_register_failure(text, text) TO service_role;