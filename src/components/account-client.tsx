"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronRight,
  CreditCard,
  Gift,
  Heart,
  HelpCircle,
  Home,
  LogIn,
  LogOut,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Star,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { clearCustomerSession, readCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";

type CustomerAddress = {
  id: string;
  label: string;
  line1: string;
  area: string;
  city: string;
  state: string;
  pinCode: string;
  isDefault: boolean;
};

type CustomerOrder = {
  id: string;
  orderNumber: string;
  grandTotal: number;
  createdAt: string;
};

type CustomerProfile = {
  id: string;
  name: string;
  mobile: string;
  email?: string | null;
  addresses: CustomerAddress[];
  loyalty?: { points: number; tier: string } | null;
  orders: CustomerOrder[];
};

const accountRows = [
  { title: "Addresses", subtitle: "Home, office, delivery instructions", icon: MapPin, href: "/address" },
  { title: "Payment Methods", subtitle: "Cards, UPI, wallets, COD preference", icon: CreditCard, href: "/checkout" },
  { title: "My Orders", subtitle: "Live tracking, invoices, reorders", icon: PackageCheck, href: "/orders" },
  { title: "Wishlist", subtitle: "Saved dishes and repeat favourites", icon: Heart, href: "/wishlist" },
  { title: "Notifications", subtitle: "WhatsApp, SMS, offer alerts", icon: Bell, href: "/account" },
  { title: "Privacy and Security", subtitle: "OTP login, devices, data controls", icon: ShieldCheck, href: "/account" },
];

export function AccountClient() {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    function refreshSession() {
      setSession(readCustomerSession());
    }

    refreshSession();
    return subscribeCustomerSession(refreshSession);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!session?.mobile) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`/api/customers/profile?mobile=${encodeURIComponent(session.mobile)}`);
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.error || "Could not load profile.");
          return;
        }
        if (!cancelled) setProfile(data.customer);
      } catch {
        if (!cancelled) setMessage("Could not load profile. Please check your connection.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const displayName = profile?.name || session?.name || "Guest";
  const displayMobile = profile?.mobile || session?.mobile || "";
  const addresses = useMemo(() => profile?.addresses ?? [], [profile?.addresses]);
  const orders = useMemo(() => profile?.orders ?? [], [profile?.orders]);
  const ltv = useMemo(() => orders.reduce((total, order) => total + order.grandTotal, 0), [orders]);
  const tier = profile?.loyalty?.tier || "Starter";
  const points = profile?.loyalty?.points ?? 0;

  if (!session) {
    return (
      <main className="mx-auto w-full max-w-[430px] px-4 pb-28 pt-5 sm:max-w-5xl sm:px-6 lg:px-8">
        <section className="rounded-[28px] bg-white p-5 text-center shadow-[0_14px_34px_rgba(34,31,32,0.08)] ring-1 ring-border">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-cream text-red">
            <UserRound size={34} />
          </div>
          <h1 className="mt-4 text-2xl font-black text-charcoal">Login to your profile</h1>
          <p className="mt-2 text-sm font-bold leading-6 text-muted">Save addresses, see your orders, and keep your phone number ready for delivery details.</p>
          <Link href="/login" className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red font-black text-white">
            <LogIn size={18} /> Login or sign up
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[430px] px-4 pb-28 pt-5 sm:max-w-5xl sm:px-6 lg:px-8">
      <section className="rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(34,31,32,0.08)] ring-1 ring-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full bg-red text-white shadow-[0_12px_24px_rgba(214,0,50,0.18)]">
              <UserRound size={34} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-widest text-red">Profile</p>
              <h1 className="truncate text-2xl font-black text-charcoal">{displayName}</h1>
              <p className="mt-1 text-sm font-bold text-muted">+91 {displayMobile}</p>
              {profile?.email ? <p className="mt-1 truncate text-xs font-bold text-muted">{profile.email}</p> : null}
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#fff4f5] px-3 py-1 text-xs font-black text-red">
                <Star size={13} className="fill-maroon" /> {tier} member
              </div>
            </div>
          </div>
          <Link href="/login" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cream text-charcoal" aria-label="Edit profile">
            <UserRound size={21} />
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-2xl border border-border bg-[#fff4f5] text-center">
          {[
            [loading ? "..." : String(orders.length), "Orders"],
            [String(points), "Points"],
            [`Rs ${ltv.toLocaleString("en-IN")}`, "LTV"],
          ].map(([value, label]) => (
            <div key={label} className="min-w-0 border-r border-border px-1.5 py-3 last:border-r-0 sm:px-2">
              <p className="truncate text-base font-black text-red sm:text-lg">{value}</p>
              <p className="text-[11px] font-bold text-muted">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          ["/offers", Gift, "Coupons", "Active offers"],
          ["/loyalty", WalletCards, "Wallet", `${points} rewards`],
          ["/support", HelpCircle, "Support", "Help center"],
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
          <Link href="/address" className="text-xs font-black text-red">Add new</Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {addresses.length ? addresses.map((address) => (
            <article key={address.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-border">
              <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fff4f5] text-red">
                  <Home size={20} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-charcoal">{address.label}</h3>
                    {address.isDefault ? <span className="rounded-full bg-red/10 px-2 py-0.5 text-[10px] font-black text-red">Default</span> : null}
                  </div>
                  <p className="mt-1 text-sm font-semibold leading-6 text-muted">
                    {[address.line1, address.area, address.city, address.state, address.pinCode].filter(Boolean).join(", ")}
                  </p>
                </div>
              </div>
            </article>
          )) : (
            <div className="rounded-2xl bg-white p-4 text-center text-sm font-bold text-muted shadow-sm ring-1 ring-border sm:col-span-2">
              No saved addresses yet. Add one from the address screen.
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-[24px] bg-red p-5 text-white shadow-[0_14px_34px_rgba(214,0,50,0.18)]">
        <h2 className="text-xl font-black">Next reward</h2>
        <p className="mt-1 text-sm font-bold text-white/75">Your live loyalty tier is {tier}. Keep ordering to unlock more rewards.</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, points % 100)}%` }} />
        </div>
      </section>

      {message ? <p className="mt-4 rounded-2xl bg-white p-3 text-center text-xs font-black text-muted">{message}</p> : null}

      <button
        type="button"
        onClick={() => {
          clearCustomerSession();
          setProfile(null);
        }}
        className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-white font-black text-red"
      >
        <LogOut size={18} /> Logout
      </button>
    </main>
  );
}
