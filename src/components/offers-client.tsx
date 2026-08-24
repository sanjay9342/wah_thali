"use client";

import { Check, Copy, Gift } from "lucide-react";
import { useEffect, useState } from "react";
import { readCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";
import { formatRupees } from "@/lib/pricing";
import { formatIstDate } from "@/lib/time";
import type { Coupon } from "@/lib/types";

const couponPalettes = [
  {
    accent: "#009b63",
    ink: "#006b45",
    soft: "#eafff3",
    glow: "#c9f7dd",
    pill: "#c7ffe1",
    border: "#b7efcf",
    dash: "#9ce6bf",
  },
  {
    accent: "#b9320b",
    ink: "#8f2507",
    soft: "#fff4e7",
    glow: "#ffdfb8",
    pill: "#ffe0bf",
    border: "#ffd1aa",
    dash: "#ffc07f",
  },
  {
    accent: "#095fb9",
    ink: "#064b95",
    soft: "#eaf5ff",
    glow: "#c9e5ff",
    pill: "#d7ecff",
    border: "#bfddff",
    dash: "#9fcaff",
  },
  {
    accent: "#008f72",
    ink: "#006b55",
    soft: "#eafff9",
    glow: "#c8fff2",
    pill: "#cffff2",
    border: "#b7efe4",
    dash: "#94e4d5",
  },
  {
    accent: "#8d0021",
    ink: "#6f001a",
    soft: "#fff4f5",
    glow: "#ffd7df",
    pill: "#ffdbe2",
    border: "#efc8d1",
    dash: "#df9cad",
  },
  {
    accent: "#6242b7",
    ink: "#493088",
    soft: "#f3efff",
    glow: "#ded4ff",
    pill: "#e2d9ff",
    border: "#d1c4fb",
    dash: "#b7a8ef",
  },
  {
    accent: "#b7791f",
    ink: "#8a5415",
    soft: "#fff8df",
    glow: "#ffe7a3",
    pill: "#ffe9ad",
    border: "#f5d782",
    dash: "#e7bf4f",
  },
  {
    accent: "#0f766e",
    ink: "#115e59",
    soft: "#ecfeff",
    glow: "#bff7f1",
    pill: "#ccfbf1",
    border: "#99f6e4",
    dash: "#5eead4",
  },
];

export function OffersClient({ coupons }: { coupons: Coupon[] }) {
  const [copiedCode, setCopiedCode] = useState("");
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [rewardOrderCount, setRewardOrderCount] = useState(0);
  const [customerTags, setCustomerTags] = useState<string[]>([]);

  useEffect(() => {
    function refreshSession() {
      setSession(readCustomerSession());
    }

    refreshSession();
    return subscribeCustomerSession(refreshSession);
  }, []);

  useEffect(() => {
    const mobile = session?.mobile ?? "";
    if (!mobile) return;
    let cancelled = false;

    async function loadRewards() {
      const response = await fetch(`/api/customers/profile?mobile=${encodeURIComponent(mobile)}`, { cache: "no-store" });
      const data = await response.json();
      if (!cancelled && response.ok) {
        setRewardOrderCount(Number(data.customer?.rewardOrderCount ?? data.customer?.loyalty?.points ?? 0));
        setCustomerTags(getCustomerTagNames(data.customer?.tags));
      }
    }

    void loadRewards();
    return () => {
      cancelled = true;
    };
  }, [session?.mobile]);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode((current) => current === code ? "" : current), 1400);
    } catch {
      setCopiedCode("");
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f6f7fb] px-5 pb-28 pt-4 text-charcoal sm:my-6 sm:rounded-[28px] lg:max-w-5xl lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted">Wah Thali</p>
          <h1 className="mt-1 text-[24px] font-black leading-tight text-maroon">Offers</h1>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-maroon shadow-sm ring-1 ring-border">
          <Gift size={22} />
        </span>
      </div>

      <section className="mt-4 grid gap-3 lg:grid-cols-2">
        {coupons.length ? coupons.map((coupon) => (
          <CouponTicket
            key={coupon.code}
            coupon={coupon}
            palette={getCouponPalette(coupon.code)}
            copied={copiedCode === coupon.code}
            eligible={isOfferEligible(coupon, session?.mobile ? rewardOrderCount : 0, session?.mobile ? customerTags : [])}
            rewardOrderCount={session?.mobile ? rewardOrderCount : 0}
            customerTags={session?.mobile ? customerTags : []}
            onCopy={() => copyCode(coupon.code)}
          />
        )) : (
          <section className="rounded-[24px] bg-white p-6 text-center shadow-sm ring-1 ring-border lg:col-span-2">
            <Gift className="mx-auto text-maroon" size={34} />
            <h2 className="mt-3 text-[20px] font-black text-charcoal">No live coupons</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-muted">
              Add active coupons from Admin, and they will appear here automatically.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}

function CouponTicket({
  coupon,
  palette,
  copied,
  eligible,
  rewardOrderCount,
  customerTags,
  onCopy,
}: {
  coupon: Coupon;
  palette: (typeof couponPalettes)[number];
  copied: boolean;
  eligible: boolean;
  rewardOrderCount: number;
  customerTags: string[];
  onCopy: () => void;
}) {
  return (
    <article
      className="relative grid min-h-[152px] grid-cols-[92px_minmax(0,1fr)] overflow-hidden rounded-[16px] bg-white shadow-[0_10px_24px_rgba(17,24,39,0.06)] ring-1 sm:grid-cols-[104px_minmax(0,1fr)]"
      style={{ borderColor: palette.border, boxShadow: `0 14px 28px ${palette.glow}44` }}
    >
      <span
        className="pointer-events-none absolute -right-12 -top-16 h-32 w-32 rounded-full blur-2xl"
        style={{ backgroundColor: palette.glow }}
      />
      <div
        className="relative grid place-items-center px-3 text-center"
        style={{ background: `linear-gradient(135deg, ${palette.soft} 0%, ${palette.glow} 58%, #ffffff 100%)` }}
      >
        <div>
          <p className="text-[24px] font-black leading-none sm:text-[27px]" style={{ color: palette.ink }}>
            {getCouponHero(coupon)}
          </p>
          <p className="mt-1.5 text-[11px] font-black uppercase leading-none sm:text-[12px]" style={{ color: palette.ink }}>
            OFF
          </p>
        </div>
        <span className="absolute right-0 top-3 h-[calc(100%-24px)] border-r-2 border-dashed" style={{ borderColor: palette.dash }} />
        <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[#f6f7fb]" />
      </div>

      <div className="relative min-w-0 px-3.5 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate rounded-[7px] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide sm:text-[11px]" style={{ backgroundColor: palette.pill, color: palette.ink }}>
            {coupon.code}
          </span>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[10px] border px-2.5 text-[10px] font-black sm:text-[11px]"
            style={{ borderColor: palette.accent, color: palette.ink }}
          >
            {copied ? <Check size={13} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy Code"}
          </button>
        </div>

        <h2 className="mt-4 line-clamp-1 text-[15px] font-black leading-tight text-charcoal sm:text-[16px]">{coupon.label}</h2>
        <p className="mt-2 line-clamp-2 text-[12px] font-semibold leading-5 text-charcoal/85">
          {getCouponDescription(coupon)}
        </p>
        <span className="mt-2 inline-flex rounded-[7px] px-2.5 py-1.5 text-[10px] font-black" style={{ backgroundColor: palette.pill, color: palette.ink }}>
          {getCouponAudienceLabel(coupon)}
        </span>
        {!eligible ? (
          <p className="mt-2 text-[11px] font-black leading-4 text-maroon">
            {getLockedOfferMessage(coupon, rewardOrderCount, customerTags)}
          </p>
        ) : null}

        <div className="mt-3 grid gap-1 border-t border-[#eef1f6] pt-3 text-[10px] font-bold leading-4 text-muted sm:grid-cols-2">
          <span>{coupon.minOrder > 0 ? `Min. Order: ${formatRupees(coupon.minOrder)}` : "No minimum order"}</span>
          <span>{coupon.endsAt ? `Expires: ${formatCouponDate(coupon.endsAt)}` : "Limited time"}</span>
          {coupon.maxDiscount ? <span className="sm:col-span-2">Max. Discount: {formatRupees(coupon.maxDiscount)}</span> : null}
        </div>
      </div>
    </article>
  );
}

function getCouponAudienceLabel(coupon: Coupon) {
  if (coupon.audience === "VIP") return "VIP customers only";
  if (coupon.audience === "POINTS") return `${getCouponOrderCountRequirement(coupon)}+ placed orders`;
  if (coupon.audience === "TAGS") return `${formatCouponTags(coupon.tagNames)} customers only`;
  return "All customers";
}

function isOfferEligible(coupon: Coupon, rewardOrderCount: number, customerTags: string[]) {
  if (coupon.audience === "POINTS") return rewardOrderCount >= getCouponOrderCountRequirement(coupon);
  if (coupon.audience === "TAGS") return hasMatchingCouponTag(coupon.tagNames, customerTags);
  return true;
}

function getLockedOfferMessage(coupon: Coupon, rewardOrderCount: number, customerTags: string[]) {
  if (coupon.audience === "POINTS") {
    return `Place ${Math.max(getCouponOrderCountRequirement(coupon) - rewardOrderCount, 0)} more orders to unlock.`;
  }
  if (coupon.audience === "TAGS" && !hasMatchingCouponTag(coupon.tagNames, customerTags)) {
    return `Available only for ${formatCouponTags(coupon.tagNames)} customers.`;
  }
  return "Sign in or check your account eligibility.";
}

function getCouponOrderCountRequirement(coupon: Pick<Coupon, "minPoints">) {
  return Math.max(1, Number(coupon.minPoints ?? 1));
}

function formatCouponTags(tags: string[] | undefined) {
  return tags?.length ? tags.join(", ") : "selected";
}

function hasMatchingCouponTag(couponTags: string[] | undefined, customerTags: string[]) {
  const required = new Set((couponTags ?? []).map((tag) => tag.trim()).filter(Boolean));
  if (!required.size) return false;
  return customerTags.some((tag) => required.has(tag));
}

function getCustomerTagNames(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => {
      if (typeof tag === "string") return tag;
      if (tag && typeof tag === "object" && "tag" in tag) {
        const nested = (tag as { tag?: { name?: unknown } }).tag;
        return typeof nested?.name === "string" ? nested.name : "";
      }
      return "";
    })
    .filter(Boolean);
}

function getCouponPalette(code: string) {
  const hash = [...code].reduce((total, character) => total + character.charCodeAt(0), 0);
  return couponPalettes[hash % couponPalettes.length];
}

function getCouponHero(coupon: Coupon) {
  if (coupon.type === "FIXED") return formatRupees(coupon.value);
  return `${coupon.value}%`;
}

function getCouponDescription(coupon: Coupon) {
  if (coupon.type === "FIXED") {
    return `Use above ${formatRupees(coupon.minOrder)} and save ${formatRupees(coupon.value)}.`;
  }

  return coupon.maxDiscount
    ? `Get ${coupon.value}% OFF up to ${formatRupees(coupon.maxDiscount)}.`
    : `Get ${coupon.value}% OFF.`;
}

function formatCouponDate(value: string) {
  return formatIstDate(value);
}
