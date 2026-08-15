import { ArrowLeft, Bike, CheckCircle2, Clock, CookingPot, MapPin, MessageCircle, Navigation, PackageCheck, Phone, Star, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { OrderReviewForm } from "@/components/order-review-form";
import { getRestaurantSettingsFromDb } from "@/lib/db";
import { formatRupees } from "@/lib/pricing";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const steps = [
  ["NEW", "Placed", CheckCircle2],
  ["CONFIRMED", "Accepted", CheckCircle2],
  ["PREPARING", "Preparing", CookingPot],
  ["PACKED", "Prepared", PackageCheck],
  ["OUT_FOR_DELIVERY", "Dispatched", Bike],
  ["DELIVERED", "Delivered", Clock],
] as const;

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
      timeline: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!order) notFound();

  const activeIndex = Math.max(0, steps.findIndex(([status]) => status === order.status));
  const placedAt = order.createdAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const latestNote = order.timeline.at(-1)?.note;
  const eta = latestNote?.match(/ETA:\s*([^|]+)/i)?.[1]?.trim();
  const locationNote = latestNote?.match(/Location:\s*([^|]+)/i)?.[1]?.trim();
  const cancelled = order.status === "CANCELLED";

  return (
    <>
      <Header whatsappNumber={restaurantSettings.whatsappNumber} />
      <main className="mx-auto w-full max-w-[430px] px-5 pb-32 pt-5 sm:max-w-4xl sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/orders" className="grid h-10 w-10 place-items-center rounded-full bg-white text-charcoal shadow-sm ring-1 ring-border" aria-label="Back to orders">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-black text-charcoal">Track order</h1>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-red/10 text-red">
            <Navigation size={20} />
          </span>
        </div>

        <section className="mt-5 overflow-hidden rounded-[28px] bg-white shadow-[0_14px_34px_rgba(34,31,32,0.08)] ring-1 ring-border">
          <div className="relative min-h-44 overflow-hidden bg-gradient-to-br from-maroon to-red p-5 text-white">
            <div className="absolute bottom-4 right-4 grid h-16 w-16 place-items-center rounded-full bg-white/15">
              {cancelled ? <XCircle size={34} /> : <Bike size={34} />}
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-white/70">{order.orderNumber}</p>
            <h2 className="mt-2 text-3xl font-black">{cancelled ? "Order declined" : order.status.replaceAll("_", " ")}</h2>
            <p className="mt-2 max-w-56 text-sm font-bold text-white/80">
              {cancelled ? "The restaurant has declined this order." : `Placed at ${placedAt}. We are preparing your order status live from the database.`}
            </p>
            {!cancelled ? (
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(((activeIndex + 1) / steps.length) * 100, 100)}%` }} />
              </div>
            ) : null}
          </div>

          <div className="p-5">
            {latestNote ? (
              <div className="mb-5 rounded-2xl border border-red/15 bg-[#fff8f9] p-4 text-sm font-bold text-maroon">
                <p>{cleanTimelineNote(latestNote)}</p>
                {eta ? <p className="mt-2 text-charcoal">Estimated time: {eta} minutes</p> : null}
                {locationNote ? <p className="mt-1 text-charcoal">Delivery note: {locationNote}</p> : null}
              </div>
            ) : null}
            <div className="rounded-2xl bg-cream p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-red">
                  <MapPin size={20} />
                </span>
                <div>
                  <p className="font-black text-charcoal">Customer</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-muted">
                    {order.customer.name} | {order.customer.mobile}
                  </p>
                </div>
              </div>
            </div>

            {!cancelled ? <div className="mt-5 space-y-4">
              {steps.map(([status, label, Icon], index) => {
                const event = order.timeline.find((item) => item.toStatus === status);
                const done = index <= activeIndex;
                return (
                  <div key={status} className="grid grid-cols-[36px_1fr] gap-3">
                    <div className="relative grid justify-items-center">
                      <span className={`z-10 grid h-9 w-9 place-items-center rounded-xl ${done ? "bg-red text-white" : "bg-cream text-muted"}`}>
                        <Icon size={17} />
                      </span>
                      {index < steps.length - 1 ? <span className="absolute top-9 h-full w-px bg-border" /> : null}
                    </div>
                    <div className="pb-1">
                      <p className="font-black text-charcoal">{label}</p>
                      <p className="text-sm font-semibold text-muted">
                        {event ? event.createdAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : done ? "Done" : "Pending"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div> : null}
          </div>
        </section>

        <section className="mt-5 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-border">
          <h2 className="text-lg font-black text-charcoal">Order summary</h2>
          <div className="mt-3 grid gap-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl bg-cream px-3 py-2 text-sm">
                <span className="font-bold text-charcoal">{item.quantity} x {item.name}</span>
                <span className="font-black text-maroon">{formatRupees(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4 font-black">
            <span>Total</span>
            <span>{formatRupees(order.grandTotal)}</span>
          </div>
          <div className="mt-4 flex gap-2">
            <a href={`tel:${restaurantSettings.supportPhone}`} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border font-black text-maroon">
              <Phone size={17} /> Call
            </a>
            <a href={`https://wa.me/${restaurantSettings.whatsappNumber}`} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red font-black text-white">
              <MessageCircle size={17} /> Chat
            </a>
          </div>
        </section>
        {order.status === "DELIVERED" && order.items[0] ? (
          <section className="mt-5 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-border">
            <h2 className="flex items-center gap-2 text-lg font-black text-charcoal">
              <Star className="text-maroon" size={19} /> Thank you for ordering
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              Please give your rating for the food. Your feedback helps Wah Thali serve you better.
            </p>
            <OrderReviewForm orderNumber={order.orderNumber} productId={order.items[0].productId} productName={order.items[0].name} />
          </section>
        ) : null}
      </main>
      <MobileNav />
    </>
  );
}

function cleanTimelineNote(note: string) {
  return note
    .split("|")
    .map((part) => part.trim())
    .filter((part) => !/^ETA:/i.test(part) && !/^Location:/i.test(part))
    .join(" | ");
}
