import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "admin" | "customer" | null;

async function getCurrentRole(): Promise<UserRole> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", sessionData.session.user.id);

  return (roles ?? []).some((row) => row.role === "admin") ? "admin" : "customer";
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display font-bold gold-text">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Halaman tidak ditemukan</h2>
        <Link to="/" className="mt-6 inline-block rounded-md btn-gold px-5 py-2 text-sm">
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Terjadi kesalahan</h1>
        <p className="mt-2 text-sm text-muted-foreground">Coba muat ulang halaman.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-md btn-gold px-5 py-2 text-sm"
        >
          Coba lagi
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "DiamondHub — Top Up Diamond Mobile Legends Murah & Cepat" },
      { name: "description", content: "Top up diamond Mobile Legends termurah, proses instan 24 jam, pembayaran lengkap DANA OVO GoPay QRIS Bank. Aman dan terpercaya." },
      { property: "og:title", content: "DiamondHub — Top Up Diamond Mobile Legends" },
      { property: "og:description", content: "Top up diamond ML termurah dan tercepat. Proses instan 24 jam." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function SiteHeader({ role, onSignOut }: { role: UserRole | undefined; onSignOut: () => Promise<void> }) {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-background/70 border-b border-border">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg btn-gold text-base">💎</div>
          <span className="font-display text-xl font-bold tracking-wider">Diamond<span className="gold-text">Hub</span></span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link to="/" className="hover:text-gold transition">Beranda</Link>
          <Link to="/topup" className="hover:text-gold transition">Top Up</Link>
          <Link to="/tracking" className="hover:text-gold transition">Lacak Pesanan</Link>
          <Link to="/dashboard" className="hover:text-gold transition">Dashboard</Link>
        </nav>
        <div className="flex items-center gap-2">
          {role === undefined ? (
            <span className="h-9 w-20 rounded-md border border-border/60 opacity-60" aria-hidden="true" />
          ) : role ? (
            <>
              <Link
                to={role === "admin" ? "/admin" : "/dashboard"}
                className="rounded-md px-4 py-2 text-sm border border-border hover:border-primary transition"
              >
                {role === "admin" ? "Admin" : "Dashboard"}
              </Link>
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-md px-4 py-2 text-sm border border-border hover:border-destructive hover:text-destructive transition"
              >
                Keluar
              </button>
            </>
          ) : (
            <Link to="/auth" className="rounded-md px-4 py-2 text-sm border border-border hover:border-primary transition">Masuk</Link>
          )}
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border mt-20 bg-card/40">
      <div className="container mx-auto px-4 py-10 grid gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg btn-gold">💎</div>
            <span className="font-display text-lg font-bold">Diamond<span className="gold-text">Hub</span></span>
          </div>
          <p className="text-sm text-muted-foreground">Top up diamond Mobile Legends termurah dan tercepat. Layanan 24 jam.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Layanan</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/topup">Top Up Diamond</Link></li>
            <li><Link to="/tracking">Lacak Pesanan</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Bantuan</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>FAQ</li>
            <li>Kontak</li>
            <li>Syarat & Ketentuan</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Kontak</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>WhatsApp: 0812-0000-0000</li>
            <li>Email: cs@diamondhub.id</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} DiamondHub. Bukan afiliasi resmi Moonton.
      </div>
    </footer>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdminPath = pathname.startsWith("/admin");
  const [role, setRole] = useState<UserRole | undefined>(undefined);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    setRole(null);
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    const refreshRole = async () => {
      const nextRole = await getCurrentRole();
      if (!cancelled) setRole(nextRole);
    };

    refreshRole();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        queryClient.invalidateQueries();
        if (event === "SIGNED_OUT") setRole(null);
        else {
          setRole(undefined);
          refreshRole();
        }
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  // Role lock: admins stay in admin area, customers stay out of admin/login pages.
  useEffect(() => {
    if (role === undefined) return;

    if (pathname === "/auth") {
      if (role === "admin") router.navigate({ to: "/admin", replace: true });
      if (role === "customer") router.navigate({ to: "/dashboard", replace: true });
      return;
    }

    if (isAdminPath) {
      if (role === null) router.navigate({ to: "/auth", replace: true });
      if (role === "customer") router.navigate({ to: "/dashboard", replace: true });
      return;
    }

    if (role === "admin") router.navigate({ to: "/admin", replace: true });
  }, [role, pathname, isAdminPath, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-center" richColors theme="dark" />
      {!isAdminPath && <SiteHeader role={role} onSignOut={signOut} />}
      <main className="min-h-[60vh]">
        <Outlet />
      </main>
      {!isAdminPath && <SiteFooter />}
    </QueryClientProvider>
  );
}
