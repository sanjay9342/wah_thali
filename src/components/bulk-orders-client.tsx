"use client";

import { Building2, CalendarDays, Check, Copy, Gift, MapPin, Phone, Send, UserRound, UsersRound } from "lucide-react";
import Image from "next/image";
import { type FormEvent, useState } from "react";
import { formatRupees } from "@/lib/pricing";
import { formatIstDate } from "@/lib/time";
import type { Coupon } from "@/lib/types";

function cleanPhone(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

const couponPalettes = [
  { accent: "#009b63", ink: "#006b45", soft: "#eafff3", glow: "#c9f7dd", pill: "#c7ffe1", border: "#b7efcf", dash: "#9ce6bf" },
  { accent: "#b9320b", ink: "#8f2507", soft: "#fff4e7", glow: "#ffdfb8", pill: "#ffe0bf", border: "#ffd1aa", dash: "#ffc07f" },
  { accent: "#095fb9", ink: "#064b95", soft: "#eaf5ff", glow: "#c9e5ff", pill: "#d7ecff", border: "#bfddff", dash: "#9fcaff" },
  { accent: "#008f72", ink: "#006b55", soft: "#eafff9", glow: "#c8fff2", pill: "#cffff2", border: "#b7efe4", dash: "#94e4d5" },
  { accent: "#8d0021", ink: "#6f001a", soft: "#fff4f5", glow: "#ffd7df", pill: "#ffdbe2", border: "#efc8d1", dash: "#df9cad" },
  { accent: "#6242b7", ink: "#493088", soft: "#f3efff", glow: "#ded4ff", pill: "#e2d9ff", border: "#d1c4fb", dash: "#b7a8ef" },
  { accent: "#b7791f", ink: "#8a5415", soft: "#fff8df", glow: "#ffe7a3", pill: "#ffe9ad", border: "#f5d782", dash: "#e7bf4f" },
  { accent: "#0f766e", ink: "#115e59", soft: "#ecfeff", glow: "#bff7f1", pill: "#ccfbf1", border: "#99f6e4", dash: "#5eead4" },
];

export function BulkOrdersClient({ coupons = [] }: { coupons?: Coupon[] }) {
  const [enquiry, setEnquiry] = useState({
    name: "",
    phone: "",
    email: "",
    area: "",
    intent: "Party and Bulk Orders",
    startDate: "",
    headcount: "",
    budget: "",
    deliveryTime: "",
    notes: "",
  });
  const [enquiryMessage, setEnquiryMessage] = useState("");
  const [enquiryTone, setEnquiryTone] = useState<"success" | "error">("success");
  const [submittingEnquiry, setSubmittingEnquiry] = useState(false);
  const phoneDigits = cleanPhone(enquiry.phone);
  const canSubmitEnquiry = Boolean(
    enquiry.name.trim() &&
    phoneDigits.length === 10 &&
    enquiry.area.trim() &&
    enquiry.intent.trim() &&
    enquiry.startDate.trim() &&
    enquiry.deliveryTime.trim(),
  );

  async function submitEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnquiryMessage("");
    setEnquiryTone("error");

    if (!enquiry.name.trim()) {
      setEnquiryMessage("Please enter your name.");
      return;
    }
    if (phoneDigits.length !== 10) {
      setEnquiryMessage("Please enter a valid 10 digit mobile number.");
      return;
    }
    if (!enquiry.area.trim()) {
      setEnquiryMessage("Please enter your location.");
      return;
    }
    if (!enquiry.intent.trim()) {
      setEnquiryMessage("Please choose your requirement.");
      return;
    }
    if (!enquiry.startDate.trim()) {
      setEnquiryMessage("Please select the event date.");
      return;
    }
    if (!enquiry.deliveryTime.trim()) {
      setEnquiryMessage("Please enter the preferred time to call.");
      return;
    }

    setSubmittingEnquiry(true);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: enquiry.intent,
          name: enquiry.name.trim(),
          phone: phoneDigits,
          email: enquiry.email.trim(),
          area: enquiry.area.trim(),
          headcount: enquiry.headcount ? Number(enquiry.headcount) : undefined,
          startDate: enquiry.startDate,
          budget: enquiry.budget.trim(),
          deliveryTime: enquiry.deliveryTime.trim(),
          notes: enquiry.notes.trim(),
          company: enquiry.intent === "Corporate and Office Orders" ? enquiry.notes.trim().slice(0, 80) : "",
        }),
      });
      const data = await response.json().catch(() => null) as { error?: string; adminNotification?: { ok?: boolean; message?: string } } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not send enquiry. Please try again.");
      }

      setEnquiry({
        name: "",
        phone: "",
        email: "",
        area: "",
        intent: enquiry.intent,
        startDate: "",
        headcount: "",
        budget: "",
        deliveryTime: "",
        notes: "",
      });
      setEnquiryTone("success");
      setEnquiryMessage(data?.adminNotification?.ok === false
        ? `Enquiry saved. WhatsApp notification failed: ${data.adminNotification.message || "Check Meta template/settings."}`
        : "Enquiry sent. Our team will contact you soon.");
    } catch (error) {
      setEnquiryTone("error");
      setEnquiryMessage(error instanceof Error ? error.message : "Could not send enquiry. Please try again.");
    } finally {
      setSubmittingEnquiry(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-5 pb-28 pt-4 text-charcoal sm:my-6 sm:rounded-[28px] lg:my-0 lg:max-w-none lg:rounded-none lg:px-0 lg:pb-14 lg:pt-8">
      <section className="mx-auto grid w-full gap-4 lg:max-w-[1248px] lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch lg:gap-6 lg:px-8">
        <div className="overflow-hidden rounded-[16px] bg-white shadow-[0_16px_34px_rgba(34,31,32,0.08)] ring-1 ring-border">
          <div className="relative h-[230px] lg:h-[420px]">
            <Image
              src="/offers-bulk-meals.png"
              alt="Packed Indian meals for subscription, corporate, and bulk orders"
              fill
              sizes="(min-width: 1024px) 42vw, 100vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/68 via-black/12 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5">
              <h1 className="mt-3 max-w-[560px] text-[26px] font-black leading-tight text-white lg:text-[40px]">
                Subscription, Corporate, Bulk Orders
              </h1>
            </div>
          </div>
          <div className="grid gap-4 p-5 lg:p-6">
            <p className="text-sm font-semibold leading-6 text-charcoal/82 lg:text-base lg:leading-7">
              Share your requirement for office meals, monthly plans, events, and party orders. The request is saved and sent to admin WhatsApp.
            </p>
            <div className="grid gap-2 text-sm font-black text-charcoal">
              <span className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-cream px-3"><UsersRound size={17} className="text-maroon" /> Party and Bulk Orders</span>
              <span className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-cream px-3"><Building2 size={17} className="text-maroon" /> Corporate and Office Orders</span>
              <span className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-cream px-3"><CalendarDays size={17} className="text-maroon" /> Monthly Subscription</span>
            </div>
          </div>
        </div>

        <form onSubmit={submitEnquiry} className="grid content-start gap-3 rounded-[16px] bg-white p-4 shadow-[0_16px_34px_rgba(34,31,32,0.08)] ring-1 ring-border lg:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <EnquiryField icon={UserRound} label="Name" value={enquiry.name} onChange={(value) => setEnquiry({ ...enquiry, name: value })} required />
            <EnquiryField icon={Phone} label="Mobile" value={enquiry.phone} onChange={(value) => setEnquiry({ ...enquiry, phone: value })} required inputMode="tel" />
            <EnquiryField icon={MapPin} label="Location" value={enquiry.area} onChange={(value) => setEnquiry({ ...enquiry, area: value })} required />
            <EnquiryField label="Email" type="email" value={enquiry.email} onChange={(value) => setEnquiry({ ...enquiry, email: value })} />
            <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-maroon">
              Requirement
              <select
                value={enquiry.intent}
                onChange={(event) => setEnquiry({ ...enquiry, intent: event.target.value })}
                required
                className="h-11 rounded-[10px] border border-border bg-cream px-3 text-sm font-black normal-case tracking-normal text-charcoal"
              >
                <option>Party and Bulk Orders</option>
                <option>Corporate and Office Orders</option>
                <option>Monthly Subscription</option>
              </select>
            </label>
            <EnquiryField icon={CalendarDays} label="Event date" type="date" value={enquiry.startDate} onChange={(value) => setEnquiry({ ...enquiry, startDate: value })} required />
            <EnquiryField icon={UsersRound} label="Guests or meals" type="number" value={enquiry.headcount} onChange={(value) => setEnquiry({ ...enquiry, headcount: value })} min={1} />
            <EnquiryField label="Budget" value={enquiry.budget} onChange={(value) => setEnquiry({ ...enquiry, budget: value })} placeholder="Example: 150 per meal" />
          </div>
          <EnquiryField label="Preferred time to call" value={enquiry.deliveryTime} onChange={(value) => setEnquiry({ ...enquiry, deliveryTime: value })} placeholder="Example: 1:00 PM" required />
          <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-maroon">
            Notes
            <textarea
              value={enquiry.notes}
              onChange={(event) => setEnquiry({ ...enquiry, notes: event.target.value })}
              className="min-h-24 rounded-[10px] border border-border bg-cream px-3 py-2 text-sm font-semibold normal-case tracking-normal text-charcoal"
              placeholder="Company name, menu preference, veg/non-veg count, delivery details"
            />
          </label>
          {enquiryMessage ? (
            <p className={`rounded-[10px] px-3 py-2 text-sm font-black ${enquiryTone === "success" ? "bg-[#effaf4] text-[#0f7a45]" : "bg-[#fff4f5] text-maroon"}`} role="status">
              {enquiryMessage}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submittingEnquiry || !canSubmitEnquiry}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-maroon px-4 text-sm font-black text-white disabled:opacity-55"
          >
            <Send size={17} /> {submittingEnquiry ? "Sending..." : "Request callback"}
          </button>
        </form>
      </section>
      <MobileOffers coupons={coupons} />
    </main>
  );
}

function MobileOffers({ coupons }: { coupons: Coupon[] }) {
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
    <section className="mt-7 grid gap-3 lg:hidden" aria-label="Offers">
      <div className="flex items-center justify-between">
        <h2 className="text-[22px] font-black leading-tight text-maroon">Offers</h2>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-maroon shadow-sm ring-1 ring-border">
          <Gift size={20} />
        </span>
      </div>
      {coupons.length ? coupons.map((coupon) => (
        <MobileCouponTicket
          key={coupon.code}
          coupon={coupon}
          palette={getCouponPalette(coupon.code)}
          copied={copiedCode === coupon.code}
          onCopy={() => copyCode(coupon.code)}
        />
      )) : (
        <div className="rounded-[16px] bg-white p-5 text-center shadow-sm ring-1 ring-border">
          <p className="text-sm font-black text-charcoal">No live coupons</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-muted">New offers will appear here automatically.</p>
        </div>
      )}
    </section>
  );
}

function MobileCouponTicket({
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
  const eligible = isOfferEligible(coupon, 0, []);

  return (
    <article
      className="relative grid min-h-[152px] grid-cols-[92px_minmax(0,1fr)] overflow-hidden rounded-[16px] bg-white shadow-[0_10px_24px_rgba(17,24,39,0.06)] ring-1"
      style={{ borderColor: palette.border, boxShadow: `0 14px 28px ${palette.glow}44` }}
    >
      <span className="pointer-events-none absolute -right-12 -top-16 h-32 w-32 rounded-full blur-2xl" style={{ backgroundColor: palette.glow }} />
      <div
        className="relative grid place-items-center px-3 text-center"
        style={{ background: `linear-gradient(135deg, ${palette.soft} 0%, ${palette.glow} 58%, #ffffff 100%)` }}
      >
        <div>
          <p className="text-[24px] font-black leading-none" style={{ color: palette.ink }}>{getCouponHero(coupon)}</p>
          <p className="mt-1.5 text-[11px] font-black uppercase leading-none" style={{ color: palette.ink }}>OFF</p>
        </div>
        <span className="absolute right-0 top-3 h-[calc(100%-24px)] border-r-2 border-dashed" style={{ borderColor: palette.dash }} />
        <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white" />
      </div>

      <div className="relative min-w-0 px-3.5 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate rounded-[7px] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide" style={{ backgroundColor: palette.pill, color: palette.ink }}>
            {coupon.code}
          </span>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[10px] border px-2.5 text-[10px] font-black"
            style={{ borderColor: palette.accent, color: palette.ink }}
          >
            {copied ? <Check size={13} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy Code"}
          </button>
        </div>

        <h3 className="mt-4 line-clamp-1 text-[15px] font-black leading-tight text-charcoal">{coupon.label}</h3>
        <p className="mt-2 line-clamp-2 text-[12px] font-semibold leading-5 text-charcoal/85">{getCouponDescription(coupon)}</p>
        <span className="mt-2 inline-flex rounded-[7px] px-2.5 py-1.5 text-[10px] font-black" style={{ backgroundColor: palette.pill, color: palette.ink }}>
          {getCouponAudienceLabel(coupon)}
        </span>
        {!eligible ? <p className="mt-2 text-[11px] font-black leading-4 text-maroon">{getLockedOfferMessage(coupon, 0, [])}</p> : null}

        <div className="mt-3 grid gap-1 border-t border-[#eef1f6] pt-3 text-[10px] font-bold leading-4 text-muted">
          <span>{coupon.minOrder > 0 ? `Min. Order: ${formatRupees(coupon.minOrder)}` : "No minimum order"}</span>
          <span>{coupon.endsAt ? `Expires: ${formatIstDate(coupon.endsAt)}` : "Limited time"}</span>
          {coupon.maxDiscount ? <span>Max. Discount: {formatRupees(coupon.maxDiscount)}</span> : null}
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

function EnquiryField({
  icon: Icon,
  label,
  value,
  onChange,
  type = "text",
  required,
  inputMode,
  min,
  placeholder,
}: {
  icon?: typeof UserRound;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  inputMode?: "tel" | "text" | "email" | "numeric" | "decimal" | "search" | "url";
  min?: number;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-maroon">
      {label}
      <span className="flex h-11 items-center gap-2 rounded-[10px] border border-border bg-cream px-3">
        {Icon ? <Icon size={16} className="shrink-0 text-muted" /> : null}
        <input
          type={type}
          required={required}
          inputMode={inputMode}
          min={min}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold normal-case tracking-normal text-charcoal outline-none"
        />
      </span>
    </label>
  );
}
