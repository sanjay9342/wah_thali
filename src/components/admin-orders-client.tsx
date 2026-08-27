"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, BellRing, CalendarDays, CheckCircle2, Clock, Filter, Mail, MapPin, MessageCircle, Printer, ReceiptText, RefreshCw, Star, Timer, Trash2, UserRound, Utensils, XCircle } from "lucide-react";
import { useAdminAccess } from "@/components/admin-access-gate";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { business } from "@/lib/business";
import { adminFetch } from "@/lib/admin-client-auth";
import type { AdminOrder, OrderStatus } from "@/lib/types";
import { formatRupees } from "@/lib/pricing";
import { canTransitionOrder } from "@/lib/state-machines";
import { formatIstDateTime, formatIstTime, getIstDateInputValue } from "@/lib/time";
import { getOrderFulfillmentDetails, getStoredOrderChargeAmount, getStoredOrderChargeLabel } from "@/lib/order-fulfillment";

type DateFilter = "all" | "today" | "yesterday" | "week";
type PriceFilter = "all" | "under500" | "500to1000" | "above1000";
type StatusFilter = "all" | "incoming" | "active" | "completed" | "declined";

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
  CANCELLED: { label: "Cancelled", customer: "Your order was cancelled." },
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

const incomingStatuses = new Set<OrderStatus>(["NEW", "PENDING_PAYMENT"]);
const activeStatuses = new Set<OrderStatus>(["CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"]);
const deliveryProgressStatuses: OrderStatus[] = ["NEW", "CONFIRMED", "PREPARING", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"];
const pickupProgressStatuses: OrderStatus[] = ["NEW", "CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "DELIVERED"];
const RESET_CONFIRMATION_TEXT = "RESET ORDERS";
const orderAlertsUpdatedEvent = "wah-thali-admin-orders-updated";

export function AdminOrdersClient({
  initialOrders,
  defaultPrepMinutes = 25,
  requireDeclineReason = true,
}: {
  initialOrders: AdminOrder[];
  defaultPrepMinutes?: number;
  requireDeclineReason?: boolean;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [declineOrder, setDeclineOrder] = useState<AdminOrder | null>(null);
  const [reason, setReason] = useState("");
  const [etaByOrder, setEtaByOrder] = useState<Record<string, string>>({});
  const [locationByOrder, setLocationByOrder] = useState<Record<string, string>>({});
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [message, setMessage] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetAcknowledged, setResetAcknowledged] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState<AdminOrder | null>(null);
  const [cancelledOrderAlert, setCancelledOrderAlert] = useState<AdminOrder | null>(null);
  const [animatedOrderNumbers, setAnimatedOrderNumbers] = useState<Set<string>>(() => new Set());
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();
  const adminAccess = useAdminAccess();
  const knownOrders = useRef(new Set(initialOrders.map((order) => order.orderNumber)));
  const orderStatusByNumber = useRef(new Map(initialOrders.map((order) => [order.orderNumber, order.status])));
  const newOrderTimers = useRef<number[]>([]);
  const canResetOrders = adminAccess?.permissions.includes("settings") ?? false;
  const resetIsConfirmed = resetAcknowledged && resetConfirmation.trim().toUpperCase() === RESET_CONFIRMATION_TEXT;

  const incomingOrders = orders.filter((order) => order.status === "NEW" || order.status === "PENDING_PAYMENT");
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => (
      matchesStatusFilter(order, statusFilter) &&
      matchesDateFilter(order, dateFilter, dateRange) &&
      matchesPriceFilter(order, priceFilter)
    ));
  }, [dateFilter, dateRange, orders, priceFilter, statusFilter]);

  const notifyAdmin = useCallback((order: AdminOrder) => {
    const details = getOrderDetails(order);
    const fulfillmentLabel = details.isPickup ? "Self pickup" : "Delivery";

    document.title = `New order ${order.orderNumber} - Wah Thali Admin`;
    if ("Notification" in window && Notification.permission === "granted") {
      const notification = new Notification(`New order ${order.orderNumber}`, {
        body: `${fulfillmentLabel} - ${order.customerName} - ${formatRupees(order.amount)} - ${order.itemSummary}`,
        tag: `wah-thali-${order.orderNumber}`,
      });
      notification.onclick = () => {
        window.focus();
        window.location.href = `/admin/orders#order-${order.orderNumber}`;
      };
    }
  }, []);

  const notifyAdminCancellation = useCallback((order: AdminOrder) => {
    document.title = `Cancelled ${order.orderNumber} - Wah Thali Admin`;
    if ("Notification" in window && Notification.permission === "granted") {
      const notification = new Notification(`Order cancelled ${order.orderNumber}`, {
        body: `${order.customerName} - ${formatRupees(order.amount)} - ${order.itemSummary}`,
        tag: `wah-thali-cancelled-${order.orderNumber}`,
      });
      notification.onclick = () => {
        window.focus();
        window.location.href = `/admin/orders#order-${order.orderNumber}`;
      };
    }
  }, []);

  const refresh = useCallback(async (silent = false) => {
    const response = await adminFetch(adminAccess?.session, "/api/orders", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      if (!silent) setMessage(data.error ?? "Could not refresh orders.");
      return false;
    }

    const nextOrders: AdminOrder[] = data.orders.map((order: {
      orderNumber: string;
      customer: { name: string; mobile: string; email?: string | null };
      reviews?: { id: string; rating: number; comment?: string | null; createdAt: string; product?: { name?: string } }[];
      status: OrderStatus;
      subtotal: number;
      discount: number;
      gst: number;
      grandTotal: number;
      items: { productId?: string; quantity: number; name: string; price: number }[];
      payments: { provider: string; status: string; amount: number; providerPaymentId?: string | null }[];
      createdAt: string;
      timeline: { toStatus: string; note?: string | null; createdAt: string }[];
    }) => ({
      orderNumber: order.orderNumber,
      customerName: order.customer.name,
      customerMobile: order.customer.mobile,
      customerEmail: order.customer.email ?? undefined,
      status: order.status,
      subtotal: order.subtotal,
      discount: order.discount,
      gst: order.gst,
      amount: order.grandTotal,
      items: order.items.map((item) => ({ productId: item.productId, name: item.name, quantity: item.quantity, price: item.price })),
      itemSummary: order.items.map((item) => `${item.quantity} x ${item.name}`).join(", "),
      payments: order.payments.map((payment) => ({
        provider: payment.provider,
        status: payment.status,
        amount: payment.amount,
        providerPaymentId: payment.providerPaymentId,
      })),
      paymentSummary: getPaymentSummary(order.payments[0]),
      createdAt: order.createdAt,
      timeline: order.timeline,
      reviews: order.reviews?.map((review) => ({
        id: review.id,
        productName: review.product?.name ?? "Dish",
        rating: review.rating,
        comment: review.comment ?? undefined,
        createdAt: review.createdAt,
      })) ?? [],
    }));

    const newIncomingOrders = nextOrders.filter((order) => !knownOrders.current.has(order.orderNumber) && incomingStatuses.has(order.status));
    const newIncoming = newIncomingOrders[0];
    const newlyCancelledOrders = nextOrders.filter((order) => order.status === "CANCELLED" && orderStatusByNumber.current.get(order.orderNumber) !== "CANCELLED");
    const newlyCancelled = newlyCancelledOrders[0];
    setOrders(nextOrders);
    knownOrders.current = new Set(nextOrders.map((order) => order.orderNumber));
    orderStatusByNumber.current = new Map(nextOrders.map((order) => [order.orderNumber, order.status]));
    setLastSyncedAt(new Date());
    if (newIncoming) {
      setNewOrderAlert(newIncoming);
      setAnimatedOrderNumbers((current) => {
        const next = new Set(current);
        newIncomingOrders.forEach((order) => next.add(order.orderNumber));
        return next;
      });
      const highlightTimer = window.setTimeout(() => {
        setAnimatedOrderNumbers((current) => {
          const next = new Set(current);
          newIncomingOrders.forEach((order) => next.delete(order.orderNumber));
          return next;
        });
      }, 22000);
      const toastTimer = window.setTimeout(() => setNewOrderAlert(null), 9000);
      newOrderTimers.current.push(highlightTimer, toastTimer);
      notifyAdmin(newIncoming);
    }
    if (newlyCancelled) {
      setCancelledOrderAlert(newlyCancelled);
      const cancelledTimer = window.setTimeout(() => setCancelledOrderAlert(null), 9000);
      newOrderTimers.current.push(cancelledTimer);
      notifyAdminCancellation(newlyCancelled);
    }
    return true;
  }, [adminAccess?.session, notifyAdmin, notifyAdminCancellation]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      refresh(true);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const timers = newOrderTimers.current;
    return () => timers.forEach((item) => window.clearTimeout(item));
  }, []);

  function updateOrder(order: AdminOrder, status: OrderStatus, note?: string) {
    startTransition(async () => {
      setMessage("");
      const eta = etaByOrder[order.orderNumber]?.trim();
      const location = locationByOrder[order.orderNumber]?.trim();
      const staffNote = [note, eta ? `ETA: ${eta} min` : "", location ? `Location: ${location}` : ""].filter(Boolean).join(" | ");
      const response = await adminFetch(adminAccess?.session, `/api/orders/${order.orderNumber}`, {
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
      window.dispatchEvent(new CustomEvent(orderAlertsUpdatedEvent, {
        detail: { orderNumber: order.orderNumber, status },
      }));
      await refresh(true);
      setDeclineOrder(null);
      setReason("");
      setMessage(status === "CANCELLED" ? "Order declined, stock restored, and customer tracking shows the reason." : `Order moved to ${statusCopy[status].label}.`);
    });
  }

  function refundOrder(order: AdminOrder) {
    const refundInfo = getRefundInfo(order);
    if (!refundInfo.canRefund) {
      setMessage(refundInfo.label);
      return;
    }

    const confirmed = window.confirm(`Refund ${formatRupees(refundInfo.amount)} to the original payment method for order ${order.orderNumber}?`);
    if (!confirmed) return;

    startTransition(async () => {
      setMessage("");
      const response = await adminFetch(adminAccess?.session, `/api/orders/${order.orderNumber}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Restaurant declined order", speed: "normal" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Refund could not be initiated.");
        return;
      }

      setOrders((current) => current.map((item) => item.orderNumber === order.orderNumber ? {
        ...item,
        payments: data.order?.payments ?? item.payments,
        paymentSummary: getPaymentSummary(data.order?.payments?.[0] ?? item.payments[0]),
        timeline: data.order?.timeline ?? item.timeline,
      } : item));
      await refresh(true);
      setMessage(`Refund initiated for ${order.orderNumber}. Razorpay refund id: ${data.refund?.id ?? "pending"}.`);
    });
  }

  function handleRefresh() {
    startTransition(async () => {
      setMessage("");
      const refreshed = await refresh(false);
      if (refreshed) setMessage("Kitchen board refreshed from live orders.");
    });
  }

  function closeResetDialog() {
    setResetDialogOpen(false);
    setResetConfirmation("");
    setResetAcknowledged(false);
  }

  function resetOrders() {
    if (!resetIsConfirmed || !canResetOrders) return;

    startTransition(async () => {
      setMessage("");
      const response = await adminFetch(adminAccess?.session, "/api/admin/orders/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: RESET_CONFIRMATION_TEXT }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Order reset failed.");
        return;
      }

      setOrders([]);
      knownOrders.current = new Set();
      orderStatusByNumber.current = new Map();
      setDateFilter("all");
      setDateRange({ from: "", to: "" });
      setPriceFilter("all");
      setStatusFilter("all");
      setNewOrderAlert(null);
      setCancelledOrderAlert(null);
      window.dispatchEvent(new CustomEvent(orderAlertsUpdatedEvent, {
        detail: { reset: true },
      }));
      closeResetDialog();
      setMessage(`Reset complete. Deleted ${data.deleted?.orders ?? 0} orders, customer order history is clear, and customer accounts were kept.`);
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
    const additionalCharges = getStoredOrderChargeAmount({
      subtotal: order.subtotal,
      discount: order.discount,
      gst: order.gst,
      grandTotal: order.amount,
    });
    const chargesLabel = getStoredOrderChargeLabel(details.isPickup);
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
          <p><strong>Date:</strong> ${formatIstDateTime(order.createdAt)}</p>
          <p><strong>Payment:</strong> ${escapeHtml(order.paymentSummary)}</p>
          ${details.address || details.pickupAddress ? `<div class="box"><strong>${details.isPickup ? "Pickup" : "Delivery"}:</strong><br>${escapeHtml(details.pickupAddress || details.address)}${details.gps ? `<br>GPS: ${escapeHtml(details.gps)}` : ""}</div>` : ""}
          ${details.customerNote ? `<div class="box"><strong>Restaurant note:</strong><br>${escapeHtml(details.customerNote)}</div>` : ""}
          <div class="rule"></div>
          <table>
            <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amt</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="rule"></div>
          <table>
            <tr><td>Subtotal</td><td class="num">${formatRupees(order.subtotal)}</td></tr>
            <tr><td>Discount${details.coupon ? ` (${escapeHtml(details.coupon)})` : ""}</td><td class="num">-${formatRupees(order.discount)}</td></tr>
            ${additionalCharges > 0 ? `<tr><td>${chargesLabel}</td><td class="num">${formatRupees(additionalCharges)}</td></tr>` : ""}
            ${details.isPickup ? `<tr><td>Delivery charge</td><td class="num">No charge</td></tr>` : ""}
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
    () => [
      ["Incoming", incomingOrders.length, "Needs attention"],
      ["Accepted", orders.filter((order) => order.status === "CONFIRMED").length, "Ready to prepare"],
      ["Preparing", orders.filter((order) => order.status === "PREPARING").length, "Kitchen active"],
      ["Filtered", filteredOrders.length, "Shown below"],
    ],
    [filteredOrders.length, incomingOrders.length, orders],
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
              {lastSyncedAt ? ` Last synced ${formatIstTime(lastSyncedAt)}.` : ""}
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

        <section className={`mt-5 overflow-hidden rounded-2xl border border-[#efd8de] bg-[#fff8f9] ${incomingOrders.length ? "wt-incoming-watch-active" : ""} ${newOrderAlert ? "wt-new-order-toast" : ""}`}>
          <div className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${incomingOrders.length ? "wt-new-order-bell bg-red text-white" : "bg-[#effaf4] text-[#0f7a45]"}`}>
                <BellRing size={21} />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-black text-maroon">Incoming order watch</h2>
                <p className="mt-1 text-sm font-bold text-muted">
                  {incomingOrders.length
                    ? `${incomingOrders.length} order${incomingOrders.length > 1 ? "s are" : " is"} waiting for accept or payment confirmation.`
                    : "No new orders waiting right now."}
                </p>
              </div>
            </div>
            {newOrderAlert ? (
              <div className="grid gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-charcoal ring-1 ring-red/25 sm:grid-cols-[1fr_auto] sm:items-center">
                <span className="min-w-0 truncate">New: {newOrderAlert.orderNumber} - {formatRupees(newOrderAlert.amount)}</span>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("incoming");
                    document.getElementById(`order-${newOrderAlert.orderNumber}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-maroon px-4 text-xs font-black text-white"
                >
                  View order
                </button>
              </div>
            ) : incomingOrders[0] ? (
              <div className="rounded-xl bg-white px-4 py-3 text-sm font-black text-charcoal ring-1 ring-[#efd8de]">
                Next: {incomingOrders[0].orderNumber} - {formatRupees(incomingOrders[0].amount)}
              </div>
            ) : null}
          </div>
        </section>
        {cancelledOrderAlert ? (
          <section className="mt-4 rounded-2xl border border-[#f2b6bc] bg-[#fff4f5] p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red text-white">
                  <XCircle size={20} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-black text-maroon">Order cancelled by customer</h2>
                  <p className="mt-1 truncate text-sm font-bold text-muted">
                    {cancelledOrderAlert.orderNumber} - {cancelledOrderAlert.customerName} - {formatRupees(cancelledOrderAlert.amount)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("declined");
                  document.getElementById(`order-${cancelledOrderAlert.orderNumber}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-maroon px-4 text-xs font-black text-white"
              >
                View cancelled order
              </button>
            </div>
          </section>
        ) : null}
        {message ? <p className="mt-4 rounded-lg border border-border bg-cream px-4 py-3 text-sm font-black text-maroon">{message}</p> : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {counters.map(([label, count, detail]) => (
            <div key={String(label)} className="surface rounded-2xl p-5">
              <p className="text-sm font-bold text-muted">{label}</p>
              <p className="mt-2 text-3xl font-black text-maroon">{count}</p>
              <p className="mt-1 text-xs font-bold text-muted">{detail}</p>
            </div>
          ))}
        </section>

        <section className="mt-5 rounded-2xl border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black text-maroon">
                <Filter size={18} className="text-red" /> Filters
              </h2>
              <p className="mt-1 text-xs font-bold text-muted">Filter orders by date, bill value, and kitchen status.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:w-[920px] lg:grid-cols-[1fr_1.6fr_1fr_1fr]">
              <FilterSelect label="Date" value={dateFilter} onChange={(value) => setDateFilter(value as DateFilter)} options={[
                ["all", "All dates"],
                ["today", "Today"],
                ["yesterday", "Yesterday"],
                ["week", "Last 7 days"],
              ]} />
              <DateRangeInputs value={dateRange} onChange={setDateRange} />
              <FilterSelect label="Price" value={priceFilter} onChange={(value) => setPriceFilter(value as PriceFilter)} options={[
                ["all", "All bills"],
                ["under500", "Below Rs 500"],
                ["500to1000", "Rs 500 - Rs 1,000"],
                ["above1000", "Above Rs 1,000"],
              ]} />
              <FilterSelect label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} options={[
                ["all", "All status"],
                ["incoming", "Incoming"],
                ["active", "Accepted active"],
                ["completed", "Delivered"],
                ["declined", "Declined"],
              ]} />
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4">
          {filteredOrders.length ? filteredOrders.map((order) => (
            <article
              id={`order-${order.orderNumber}`}
              key={order.orderNumber}
              className={`wt-order-card relative overflow-hidden rounded-2xl border p-5 shadow-sm ${getOrderCardTone(order.status).card} ${order.status === "NEW" ? "wt-new-order-blink" : ""} ${animatedOrderNumbers.has(order.orderNumber) ? "wt-new-order-arrive" : ""}`}
            >
              <div className={`absolute inset-y-0 left-0 w-2 ${getOrderCardTone(order.status).bar}`} />
              {(() => {
                const details = getOrderDetails(order);
                const tone = getOrderCardTone(order.status);
                const refundInfo = getRefundInfo(order);
                const additionalCharges = getStoredOrderChargeAmount({
                  subtotal: order.subtotal,
                  discount: order.discount,
                  gst: order.gst,
                  grandTotal: order.amount,
                });
                return (
                  <>
              <div className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2 text-xs font-black uppercase tracking-wide ${tone.banner}`}>
                <span className="inline-flex items-center gap-2">
                  {incomingStatuses.has(order.status) ? <BellRing size={15} className="wt-order-pulse" /> : null}
                  {tone.label}
                </span>
                {incomingStatuses.has(order.status) ? <span className="wt-new-order-text">{details.isPickup ? "Self pickup order" : "Needs attention now"}</span> : null}
              </div>
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black text-maroon">{order.orderNumber}</h2>
                    <span className={`rounded-lg px-3 py-1 text-xs font-black ${getStatusTone(order.status)}`}>{statusCopy[order.status].label}</span>
                  </div>
                  <p className="mt-1 font-black text-charcoal">{order.customerName} - {order.customerMobile}</p>
                  <p className="mt-1 text-sm font-semibold text-muted">{order.itemSummary || "Items unavailable"} - {formatRupees(order.amount)}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold text-muted">
                    <span className="inline-flex items-center gap-1"><Clock size={16} /> {formatIstDateTime(order.createdAt)}</span>
                    <span>{order.paymentSummary}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-muted">
                    {details.email || order.customerEmail ? (
                      <span className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 ${tone.chip}`}>
                        <Mail size={14} /> {details.email || order.customerEmail}
                      </span>
                    ) : null}
                    {details.isPickup ? <span className={`rounded-lg px-3 py-2 ${tone.chip}`}>Self pickup</span> : null}
                    {details.customerNote ? <span className={`rounded-lg px-3 py-2 ${tone.chip}`}>Customer note: {details.customerNote}</span> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button onClick={() => printBill(order)} className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-black ${tone.action}`}>
                    <Printer size={16} /> Print bill
                  </button>
                  <a href={`https://wa.me/91${order.customerMobile}?text=${encodeURIComponent(buildCustomerMessage(order, order.status))}`} className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-black ${tone.action}`}>
                    <MessageCircle size={16} /> Message
                  </a>
                  {refundInfo.visible ? (
                    <button
                      type="button"
                      onClick={() => refundOrder(order)}
                      disabled={isPending || !refundInfo.canRefund}
                      className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-black disabled:opacity-60 ${
                        refundInfo.canRefund
                          ? "border-[#a8d8b8] bg-[#effaf4] text-[#0f7a45] hover:bg-[#dff6e8]"
                          : "border-[#d8dde7] bg-white text-[#64748b]"
                      }`}
                      title={refundInfo.label}
                    >
                      <RefreshCw size={16} /> {refundInfo.label}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-4">
                <div className={`rounded-xl border p-3 ${tone.panel}`}>
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted"><UserRound size={15} /> Receiver</p>
                  <p className="mt-2 text-sm font-black text-charcoal">{details.receiver || `${order.customerName}, ${order.customerMobile}`}</p>
                </div>
                <div className={`rounded-xl border p-3 lg:col-span-2 ${tone.panel}`}>
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted"><MapPin size={15} /> {details.isPickup ? "Pickup location" : "Delivery location"}</p>
                  <p className="mt-2 text-sm font-black leading-5 text-charcoal">{details.pickupAddress || details.address || details.location || (details.gps ? `Map pin: ${details.gps}` : "Location not provided")}</p>
                  {!details.isPickup && details.gps ? (
                    <a href={`https://www.google.com/maps?q=${encodeURIComponent(details.gps)}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-xs font-black text-red">
                      Open GPS: {details.gps}
                    </a>
                  ) : null}
                </div>
                <div className={`rounded-xl border p-3 ${tone.panel}`}>
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted"><ReceiptText size={15} /> Bill</p>
                  <p className="mt-2 text-sm font-black text-charcoal">Subtotal {formatRupees(order.subtotal)}</p>
                  <p className="mt-1 text-xs font-bold text-muted">GST {formatRupees(order.gst)} | Discount {formatRupees(order.discount)}{details.coupon ? ` (${details.coupon})` : ""}</p>
                  {additionalCharges > 0 ? (
                    <p className="mt-1 text-xs font-bold text-muted">{getStoredOrderChargeLabel(details.isPickup)} {formatRupees(additionalCharges)}</p>
                  ) : null}
                  {details.isPickup ? <p className="mt-1 text-xs font-black text-[#0f7a45]">No delivery charge</p> : null}
                </div>
              </div>
              <div className={`mt-4 rounded-xl border bg-white p-3 ${tone.box}`}>
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted"><Utensils size={15} /> Items</p>
                <div className="mt-2 grid gap-2">
                  {order.items.map((item) => (
                    <div key={`${order.orderNumber}-${item.name}`} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${tone.row}`}>
                      <span className="font-black text-charcoal">{item.quantity} x {item.name}</span>
                      <span className="font-black text-maroon">{formatRupees(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {order.reviews?.length ? (
                <div className={`mt-4 rounded-xl border bg-white p-3 ${tone.box}`}>
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted"><Star size={15} /> Delivered reviews</p>
                  <div className="mt-2 grid gap-2">
                    {order.reviews.map((review) => (
                      <div key={review.id} className={`rounded-lg px-3 py-2 text-sm ${tone.row}`}>
                        <p className="font-black text-charcoal">{review.productName} - {review.rating}/5</p>
                        {review.comment ? <p className="mt-1 font-semibold text-muted">{review.comment}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className={`mt-4 grid gap-3 rounded-xl border p-3 sm:grid-cols-2 ${tone.panel}`}>
                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-muted">
                  <span className="flex items-center gap-2"><Timer size={15} /> Order timing</span>
                  <input
                    type="number"
                    min={1}
                    value={etaByOrder[order.orderNumber] ?? ""}
                    onChange={(event) => setEtaByOrder((current) => ({ ...current, [order.orderNumber]: event.target.value }))}
                    className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-black normal-case tracking-normal text-charcoal"
                    placeholder={`Default ${defaultPrepMinutes} minutes`}
                  />
                  <span className="text-[11px] font-bold normal-case tracking-normal text-muted">Leave empty to show default prep time: {defaultPrepMinutes} min.</span>
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
              <OrderStatusPanel
                order={order}
                customEta={etaByOrder[order.orderNumber]?.trim() || details.eta}
                defaultPrepMinutes={defaultPrepMinutes}
                isPickup={details.isPickup}
                isPending={isPending}
                onDecline={() => setDeclineOrder(order)}
                onMove={(next) => updateOrder(order, next, next === "CONFIRMED" ? "Restaurant accepted the order." : undefined)}
              />
                  </>
                );
              })()}
            </article>
          )) : (
            <div className="surface rounded-2xl p-8 text-center">
              <h2 className="text-xl font-black text-maroon">No orders match these filters</h2>
              <p className="mt-2 text-sm font-semibold text-muted">Change the date, price, or status filter to see more orders.</p>
            </div>
          )}
        </section>

        {canResetOrders ? (
          <section className="mt-8 rounded-2xl border border-[#f2b6bc] bg-[#fff8f9] p-5 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex min-w-0 gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-red text-white">
                  <AlertTriangle size={21} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-black text-maroon">Reset customer orders</h2>
                  <p className="mt-1 text-sm font-bold leading-6 text-muted">
                    Clears all orders, payments, order status history, item rows, and reviews. Customer accounts stay saved.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setResetDialogOpen(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red px-4 text-sm font-black text-white disabled:opacity-60"
              >
                <Trash2 size={17} /> Reset orders
              </button>
            </div>
          </section>
        ) : null}
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

      {resetDialogOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-charcoal/45 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-red text-white">
                <AlertTriangle size={22} />
              </span>
              <div>
                <h2 className="text-xl font-black text-maroon">Reset all customer orders?</h2>
                <p className="mt-2 text-sm font-bold leading-6 text-muted">
                  This permanently deletes every order and clears order history from customer accounts. Customers, addresses, products, settings, and staff access are kept.
                </p>
              </div>
            </div>

            <label className="mt-5 flex items-start gap-3 rounded-xl border border-[#f2b6bc] bg-[#fff8f9] p-3 text-sm font-bold leading-5 text-charcoal">
              <input
                type="checkbox"
                checked={resetAcknowledged}
                onChange={(event) => setResetAcknowledged(event.target.checked)}
                className="mt-1 h-4 w-4 accent-[#8d0021]"
              />
              I understand this cannot be undone from the website.
            </label>

            <label className="mt-4 grid gap-2 text-sm font-black text-charcoal">
              Type {RESET_CONFIRMATION_TEXT}
              <input
                value={resetConfirmation}
                onChange={(event) => setResetConfirmation(event.target.value)}
                className="h-11 rounded-lg border border-border bg-cream px-3 text-sm font-black uppercase tracking-wide text-charcoal"
                placeholder={RESET_CONFIRMATION_TEXT}
              />
            </label>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button onClick={closeResetDialog} className="h-10 rounded-lg border border-border px-4 font-black">Cancel</button>
              <button
                disabled={isPending || !resetIsConfirmed}
                onClick={resetOrders}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red px-4 font-black text-white disabled:opacity-60"
              >
                <Trash2 size={16} /> {isPending ? "Resetting..." : "Delete orders"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-muted">
      <span className="flex items-center gap-2"><CalendarDays size={15} /> {label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-lg border border-border bg-cream px-3 text-sm font-black normal-case tracking-normal text-charcoal"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function DateRangeInputs({
  value,
  onChange,
}: {
  value: { from: string; to: string };
  onChange: (value: { from: string; to: string }) => void;
}) {
  return (
    <div className="grid gap-2 text-xs font-black uppercase tracking-wide text-muted">
      <span className="flex items-center gap-2"><CalendarDays size={15} /> Date range</span>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type="date"
          value={value.from}
          onChange={(event) => onChange({ ...value, from: event.target.value })}
          className="h-11 min-w-0 rounded-lg border border-border bg-cream px-3 text-sm font-black normal-case tracking-normal text-charcoal"
          aria-label="From date"
        />
        <input
          type="date"
          value={value.to}
          onChange={(event) => onChange({ ...value, to: event.target.value })}
          className="h-11 min-w-0 rounded-lg border border-border bg-cream px-3 text-sm font-black normal-case tracking-normal text-charcoal"
          aria-label="To date"
        />
      </div>
    </div>
  );
}

function OrderStatusPanel({
  order,
  customEta,
  defaultPrepMinutes,
  isPickup,
  isPending,
  onDecline,
  onMove,
}: {
  order: AdminOrder;
  customEta?: string;
  defaultPrepMinutes: number;
  isPickup: boolean;
  isPending: boolean;
  onDecline: () => void;
  onMove: (status: OrderStatus) => void;
}) {
  const actions = getNextOrderActions(order.status, isPickup);
  const progressStatuses = getProgressStatuses(isPickup);
  const progress = getOrderProgress(order.status, isPickup);
  const [statusDraft, setStatusDraft] = useState<{ orderStatus: OrderStatus; value: OrderStatus }>(() => ({
    orderStatus: order.status,
    value: getDefaultSelectedStatus(actions, order.status),
  }));
  const selectedStatus = statusDraft.orderStatus === order.status ? statusDraft.value : getDefaultSelectedStatus(actions, order.status);
  const nextPrimary = actions.find((status) => status !== "CANCELLED");
  const selectedIsValid = actions.includes(selectedStatus);

  function submitStatusChange() {
    if (!selectedIsValid) return;
    if (selectedStatus === "CANCELLED") {
      onDecline();
      return;
    }
    onMove(selectedStatus);
  }

  return (
    <section className="mt-4 rounded-xl border border-border bg-white p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase tracking-wide text-muted">Status control</p>
            <span className={`rounded-lg px-3 py-1 text-xs font-black ${getStatusTone(order.status)}`}>Current: {statusCopy[order.status].label}</span>
            <span className="rounded-lg bg-cream px-3 py-1 text-xs font-black text-muted">
              ETA {customEta ? `${customEta} min` : `${defaultPrepMinutes} min default`}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-1.5">
            {progressStatuses.map((status, index) => {
              const done = order.status === "DELIVERED" ? index <= progress.index : index < progress.index;
              const active = progress.index === index && order.status !== "DELIVERED" && order.status !== "CANCELLED";
              return (
                <span
                  key={status}
                  title={statusCopy[status].label}
                  className={`h-2 flex-1 rounded-full ${done ? "bg-maroon" : active ? "bg-red" : "bg-cream"}`}
                />
              );
            })}
          </div>
          <p className="mt-2 text-xs font-bold text-muted">
            Use the dropdown for exact status changes. Customers see custom ETA when entered, otherwise {defaultPrepMinutes} min.
          </p>
        </div>

        {actions.length ? (
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-muted">
              Change to
              <select
                value={selectedStatus}
                onChange={(event) => setStatusDraft({ orderStatus: order.status, value: event.target.value as OrderStatus })}
                className="h-11 rounded-lg border border-border bg-cream px-3 text-sm font-black normal-case tracking-normal text-charcoal"
              >
                {actions.map((status) => (
                  <option key={status} value={status}>{actionCopy[status] ?? statusCopy[status].label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={isPending || !selectedIsValid}
              onClick={submitStatusChange}
              className={`mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black text-white disabled:opacity-60 ${selectedStatus === "CANCELLED" ? "bg-red" : "bg-maroon"}`}
            >
              {selectedStatus === "CANCELLED" ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
              Update
            </button>
            {nextPrimary ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onMove(nextPrimary)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-black text-maroon disabled:opacity-60 sm:col-span-2"
              >
                <CheckCircle2 size={15} /> Quick next: {actionCopy[nextPrimary] ?? statusCopy[nextPrimary].label}
              </button>
            ) : null}
            <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
              {actions.map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={isPending}
                  onClick={() => status === "CANCELLED" ? onDecline() : onMove(status)}
                  className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-black disabled:opacity-60 ${getStatusActionTone(status)}`}
                >
                  {status === "CANCELLED" ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                  {actionCopy[status] ?? statusCopy[status].label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex justify-start lg:justify-end">
            <span className={`inline-flex h-10 items-center rounded-lg px-4 text-xs font-black ${getStatusTone(order.status)}`}>
              {order.status === "DELIVERED" ? "Order completed" : order.status === "CANCELLED" ? "Order declined" : "No next action"}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function buildCustomerMessage(order: AdminOrder, status: OrderStatus) {
  const latestNote = order.timeline.at(-1)?.note;
  const ratingText = status === "DELIVERED" ? " Thank you for ordering from Wah Thali. Please give your rating for the food, it helps us serve you better." : "";
  const reasonText = status === "CANCELLED" && latestNote ? ` Reason: ${latestNote}` : "";
  return `Hi ${order.customerName}, ${statusCopy[status].customer} Order ${order.orderNumber}: ${statusCopy[status].label}.${reasonText}${ratingText}`;
}

function matchesStatusFilter(order: AdminOrder, filter: StatusFilter) {
  if (filter === "all") return true;
  if (filter === "incoming") return incomingStatuses.has(order.status);
  if (filter === "active") return activeStatuses.has(order.status);
  if (filter === "completed") return order.status === "DELIVERED";
  return order.status === "CANCELLED";
}

function matchesDateFilter(order: AdminOrder, filter: DateFilter, range: { from: string; to: string }) {
  const orderDay = getIstDateInputValue(order.createdAt);
  if (range.from && orderDay < range.from) return false;
  if (range.to && orderDay > range.to) return false;

  if (filter === "all") return true;

  if (filter === "today") return orderDay === getIstDateInputValue();
  if (filter === "yesterday") return orderDay === getIstDateInputValue(new Date(), -1);

  const orderTime = new Date(order.createdAt).getTime();
  return orderTime >= Date.now() - 7 * 24 * 60 * 60 * 1000;
}

function matchesPriceFilter(order: AdminOrder, filter: PriceFilter) {
  if (filter === "all") return true;
  if (filter === "under500") return order.amount < 500;
  if (filter === "500to1000") return order.amount >= 500 && order.amount <= 1000;
  return order.amount > 1000;
}

function getStatusTone(status: OrderStatus) {
  if (status === "NEW") return "bg-red/10 text-red";
  if (status === "PENDING_PAYMENT") return "bg-[#fff7e8] text-[#9a5b00]";
  if (activeStatuses.has(status)) return "bg-[#fff4f5] text-maroon";
  if (status === "DELIVERED") return "bg-[#effaf4] text-[#0f7a45]";
  return "bg-cream text-muted";
}

function getStatusActionTone(status: OrderStatus) {
  if (status === "CONFIRMED") return "border-red/25 bg-red text-white hover:bg-maroon";
  if (status === "PREPARING") return "border-[#cad7ff] bg-[#2563eb] text-white hover:bg-[#1e40af]";
  if (status === "PACKED") return "border-[#b7e5dd] bg-[#0f766e] text-white hover:bg-[#115e59]";
  if (status === "READY_FOR_PICKUP") return "border-[#c7ecd2] bg-[#16a34a] text-white hover:bg-[#15803d]";
  if (status === "OUT_FOR_DELIVERY") return "border-[#f3d7a0] bg-[#f59e0b] text-[#221f20] hover:bg-[#f7c453]";
  if (status === "DELIVERED") return "border-[#a8d8b8] bg-[#effaf4] text-[#0f7a45] hover:bg-[#dff6e8]";
  if (status === "CANCELLED") return "border-[#f2b6bc] bg-white text-red hover:bg-[#fff0f3]";
  return "border-border bg-white text-maroon hover:bg-cream";
}

function getOrderCardTone(status: OrderStatus) {
  if (status === "NEW") {
    return {
      label: "New order",
      card: "border-red/45 bg-[#fff7f8] shadow-[0_14px_36px_rgba(141,0,33,0.14)] ring-2 ring-red/20",
      bar: "bg-red",
      banner: "border-red/25 bg-red text-white",
      panel: "border-red/20 bg-white",
      box: "border-red/20",
      row: "bg-[#fff0f3]",
      chip: "bg-white text-maroon ring-1 ring-red/15",
      action: "border-red/25 bg-white text-maroon hover:bg-[#fff0f3]",
    };
  }

  if (status === "PENDING_PAYMENT") {
    return {
      label: "Payment pending",
      card: "border-[#f0b44d]/55 bg-[#fffaf0] shadow-[0_12px_30px_rgba(154,91,0,0.1)]",
      bar: "bg-[#f59e0b]",
      banner: "border-[#f7d48a] bg-[#fff3cf] text-[#7a4100]",
      panel: "border-[#f3d7a0] bg-[#fff7e8]",
      box: "border-[#f3d7a0]",
      row: "bg-[#fff4d8]",
      chip: "bg-[#fff3cf] text-[#7a4100]",
      action: "border-[#f3d7a0] bg-white text-[#7a4100] hover:bg-[#fff7e8]",
    };
  }

  if (status === "CONFIRMED") {
    return {
      label: "Accepted",
      card: "border-[#9db5f7]/60 bg-[#f6f8ff] shadow-[0_12px_30px_rgba(37,99,235,0.08)]",
      bar: "bg-[#2563eb]",
      banner: "border-[#cad7ff] bg-[#e9efff] text-[#1e3a8a]",
      panel: "border-[#d5defb] bg-[#f1f5ff]",
      box: "border-[#d5defb]",
      row: "bg-[#eef4ff]",
      chip: "bg-[#e9efff] text-[#1e3a8a]",
      action: "border-[#cad7ff] bg-white text-[#1e3a8a] hover:bg-[#f1f5ff]",
    };
  }

  if (status === "PREPARING" || status === "PACKED" || status === "READY_FOR_PICKUP" || status === "OUT_FOR_DELIVERY") {
    return {
      label: "Kitchen active",
      card: "border-[#88c8c0]/65 bg-[#f2fffc] shadow-[0_12px_30px_rgba(15,118,110,0.08)]",
      bar: "bg-[#0f766e]",
      banner: "border-[#b7e5dd] bg-[#dffaf4] text-[#115e59]",
      panel: "border-[#b7e5dd] bg-[#ecfffb]",
      box: "border-[#b7e5dd]",
      row: "bg-[#e2fbf5]",
      chip: "bg-[#dffaf4] text-[#115e59]",
      action: "border-[#b7e5dd] bg-white text-[#115e59] hover:bg-[#ecfffb]",
    };
  }

  if (status === "DELIVERED") {
    return {
      label: "Delivered",
      card: "border-[#a8d8b8]/70 bg-[#f5fff8] shadow-[0_10px_26px_rgba(15,122,69,0.07)]",
      bar: "bg-[#16a34a]",
      banner: "border-[#c7ecd2] bg-[#e8f8ee] text-[#0f7a45]",
      panel: "border-[#c7ecd2] bg-[#f0fbf4]",
      box: "border-[#c7ecd2]",
      row: "bg-[#eaf8ef]",
      chip: "bg-[#e8f8ee] text-[#0f7a45]",
      action: "border-[#c7ecd2] bg-white text-[#0f7a45] hover:bg-[#f0fbf4]",
    };
  }

  return {
    label: "Declined",
    card: "border-[#c8cdd7] bg-[#f8fafc] shadow-[0_8px_22px_rgba(15,23,42,0.06)] opacity-90",
    bar: "bg-[#64748b]",
    banner: "border-[#d8dde7] bg-[#eef2f7] text-[#475569]",
    panel: "border-[#dde3ec] bg-[#f8fafc]",
    box: "border-[#dde3ec]",
    row: "bg-[#f1f5f9]",
    chip: "bg-[#eef2f7] text-[#475569]",
    action: "border-[#d8dde7] bg-white text-[#475569] hover:bg-[#f8fafc]",
  };
}

function getProgressStatuses(isPickup: boolean) {
  return isPickup ? pickupProgressStatuses : deliveryProgressStatuses;
}

function getOrderProgress(status: OrderStatus, isPickup: boolean) {
  const progressStatuses = getProgressStatuses(isPickup);

  if (status === "PENDING_PAYMENT") return { index: 0, done: false };
  if (status === "CANCELLED") return { index: 0, done: false };

  const index = Math.max(progressStatuses.indexOf(status), 0);
  return { index, done: status === "DELIVERED" };
}

function getDefaultSelectedStatus(actions: OrderStatus[], currentStatus: OrderStatus) {
  return actions.find((status) => status !== "CANCELLED") ?? actions[0] ?? currentStatus;
}

function getNextOrderActions(status: OrderStatus, isPickup: boolean): OrderStatus[] {
  const fulfillmentActionStatuses: OrderStatus[] = isPickup
    ? ["CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "DELIVERED", "CANCELLED"]
    : ["CONFIRMED", "PREPARING", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

  return fulfillmentActionStatuses
    .filter((next) => canTransitionOrder(status, next));
}

function getPaymentSummary(payment?: { provider: string; status: string }) {
  if (!payment) return "Cash on Delivery";
  if (payment.provider === "COD") return "Cash on Delivery";
  if (payment.status === "REFUND_PENDING") return "Refund pending";
  if (payment.status === "PARTIALLY_REFUNDED") return "Partially refunded";
  if (payment.status === "REFUNDED") return "Refunded";
  if (payment.status === "PAID" || payment.status === "AUTHORIZED") return "Online payment received";
  if (payment.status === "CREATED") return "Online payment pending";
  return "Online payment";
}

function getRefundInfo(order: AdminOrder) {
  const payment = order.payments.find((item) => item.provider === "RAZORPAY");
  if (!payment) {
    return { visible: false, canRefund: false, amount: 0, label: "No online payment" };
  }

  if (payment.status === "REFUND_PENDING") {
    return { visible: true, canRefund: false, amount: payment.amount, label: "Refund pending" };
  }

  if (payment.status === "PARTIALLY_REFUNDED") {
    return { visible: true, canRefund: false, amount: payment.amount, label: "Partially refunded" };
  }

  if (payment.status === "REFUNDED") {
    return { visible: true, canRefund: false, amount: payment.amount, label: "Refunded" };
  }

  if (order.status !== "CANCELLED") {
    return { visible: false, canRefund: false, amount: payment.amount, label: "Refund after decline" };
  }

  if (payment.status !== "PAID") {
    return { visible: true, canRefund: false, amount: payment.amount, label: "Payment not refundable" };
  }

  return { visible: true, canRefund: true, amount: payment.amount, label: `Refund ${formatRupees(payment.amount)}` };
}

function getOrderDetails(order: AdminOrder) {
  return getOrderFulfillmentDetails(order.timeline);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
