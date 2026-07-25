"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BellRing, CheckCircle2, Clock, MessageCircle, Printer, RefreshCw, Truck, XCircle } from "lucide-react";
import Link from "next/link";
import type { AdminOrder, OrderStatus } from "@/lib/types";
import { formatRupees } from "@/lib/pricing";
import { canTransitionOrder } from "@/lib/state-machines";

const liveStatuses: OrderStatus[] = ["NEW", "CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"];
const nextStatuses: OrderStatus[] = ["CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"];

export function AdminOrdersClient({ initialOrders }: { initialOrders: AdminOrder[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [declineOrder, setDeclineOrder] = useState<AdminOrder | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();
  const knownOrders = useRef(new Set(initialOrders.map((order) => order.orderNumber)));

  const newOrders = orders.filter((order) => order.status === "NEW");

  const playNewOrderSound = useCallback(async () => {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audio = new AudioContextClass();
    for (const [index, frequency] of [880, 988, 1175].entries()) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      gain.connect(audio.destination);
      gain.gain.setValueAtTime(0.0001, audio.currentTime + index * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.2, audio.currentTime + index * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + index * 0.16 + 0.13);
      oscillator.start(audio.currentTime + index * 0.16);
      oscillator.stop(audio.currentTime + index * 0.16 + 0.14);
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
    if (hasNewOrder) await playNewOrderSound();
    return true;
  }, [playNewOrderSound]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refresh(true);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  function updateOrder(order: AdminOrder, status: OrderStatus, note?: string) {
    startTransition(async () => {
      setMessage("");
      const response = await fetch(`/api/orders/${order.orderNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Order update failed.");
        return;
      }
      await refresh(true);
      setDeclineOrder(null);
      setReason("");
      setMessage(status === "CANCELLED" ? "Order declined and stock restored." : `Order moved to ${status.replaceAll("_", " ")}.`);
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
    () => ["NEW", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY"].map((status) => [status, orders.filter((order) => order.status === status).length]),
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
            <Link href="/admin" className="inline-flex h-11 items-center rounded-lg border border-border px-4 font-black">Dashboard</Link>
            <button disabled={isPending} onClick={handleRefresh} className="inline-flex h-11 min-w-36 items-center justify-center gap-2 rounded-lg bg-maroon px-4 font-black text-white disabled:opacity-60">
              <RefreshCw size={18} className={isPending ? "animate-spin" : ""} /> {isPending ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

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
                    <span className="rounded-lg bg-cream px-3 py-1 text-xs font-black text-charcoal">{order.status.replaceAll("_", " ")}</span>
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
                  <a href={`https://wa.me/91${order.customerMobile}?text=${encodeURIComponent(`Hi ${order.customerName}, your Wah Thali order ${order.orderNumber} is ${order.status.replaceAll("_", " ")}.`)}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black">
                    <MessageCircle size={16} /> Message
                  </a>
                  <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-red px-3 text-sm font-black text-white">
                    <Truck size={16} /> Assign rider
                  </button>
                </div>
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
                {nextStatuses.map((next) => (
                  <button
                    key={next}
                    disabled={isPending || !liveStatuses.includes(order.status)}
                    onClick={() => updateOrder(order, next)}
                    className={`rounded-lg px-3 py-2 text-xs font-black ${canTransitionOrder(order.status, next) ? "bg-maroon text-white" : "bg-cream text-muted"}`}
                  >
                    {next.replaceAll("_", " ")}
                  </button>
                ))}
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
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-28 rounded-lg border border-border bg-cream p-3" placeholder="Item unavailable, kitchen closed, delivery not possible..." />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeclineOrder(null)} className="h-10 rounded-lg border border-border px-4 font-black">Cancel</button>
              <button disabled={isPending || !reason.trim()} onClick={() => updateOrder(declineOrder, "CANCELLED", reason)} className="h-10 rounded-lg bg-red px-4 font-black text-white disabled:opacity-60">Decline order</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
