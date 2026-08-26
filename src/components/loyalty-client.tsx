"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Gift, LockKeyhole, Sparkles, TicketPercent, Trophy } from "lucide-react";
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
  const unlockedCount = rewardState.completed.length;
  const nextRewardValue = rewardState.next?.value ?? rewardMilestones.at(-1)?.value ?? 0;
  const rewardName = `${profile?.name || session?.name || "Your"} Rewards`;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-5 pb-28 pt-5 text-charcoal sm:my-6 sm:rounded-[28px] lg:my-0 lg:max-w-none lg:rounded-none lg:px-0 lg:pb-14 lg:pt-8">
      <div className="mx-auto w-full lg:max-w-[1248px] lg:px-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-white text-maroon shadow-sm ring-1 ring-[#e7ebf2] transition-colors hover:bg-[#fff8f9] lg:mb-5"
        aria-label="Go back"
      >
        <ArrowLeft size={21} strokeWidth={2.7} />
      </button>

      <section className="overflow-hidden rounded-[24px] border border-[#dfe8f6] bg-white p-5 shadow-[0_16px_36px_rgba(17,24,39,0.08)] lg:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="inline-flex rounded-full bg-[#fff4dc] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#9a5b00] ring-1 ring-[#ffe2a8]">
              Live rewards
            </p>
            <h1 className="mt-3 text-[28px] font-black leading-tight text-[#111827] lg:text-[38px]">{rewardName}</h1>
            <p className="mt-2 max-w-2xl text-sm font-bold leading-5 text-[#5f6875] lg:text-base lg:leading-7">
              {rewardState.tier} tier from {orderCount} placed orders. Keep ordering to unlock coupon cash.
            </p>
          </div>
          <span className="grid h-13 w-13 shrink-0 place-items-center rounded-full bg-[#e9f7ff] text-[#1769c2] ring-1 ring-[#cce8ff]">
            <Sparkles size={24} />
          </span>
        </div>

        <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-[18px] border border-[#e7ebf2] bg-[#f7f8fb] text-center">
          {[
            [String(orderCount), "Orders"],
            [`${unlockedCount}/${rewardMilestones.length}`, "Coupons"],
            [formatRupees(nextRewardValue), rewardState.next ? "Next" : "Unlocked"],
          ].map(([value, label]) => (
            <div key={label} className="border-r border-[#e7ebf2] px-2 py-3 last:border-r-0">
              <p className="text-[18px] font-black text-[#111827]">{value}</p>
              <p className="text-[10px] font-black text-[#6b7280]">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[18px] bg-[#eef7ff] p-4 ring-1 ring-[#d5eaff]">
          <div className="flex items-center justify-between gap-3 text-xs font-black text-[#1769c2]">
            <span>{rewardState.next ? `${rewardState.ordersToNext} orders to next coupon` : "All milestone coupons unlocked"}</span>
            <span>{Math.round(rewardState.progress)}%</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-white ring-1 ring-[#d5eaff]">
            <div className="wt-reward-progress h-full rounded-full bg-[#25a6f0]" style={{ width: `${rewardState.progress}%` }} />
          </div>
        </div>

        <Link
          href={unlockedCount > 0 ? "/offers" : "/menu"}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[16px] bg-[#111827] text-sm font-black text-white shadow-[0_12px_24px_rgba(17,24,39,0.18)]"
        >
          {unlockedCount > 0 ? "Open unlocked coupons" : "Start earning coupons"}
          <ArrowRight size={17} strokeWidth={3} />
        </Link>
      </section>

      <section className="mt-5 grid gap-3 lg:grid-cols-3">
        {rewardMilestones.map((milestone, index) => {
          const unlocked = orderCount >= milestone.orders;
          const remainingOrders = Math.max(milestone.orders - orderCount, 0);
          const palette = rewardCardPalettes[index % rewardCardPalettes.length];

          return (
            <article key={milestone.code} className={`rounded-[22px] p-5 shadow-sm ring-1 ${palette.card}`}>
              <div className="flex items-start justify-between gap-3">
                <span>
                  <span className={`text-2xl font-black ${palette.value}`}>{formatRupees(milestone.value)}</span>
                  <span className="mt-1 block text-sm font-black text-[#111827]">{milestone.orders} order coupon</span>
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-black text-[#4b5563] ring-1 ring-white/80">
                    {unlocked ? <CheckCircle2 size={12} className={palette.iconText} /> : <LockKeyhole size={12} className={palette.iconText} />}
                    {unlocked ? "Ready in Coupons" : `${remainingOrders} orders left`}
                  </span>
                </span>
                <span className={`grid h-11 w-11 place-items-center rounded-full bg-white shadow-sm ring-1 ring-white/80 ${palette.iconText}`}>
                  {unlocked ? <TicketPercent size={20} /> : <Gift size={20} />}
                </span>
              </div>
              <p className="mt-4 text-sm font-bold leading-5 text-[#5f6875]">
                {unlocked ? `${milestone.code} is ready. Use it from Coupons or Cart checkout.` : `Place ${remainingOrders} more orders to unlock ${milestone.code}.`}
              </p>
              <Link href={unlocked ? "/offers" : "/menu"} className={`mt-5 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-black ${palette.button}`}>
                {unlocked ? "View coupon" : "Order now"}
                <ArrowRight size={15} strokeWidth={3} />
              </Link>
            </article>
          );
        })}
      </section>

      <section className="mt-5 rounded-[22px] bg-white p-5 shadow-sm ring-1 ring-[#e7ebf2]">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#ecfdf3] text-[#16833d] ring-1 ring-[#ccefd8]">
            <Trophy size={21} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-black text-[#111827]">How to reach coupons faster</h2>
            <p className="mt-1 text-sm font-bold leading-5 text-[#5f6875]">
              Every completed order moves you closer. Unlock rewards, open Coupons, and apply them during checkout.
            </p>
          </div>
        </div>
      </section>
      </div>
    </main>
  );
}

const rewardCardPalettes = [
  {
    card: "bg-[#fff7dc] ring-[#ffe2a8]",
    value: "text-[#9a5b00]",
    iconText: "text-[#d97706]",
    button: "bg-[#9a5b00] text-white shadow-[0_10px_22px_rgba(154,91,0,0.18)]",
  },
  {
    card: "bg-[#e9f7ff] ring-[#cce8ff]",
    value: "text-[#1769c2]",
    iconText: "text-[#1769c2]",
    button: "bg-[#1769c2] text-white shadow-[0_10px_22px_rgba(23,105,194,0.18)]",
  },
  {
    card: "bg-[#ecfdf3] ring-[#ccefd8]",
    value: "text-[#16833d]",
    iconText: "text-[#16833d]",
    button: "bg-[#16833d] text-white shadow-[0_10px_22px_rgba(22,131,61,0.18)]",
  },
];
