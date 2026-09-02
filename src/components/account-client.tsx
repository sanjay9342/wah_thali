"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  BellOff,
  ChevronRight,
  CheckCircle2,
  Gift,
  Heart,
  HelpCircle,
  Home,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  ShieldCheck,
  Star,
  TicketPercent,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearCustomerSession, readCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";
import { saveNotificationPreferences, useNotificationPreferences, type WahNotificationPreferences } from "@/lib/notifications";
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
  const [notificationSaving, setNotificationSaving] = useState(false);
  const notificationPreferences = useNotificationPreferences(session?.mobile);

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
  const displayEmail = profile?.email || "";
  const profileInitial = displayName.trim().charAt(0).toUpperCase() || "W";
  const addresses = useMemo(() => profile?.addresses ?? [], [profile?.addresses]);
  const orders = useMemo(() => profile?.orders ?? [], [profile?.orders]);
  const ltv = useMemo(() => orders.reduce((total, order) => total + order.grandTotal, 0), [orders]);
  const rewardOrderCount = profile?.rewardOrderCount ?? profile?.loyalty?.points ?? orders.length;
  const rewardState = getRewardState(rewardOrderCount);
  const tier = profile?.rewardTier || rewardState.tier;
  const unlockedRewardTotal = rewardState.completed.reduce((total, milestone) => total + milestone.value, 0);
  const mutedCount = [notificationPreferences.appMuted, notificationPreferences.whatsappMuted].filter(Boolean).length;

  async function updateNotificationPreference(key: keyof WahNotificationPreferences, value: boolean) {
    if (!session?.mobile || notificationSaving) return;
    setNotificationSaving(true);
    setMessage("");
    try {
      await saveNotificationPreferences(session.mobile, {
        ...notificationPreferences,
        [key]: value,
      });
      setMessage(value ? "Notification mute setting saved." : "Notification alerts turned on.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save notification settings.");
    } finally {
      setNotificationSaving(false);
    }
  }

  if (!sessionReady || !session) {
    return <main className="min-h-screen bg-white" />;
  }

  return (
    <main className="wt-soft-type mx-auto w-full max-w-[430px] bg-white px-5 pb-28 pt-5 sm:max-w-5xl sm:px-6 lg:max-w-none lg:px-0 lg:pb-14 lg:pt-8">
      <div className="mx-auto w-full lg:max-w-[1248px] lg:px-8">
      <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_18px_44px_rgba(34,31,32,0.09)] ring-1 ring-[#eadfe3]">
        <div className="bg-[linear-gradient(135deg,#8d0021_0%,#b9163f_62%,#221f20_100%)] p-5 text-white lg:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full bg-white text-[28px] font-bold text-maroon shadow-[0_16px_30px_rgba(34,31,32,0.22)] ring-4 ring-white/24">
                {profileInitial}
                <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-[#fff4f5] text-maroon ring-2 ring-white">
                  <Star size={14} className="fill-maroon" />
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/72">Profile</p>
                <h1 className="mt-1 truncate text-[22px] font-bold leading-tight text-white lg:text-[30px]">{displayName}</h1>
                <div className="mt-2 grid gap-1.5 text-[11px] font-semibold text-white/84">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Phone size={13} className="shrink-0" />
                    <span className="truncate">+91 {displayMobile}</span>
                  </span>
                  {displayEmail ? (
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Mail size={13} className="shrink-0" />
                      <span className="truncate">{displayEmail}</span>
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[10px] font-bold text-maroon shadow-sm">
                  <Star size={13} className="fill-maroon" /> {tier} member
                </div>
              </div>
            </div>
            <Link href="/login" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/12 text-white ring-1 ring-white/22 transition-colors hover:bg-white/20" aria-label="Edit profile">
              <UserRound size={21} />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 bg-white text-center">
          <div className="min-w-0 border-r border-[#eef1f6] px-1.5 py-4 sm:px-2">
            <PackageCheck size={18} className="mx-auto text-maroon" />
            <p className="mt-1 truncate text-[14px] font-bold text-maroon sm:text-base">{loading ? "..." : String(rewardOrderCount)}</p>
            <p className="text-[10px] font-medium text-muted">Orders</p>
          </div>
          <div className="min-w-0 border-r border-[#eef1f6] px-1.5 py-4 sm:px-2">
            <TicketPercent size={18} className="mx-auto text-maroon" />
            <p className="mt-1 truncate text-[14px] font-bold text-maroon sm:text-base">{Math.round(rewardState.progress)}%</p>
            <p className="text-[10px] font-medium text-muted">Reward</p>
          </div>
          <div className="min-w-0 px-1.5 py-4 sm:px-2">
            <Star size={18} className="mx-auto fill-maroon text-maroon" />
            <p className="mt-1 truncate text-[14px] font-bold text-maroon sm:text-base">{formatRupees(ltv)}</p>
            <p className="text-[10px] font-medium text-muted">Spent</p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-3 lg:gap-5">
        {[
          ["/offers", Gift, "Coupons", "Active offers"],
          ["/loyalty", Star, "Rewards", `${rewardOrderCount} orders`],
          ["/support", HelpCircle, "Support", "Help center"],
        ].map(([href, Icon, title, subtitle]) => (
          <Link key={String(title)} href={String(href)} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-border sm:p-4">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fff4f5] text-maroon ring-1 ring-[#f1dce1] sm:h-12 sm:w-12">
              <Icon size={20} />
            </span>
            <span>
              <span className="block text-[13px] font-semibold text-charcoal">{String(title)}</span>
              <span className="text-[11px] font-medium text-muted">{String(subtitle)}</span>
            </span>
          </Link>
        ))}
      </section>

      <div className="lg:mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start lg:gap-6">
      <div className="min-w-0">
      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-charcoal">Notification Settings</h2>
            <p className="mt-0.5 text-[11px] font-medium text-muted">
              {mutedCount ? `${mutedCount} notification channel${mutedCount === 1 ? "" : "s"} muted` : "All notification channels are active"}
            </p>
          </div>
          <Link href="/notifications" className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-3 text-[11px] font-bold text-maroon shadow-sm ring-1 ring-border">
            View alerts
          </Link>
        </div>
        <div className="mt-3 overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-border">
          <NotificationPreferenceRow
            icon={notificationPreferences.appMuted ? BellOff : Bell}
            title="Notification Icon"
            subtitle={notificationPreferences.appMuted ? "Bell alerts are muted" : "Bell alerts are active"}
            muted={notificationPreferences.appMuted}
            disabled={notificationSaving}
            onToggle={(muted) => updateNotificationPreference("appMuted", muted)}
          />
          <NotificationPreferenceRow
            icon={MessageCircle}
            title="WhatsApp Notifications"
            subtitle={notificationPreferences.whatsappMuted ? "WhatsApp messages are muted" : "WhatsApp messages are active"}
            muted={notificationPreferences.whatsappMuted}
            disabled={notificationSaving}
            onToggle={(muted) => updateNotificationPreference("whatsappMuted", muted)}
          />
        </div>
        {notificationSaving ? <p className="mt-2 text-xs font-semibold text-muted">Saving notification settings...</p> : null}
      </section>

      <section className="mt-6">
        <h2 className="text-[15px] font-bold text-charcoal">My Account</h2>
        <div className="mt-3 overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-border lg:grid lg:grid-cols-2">
          {accountRows.map((row) => (
            <Link key={row.title} href={row.href} className="flex items-center gap-3 border-b border-border p-4 last:border-b-0 lg:border-r lg:[&:nth-child(2n)]:border-r-0 lg:[&:nth-last-child(-n+2)]:border-b-0">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#fff4f5] text-maroon">
                <row.icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-charcoal">{row.title}</span>
                <span className="mt-0.5 block truncate text-[12px] font-medium text-muted">{row.subtitle}</span>
              </span>
              <ChevronRight size={18} className="text-muted" />
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-charcoal">Saved Addresses</h2>
          <Link href="/address" className="text-xs font-bold text-maroon">Add new</Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {addresses.length ? addresses.map((address) => (
            <article key={address.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-border">
              <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fff4f5] text-maroon">
                  <Home size={20} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-semibold text-charcoal">{address.label}</h3>
                    {address.isDefault ? <span className="rounded-full bg-[#fff4f5] px-2 py-0.5 text-[10px] font-bold text-maroon ring-1 ring-[#f1dce1]">Default</span> : null}
                  </div>
                  <p className="mt-1 text-[12px] font-medium leading-5 text-muted">
                    {[address.line1, address.area, address.city, address.state, address.pinCode].filter(Boolean).join(", ")}
                  </p>
                </div>
              </div>
            </article>
          )) : (
            <div className="rounded-2xl bg-white p-4 text-center text-[12px] font-medium text-muted shadow-sm ring-1 ring-border sm:col-span-2">
              No saved addresses yet. Add one from the address screen.
            </div>
          )}
        </div>
      </section>
      </div>

      <aside className="lg:sticky lg:top-24">
      <section className="mt-6 overflow-hidden rounded-[24px] border border-[#eadfe3] bg-white text-charcoal shadow-[0_18px_42px_rgba(34,31,32,0.09)] lg:mt-0">
        <div className="bg-[linear-gradient(135deg,#8d0021_0%,#ad1238_58%,#221f20_100%)] p-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/14 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white ring-1 ring-white/20">
                <TicketPercent size={13} /> Wah rewards
              </span>
              <h2 className="mt-3 text-[18px] font-bold leading-tight text-white">Next reward</h2>
              <p className="mt-1 max-w-[260px] text-[12px] font-medium leading-5 text-white/86">
                {rewardState.next
                  ? `${rewardState.ordersToNext} more orders unlock ${formatRupees(rewardState.next.value)} coupon.`
                  : "All reward coupons are unlocked."}
              </p>
            </div>
            <span className="shrink-0 rounded-[18px] bg-white px-3.5 py-2 text-right text-[10px] font-bold text-maroon shadow-[0_12px_24px_rgba(34,31,32,0.16)]">
              <span className="block text-[18px] leading-none">{rewardOrderCount}</span>
              orders
            </span>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3 text-[10px] font-semibold text-white/88">
              <span>{rewardState.next ? `${Math.round(rewardState.progress)}% toward ${formatRupees(rewardState.next.value)}` : "Reward journey complete"}</span>
              <span>{rewardState.next ? `${rewardState.next.orders} order goal` : `${rewardOrderCount} orders`}</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/20 ring-1 ring-white/20">
              <div className="wt-reward-progress h-full rounded-full bg-white" style={{ width: `${rewardState.progress}%` }} />
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-2">
            {rewardMilestones.map((milestone) => {
              const unlocked = rewardOrderCount >= milestone.orders;
              const remainingOrders = Math.max(milestone.orders - rewardOrderCount, 0);
              return (
                <Link
                  key={milestone.code}
                  href={unlocked ? "/offers" : "/menu"}
                  className={`min-w-0 rounded-[18px] p-3 text-center ring-1 transition duration-200 hover:-translate-y-0.5 ${
                    unlocked
                      ? "bg-[#fff4f5] text-maroon shadow-[0_10px_22px_rgba(141,0,33,0.08)] ring-[#f1dce1]"
                      : "bg-[#f7f8fb] text-muted ring-[#e7ebf2]"
                  }`}
                >
                  <span className={`mx-auto grid h-8 w-8 place-items-center rounded-full ${unlocked ? "bg-maroon text-white" : "bg-white text-muted ring-1 ring-[#e7ebf2]"}`}>
                    {unlocked ? <CheckCircle2 size={16} /> : <LockKeyhole size={15} />}
                  </span>
                  <span className="mt-2 block truncate text-[13px] font-bold">{formatRupees(milestone.value)}</span>
                  <span className="mt-0.5 block text-[10px] font-semibold leading-4">{unlocked ? "Unlocked" : `${remainingOrders} left`}</span>
                  <span className="block text-[10px] font-medium leading-4 text-muted">{milestone.orders} orders</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-[18px] bg-[#f7f8fb] p-3 ring-1 ring-[#e7ebf2] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] font-medium leading-5 text-muted">
              {unlockedRewardTotal ? `${formatRupees(unlockedRewardTotal)} reward value unlocked in Coupons.` : "Place orders to start unlocking reward coupons."}
            </p>
            <Link
              href={unlockedRewardTotal ? "/offers" : "/menu"}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-maroon px-4 text-xs font-bold text-white shadow-[0_10px_20px_rgba(141,0,33,0.18)]"
            >
              {unlockedRewardTotal ? "Open coupons" : "Order now"}
              <ArrowRight size={15} strokeWidth={3} />
            </Link>
          </div>
        </div>
      </section>

      {message ? <p className="mt-4 rounded-2xl bg-white p-3 text-center text-xs font-semibold text-muted">{message}</p> : null}

      <button
        type="button"
        onClick={() => setConfirmLogout(true)}
        className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-white text-sm font-bold text-maroon"
      >
        <LogOut size={18} /> Logout
      </button>
      </aside>
      </div>
      </div>

      {confirmLogout ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-charcoal/45 p-5">
          <section className="w-full max-w-[360px] rounded-[24px] bg-white p-5 text-center shadow-2xl">
            <span className="mx-auto grid h-13 w-13 place-items-center rounded-full bg-[#fff4f5] text-maroon">
              <LogOut size={24} />
            </span>
            <h2 className="mt-4 text-lg font-bold text-charcoal">Logout from Wah Thali?</h2>
            <p className="mt-2 text-[13px] font-medium leading-6 text-muted">
              You will need to sign in again to view orders, rewards, addresses, and coupons linked to your account.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                className="h-11 rounded-xl border border-border bg-white text-sm font-bold text-charcoal"
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
                className="h-11 rounded-xl bg-maroon text-sm font-bold text-white"
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

function NotificationPreferenceRow({
  disabled,
  icon: Icon,
  muted,
  onToggle,
  subtitle,
  title,
}: {
  disabled: boolean;
  icon: typeof Bell;
  muted: boolean;
  onToggle: (muted: boolean) => void;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border p-4 last:border-b-0">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${muted ? "bg-[#f7f8fb] text-muted" : "bg-[#fff4f5] text-maroon"}`}>
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-charcoal">{title}</span>
        <span className="mt-0.5 block truncate text-[12px] font-medium text-muted">{subtitle}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={!muted}
        disabled={disabled}
        onClick={() => onToggle(!muted)}
        className={`relative h-8 w-[58px] shrink-0 rounded-full p-1 transition-colors disabled:opacity-60 ${
          muted ? "bg-[#d5d9e2]" : "bg-maroon"
        }`}
      >
        <span className={`block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${muted ? "translate-x-0" : "translate-x-6"}`} />
      </button>
    </div>
  );
}
