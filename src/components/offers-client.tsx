"use client";

import { Check, Copy, Gift } from "lucide-react";
import { useState } from "react";
import { formatRupees } from "@/lib/pricing";
import type { Coupon } from "@/lib/types";

const couponPalettes = [
  {
    accent: "#009b63",
    ink: "#006b45",
    soft: "#eafff3",
    pill: "#c7ffe1",
    border: "#b7efcf",
    dash: "#9ce6bf",
  },
  {
    accent: "#b9320b",
    ink: "#8f2507",
    soft: "#fff4e7",
    pill: "#ffe0bf",
    border: "#ffd1aa",
    dash: "#ffc07f",
  },
  {
    accent: "#095fb9",
    ink: "#064b95",
    soft: "#eaf5ff",
    pill: "#d7ecff",
    border: "#bfddff",
    dash: "#9fcaff",
  },
  {
    accent: "#008f72",
    ink: "#006b55",
    soft: "#eafff9",
    pill: "#cffff2",
    border: "#b7efe4",
    dash: "#94e4d5",
  },
  {
    accent: "#8d0021",
    ink: "#6f001a",
    soft: "#fff4f5",
    pill: "#ffdbe2",
    border: "#efc8d1",
    dash: "#df9cad",
  },
  {
    accent: "#6242b7",
    ink: "#493088",
    soft: "#f3efff",
    pill: "#e2d9ff",
    border: "#d1c4fb",
    dash: "#b7a8ef",
  },
];

export function OffersClient({ coupons }: { coupons: Coupon[] }) {
  const [copiedCode, setCopiedCode] = useState("");

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
        {coupons.length ? coupons.map((coupon, index) => (
          <CouponTicket
            key={coupon.code}
            coupon={coupon}
            palette={couponPalettes[index % couponPalettes.length]}
            copied={copiedCode === coupon.code}
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
  onCopy,
}: {
  coupon: Coupon;
  palette: (typeof couponPalettes)[number];
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <article className="relative grid min-h-[152px] grid-cols-[92px_minmax(0,1fr)] overflow-hidden rounded-[16px] bg-white shadow-[0_8px_20px_rgba(17,24,39,0.05)] ring-1 ring-[#e6eaf1] sm:grid-cols-[104px_minmax(0,1fr)]">
      <div
        className="relative grid place-items-center px-3 text-center"
        style={{ background: `linear-gradient(90deg, ${palette.soft}, #ffffff)` }}
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

      <div className="min-w-0 px-3.5 py-3.5">
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

        <div className="mt-3 grid gap-1 border-t border-[#eef1f6] pt-3 text-[10px] font-bold leading-4 text-muted sm:grid-cols-2">
          <span>{coupon.minOrder > 0 ? `Min. Order: ${formatRupees(coupon.minOrder)}` : "No minimum order"}</span>
          <span>{coupon.endsAt ? `Expires: ${formatCouponDate(coupon.endsAt)}` : "Limited time"}</span>
          {coupon.maxDiscount ? <span className="sm:col-span-2">Max. Discount: {formatRupees(coupon.maxDiscount)}</span> : null}
        </div>
      </div>
    </article>
  );
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
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
