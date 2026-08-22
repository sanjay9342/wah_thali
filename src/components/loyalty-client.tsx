"use client";

import { useEffect, useState } from "react";
import { Gift, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";
import { formatRupees } from "@/lib/pricing";
import { getRewardState, rewardMilestones } from "@/lib/rewards";

type LoyaltyProfile = {
  name: string;
  rewardOrderCount?: number;
  rewardTier?: string;
  loyalty?: { points: number; tier: string } | null;
};

export function LoyaltyClient() {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState<LoyaltyProfile | null>(null);

  useEffect(() => {
    function refreshSession() {
      setSession(readCustomerSession());
      setSessionReady(true);
    }

    refreshSession();
    return subscribeCustomerSession(refreshSession);
  }, []);

  useEffect(() => {
    if (sessionReady && !session?.mobile) router.replace("/login?next=/loyalty");
  }, [router, session?.mobile, sessionReady]);

  useEffect(() => {
    const mobile = session?.mobile ?? "";
    if (!mobile) return;
    let cancelled = false;

    async function loadProfile() {
      const response = await fetch(`/api/customers/profile?mobile=${encodeURIComponent(mobile)}`, { cache: "no-store" });
      const data = await response.json();
      if (!cancelled && response.ok) setProfile(data.customer);
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [session?.mobile]);

  const orderCount = profile?.rewardOrderCount ?? profile?.loyalty?.points ?? 0;
  const rewardState = getRewardState(orderCount);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f6f7fb] px-5 pb-28 pt-5 text-charcoal sm:my-6 sm:rounded-[28px] lg:max-w-5xl">
      <section className="overflow-hidden rounded-[24px] bg-red p-6 text-white shadow-[0_16px_36px_rgba(141,0,33,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/75">Live rewards</p>
            <h1 className="mt-2 text-3xl font-black leading-tight">{profile?.name || session?.name || "Your"} Rewards</h1>
            <p className="mt-2 text-sm font-bold text-white/78">{rewardState.tier} tier from {orderCount} placed orders.</p>
          </div>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-red">
            <Star size={23} className="fill-red" />
          </span>
        </div>
        <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/20">
          <div className="wt-reward-progress h-full rounded-full bg-white" style={{ width: `${rewardState.progress}%` }} />
        </div>
        <p className="mt-3 text-sm font-black text-white/82">
          {rewardState.next ? `${rewardState.ordersToNext} more orders for ${formatRupees(rewardState.next.value)} coupon.` : "All milestone coupons unlocked."}
        </p>
      </section>

      <section className="mt-5 grid gap-3 lg:grid-cols-3">
        {rewardMilestones.map((milestone) => {
          const unlocked = orderCount >= milestone.orders;
          return (
            <article key={milestone.code} className="rounded-[22px] bg-white p-5 shadow-sm ring-1 ring-border">
              <div className="flex items-start justify-between gap-3">
                <span>
                  <span className="text-2xl font-black text-maroon">{formatRupees(milestone.value)}</span>
                  <span className="mt-1 block text-sm font-black text-charcoal">{milestone.orders} order reward</span>
                </span>
                <span className={`grid h-11 w-11 place-items-center rounded-full ${unlocked ? "bg-red text-white" : "bg-cream text-red"}`}>
                  <Gift size={20} />
                </span>
              </div>
              <p className="mt-4 text-sm font-semibold leading-6 text-muted">
                {unlocked ? `${milestone.code} is available in Coupons and Cart.` : `Place ${milestone.orders - orderCount} more orders to unlock ${milestone.code}.`}
              </p>
              <Link href={unlocked ? "/offers" : "/menu"} className="mt-5 inline-flex h-11 items-center rounded-xl bg-red px-5 text-sm font-black text-white">
                {unlocked ? "View coupon" : "Order now"}
              </Link>
            </article>
          );
        })}
      </section>
    </main>
  );
}
