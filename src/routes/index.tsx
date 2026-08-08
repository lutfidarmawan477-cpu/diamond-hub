import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getStorefront } from "@/lib/storefront.functions";
import { formatIDR } from "@/lib/format";

import heroImg from "@/assets/hero-ml.jpg";

const storefrontQO = queryOptions({
  queryKey: ["storefront"],
  queryFn: () => getStorefront(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DiamondHub — Cheapest & Fastest Mobile Legends Diamond Top Up" },
      { name: "description", content: "Instant Mobile Legends diamond top up. Lowest prices, 24/7 service. Pay with DANA, OVO, GoPay, QRIS, or bank transfer." },
      { property: "og:title", content: "DiamondHub — Mobile Legends Diamond Top Up" },
      { property: "og:description", content: "Cheapest & fastest ML diamond top up. Available 24/7." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(storefrontQO),
  errorComponent: ({ error }) => <div className="container mx-auto p-10 text-center">Failed to load: {error.message}</div>,
  notFoundComponent: () => <div className="container mx-auto p-10 text-center">Not found</div>,
  component: Home,
});

function Home() {
  const { data } = useSuspenseQuery(storefrontQO);
  const popular = data.packages.filter((p) => (p as { best_seller?: boolean }).best_seller).slice(0, 8);
  // Top up is open to guests — no sign-in detour.
  const topupHref = "/topup";


  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-25"
          style={{ backgroundImage: `url(${heroImg})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
        <div className="container relative mx-auto px-4 py-20 md:py-28">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs text-gold">
              ⚡ Instant 24/7 Delivery
            </span>
            <h1 className="mt-5 font-display text-4xl md:text-6xl font-black leading-tight">
              Cheapest & Fastest <span className="gold-text">Mobile Legends</span> Diamond Top Up
            </h1>
            <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-2xl">
              Buy ML diamonds delivered to your account in seconds. Full range of payment options — e-wallet, bank, QRIS — safe & trusted.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={topupHref} className="rounded-md btn-gold px-6 py-3 text-sm">💎 Top Up Now</Link>
              <Link to="/tracking" className="rounded-md border border-border px-6 py-3 text-sm hover:border-primary transition">Track Order</Link>
            </div>
            <div className="mt-10 grid grid-cols-3 max-w-md gap-4">
              <Stat label="Transactions" value="500K+" />
              <Stat label="Rating" value="4.9★" />
              <Stat label="Service" value="24/7" />
            </div>
          </div>
        </div>
      </section>

      {/* POPULAR PACKAGES */}
      {popular.length > 0 && (
        <section className="container mx-auto px-4 py-16">
          <SectionHead title="Best Sellers" subtitle="Player favorites" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {popular.map((p) => (
              <div key={p.id} className="card-premium rounded-xl p-5 group hover:-translate-y-1 transition">
                <div className="flex items-start justify-between">
                  <div className="text-4xl">💎</div>
                  <span className="rounded-full btn-gold px-2 py-0.5 text-[10px]">🔥 Best Seller</span>
                </div>
                <div className="mt-4 font-display text-lg">{p.name}</div>
                <div className="mt-2 gold-text font-bold text-xl">{formatIDR(p.price)}</div>
                {p.original_price && (
                  <div className="text-xs text-muted-foreground line-through">{formatIDR(p.original_price)}</div>
                )}
                <Link to={topupHref} className="mt-4 block rounded-md bg-primary/80 hover:bg-primary py-2 text-center text-sm transition">
                  Buy
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FEATURES */}
      <section className="container mx-auto px-4 py-16">
        <SectionHead title="Why DiamondHub?" subtitle="The best service for legends" />
        <div className="grid gap-5 md:grid-cols-4">
          {[
            { icon: "⚡", t: "Instant Delivery", d: "Diamonds arrive within seconds after payment." },
            { icon: "🔒", t: "100% Secure", d: "Encrypted transactions — we never store account passwords." },
            { icon: "💰", t: "Lowest Prices", d: "Compare anywhere — we guarantee the most competitive rates." },
            { icon: "🕒", t: "24/7 Available", d: "Customer support ready to help you any time of day." },
          ].map((f) => (
            <div key={f.t} className="card-premium rounded-xl p-5">
              <div className="text-3xl">{f.icon}</div>
              <div className="mt-3 font-display text-lg">{f.t}</div>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW */}
      <section className="container mx-auto px-4 py-16">
        <SectionHead title="How to Top Up" subtitle="Just 3 easy steps" />
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { n: "1", t: "Enter User ID & Zone ID", d: "Type your Mobile Legends account IDs correctly." },
            { n: "2", t: "Pick Package & Payment", d: "Choose your diamond package and preferred payment method." },
            { n: "3", t: "Pay — Diamonds Delivered", d: "Complete payment and diamonds are sent automatically." },
          ].map((s) => (
            <div key={s.n} className="card-premium rounded-xl p-6 relative">
              <div className="absolute -top-4 left-6 grid h-10 w-10 place-items-center rounded-lg btn-gold font-display">{s.n}</div>
              <div className="mt-4 font-display text-lg">{s.t}</div>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-4 py-16">
        <SectionHead title="FAQ" subtitle="Frequently asked questions" />
        <div className="max-w-3xl mx-auto space-y-3">
          {[
            { q: "How long until diamonds arrive?", a: "On average, less than 1 minute after successful payment verification." },
            { q: "Is it safe? Can my account be banned?", a: "Completely safe. We only need your User ID & Zone ID — never your password." },
            { q: "What if diamonds don't arrive?", a: "Contact our WhatsApp support with your invoice number — we offer a 100% refund guarantee." },
          ].map((f) => (
            <details key={f.q} className="card-premium rounded-lg p-4 group">
              <summary className="cursor-pointer font-medium flex justify-between">{f.q}<span className="text-gold group-open:rotate-45 transition">+</span></summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-2xl gold-text font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
function SectionHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8 text-center">
      <h2 className="font-display text-3xl md:text-4xl font-bold">{title}</h2>
      <p className="mt-2 text-muted-foreground">{subtitle}</p>
    </div>
  );
}
