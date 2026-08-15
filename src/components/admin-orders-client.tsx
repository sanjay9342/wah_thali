"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BellRing, CheckCircle2, Clock, MessageCircle, Printer, RefreshCw, XCircle } from "lucide-react";
import { AdminSectionNav } from "@/components/admin-section-nav";
import type { AdminOrder, OrderStatus } from "@/lib/types";
import { formatRupees } from "@/lib/pricing";
import { canTransitionOrder } from "@/lib/state-machines";

const liveStatuses: OrderStatus[] = ["NEW", "CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"];
const nextStatuses: OrderStatus[] = ["CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"];
const declineReasons = [
  "Item unavailable",
  "Kitchen closed for today",
  "Delivery not available for this location",
  "Too many orders right now",
  "Payment or address issue",
];

const statusCopy: Record<OrderStatus, { label: string; customer: string }> = {
  PENDING_PAYMENT: { label: "Payment pending", customer: "Your payment is still pending." },
  NEW: { label: "New", customer: "We received your order." },
  CONFIRMED: { label: "Accepted", customer: "Good news, your order has been accepted." },
  PREPARING: { label: "Preparing", customer: "Your food is being prepared fresh." },
  PACKED: { label: "Prepared", customer: "Your food is prepared and packed." },
  READY_FOR_PICKUP: { label: "Ready", customer: "Your order is ready for pickup." },
  OUT_FOR_DELIVERY: { label: "Dispatched", customer: "Your order is on the way." },
  DELIVERED: { label: "Delivered", customer: "Your order has been delivered. Please rate your food." },
  CANCELLED: { label: "Declined", customer: "Your order was declined by the restaurant." },
};

export function AdminOrdersClient({
  initialOrders,
  newOrderSoundEnabled = true,
  requireDeclineReason = true,
}: {
  initialOrders: AdminOrder[];
  newOrderSoundEnabled?: boolean;
  requireDeclineReason?: boolean;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [declineOrder, setDeclineOrder] = useState<AdminOrder | null>(null);
  const [reason, setReason] = useState("");
  const [etaByOrder, setEtaByOrder] = useState<Record<string, string>>({});
  const [locationByOrder, setLocationByOrder] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();
  const knownOrders = useRef(new Set(initialOrders.map((order) => order.orderNumber)));

  const newOrders = orders.filter((order) => order.status === "NEW");

  const playNewOrderSound = useCallback(async () => {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audio = new AudioContextClass();
    for (const [index, frequency] of [784, 988, 1175, 988, 1319].entries()) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = index % 2 ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      gain.connect(audio.destination);
      gain.gain.setValueAtTime(0.0001, audio.currentTime + index * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.24, audio.currentTime + index * 0.13 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + index * 0.13 + 0.11);
      oscillator.start(audio.currentTime + index * 0.13);
      oscillator.stop(audio.currentTime + index * 0.13 + 0.12);
    }
  }, []);

  const refresh = useCallback(async (silent = false) => {
    const response = await fetch("/api/orders", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      if (!silent) setMessage(data.error ?? "Could not refresh orders.");
      return false;
    }

    const nextOrders: AdminOrder[] = data.orders.map((order: {
      orderNumber: string;
      customer: { name: string; mobile: string };
      status: OrderStatus;
      grandTotal: number;
      items: { quantity: number; name: string }[];
      payments: { provider: string; status: string }[];
      createdAt: string;
      timeline: { toStatus: string; note?: string | null; createdAt: string }[];
    }) => ({
      orderNumber: order.orderNumber,
      customerName: order.customer.name,
      customerMobile: order.customer.mobile,
      status: order.status,
      amount: order.grandTotal,
      itemSummary: order.items.map((item) => `${item.quantity} x ${item.name}`).join(", "),
      paymentSummary: order.payments[0]?.status ? `${order.payments[0].provider} ${order.payments[0].status}` : "COD pending",
      createdAt: order.createdAt,
      timeline: order.timeline,
    }));

    const hasNewOrder = nextOrders.some((order) => !knownOrders.current.has(order.orderNumber) && order.status === "NEW");
    setOrders(nextOrders);
    knownOrders.current = new Set(nextOrders.map((order) => order.orderNumber));
    setLastSyncedAt(new Date());
    if (hasNewOrder && newOrderSoundEnabled) await playNewOrderSound();
    return true;
  }, [newOrderSoundEnabled, playNewOrderSound]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refresh(true);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  function updateOrder(order: AdminOrder, status: OrderStatus, note?: string) {
    startTransition(async () => {
      setMessage("");
      const eta = etaByOrder[order.orderNumber]?.trim();
      const location = locationByOrder[order.orderNumber]?.trim();
      const staffNote = [note, eta ? `ETA: ${eta} min` : "", location ? `Location: ${location}` : ""].filter(Boolean).join(" | ");
      const response = await fetch(`/api/orders/${order.orderNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: staffNote }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Order update failed.");
        return;
      }
      await refresh(true);
      setDeclineOrder(null);
      setReason("");
      setMessage(status === "CANCELLED" ? "Order declined, stock restored, and customer tracking shows the reason." : `Order moved to ${statusCopy[status].label}.`);
    });
  }

  function handleRefresh() {
    startTransition(async () => {
      setMessage("");
      const refreshed = await refresh(false);
      if (refreshed) setMessage("Kitchen board refreshed from live orders.");
    });
  }

  const counters = useMemo(
    () => ["PENDING_PAYMENT", "NEW", "CONFIRMED", "PREPARING"].map((status) => [status, orders.filter((order) => order.status === status).length]),
    [orders],
  );

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black uppercase tracking-widest text-red">Kitchen board</p>
            <h1 className="text-3xl font-black text-maroon">Orders</h1>
            <p className="mt-1 text-sm font-semibold text-muted">
              Accept, decline with reason, prepare, pack, dispatch, and mark delivered.
              {lastSyncedAt ? ` Last synced ${lastSyncedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={isPending} onClick={handleRefresh} className="inline-flex h-11 min-w-36 items-center justify-center gap-2 rounded-lg bg-maroon px-4 font-black text-white disabled:opacity-60">
              <RefreshCw size={18} className={isPending ? "animate-spin" : ""} /> {isPending ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
        <AdminSectionNav />

        {newOrders.length ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-red/20 bg-red/10 px-4 py-3 font-black text-maroon">
            <BellRing size={18} /> {newOrders.length} new order{newOrders.length > 1 ? "s" : ""} waiting for accept or decline
          </div>
        ) : null}
        {message ? <p className="mt-4 rounded-lg border border-border bg-cream px-4 py-3 text-sm font-black text-maroon">{message}</p> : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {counters.map(([status, count]) => (
            <div key={String(status)} className="surface rounded-2xl p-5">
              <p className="text-sm font-bold text-muted">{String(status).replaceAll("_", " ")}</p>
              <p className="mt-2 text-3xl font-black text-maroon">{count}</p>
              <p className="mt-1 text-xs font-bold text-muted">Live queue</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-4">
          {orders.length ? orders.map((order) => (
            <article key={order.orderNumber} className="surface rounded-2xl p-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black text-maroon">{order.orderNumber}</h2>
                    <span className="rounded-lg bg-cream px-3 py-1 text-xs font-black text-charcoal">{statusCopy[order.status].label}</span>
                  </div>
                  <p className="mt-1 font-black text-charcoal">{order.customerName} - {order.customerMobile}</p>
                  <p className="mt-1 text-sm font-semibold text-muted">{order.itemSummary || "Items unavailable"} - {formatRupees(order.amount)}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold text-muted">
                    <span className="inline-flex items-center gap-1"><Clock size={16} /> {new Date(order.createdAt).toLocaleString("en-IN")}</span>
                    <span>{order.paymentSummary}</span>
                  </div>
                  {order.timeline.at(-1)?.note ? <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-sm font-bold text-muted">Note: {order.timeline.at(-1)?.note}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black">
                    <Printer size={16} /> KOT
                  </button>
                  <a href={`https://wa.me/91${order.customerMobile}?text=${encodeURIComponent(buildCustomerMessage(order, order.status))}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black">
                    <MessageCircle size={16} /> Message
                  </a>
                </div>
              </div>
              <div className="mt-4 grid gap-3 rounded-xl border border-border bg-cream p-3 sm:grid-cols-2">
                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-muted">
                  Order timing
                  <input
                    type="number"
                    min={1}
                    value={etaByOrder[order.orderNumber] ?? ""}
                    onChange={(event) => setEtaByOrder((current) => ({ ...current, [order.orderNumber]: event.target.value }))}
                    className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-black normal-case tracking-normal text-charcoal"
                    placeholder="ETA minutes"
                  />
                </label>
                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-muted">
                  Delivery location / rider note
                  <input
                    value={locationByOrder[order.orderNumber] ?? ""}
                    onChange={(event) => setLocationByOrder((current) => ({ ...current, [order.orderNumber]: event.target.value }))}
                    className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-black normal-case tracking-normal text-charcoal"
                    placeholder="Rider, area, or map note"
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {order.status === "NEW" ? (
                  <>
                    <button disabled={isPending} onClick={() => updateOrder(order, "CONFIRMED", "Restaurant accepted the order.")} className="inline-flex items-center gap-2 rounded-lg bg-maroon px-3 py-2 text-xs font-black text-white">
                      <CheckCircle2 size={15} /> Accept
                    </button>
                    <button disabled={isPending} onClick={() => setDeclineOrder(order)} className="inline-flex items-center gap-2 rounded-lg bg-red px-3 py-2 text-xs font-black text-white">
                      <XCircle size={15} /> Decline
                    </button>
                  </>
                ) : null}
                {nextStatuses.map((next) => {
                  const canMove = canTransitionOrder(order.status, next);
                  return (
                    <button
                      key={next}
                      disabled={isPending || !liveStatuses.includes(order.status) || !canMove}
                      onClick={() => updateOrder(order, next)}
                      className={`rounded-lg px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60 ${canMove ? "bg-maroon text-white" : "bg-cream text-muted"}`}
                    >
                      {statusCopy[next].label}
                    </button>
                  );
                })}
              </div>
            </article>
          )) : (
            <div className="surface rounded-2xl p-8 text-center">
              <h2 className="text-xl font-black text-maroon">No live orders yet</h2>
              <p className="mt-2 text-sm font-semibold text-muted">New customer orders will appear here with a sound alert.</p>
            </div>
          )}
        </section>
      </div>

      {declineOrder ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-charcoal/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-xl font-black text-maroon">Decline {declineOrder.orderNumber}</h2>
            <label className="mt-4 grid gap-2 text-sm font-black text-charcoal">
              Reason
              <select value={reason} onChange={(event) => setReason(event.target.value)} className="h-11 rounded-lg border border-border bg-cream px-3">
                <option value="">Select reason</option>
                {declineReasons.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeclineOrder(null)} className="h-10 rounded-lg border border-border px-4 font-black">Cancel</button>
              <button
                disabled={isPending || (requireDeclineReason && !reason.trim())}
                onClick={() => updateOrder(declineOrder, "CANCELLED", reason.trim() || "Order declined by restaurant.")}
                className="h-10 rounded-lg bg-red px-4 font-black text-white disabled:opacity-60"
              >
                Decline order
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function buildCustomerMessage(order: AdminOrder, status: OrderStatus) {
  const latestNote = order.timeline.at(-1)?.note;
  const ratingText = status === "DELIVERED" ? " Thank you for ordering from Wah Thali. Please give your rating for the food, it helps us serve you better." : "";
  const reasonText = status === "CANCELLED" && latestNote ? ` Reason: ${latestNote}` : "";
  return `Hi ${order.customerName}, ${statusCopy[status].customer} Order ${order.orderNumber}: ${statusCopy[status].label}.${reasonText}${ratingText}`;
}
