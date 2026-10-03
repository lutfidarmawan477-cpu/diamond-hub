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
import { Home, Zap, PackageSearch, LayoutDashboard, LogIn, ArrowLeft, type LucideIcon } from "lucide-react";

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
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <Link to="/" className="mt-6 inline-block rounded-md btn-gold px-5 py-2 text-sm">
          Back to Home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please try reloading the page.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-md btn-gold px-5 py-2 text-sm"
        >
          Try again
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
      { title: "DiamondHub — Cheap & Fast Mobile Legends Diamond Top Up" },
      { name: "description", content: "Cheapest Mobile Legends diamond top up, instant 24/7 delivery, pay with DANA OVO GoPay QRIS or bank. Safe and trusted." },
      { property: "og:title", content: "DiamondHub — Mobile Legends Diamond Top Up" },
      { property: "og:description", content: "Cheapest and fastest ML diamond top up. Instant 24/7 delivery." },
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

function SiteHeader({
  role,
  pathname,
}: {
  role: UserRole | undefined;
  pathname: string;
}) {
  // On the auth page: replace navbar with a single "back to home" button.
  if (pathname === "/auth") {
    return (
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/70 border-b border-border no-print">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg btn-gold text-base">💎</div>
            <span className="font-display text-lg font-bold tracking-wider">
              Diamond<span className="gold-text">Hub</span>
            </span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg border border-primary/60 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-foreground transition-all duration-200 hover:bg-primary/20 hover:border-primary active:scale-95 whitespace-nowrap"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
            Home
          </Link>
        </div>
      </header>
    );
  }

  // Guests browsing the checkout flow only get a way back Home.
  const guestCheckout = !role && (pathname === "/topup" || pathname.startsWith("/invoice"));
  // On Track Order / Terms, mobile guests only see Home (desktop keeps full nav).
  const guestInfoPage = !role && (pathname === "/tracking" || pathname === "/terms");

  // Determine which links to show based on role + current page.
  let links: { to: string; label: string; icon: LucideIcon; mobileOnly?: boolean }[] = [];
  if (role === "customer") {
    if (pathname === "/dashboard") {
      links = [{ to: "/tracking", label: "Track Order", icon: PackageSearch }];
    } else {
      links = [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }];
    }
  } else if (!role) {
    links = guestCheckout
      ? [{ to: "/", label: "Home", icon: Home }]
      : [
          { to: "/", label: "Home", icon: Home, mobileOnly: guestInfoPage },
          { to: "/topup", label: "Top Up", icon: Zap },
          { to: "/tracking", label: "Track Order", icon: PackageSearch },
        ];
  }

  const linkCls =
    "items-center gap-2 rounded-lg border border-primary/60 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-foreground transition-all duration-200 hover:bg-primary/20 hover:border-primary active:scale-95 whitespace-nowrap";

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-background/70 border-b border-border no-print animate-fade-in">
      <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="grid h-9 w-9 place-items-center rounded-lg btn-gold text-base">💎</div>
          <span className="font-display text-lg font-bold tracking-wider">
            Diamond<span className="gold-text">Hub</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2 text-sm overflow-x-auto">
          {/* Guest on mobile: only "Sign In" (checkout pages: only "Home"). Desktop/tablet shows full nav. */}
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`${l.mobileOnly || !(role === null && !guestCheckout) ? "inline-flex" : "hidden sm:inline-flex"} ${linkCls}`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                {l.label}
              </Link>
            );
          })}
          {role === null && !guestCheckout && (
            <Link to="/auth" className={`${guestInfoPage ? "hidden sm:inline-flex" : "inline-flex"} ${linkCls}`}>
              <LogIn className="h-[18px] w-[18px]" strokeWidth={2} />
              Sign In
            </Link>
          )}
        </nav>

      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border mt-20 bg-card/40 no-print">
      <div className="container mx-auto px-4 py-10 grid gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg btn-gold">💎</div>
            <span className="font-display text-lg font-bold">Diamond<span className="gold-text">Hub</span></span>
          </div>
          <p className="text-sm text-muted-foreground">Cheapest and fastest Mobile Legends diamond top up. Available 24/7.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Services</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/topup">Diamond Top Up</Link></li>
            
            <li><Link to="/tracking">Track Order</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Support</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>FAQ</li>
            <li>Contact</li>
            <li><Link to="/terms" className="hover:text-gold transition-colors">Terms & Conditions</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Contact</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              WhatsApp:{" "}
              <a
                href="https://wa.me/628989110355"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gold transition-colors"
              >
                +62 8989110355
              </a>
            </li>
            <li>
              Instagram:{" "}
              <a
                href="https://www.instagram.com/pilll_23"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gold transition-colors"
              >
                @pilll_23
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} DiamondHub. Not affiliated with Moonton.
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
      {!isAdminPath && <SiteHeader role={role} pathname={pathname} />}
      <main className="min-h-[60vh]">
        <Outlet />
      </main>
      {!isAdminPath && <SiteFooter />}
    </QueryClientProvider>
  );
}
