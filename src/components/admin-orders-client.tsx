"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BellRing, CheckCircle2, Clock, MapPin, MessageCircle, Printer, ReceiptText, RefreshCw, Timer, UserRound, Utensils, XCircle } from "lucide-react";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { business } from "@/lib/business";
import type { AdminOrder, OrderStatus } from "@/lib/types";
import { formatRupees } from "@/lib/pricing";
import { canTransitionOrder } from "@/lib/state-machines";

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

const actionCopy: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "Accept order",
  PREPARING: "Start preparing",
  PACKED: "Mark prepared",
  READY_FOR_PICKUP: "Ready for pickup",
  OUT_FOR_DELIVERY: "Dispatch",
  DELIVERED: "Mark delivered",
  CANCELLED: "Decline",
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

  const incomingOrders = orders.filter((order) => order.status === "NEW" || order.status === "PENDING_PAYMENT");

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

  const notifyAdmin = useCallback((order: AdminOrder) => {
    document.title = `New order ${order.orderNumber} - Wah Thali Admin`;
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`New order ${order.orderNumber}`, {
        body: `${order.customerName} - ${formatRupees(order.amount)} - ${order.itemSummary}`,
      });
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
      subtotal: number;
      discount: number;
      gst: number;
      grandTotal: number;
      items: { quantity: number; name: string; price: number }[];
      payments: { provider: string; status: string }[];
      createdAt: string;
      timeline: { toStatus: string; note?: string | null; createdAt: string }[];
    }) => ({
      orderNumber: order.orderNumber,
      customerName: order.customer.name,
      customerMobile: order.customer.mobile,
      status: order.status,
      subtotal: order.subtotal,
      discount: order.discount,
      gst: order.gst,
      amount: order.grandTotal,
      items: order.items.map((item) => ({ name: item.name, quantity: item.quantity, price: item.price })),
      itemSummary: order.items.map((item) => `${item.quantity} x ${item.name}`).join(", "),
      paymentSummary: getPaymentSummary(order.payments[0]),
      createdAt: order.createdAt,
      timeline: order.timeline,
    }));

    const newIncoming = nextOrders.find((order) => !knownOrders.current.has(order.orderNumber) && (order.status === "NEW" || order.status === "PENDING_PAYMENT"));
    setOrders(nextOrders);
    knownOrders.current = new Set(nextOrders.map((order) => order.orderNumber));
    setLastSyncedAt(new Date());
    if (newIncoming) {
      notifyAdmin(newIncoming);
      if (newOrderSoundEnabled) await playNewOrderSound();
    }
    return true;
  }, [newOrderSoundEnabled, notifyAdmin, playNewOrderSound]);

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
      setOrders((current) => current.map((item) => item.orderNumber === order.orderNumber ? {
        ...item,
        status,
        timeline: data.order?.timeline ?? item.timeline,
      } : item));
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

  async function enableDesktopAlerts() {
    if (!("Notification" in window)) {
      setMessage("This browser does not support desktop notifications.");
      return;
    }

    const permission = await Notification.requestPermission();
    setMessage(permission === "granted" ? "Desktop order notifications enabled." : "Desktop notifications were not enabled.");
  }

  function printBill(order: AdminOrder) {
    const details = getOrderDetails(order);
    const rows = order.items.map((item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${formatRupees(item.price)}</td>
        <td class="num">${formatRupees(item.price * item.quantity)}</td>
      </tr>
    `).join("");
    const win = window.open("", "_blank", "width=420,height=720");
    if (!win) {
      setMessage("Popup blocked. Please allow popups to print the bill.");
      return;
    }

    win.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${order.orderNumber} bill</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 18px; color: #111; }
            h1, h2, p { margin: 0; }
            .center { text-align: center; }
            .muted { color: #555; font-size: 12px; line-height: 1.45; }
            .rule { border-top: 1px dashed #999; margin: 12px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { padding: 6px 0; border-bottom: 1px solid #eee; text-align: left; vertical-align: top; }
            .num { text-align: right; }
            .total { font-weight: 800; font-size: 16px; }
            .box { border: 1px solid #ddd; padding: 8px; border-radius: 8px; margin-top: 8px; }
            @media print { body { padding: 0; } button { display: none; } }
          </style>
        </head>
        <body>
          <div class="center">
            <h1>${business.brandName}</h1>
            <p class="muted">${business.legalName}</p>
            <p class="muted">${business.address}</p>
            <p class="muted">GSTIN: ${business.gstin} | Phone: ${business.phone}</p>
          </div>
          <div class="rule"></div>
          <p><strong>Order:</strong> ${order.orderNumber}</p>
          <p><strong>Customer:</strong> ${escapeHtml(order.customerName)} (${order.customerMobile})</p>
          <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString("en-IN")}</p>
          <p><strong>Payment:</strong> ${escapeHtml(order.paymentSummary)}</p>
          ${details.address ? `<div class="box"><strong>Delivery:</strong><br>${escapeHtml(details.address)}${details.gps ? `<br>GPS: ${escapeHtml(details.gps)}` : ""}</div>` : ""}
          ${details.customerNote ? `<div class="box"><strong>Restaurant note:</strong><br>${escapeHtml(details.customerNote)}</div>` : ""}
          <div class="rule"></div>
          <table>
            <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amt</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="rule"></div>
          <table>
            <tr><td>Subtotal</td><td class="num">${formatRupees(order.subtotal)}</td></tr>
            <tr><td>Discount</td><td class="num">-${formatRupees(order.discount)}</td></tr>
            <tr><td>GST</td><td class="num">${formatRupees(order.gst)}</td></tr>
            <tr class="total"><td>Total payable</td><td class="num">${formatRupees(order.amount)}</td></tr>
          </table>
          <div class="rule"></div>
          <p class="center"><strong>Thank you for ordering from ${business.brandName}.</strong></p>
          <p class="center muted">Fresh homely meals, made with care.</p>
          <button onclick="window.print()" style="margin-top:16px;width:100%;height:40px;font-weight:800">Print bill</button>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
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
            <button type="button" onClick={enableDesktopAlerts} className="inline-flex h-11 min-w-36 items-center justify-center gap-2 rounded-lg border border-border px-4 font-black text-maroon">
              <BellRing size={18} /> Alerts
            </button>
            <button disabled={isPending} onClick={handleRefresh} className="inline-flex h-11 min-w-36 items-center justify-center gap-2 rounded-lg bg-maroon px-4 font-black text-white disabled:opacity-60">
              <RefreshCw size={18} className={isPending ? "animate-spin" : ""} /> {isPending ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
        <AdminSectionNav />

        {incomingOrders.length ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-red/20 bg-red/10 px-4 py-3 font-black text-maroon">
            <BellRing size={18} /> {incomingOrders.length} incoming order{incomingOrders.length > 1 ? "s" : ""} waiting for attention
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
              {(() => {
                const details = getOrderDetails(order);
                return (
                  <>
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
                  {details.customerNote ? <p className="mt-3 rounded-lg bg-[#fff4f5] px-3 py-2 text-sm font-black text-maroon">Customer note: {details.customerNote}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button onClick={() => printBill(order)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black">
                    <Printer size={16} /> Print bill
                  </button>
                  <a href={`https://wa.me/91${order.customerMobile}?text=${encodeURIComponent(buildCustomerMessage(order, order.status))}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black">
                    <MessageCircle size={16} /> Message
                  </a>
                </div>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-4">
                <div className="rounded-xl bg-cream p-3">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted"><UserRound size={15} /> Receiver</p>
                  <p className="mt-2 text-sm font-black text-charcoal">{details.receiver || `${order.customerName}, ${order.customerMobile}`}</p>
                </div>
                <div className="rounded-xl bg-cream p-3 lg:col-span-2">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted"><MapPin size={15} /> Delivery location</p>
                  <p className="mt-2 text-sm font-black leading-5 text-charcoal">{details.address || details.location || "Location not provided"}</p>
                  {details.gps ? <p className="mt-1 text-xs font-bold text-muted">GPS: {details.gps}</p> : null}
                </div>
                <div className="rounded-xl bg-cream p-3">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted"><ReceiptText size={15} /> Bill</p>
                  <p className="mt-2 text-sm font-black text-charcoal">Subtotal {formatRupees(order.subtotal)}</p>
                  <p className="mt-1 text-xs font-bold text-muted">GST {formatRupees(order.gst)} | Discount {formatRupees(order.discount)}</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-white p-3 ring-1 ring-border">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted"><Utensils size={15} /> Items</p>
                <div className="mt-2 grid gap-2">
                  {order.items.map((item) => (
                    <div key={`${order.orderNumber}-${item.name}`} className="flex items-center justify-between rounded-lg bg-cream px-3 py-2 text-sm">
                      <span className="font-black text-charcoal">{item.quantity} x {item.name}</span>
                      <span className="font-black text-maroon">{formatRupees(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid gap-3 rounded-xl border border-border bg-cream p-3 sm:grid-cols-2">
                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-muted">
                  <span className="flex items-center gap-2"><Timer size={15} /> Order timing</span>
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
                  <span className="flex items-center gap-2"><MapPin size={15} /> Rider note</span>
                  <input
                    value={locationByOrder[order.orderNumber] ?? ""}
                    onChange={(event) => setLocationByOrder((current) => ({ ...current, [order.orderNumber]: event.target.value }))}
                    className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-black normal-case tracking-normal text-charcoal"
                    placeholder="Rider, area, or map note"
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {getNextOrderActions(order.status).map((next) => (
                  next === "CANCELLED" ? (
                    <button key={next} disabled={isPending} onClick={() => setDeclineOrder(order)} className="inline-flex items-center gap-2 rounded-lg bg-red px-4 py-2 text-xs font-black text-white disabled:opacity-60">
                      <XCircle size={15} /> {actionCopy[next]}
                    </button>
                  ) : (
                    <button key={next} disabled={isPending} onClick={() => updateOrder(order, next, next === "CONFIRMED" ? "Restaurant accepted the order." : undefined)} className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2 text-xs font-black text-white disabled:opacity-60">
                      <CheckCircle2 size={15} /> {actionCopy[next] ?? statusCopy[next].label}
                    </button>
                  )
                ))}
                {!getNextOrderActions(order.status).length ? (
                  <span className="rounded-lg bg-cream px-4 py-2 text-xs font-black text-muted">No further status action</span>
                ) : null}
              </div>
                  </>
                );
              })()}
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

function getNextOrderActions(status: OrderStatus): OrderStatus[] {
  return (["CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"] as OrderStatus[])
    .filter((next) => canTransitionOrder(status, next));
}

function getPaymentSummary(payment?: { provider: string; status: string }) {
  if (!payment) return "Cash on Delivery";
  if (payment.provider === "COD") return "Cash on Delivery";
  if (payment.status === "PAID" || payment.status === "AUTHORIZED") return "Online payment received";
  if (payment.status === "CREATED") return "Online payment pending";
  return "Online payment";
}

function getOrderDetails(order: AdminOrder) {
  const parts = order.timeline.flatMap((event) => (event.note ?? "").split("|").map((part) => part.trim()).filter(Boolean));
  return {
    receiver: readPart(parts, "Receiver"),
    address: readPart(parts, "Address"),
    addressType: readPart(parts, "Address type"),
    customerNote: readPart(parts, "Customer note"),
    location: readPart(parts, "Location"),
    gps: readPart(parts, "GPS"),
    distance: readPart(parts, "Distance"),
  };
}

function readPart(parts: string[], label: string) {
  const prefix = `${label}:`;
  return parts.find((part) => part.toLowerCase().startsWith(prefix.toLowerCase()))?.slice(prefix.length).trim() ?? "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
