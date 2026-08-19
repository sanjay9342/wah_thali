import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  ChefHat,
  Clock,
  CookingPot,
  CreditCard,
  MapPin,
  MessageCircle,
  Navigation,
  PackageCheck,
  Phone,
  ReceiptText,
  RotateCcw,
  Sparkles,
  Star,
  Timer,
  User,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MobileNav } from "@/components/mobile-nav";
import { OrderReviewForm } from "@/components/order-review-form";
import { OrderReorderButton } from "@/components/order-reorder-button";
import { getRestaurantSettingsFromDb } from "@/lib/db";
import { formatRupees } from "@/lib/pricing";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

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
  const progress = cancelled ? 0 : Math.round(((activeIndex + 1) / visibleSteps.length) * 100);
  const placedAt = order.createdAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const placedDate = order.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const eta = formatEta(extractTimelineValue(notes, "ETA"), restaurantSettings.defaultPrepMinutes);
  const deliveryLocation = extractTimelineValue(notes, "Address") ?? extractTimelineValue(notes, "Location") ?? "Delivery address saved with this order.";
  const deliveryNote = extractTimelineValue(notes, "Customer note");
  const gps = extractTimelineValue(notes, "GPS");
  const distance = extractTimelineValue(notes, "Distance");
  const latestUpdate = getLatestCustomerUpdate(notes);
  const statusCopy = getStatusCopy(order.status, placedAt, eta);
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  const payment = order.payments[0];
  const paymentSummary = getPaymentSummary(payment);
  const whatsappLink = `https://wa.me/${restaurantSettings.whatsappNumber}?text=${encodeURIComponent(`I need help with order ${order.orderNumber}`)}`;

  return (
    <>
      <main className="min-h-screen bg-[#efeaf3] text-charcoal">
        <div className="mx-auto min-h-screen max-w-[430px] bg-[#f7f8fb] shadow-[0_24px_80px_rgba(34,31,32,0.14)] lg:max-w-5xl lg:bg-white">
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
              <section className={`relative overflow-hidden rounded-b-[30px] px-5 pb-6 pt-5 text-white lg:rounded-[26px] ${cancelled ? "bg-[#3f4652]" : "bg-[#a50027]"}`}>
                <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/12" />
                <div className="absolute right-6 top-24 h-16 w-16 rounded-full bg-[#f5a3b6]/18" />
                <div className="relative flex items-start justify-between gap-5">
                  <div className="min-w-0">
                    <p className="text-[12px] font-black text-white/76">Order {order.orderNumber}</p>
                    <h2 className="mt-3 max-w-[260px] text-[34px] font-black leading-[0.98] sm:text-[38px]">
                      {cancelled ? "Order cancelled" : statusCopy.title}
                    </h2>
                    <p className="mt-3 max-w-[285px] text-[13px] font-bold leading-5 text-white/86">
                      {cancelled ? "This order was cancelled. You can reorder the same dishes whenever you are ready." : statusCopy.body}
                    </p>
                  </div>
                  <div className="relative grid h-[78px] w-[78px] shrink-0 place-items-center rounded-[24px] bg-white/16 ring-1 ring-white/20 wt-track-float">
                    {!cancelled ? <span className="absolute inset-[-7px] rounded-[28px] border border-white/18 wt-track-pulse" /> : null}
                    <IconGlyph icon={currentIcon} size={36} strokeWidth={2.6} />
                  </div>
                </div>

                {!cancelled ? (
                  <div className="relative mt-7">
                    <div className="flex items-center justify-between text-[12px] font-black text-white/78">
                      <span>{currentStep.label}</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/22">
                      <div className="h-full rounded-full bg-white wt-track-progress" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${visibleSteps.length}, minmax(0, 1fr))` }}>
                      {visibleSteps.map((step, index) => (
                        <span key={step.status} className={`h-1.5 rounded-full ${index <= activeIndex ? "bg-white" : "bg-white/22"}`} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="px-5 pt-5 lg:px-0">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MetricCard icon={Timer} label="ETA" value={eta} tone="rose" />
                  <MetricCard icon={Sparkles} label="Items" value={`${itemCount} ${itemCount === 1 ? "item" : "items"}`} tone="blue" />
                  <MetricCard icon={Clock} label="Placed" value={placedAt} subValue={placedDate} tone="amber" />
                  <MetricCard icon={ReceiptText} label="Total" value={formatRupees(order.grandTotal)} tone="green" />
                </div>

                <div className="mt-4 overflow-hidden rounded-[22px] bg-white shadow-sm ring-1 ring-[#eadfe3]">
                  <InfoRow icon={User} title="Customer" body={`${order.customer.name} | ${order.customer.mobile}`} />
                  <InfoRow icon={MapPin} title="Delivery details" body={deliveryLocation} subBody={[deliveryNote, gps, distance].filter(Boolean).join(" | ")} />
                  <InfoRow icon={Wallet} title="Payment" body={paymentSummary} subBody={payment ? `Payment status: ${formatStatus(payment.status)}` : "Cash will be collected on delivery."} />
                </div>

                {latestUpdate ? (
                  <div className="mt-4 rounded-[22px] border border-[#f1dce1] bg-[#fff8f9] p-4 text-sm font-bold leading-5 text-maroon">
                    <p>{latestUpdate}</p>
                  </div>
                ) : null}

                <section className="mt-5 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-[#eadfe3]">
                  <h2 className="text-[19px] font-black text-charcoal">Live progress</h2>
                  <div className="mt-5 grid gap-3">
                    {visibleSteps.map((step, index) => {
                      const event = getStepEvent(order.timeline, step.status);
                      const done = !cancelled && index <= activeIndex;
                      const active = !cancelled && index === activeIndex;

                      return (
                        <div key={step.status} className="grid grid-cols-[42px_minmax(0,1fr)] gap-3">
                          <div className="grid justify-items-center">
                            <span className={`grid h-10 w-10 place-items-center rounded-2xl ${done ? "bg-maroon text-white" : "bg-[#f4f5f8] text-muted"} ${active ? "wt-step-active" : ""}`}>
                              <IconGlyph icon={step.icon} size={18} strokeWidth={2.6} />
                            </span>
                            {index < visibleSteps.length - 1 ? <span className={`mt-2 h-8 w-0.5 rounded-full ${done ? "bg-maroon/40" : "bg-[#e5e7eb]"}`} /> : null}
                          </div>
                          <div className={`min-w-0 rounded-[18px] px-4 py-3 ${active ? "bg-[#fff4f5] ring-1 ring-[#f1dce1]" : "bg-[#f7f8fb]"}`}>
                            <div className="flex items-start justify-between gap-3">
                              <span className="min-w-0">
                                <span className="block text-[15px] font-black text-charcoal">{step.label}</span>
                              </span>
                              <span className="shrink-0 text-[12px] font-black text-maroon">
                                {event ? event.createdAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : done ? "Done" : "Soon"}
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
                <Link href="/menu" className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#fff4f5] px-5 text-[15px] font-black text-maroon ring-1 ring-[#f1dce1]">
                  <RotateCcw size={17} /> Browse menu
                </Link>
              </section>

              {order.status === "DELIVERED" && order.items[0] ? (
                <section className="mt-5 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-[#eadfe3]">
                  <h2 className="flex items-center gap-2 text-lg font-black text-charcoal">
                    <Star className="text-maroon" size={19} /> Rate your meal
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                    Your feedback helps Wah Thali serve you better next time.
                  </p>
                  <OrderReviewForm orderNumber={order.orderNumber} productId={order.items[0].productId} productName={order.items[0].name} />
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

function MetricCard({
  icon,
  label,
  value,
  subValue,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  subValue?: string;
  tone: "rose" | "blue" | "amber" | "green";
}) {
  const tones = {
    rose: "bg-[#fff4f5] text-maroon",
    blue: "bg-[#eef6ff] text-[#1769c2]",
    amber: "bg-[#fff7e8] text-[#9a5b00]",
    green: "bg-[#effaf4] text-[#0f7a45]",
  };

  return (
    <div className="min-w-0 rounded-[20px] bg-white p-4 shadow-sm ring-1 ring-[#eadfe3]">
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}>
        <IconGlyph icon={icon} size={18} strokeWidth={2.6} />
      </span>
      <p className="mt-3 text-[12px] font-black text-muted">{label}</p>
      <p className="mt-1 truncate text-[18px] font-black leading-tight text-charcoal">{value}</p>
      {subValue ? <p className="mt-0.5 text-[11px] font-bold text-muted">{subValue}</p> : null}
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
