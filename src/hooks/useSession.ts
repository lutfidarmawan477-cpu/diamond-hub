import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setLoggedIn(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setLoggedIn(!!s);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);
  return loggedIn;
}
