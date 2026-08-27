import { CheckCircle2, MessageCircle, ReceiptText, RotateCcw } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { getRestaurantSettingsFromDb } from "@/lib/db";
import { getOrderFulfillmentDetails } from "@/lib/order-fulfillment";
import { formatRupees } from "@/lib/pricing";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ConfirmedPage({
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

  const fulfillmentDetails = getOrderFulfillmentDetails(order.timeline);
  const paymentSummary = getPaymentSummary(order.payments[0], fulfillmentDetails.isPickup);

  return (
    <>
      <Header whatsappNumber={restaurantSettings.whatsappNumber} />
      <main className="mx-auto max-w-4xl px-5 pb-24 pt-8 sm:px-6 lg:px-8">
        <section className="surface rounded-2xl p-6 text-center">
          <CheckCircle2 className="mx-auto text-maroon" size={56} />
          <h1 className="mt-4 text-3xl font-black text-maroon">Order confirmed</h1>
          <p className="mt-2 text-muted">
            Order {order.orderNumber} is saved for {order.customer.name}.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-cream p-4">
              <p className="text-sm text-muted">{fulfillmentDetails.isPickup ? "Pickup" : "ETA"}</p>
              <p className="text-xl font-black">{fulfillmentDetails.isPickup ? "Self pickup" : `${restaurantSettings.defaultPrepMinutes} min`}</p>
            </div>
            <div className="rounded-xl bg-cream p-4">
              <p className="text-sm text-muted">Payment</p>
              <p className="text-xl font-black">{paymentSummary}</p>
            </div>
            <div className="rounded-xl bg-cream p-4">
              <p className="text-sm text-muted">Total</p>
              <p className="text-xl font-black">{formatRupees(order.grandTotal)}</p>
            </div>
          </div>
          {fulfillmentDetails.isPickup ? (
            <p className="mx-auto mt-4 max-w-md rounded-xl bg-[#effaf4] px-4 py-3 text-sm font-black text-[#0f7a45]">
              Self pickup selected - no delivery charge added.
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href={`/order/${order.orderNumber}/track`} className="inline-flex h-12 items-center gap-2 rounded-lg bg-red px-5 font-black text-white">
              <ReceiptText size={18} /> Track order
            </Link>
            <Link href="/menu" className="inline-flex h-12 items-center gap-2 rounded-lg border border-border bg-white px-5 font-black">
              <RotateCcw size={18} /> Order again
            </Link>
            <a
              href={`https://wa.me/${restaurantSettings.whatsappNumber}?text=${encodeURIComponent(`I need help with order ${order.orderNumber}`)}`}
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-border bg-white px-5 font-black text-maroon"
            >
              <MessageCircle size={18} /> WhatsApp support
            </a>
          </div>
        </section>
      </main>
      <MobileNav />
    </>
  );
}

function getPaymentSummary(payment?: { provider: string; status: string }, isPickup = false) {
  if (!payment) return isPickup ? "Cash at pickup" : "Cash on Delivery";
  if (payment.provider === "COD") return isPickup ? "Cash at pickup" : "Cash on Delivery";
  if (payment.status === "REFUND_PENDING") return "Refund pending";
  if (payment.status === "PARTIALLY_REFUNDED") return "Partially refunded";
  if (payment.status === "REFUNDED") return "Refunded";
  if (payment.status === "PAID" || payment.status === "AUTHORIZED") return "Online payment received";
  return "Online payment pending";
}
