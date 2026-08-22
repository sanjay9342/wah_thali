import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  ChefHat,
  CookingPot,
  CreditCard,
  MapPin,
  MessageCircle,
  Navigation,
  PackageCheck,
  Phone,
  Star,
  User,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MobileNav } from "@/components/mobile-nav";
import { CustomerOrderCancelButton } from "@/components/customer-order-cancel-button";
import { OrderTrackAutoRefresh } from "@/components/order-track-auto-refresh";
import { OrderReviewForm } from "@/components/order-review-form";
import { OrderReorderButton } from "@/components/order-reorder-button";
import { getRestaurantSettingsFromDb } from "@/lib/db";
import { formatRupees } from "@/lib/pricing";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { formatIstTime } from "@/lib/time";

export const dynamic = "force-dynamic";

const orderSteps = [
  { status: "PENDING_PAYMENT", label: "Payment", detail: "Secure payment is waiting.", icon: CreditCard },
  { status: "NEW", label: "Order placed", detail: "The kitchen has received it.", icon: CheckCircle2 },
  { status: "CONFIRMED", label: "Accepted", detail: "Fresh prep is scheduled.", icon: ChefHat },
  { status: "PREPARING", label: "Cooking", detail: "Your meal is being prepared.", icon: CookingPot },
  { status: "PACKED", label: "Packed", detail: "Packed neatly for delivery.", icon: PackageCheck },
  { status: "OUT_FOR_DELIVERY", label: "On the way", detail: "Rider is heading to you.", icon: Bike },
  { status: "DELIVERED", label: "Delivered", detail: "Enjoy your meal.", icon: CheckCircle2 },
] as const;

type TrackerStep = (typeof orderSteps)[number];

export default async function TrackPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const restaurantSettings = await getRestaurantSettingsFromDb();

  if (!isDatabaseConfigured()) notFound();

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      customer: { select: { id: true, name: true, mobile: true, email: true } },
      items: true,
      payments: true,
      reviews: true,
      timeline: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!order) notFound();

  const notes = order.timeline.map((item) => item.note).filter((note): note is string => Boolean(note));
  const cancelled = order.status === "CANCELLED";
  const visibleSteps = getVisibleSteps(order.status, order.payments[0]?.provider);
  const activeIndex = getActiveStepIndex(order.status, visibleSteps);
  const currentStep = visibleSteps[activeIndex] ?? visibleSteps[0];
  const currentIcon = cancelled ? XCircle : getHeroIcon(order.status, currentStep.icon);
  const palette = getTrackingPalette(order.status);
  const placedAt = formatIstTime(toIsoTimestamp(order.createdAt));
  const eta = formatEta(extractTimelineValue(notes, "ETA"), restaurantSettings.defaultPrepMinutes);
  const deliveryLocation = extractTimelineValue(notes, "Address") ?? extractTimelineValue(notes, "Location") ?? "Delivery address saved with this order.";
  const deliveryNote = extractTimelineValue(notes, "Customer note");
  const gps = extractTimelineValue(notes, "GPS");
  const distance = extractTimelineValue(notes, "Distance");
  const latestUpdate = getLatestCustomerUpdate(notes);
  const statusCopy = getStatusCopy(order.status, placedAt, eta);
  const reviewItems = getReviewItems(order.items);
  const reviewedProductIds = new Set(order.reviews.map((review) => review.productId));
  const pendingReviewItems = reviewItems.filter((item) => !reviewedProductIds.has(item.productId));
  const canCustomerCancel = order.status === "NEW" || order.status === "PENDING_PAYMENT";
  const payment = order.payments[0];
  const paymentSummary = getPaymentSummary(payment);
  const whatsappLink = `https://wa.me/${restaurantSettings.whatsappNumber}?text=${encodeURIComponent(`I need help with order ${order.orderNumber}`)}`;

  return (
    <>
      <OrderTrackAutoRefresh status={order.status} />
      <main className="min-h-screen bg-[#fff4f5] text-charcoal">
        <div className="mx-auto min-h-screen max-w-[430px] bg-[#fffafa] shadow-[0_24px_80px_rgba(34,31,32,0.14)] lg:max-w-5xl lg:bg-white">
          <div className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[#efe1e5] bg-white/96 px-5 backdrop-blur">
            <Link href="/orders" className="grid h-10 w-10 place-items-center rounded-full bg-white text-charcoal shadow-sm ring-1 ring-[#eadfe3]" aria-label="Back to orders">
              <ArrowLeft size={20} strokeWidth={2.5} />
            </Link>
            <h1 className="text-[18px] font-black text-charcoal">Track order</h1>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#fff4f5] text-maroon ring-1 ring-[#f1dce1]">
              <Navigation size={19} strokeWidth={2.5} />
            </span>
          </div>

          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:p-6">
            <div className="min-w-0">
              <section className={`relative overflow-hidden rounded-b-[30px] px-5 pb-6 pt-5 lg:rounded-[26px] ${palette.hero}`}>
                <div className={`absolute -right-12 -top-12 h-40 w-40 rounded-full ${palette.orbLarge}`} />
                <div className={`absolute right-6 top-24 h-16 w-16 rounded-full ${palette.orbSmall}`} />
                <div className="relative flex items-start justify-between gap-5">
                  <div className="min-w-0">
                    <p className={`text-[12px] font-black ${palette.eyebrow}`}>Order {order.orderNumber}</p>
                    <h2 className={`mt-3 max-w-[260px] text-[34px] font-black leading-[0.98] sm:text-[38px] ${palette.title}`}>
                      {cancelled ? "Order cancelled" : statusCopy.title}
                    </h2>
                    <p className={`mt-3 max-w-[285px] text-[13px] font-bold leading-5 ${palette.body}`}>
                      {cancelled ? "This order was cancelled. You can reorder the same dishes whenever you are ready." : statusCopy.body}
                    </p>
                  </div>
                  <div className={`relative grid h-[78px] w-[78px] shrink-0 place-items-center rounded-[24px] wt-track-float ${palette.iconBox}`}>
                    {!cancelled ? <span className={`absolute inset-[-7px] rounded-[28px] border wt-track-pulse ${palette.pulse}`} /> : null}
                    <IconGlyph icon={currentIcon} size={36} strokeWidth={2.6} />
                  </div>
                </div>

                {!cancelled ? (
                  <div className="relative mt-7">
                    <StatusIconStrip steps={visibleSteps} activeIndex={activeIndex} cancelled={cancelled} palette={palette} inHero />
                  </div>
                ) : null}
              </section>

              <section className="px-5 pt-5 lg:px-0">
                <div className="overflow-hidden rounded-[22px] bg-white shadow-sm ring-1 ring-[#eadfe3]">
                  <InfoRow icon={User} title="Customer" body={`${order.customer.name} | ${order.customer.mobile}`} />
                  <InfoRow icon={MapPin} title="Delivery details" body={deliveryLocation} subBody={[deliveryNote, gps, distance].filter(Boolean).join(" | ")} />
                  <InfoRow icon={Wallet} title="Payment" body={paymentSummary} subBody={payment ? `Payment status: ${formatStatus(payment.status)}` : "Cash will be collected on delivery."} />
                </div>

                {latestUpdate ? (
                  <div className={`mt-4 rounded-[22px] border p-4 text-sm font-bold leading-5 ${palette.notice}`}>
                    <p>{latestUpdate}</p>
                  </div>
                ) : null}

                <section className="mt-5 rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-[#f1dce1]">
                  <h2 className="text-[16px] font-black text-charcoal">Live progress</h2>
                  <div className="mt-4 grid gap-2.5">
                    {visibleSteps.map((step, index) => {
                      const event = getStepEvent(order.timeline, step.status);
                      const done = !cancelled && index <= activeIndex;
                      const active = !cancelled && index === activeIndex;

                      return (
                        <div key={step.status} className="grid grid-cols-[34px_minmax(0,1fr)] gap-2.5">
                          <div className="grid justify-items-center">
                            <span className={`grid h-8 w-8 place-items-center rounded-xl ${done ? palette.stepDone : "bg-[#f4f5f8] text-muted"} ${active ? "wt-step-active" : ""}`}>
                              <IconGlyph icon={step.icon} size={15} strokeWidth={2.6} />
                            </span>
                            {index < visibleSteps.length - 1 ? <span className={`mt-1.5 h-6 w-0.5 rounded-full ${done ? palette.lineDone : "bg-[#e5e7eb]"}`} /> : null}
                          </div>
                          <div className={`min-w-0 rounded-[14px] px-3 py-2.5 ${active ? palette.stepActive : "bg-[#f7f8fb]"}`}>
                            <div className="flex items-start justify-between gap-3">
                              <span className="min-w-0">
                                <span className="block text-[13px] font-black text-charcoal">{step.label}</span>
                              </span>
                              <span className="shrink-0 text-[11px] font-black text-maroon">
                                {event ? formatIstTime(toIsoTimestamp(event.createdAt)) : done ? "Done" : "Soon"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </section>
            </div>

            <aside className="px-5 pb-28 pt-5 lg:px-0 lg:pb-0 lg:pt-0">
              <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-[#eadfe3] lg:sticky lg:top-24">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-[19px] font-black text-charcoal">Order details</h2>
                  <span className="rounded-full bg-[#effaf4] px-3 py-1 text-[12px] font-black text-[#0f7a45]">{formatRupees(order.grandTotal)}</span>
                </div>

                <div className="mt-4 grid gap-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-2xl bg-[#f7f8fb] px-3 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-black text-charcoal">{item.name}</span>
                        <span className="mt-1 block text-[12px] font-bold text-muted">Qty {item.quantity}</span>
                      </span>
                      <span className="text-[14px] font-black text-maroon">{formatRupees(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 border-t border-[#edf0f5] pt-4">
                  <div className="flex items-center justify-between text-[15px] font-black">
                    <span>Total paid/payable</span>
                    <span>{formatRupees(order.grandTotal)}</span>
                  </div>
                  <p className="mt-1 text-[12px] font-bold leading-5 text-muted">{paymentSummary}</p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <a href={`tel:${restaurantSettings.supportPhone}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#eadfe3] bg-white text-[14px] font-black text-maroon">
                    <Phone size={17} /> Call
                  </a>
                  <a href={whatsappLink} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-maroon text-[14px] font-black text-white">
                    <MessageCircle size={17} /> Chat
                  </a>
                </div>
                <OrderReorderButton
                  items={order.items}
                  className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#23262f] px-5 text-[15px] font-black text-white"
                />
                {canCustomerCancel ? <CustomerOrderCancelButton orderNumber={order.orderNumber} /> : null}
              </section>

              {order.status === "DELIVERED" && pendingReviewItems.length ? (
                <section className="mt-5 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-[#eadfe3]">
                  <h2 className="flex items-center gap-2 text-lg font-black text-charcoal">
                    <Star className="text-maroon" size={19} /> Rate your meal
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                    Your feedback helps Wah Thali serve you better next time.
                  </p>
                  {pendingReviewItems.map((item) => (
                    <OrderReviewForm
                      key={item.productId}
                      orderNumber={order.orderNumber}
                      productId={item.productId}
                      productName={item.name}
                    />
                  ))}
                </section>
              ) : null}
            </aside>
          </div>
        </div>
      </main>
      <MobileNav />
    </>
  );
}

function StatusIconStrip({
  steps,
  activeIndex,
  cancelled,
  palette,
  inHero = false,
}: {
  steps: TrackerStep[];
  activeIndex: number;
  cancelled: boolean;
  palette: ReturnType<typeof getTrackingPalette>;
  inHero?: boolean;
}) {
  return (
    <div className={`overflow-hidden rounded-[16px] px-2.5 py-2.5 ring-1 ${
      inHero ? "bg-white/82 shadow-sm ring-white/70 backdrop-blur" : "bg-white shadow-sm ring-[#eadfe3]"
    }`}>
      <div className="flex w-full items-center">
        {steps.map((step, index) => {
          const done = !cancelled && index <= activeIndex;
          const active = !cancelled && index === activeIndex;

          return (
            <div key={step.status} className={`flex min-w-0 items-center ${index < steps.length - 1 ? "flex-1" : "shrink-0"}`}>
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                done ? palette.stepDone : "bg-[#f4f5f8] text-muted"
              } ${active ? "wt-step-active" : ""}`}
                title={step.label}
                aria-label={step.label}
              >
                <IconGlyph icon={step.icon} size={14} strokeWidth={2.7} />
              </span>
              {index < steps.length - 1 ? <span className={`mx-1.5 h-0.5 min-w-2 flex-1 rounded-full ${done ? palette.lineDone : "bg-[#e5e7eb]"}`} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  title,
  body,
  subBody,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  subBody?: string;
}) {
  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 border-b border-[#edf0f5] px-4 py-4 last:border-b-0">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#fff4f5] text-maroon">
        <IconGlyph icon={icon} size={18} strokeWidth={2.6} />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-black text-charcoal">{title}</span>
        <span className="mt-1 block text-[13px] font-bold leading-5 text-muted">{body}</span>
        {subBody ? <span className="mt-1 block text-[12px] font-bold leading-5 text-charcoal">{subBody}</span> : null}
      </span>
    </div>
  );
}

function IconGlyph({
  icon: Icon,
  size,
  strokeWidth,
}: {
  icon: LucideIcon;
  size: number;
  strokeWidth: number;
}) {
  return <Icon size={size} strokeWidth={strokeWidth} />;
}

function getVisibleSteps(status: string, paymentProvider?: string): TrackerStep[] {
  if (status === "PENDING_PAYMENT" || paymentProvider === "RAZORPAY") {
    return [...orderSteps];
  }

  return orderSteps.filter((step) => step.status !== "PENDING_PAYMENT");
}

function getActiveStepIndex(status: string, steps: TrackerStep[]) {
  const normalizedStatus = status === "READY_FOR_PICKUP" ? "PACKED" : status;
  const index = steps.findIndex((step) => step.status === normalizedStatus);
  return Math.max(index, 0);
}

function getHeroIcon(status: string, fallback: LucideIcon) {
  if (status === "READY_FOR_PICKUP") return PackageCheck;
  return fallback;
}

function getStepEvent(timeline: { toStatus: string; note?: string | null; createdAt: Date }[], status: string) {
  if (status === "PACKED") {
    return timeline.find((item) => item.toStatus === "PACKED" || item.toStatus === "READY_FOR_PICKUP");
  }

  return timeline.find((item) => item.toStatus === status);
}

function getReviewItems(items: { productId: string; name: string }[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.productId)) return false;
    seen.add(item.productId);
    return true;
  });
}

function toIsoTimestamp(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function extractTimelineValue(notes: string[], label: string) {
  const joined = notes.join(" | ");
  const labels = ["Receiver", "Address", "Address type", "Customer note", "Location", "GPS", "Distance", "ETA", "Coupon"];
  const nextLabels = labels.filter((item) => item !== label).join("|");
  const pattern = new RegExp(`${label}:\\s*(.*?)(?=\\s(?:${nextLabels}):|\\sCoupon\\s|\\s\\|\\s|$)`, "i");
  return joined.match(pattern)?.[1]?.trim().replace(/[.]$/, "");
}

function formatEta(value: string | undefined, fallbackMinutes: number) {
  if (!value) return `${fallbackMinutes} min`;
  return /\bmin/i.test(value) ? value : `${value} min`;
}

function getLatestCustomerUpdate(notes: string[]) {
  const clean = [...notes].reverse().map(cleanTimelineNote).find((note) => {
    if (!note) return false;
    return !/^Order created/i.test(note) && !/^Order auto accepted/i.test(note) && !/^Razorpay payment verified/i.test(note);
  });

  return clean;
}

function cleanTimelineNote(note: string) {
  const labels = "ETA|Location|GPS|Distance|Address|Address type|Receiver|Customer note";
  const fieldPattern = new RegExp(`(?:^|\\s)(?:${labels}):\\s*.*?(?=\\s(?:${labels}):|\\s\\|\\s|$)`, "gi");

  return note
    .split("|")
    .map((part) => part.replace(fieldPattern, "").trim())
    .filter(Boolean)
    .join(" | ");
}

function getStatusCopy(status: string, placedAt: string, eta: string) {
  switch (status) {
    case "PENDING_PAYMENT":
      return { title: "Payment pending", body: "Complete payment to send this order to the kitchen." };
    case "NEW":
      return { title: "We got your order", body: `Placed at ${placedAt}. The kitchen will accept it shortly.` };
    case "CONFIRMED":
      return { title: "Kitchen accepted", body: `Fresh preparation is queued. Expected in about ${eta}.` };
    case "PREPARING":
      return { title: "Cooking fresh now", body: `Your food is being prepared hot. Expected in about ${eta}.` };
    case "PACKED":
      return { title: "Packed and ready", body: "Your meal has been packed neatly and is waiting for dispatch." };
    case "READY_FOR_PICKUP":
      return { title: "Ready for pickup", body: "Your order is ready. Please collect it while it is fresh." };
    case "OUT_FOR_DELIVERY":
      return { title: "On the way", body: "Your order has left the kitchen and is heading to you." };
    case "DELIVERED":
      return { title: "Delivered", body: "Enjoy your meal. A quick rating helps us serve you better." };
    default:
      return { title: formatStatus(status), body: "We are updating your order live." };
  }
}

function getTrackingPalette(status: string) {
  if (status === "PENDING_PAYMENT") {
    return {
      hero: "bg-[#fff7e8] text-[#4b2b00] ring-1 ring-[#f6d999]",
      title: "text-[#4b2b00]",
      body: "text-[#77510c]",
      eyebrow: "text-[#9a5b00]",
      iconBox: "bg-white/70 text-[#9a5b00] ring-1 ring-[#f6d999]",
      pulse: "border-[#f0b44d]/45",
      progressLabel: "text-[#7a4100]",
      progressTrack: "bg-[#f5dfae]",
      progressBar: "bg-[#f59e0b]",
      notice: "border-[#f6d999] bg-[#fffaf0] text-[#7a4100]",
      stepDone: "bg-[#f59e0b] text-white",
      lineDone: "bg-[#f59e0b]/35",
      stepActive: "bg-[#fff7e8] ring-1 ring-[#f6d999]",
      orbLarge: "bg-[#f7c453]/28",
      orbSmall: "bg-white/58",
    };
  }

  if (status === "CONFIRMED") {
    return {
      hero: "bg-[#eef3ff] text-[#172554] ring-1 ring-[#cad7ff]",
      title: "text-[#172554]",
      body: "text-[#334b85]",
      eyebrow: "text-[#1e3a8a]",
      iconBox: "bg-white/72 text-[#2563eb] ring-1 ring-[#cad7ff]",
      pulse: "border-[#9db5f7]/55",
      progressLabel: "text-[#1e3a8a]",
      progressTrack: "bg-[#dbe5ff]",
      progressBar: "bg-[#2563eb]",
      notice: "border-[#cad7ff] bg-[#f6f8ff] text-[#1e3a8a]",
      stepDone: "bg-[#2563eb] text-white",
      lineDone: "bg-[#2563eb]/35",
      stepActive: "bg-[#eef3ff] ring-1 ring-[#cad7ff]",
      orbLarge: "bg-[#9db5f7]/28",
      orbSmall: "bg-white/60",
    };
  }

  if (status === "PREPARING") {
    return {
      hero: "bg-[#fff4df] text-[#4a2800] ring-1 ring-[#ffd08a]",
      title: "text-[#4a2800]",
      body: "text-[#85520c]",
      eyebrow: "text-[#a95d00]",
      iconBox: "bg-white/72 text-[#d97706] ring-1 ring-[#ffd08a]",
      pulse: "border-[#f6b44b]/55",
      progressLabel: "text-[#8a4b00]",
      progressTrack: "bg-[#ffe2ae]",
      progressBar: "bg-[#d97706]",
      notice: "border-[#ffd08a] bg-[#fff8ec] text-[#8a4b00]",
      stepDone: "bg-[#d97706] text-white",
      lineDone: "bg-[#d97706]/35",
      stepActive: "bg-[#fff4df] ring-1 ring-[#ffd08a]",
      orbLarge: "bg-[#f59e0b]/22",
      orbSmall: "bg-white/58",
    };
  }

  if (status === "PACKED" || status === "READY_FOR_PICKUP") {
    return {
      hero: "bg-[#e8fffb] text-[#0f3f3c] ring-1 ring-[#b7e5dd]",
      title: "text-[#0f3f3c]",
      body: "text-[#22635e]",
      eyebrow: "text-[#115e59]",
      iconBox: "bg-white/72 text-[#0f766e] ring-1 ring-[#b7e5dd]",
      pulse: "border-[#88c8c0]/55",
      progressLabel: "text-[#115e59]",
      progressTrack: "bg-[#c9f3eb]",
      progressBar: "bg-[#0f766e]",
      notice: "border-[#b7e5dd] bg-[#f2fffc] text-[#115e59]",
      stepDone: "bg-[#0f766e] text-white",
      lineDone: "bg-[#0f766e]/35",
      stepActive: "bg-[#ecfffb] ring-1 ring-[#b7e5dd]",
      orbLarge: "bg-[#88c8c0]/28",
      orbSmall: "bg-white/58",
    };
  }

  if (status === "OUT_FOR_DELIVERY") {
    return {
      hero: "bg-[#e7f5ff] text-[#0b315f] ring-1 ring-[#b9ddff]",
      title: "text-[#0b315f]",
      body: "text-[#285f95]",
      eyebrow: "text-[#1769c2]",
      iconBox: "bg-white/72 text-[#1769c2] ring-1 ring-[#b9ddff]",
      pulse: "border-[#8bc7ff]/55",
      progressLabel: "text-[#1769c2]",
      progressTrack: "bg-[#cdeaff]",
      progressBar: "bg-[#1769c2]",
      notice: "border-[#b9ddff] bg-[#f3faff] text-[#1769c2]",
      stepDone: "bg-[#1769c2] text-white",
      lineDone: "bg-[#1769c2]/35",
      stepActive: "bg-[#e7f5ff] ring-1 ring-[#b9ddff]",
      orbLarge: "bg-[#8bc7ff]/28",
      orbSmall: "bg-white/60",
    };
  }

  if (status === "DELIVERED") {
    return {
      hero: "bg-[#effaf4] text-[#0b3d25] ring-1 ring-[#c7ecd2]",
      title: "text-[#0b3d25]",
      body: "text-[#2c6344]",
      eyebrow: "text-[#0f7a45]",
      iconBox: "bg-white/72 text-[#16a34a] ring-1 ring-[#c7ecd2]",
      pulse: "border-[#a8d8b8]/55",
      progressLabel: "text-[#0f7a45]",
      progressTrack: "bg-[#d4f0dd]",
      progressBar: "bg-[#16a34a]",
      notice: "border-[#c7ecd2] bg-[#f5fff8] text-[#0f7a45]",
      stepDone: "bg-[#16a34a] text-white",
      lineDone: "bg-[#16a34a]/35",
      stepActive: "bg-[#effaf4] ring-1 ring-[#c7ecd2]",
      orbLarge: "bg-[#a8d8b8]/28",
      orbSmall: "bg-white/60",
    };
  }

  if (status === "CANCELLED") {
    return {
      hero: "bg-[#eef2f7] text-[#253244] ring-1 ring-[#d8dde7]",
      title: "text-[#253244]",
      body: "text-[#475569]",
      eyebrow: "text-[#64748b]",
      iconBox: "bg-white/72 text-[#64748b] ring-1 ring-[#d8dde7]",
      pulse: "border-[#c8cdd7]/55",
      progressLabel: "text-[#475569]",
      progressTrack: "bg-[#d8dde7]",
      progressBar: "bg-[#64748b]",
      notice: "border-[#d8dde7] bg-[#f8fafc] text-[#475569]",
      stepDone: "bg-[#64748b] text-white",
      lineDone: "bg-[#64748b]/35",
      stepActive: "bg-[#eef2f7] ring-1 ring-[#d8dde7]",
      orbLarge: "bg-[#c8cdd7]/36",
      orbSmall: "bg-white/60",
    };
  }

  return {
    hero: "bg-[#fff4f5] text-[#4a0012] ring-1 ring-[#f1dce1]",
    title: "text-[#4a0012]",
    body: "text-[#7b2338]",
    eyebrow: "text-maroon",
    iconBox: "bg-white/72 text-maroon ring-1 ring-[#f1dce1]",
    pulse: "border-maroon/30",
    progressLabel: "text-maroon",
    progressTrack: "bg-[#f2cbd4]",
    progressBar: "bg-maroon",
    notice: "border-[#f1dce1] bg-[#fff8f9] text-maroon",
    stepDone: "bg-maroon text-white",
    lineDone: "bg-maroon/35",
    stepActive: "bg-[#fff4f5] ring-1 ring-[#f1dce1]",
    orbLarge: "bg-[#f5a3b6]/25",
    orbSmall: "bg-white/58",
  };
}

function getPaymentSummary(payment?: { provider: string; status: string }) {
  if (!payment) return "Cash on Delivery";
  if (payment.provider === "COD") {
    return payment.status === "COD_COLLECTED" ? "Cash collected" : "Cash on Delivery";
  }
  if (payment.status === "PAID" || payment.status === "AUTHORIZED") return "Online payment received";
  if (payment.status === "FAILED") return "Online payment failed";
  return "Online payment pending";
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
