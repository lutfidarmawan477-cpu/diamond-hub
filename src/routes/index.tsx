import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getStorefront } from "@/lib/storefront.functions";
import { formatIDR } from "@/lib/format";
import { useSession } from "@/hooks/useSession";
import heroImg from "@/assets/hero-ml.jpg";

const storefrontQO = queryOptions({
  queryKey: ["storefront"],
  queryFn: () => getStorefront(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DiamondHub — Top Up Diamond Mobile Legends Termurah & Tercepat" },
      { name: "description", content: "Top up diamond Mobile Legends instan, harga termurah, proses 24 jam. Bayar dengan DANA, OVO, GoPay, QRIS, dan VA Bank." },
      { property: "og:title", content: "DiamondHub — Top Up Diamond Mobile Legends" },
      { property: "og:description", content: "Top up diamond ML termurah & tercepat 24 jam." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(storefrontQO),
  errorComponent: ({ error }) => <div className="container mx-auto p-10 text-center">Gagal memuat: {error.message}</div>,
  notFoundComponent: () => <div className="container mx-auto p-10 text-center">Tidak ditemukan</div>,
  component: Home,
});

function Home() {
  const { data } = useSuspenseQuery(storefrontQO);
  const popular = data.packages.filter((p) => p.badge).slice(0, 4);
  const loggedIn = useSession();
  const topupHref = loggedIn ? "/topup" : "/auth";

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
              ⚡ Proses Instan 24 Jam
            </span>
            <h1 className="mt-5 font-display text-4xl md:text-6xl font-black leading-tight">
              Top Up Diamond <span className="gold-text">Mobile Legends</span> Termurah & Tercepat
            </h1>
            <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-2xl">
              Beli diamond ML langsung masuk akun dalam hitungan detik. Pembayaran lengkap — e‑wallet, bank, QRIS — aman & terpercaya.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/topup" className="rounded-md btn-gold px-6 py-3 text-sm">💎 Top Up Sekarang</Link>
              <Link to="/tracking" className="rounded-md border border-border px-6 py-3 text-sm hover:border-primary transition">Lacak Pesanan</Link>
            </div>
            <div className="mt-10 grid grid-cols-3 max-w-md gap-4">
              <Stat label="Transaksi" value="500K+" />
              <Stat label="Rating" value="4.9★" />
              <Stat label="Layanan" value="24/7" />
            </div>
          </div>
        </div>
      </section>

      {/* POPULAR PACKAGES */}
      <section className="container mx-auto px-4 py-16">
        <SectionHead title="Paket Terlaris" subtitle="Pilihan favorit para pemain" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {popular.map((p) => (
            <div key={p.id} className="card-premium rounded-xl p-5 group hover:-translate-y-1 transition">
              <div className="flex items-start justify-between">
                <div className="text-4xl">💎</div>
                {p.badge && <span className="rounded-full btn-gold px-2 py-0.5 text-[10px]">{p.badge}</span>}
              </div>
              <div className="mt-4 font-display text-lg">{p.name}</div>
              <div className="mt-2 gold-text font-bold text-xl">{formatIDR(p.price)}</div>
              {p.original_price && (
                <div className="text-xs text-muted-foreground line-through">{formatIDR(p.original_price)}</div>
              )}
              <Link to="/topup" className="mt-4 block rounded-md bg-primary/80 hover:bg-primary py-2 text-center text-sm transition">
                Beli
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="container mx-auto px-4 py-16">
        <SectionHead title="Kenapa DiamondHub?" subtitle="Layanan terbaik untuk para legenda" />
        <div className="grid gap-5 md:grid-cols-4">
          {[
            { icon: "⚡", t: "Proses Instan", d: "Diamond masuk dalam hitungan detik setelah pembayaran." },
            { icon: "🔒", t: "100% Aman", d: "Transaksi terenkripsi & data akun tidak disimpan." },
            { icon: "💰", t: "Harga Termurah", d: "Bandingkan, dijamin paling kompetitif." },
            { icon: "🕒", t: "24 Jam Online", d: "Customer service siap membantu kapan saja." },
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
        <SectionHead title="Cara Top Up" subtitle="Hanya 3 langkah mudah" />
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { n: "1", t: "Masukkan User ID & Zone ID", d: "Tulis ID akun Mobile Legends-mu dengan benar." },
            { n: "2", t: "Pilih Nominal & Pembayaran", d: "Pilih paket diamond dan metode bayar favorit." },
            { n: "3", t: "Bayar — Diamond Langsung Masuk", d: "Selesaikan pembayaran, diamond otomatis terkirim." },
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
        <SectionHead title="FAQ" subtitle="Pertanyaan yang sering diajukan" />
        <div className="max-w-3xl mx-auto space-y-3">
          {[
            { q: "Berapa lama diamond masuk?", a: "Rata-rata kurang dari 1 menit setelah pembayaran berhasil terverifikasi." },
            { q: "Apakah aman? Apakah akun bisa di-banned?", a: "Aman. Kami hanya membutuhkan User ID & Zone ID, bukan password." },
            { q: "Bagaimana jika diamond tidak masuk?", a: "Hubungi CS WhatsApp dengan menyertakan nomor invoice — kami refund 100%." },
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
