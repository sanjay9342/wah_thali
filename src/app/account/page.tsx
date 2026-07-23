import {
  Bell,
  ChevronRight,
  CreditCard,
  Edit3,
  Gift,
  Heart,
  HelpCircle,
  Home,
  LogOut,
  MapPin,
  PackageCheck,
  Settings,
  ShieldCheck,
  Star,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";

const accountRows = [
  { title: "Addresses", subtitle: "Home, office, delivery instructions", icon: MapPin, href: "/account" },
  { title: "Payment Methods", subtitle: "Cards, UPI, wallets, COD preference", icon: CreditCard, href: "/checkout" },
  { title: "My Orders", subtitle: "Live tracking, invoices, reorders", icon: PackageCheck, href: "/orders" },
  { title: "Wishlist", subtitle: "Saved dishes and repeat favourites", icon: Heart, href: "/wishlist" },
  { title: "Notifications", subtitle: "WhatsApp, SMS, offer alerts", icon: Bell, href: "/account" },
  { title: "Privacy and Security", subtitle: "OTP login, devices, data controls", icon: ShieldCheck, href: "/account" },
];

const savedLocations = [
  ["Home", "221B Baker Street, Salt Lake", "Default"],
  ["Office", "Sector V, Kolkata 700091", "Lunch"],
];

export default function AccountPage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-[430px] px-4 pb-28 pt-5 sm:max-w-5xl sm:px-6 lg:px-8">
        <section className="rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(34,31,32,0.08)] ring-1 ring-border">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ffd55f] to-red text-white shadow-[0_12px_24px_rgba(214,0,50,0.18)]">
                <UserRound size={34} />
                <span className="absolute bottom-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-white text-red ring-2 ring-white">
                  <Edit3 size={14} />
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-widest text-red">Profile</p>
                <h1 className="truncate text-2xl font-black text-charcoal">Sanjay</h1>
                <p className="mt-1 text-sm font-bold text-muted">+91 90000 00000</p>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-cream px-3 py-1 text-xs font-black text-maroon">
                  <Star size={13} className="fill-maroon" /> Gold member
                </div>
              </div>
            </div>
            <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cream text-charcoal" aria-label="Profile settings">
              <Settings size={21} />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-2xl border border-border bg-cream text-center">
            {[
              ["36", "Orders"],
              ["1,240", "Points"],
              ["Rs 18.4k", "LTV"],
            ].map(([value, label]) => (
              <div key={label} className="min-w-0 border-r border-border px-1.5 py-3 last:border-r-0 sm:px-2">
                <p className="truncate text-base font-black text-maroon sm:text-lg">{value}</p>
                <p className="text-[11px] font-bold text-muted">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["/offers", Gift, "Coupons", "4 active"],
            ["/loyalty", WalletCards, "Wallet", "Rs 80 rewards"],
            ["/support", HelpCircle, "Support", "24x7 help"],
          ].map(([href, Icon, title, subtitle]) => (
            <Link key={String(title)} href={String(href)} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-border sm:p-4">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-red text-white sm:h-12 sm:w-12">
                <Icon size={20} />
              </span>
              <span>
                <span className="block font-black text-charcoal">{String(title)}</span>
                <span className="text-xs font-bold text-muted">{String(subtitle)}</span>
              </span>
            </Link>
          ))}
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-black text-charcoal">My Account</h2>
          <div className="mt-3 overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-border">
            {accountRows.map((row) => (
              <Link key={row.title} href={row.href} className="flex items-center gap-3 border-b border-border p-4 last:border-b-0">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cream text-red">
                  <row.icon size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-black text-charcoal">{row.title}</span>
                  <span className="mt-0.5 block truncate text-sm font-semibold text-muted">{row.subtitle}</span>
                </span>
                <ChevronRight size={18} className="text-muted" />
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-charcoal">Saved Addresses</h2>
            <button className="text-xs font-black text-red">Add new</button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {savedLocations.map(([label, address, tag]) => (
              <article key={label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-border">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cream text-red">
                    <Home size={20} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-charcoal">{label}</h3>
                      <span className="rounded-full bg-red/10 px-2 py-0.5 text-[10px] font-black text-red">{tag}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold leading-6 text-muted">{address}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[24px] bg-maroon p-5 text-white shadow-[0_14px_34px_rgba(141,0,33,0.18)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">Next reward unlocked</h2>
              <p className="mt-1 text-sm font-bold text-white/75">Earn 260 more points for Rs 100 off.</p>
            </div>
            <Link href="/loyalty" className="inline-flex h-10 shrink-0 items-center rounded-xl bg-white px-4 text-sm font-black text-maroon">
              View
            </Link>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full w-[82%] rounded-full bg-white" />
          </div>
        </section>

        <button className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-white font-black text-red">
          <LogOut size={18} /> Logout
        </button>
      </main>
      <MobileNav />
    </>
  );
}
