import { ArrowLeft, BadgePercent, CalendarClock, Copy, CreditCard, Gift, TicketPercent, Truck } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { coupons } from "@/lib/data";
import { formatRupees } from "@/lib/pricing";

const offerCards = [
  {
    code: "WAHTHALI20",
    title: "Flat 20% OFF",
    subtitle: "On all thalis today",
    detail: "Valid till 11 PM",
    tone: "maroon",
    icon: BadgePercent,
  },
  {
    code: "FREEDEL",
    title: "Free delivery",
    subtitle: "On orders above Rs 499",
    detail: "Salt Lake and Sector V",
    tone: "red",
    icon: Truck,
  },
  ...coupons.map((coupon) => ({
    code: coupon.code,
    title: coupon.label,
    subtitle: `Minimum order ${formatRupees(coupon.minOrder)}`,
    detail: coupon.maxDiscount ? `Max discount ${formatRupees(coupon.maxDiscount)}` : "Auto applies in cart",
    tone: "cream",
    icon: TicketPercent,
  })),
];

const bankOffers = [
  ["HDFC Cards", "10% instant off up to Rs 100", "Use on prepaid checkout"],
  ["UPI Cashback", "Rs 25 cashback on orders above Rs 249", "Valid once per day"],
  ["Wallet Deals", "Extra Rs 40 off with partner wallets", "Limited slots"],
];

export default function OffersPage() {
  return (
    <>
      <Header />
      <main className="w-full max-w-[390px] px-3 pb-28 pt-5 sm:mx-auto sm:max-w-5xl sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="grid h-10 w-10 place-items-center rounded-full bg-white text-charcoal shadow-sm ring-1 ring-border" aria-label="Back home">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-black text-charcoal">Offers</h1>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-red/10 text-red">
            <Gift size={20} />
          </span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-border">
          {["All Offers", "Bank Offers", "Coupons"].map((tab, index) => (
            <button key={tab} className={`h-9 rounded-xl text-[11px] font-black sm:h-10 sm:text-sm ${index === 0 ? "bg-red text-white shadow-[0_8px_18px_rgba(214,0,50,0.22)]" : "text-muted"}`}>
              {tab}
            </button>
          ))}
        </div>

        <section className="mt-5 grid gap-4">
          {offerCards.map((offer, index) => {
            const Icon = offer.icon;
            const dark = offer.tone !== "cream";

            return (
              <article
                key={offer.code}
                className={`relative overflow-hidden rounded-2xl p-4 shadow-[0_12px_28px_rgba(34,31,32,0.10)] ${
                  offer.tone === "maroon"
                    ? "bg-gradient-to-r from-[#39180e] to-maroon text-white"
                    : offer.tone === "red"
                      ? "bg-gradient-to-r from-red to-[#ef7382] text-white"
                      : "bg-white text-charcoal ring-1 ring-border"
                }`}
              >
                <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/15" />
                <div className="grid grid-cols-[1fr_88px] items-center gap-3">
                  <div>
                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase ${dark ? "bg-white/15 text-white" : "bg-red/10 text-red"}`}>
                      <Icon size={14} /> Deal of the day
                    </div>
                    <h2 className="mt-3 text-2xl font-black leading-tight">{offer.title}</h2>
                    <p className={`mt-1 text-sm font-bold ${dark ? "text-white/80" : "text-muted"}`}>{offer.subtitle}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex h-9 items-center rounded-l-xl px-3 text-xs font-black ${dark ? "bg-black/20" : "bg-cream text-muted"}`}>CODE</span>
                      <span className={`inline-flex h-9 items-center rounded-r-xl px-3 text-xs font-black ${dark ? "bg-white/16" : "bg-red text-white"}`}>{offer.code}</span>
                      <button className={`grid h-9 w-9 place-items-center rounded-xl ${dark ? "bg-white/16 text-white" : "bg-cream text-red"}`} aria-label={`Copy ${offer.code}`}>
                        <Copy size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="relative h-24">
                    {index === 1 ? (
                      <div className="absolute bottom-1 right-0 grid h-20 w-20 place-items-center rounded-full bg-white/18">
                        <Truck size={42} className="text-white" />
                      </div>
                    ) : (
                      <div className="absolute inset-0 rounded-full bg-white/12" />
                    )}
                    <p className={`absolute bottom-0 right-0 text-[10px] font-black ${dark ? "text-white/75" : "text-muted"}`}>T&C</p>
                  </div>
                </div>
                <div className={`mt-3 flex items-center gap-2 text-xs font-bold ${dark ? "text-white/75" : "text-muted"}`}>
                  <CalendarClock size={15} /> {offer.detail}
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-charcoal">Bank Offers</h2>
            <button className="text-xs font-black text-red">See all</button>
          </div>
          <div className="mt-3 grid gap-3">
            {bankOffers.map(([title, body, detail]) => (
              <article key={title} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-border">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cream text-red">
                  <CreditCard size={22} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-black text-charcoal">{title}</h3>
                  <p className="mt-1 text-sm font-semibold text-muted">{body}</p>
                  <p className="mt-1 text-xs font-bold text-red">{detail}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <MobileNav />
    </>
  );
}
