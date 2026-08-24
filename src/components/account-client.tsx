"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronRight,
  Gift,
  Heart,
  HelpCircle,
  Home,
  LogOut,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearCustomerSession, readCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";
import { formatRupees } from "@/lib/pricing";
import { getRewardState, rewardMilestones } from "@/lib/rewards";

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
  rewardOrderCount?: number;
  rewardTier?: string;
};

const accountRows = [
  { title: "Addresses", subtitle: "Home, office, delivery instructions", icon: MapPin, href: "/address" },
  { title: "My Orders", subtitle: "Live tracking, invoices, reorders", icon: PackageCheck, href: "/orders" },
  { title: "Wishlist", subtitle: "Saved dishes and repeat favourites", icon: Heart, href: "/wishlist" },
  { title: "Rewards", subtitle: "Order milestones and reward coupons", icon: Gift, href: "/loyalty" },
  { title: "Notifications", subtitle: "WhatsApp, SMS, offer alerts", icon: Bell, href: "/notifications" },
  { title: "Privacy and Security", subtitle: "OTP login, devices, data controls", icon: ShieldCheck, href: "/privacy-security" },
];

export function AccountClient() {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    function refreshSession() {
      setSession(readCustomerSession());
      setSessionReady(true);
    }

    refreshSession();
    return subscribeCustomerSession(refreshSession);
  }, []);

  useEffect(() => {
    if (sessionReady && !session?.mobile) {
      router.replace("/login?next=/account");
    }
  }, [router, session, sessionReady]);

  useEffect(() => {
    if (!sessionReady) return;
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
  }, [session, sessionReady]);

  const displayName = profile?.name || session?.name || "Guest";
  const displayMobile = profile?.mobile || session?.mobile || "";
  const addresses = useMemo(() => profile?.addresses ?? [], [profile?.addresses]);
  const orders = useMemo(() => profile?.orders ?? [], [profile?.orders]);
  const ltv = useMemo(() => orders.reduce((total, order) => total + order.grandTotal, 0), [orders]);
  const rewardOrderCount = profile?.rewardOrderCount ?? profile?.loyalty?.points ?? orders.length;
  const rewardState = getRewardState(rewardOrderCount);
  const tier = profile?.rewardTier || rewardState.tier;
  const unlockedRewardTotal = rewardState.completed.reduce((total, milestone) => total + milestone.value, 0);

  if (!sessionReady || !session) {
    return <main className="min-h-screen bg-white" />;
  }

  return (
    <main className="mx-auto w-full max-w-[430px] bg-[#fbf8f4] px-5 pb-28 pt-5 sm:max-w-5xl sm:px-6 lg:px-8">
      <section className="rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(34,31,32,0.08)] ring-1 ring-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full bg-cream text-maroon shadow-[0_12px_24px_rgba(34,31,32,0.08)] ring-1 ring-[#eadfd5]">
              <UserRound size={34} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-widest text-maroon/70">Profile</p>
              <h1 className="truncate text-2xl font-black text-charcoal">{displayName}</h1>
              <p className="mt-1 text-sm font-bold text-muted">+91 {displayMobile}</p>
              {profile?.email ? <p className="mt-1 truncate text-xs font-bold text-muted">{profile.email}</p> : null}
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-cream px-3 py-1 text-xs font-black text-maroon">
                <Star size={13} className="fill-maroon" /> {tier} member
              </div>
            </div>
          </div>
          <Link href="/login" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cream text-charcoal" aria-label="Edit profile">
            <UserRound size={21} />
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-2xl border border-border bg-cream text-center">
          {[
            [loading ? "..." : String(rewardOrderCount), "Orders"],
            [`${Math.round(rewardState.progress)}%`, "Reward"],
            [formatRupees(ltv), "Spent"],
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
          ["/offers", Gift, "Coupons", "Active offers"],
          ["/loyalty", Star, "Rewards", `${rewardOrderCount} orders`],
          ["/support", HelpCircle, "Support", "Help center"],
        ].map(([href, Icon, title, subtitle]) => (
          <Link key={String(title)} href={String(href)} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-border sm:p-4">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cream text-maroon ring-1 ring-[#eadfd5] sm:h-12 sm:w-12">
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
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cream text-maroon">
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
          <Link href="/address" className="text-xs font-black text-maroon">Add new</Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {addresses.length ? addresses.map((address) => (
            <article key={address.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-border">
              <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cream text-maroon">
                  <Home size={20} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-charcoal">{address.label}</h3>
                    {address.isDefault ? <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-black text-maroon ring-1 ring-[#eadfd5]">Default</span> : null}
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

      <section className="mt-6 overflow-hidden rounded-[24px] border border-[#eadfd5] bg-[#f8f1ea] p-5 text-charcoal shadow-[0_14px_34px_rgba(34,31,32,0.06)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-charcoal">Next reward</h2>
            <p className="mt-1 text-sm font-bold text-muted">
              {rewardState.next
                ? `${rewardState.ordersToNext} more orders unlock ${formatRupees(rewardState.next.value)} coupon.`
                : "All reward coupons are unlocked."}
            </p>
          </div>
          <span className="rounded-2xl bg-white px-3 py-2 text-right text-xs font-black text-maroon ring-1 ring-[#eadfd5]">
            <span className="block text-lg leading-none">{rewardOrderCount}</span>
            orders
          </span>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white ring-1 ring-[#eadfd5]">
          <div className="h-full rounded-full bg-maroon transition-[width] duration-700" style={{ width: `${rewardState.progress}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {rewardMilestones.map((milestone) => {
            const unlocked = rewardOrderCount >= milestone.orders;
            return (
              <Link
                key={milestone.code}
                href="/offers"
                className={`rounded-2xl px-3 py-3 text-center ring-1 ring-[#eadfd5] ${unlocked ? "bg-white text-maroon" : "bg-white/60 text-muted"}`}
              >
                <span className="block text-sm font-black">{formatRupees(milestone.value)}</span>
                <span className="mt-1 block text-[10px] font-black">{milestone.orders} orders</span>
              </Link>
            );
          })}
        </div>
        <p className="mt-4 text-xs font-black text-muted">
          {unlockedRewardTotal ? `${formatRupees(unlockedRewardTotal)} reward value unlocked in Coupons.` : "Place orders to start unlocking reward coupons."}
        </p>
      </section>

      {message ? <p className="mt-4 rounded-2xl bg-white p-3 text-center text-xs font-black text-muted">{message}</p> : null}

      <button
        type="button"
        onClick={() => setConfirmLogout(true)}
        className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-white font-black text-maroon"
      >
        <LogOut size={18} /> Logout
      </button>

      {confirmLogout ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-charcoal/45 p-5">
          <section className="w-full max-w-[360px] rounded-[24px] bg-white p-5 text-center shadow-2xl">
            <span className="mx-auto grid h-13 w-13 place-items-center rounded-full bg-cream text-maroon">
              <LogOut size={24} />
            </span>
            <h2 className="mt-4 text-xl font-black text-charcoal">Logout from Wah Thali?</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              You will need to sign in again to view orders, rewards, addresses, and coupons linked to your account.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                className="h-11 rounded-xl border border-border bg-white text-sm font-black text-charcoal"
              >
                Stay logged in
              </button>
              <button
                type="button"
                onClick={() => {
                  clearCustomerSession();
                  setProfile(null);
                  setConfirmLogout(false);
                  router.replace("/login?next=/account");
                }}
                className="h-11 rounded-xl bg-maroon text-sm font-black text-white"
              >
                Logout
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
