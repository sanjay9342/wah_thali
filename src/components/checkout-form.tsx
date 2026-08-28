"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, CreditCard, LocateFixed, MapPin, ShieldCheck, Store } from "lucide-react";
import { business } from "@/lib/business";
import { writeStoredCart } from "@/lib/cart-storage";
import { readCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";
import { saveDeliveryLocation, useDeliveryLocation } from "@/lib/delivery-location";
import { getDeliveryCoverage } from "@/lib/delivery-radius";
import { addNotification } from "@/lib/notifications";
import { getStoreOrderingStatus } from "@/lib/store-hours";
import { useStoredCart } from "@/lib/use-stored-cart";
import { OrderPlacingOverlay } from "@/components/order-placing-overlay";
import type { RestaurantSettings } from "@/lib/types";

type PaymentMethod = "COD" | "RAZORPAY";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => { open: () => void };
  }
}

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; contact: string };
  notes: { orderNumber: string };
  theme: { color: string };
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal: { ondismiss: () => void };
};

function wait(durationMs: number) {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

export function CheckoutForm({ restaurantSettings }: { restaurantSettings: RestaurantSettings }) {
  const router = useRouter();
  const paymentMethods = [
    ...(restaurantSettings.codEnabled ? ["Cash on Delivery"] : []),
    ...(restaurantSettings.onlinePaymentsEnabled ? ["Online Pay"] : []),
  ];
  const deliveryLocation = useDeliveryLocation();
  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  const cartLines = useStoredCart(customerSession?.mobile);
  const [deliveryMode, setDeliveryMode] = useState<"now" | "schedule">("now");
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0] ?? "No payment method");
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [placingStage, setPlacingStage] = useState<string | null>(null);
  const [address, setAddress] = useState({
    name: "",
    phone: "",
    area: deliveryLocation.address === "Select delivery location" ? "" : deliveryLocation.address,
    pinCode: "",
    landmark: "",
    instructions: deliveryLocation.latitude && deliveryLocation.longitude ? `Live location: ${deliveryLocation.latitude}, ${deliveryLocation.longitude}` : "",
    latitude: deliveryLocation.latitude ?? "",
    longitude: deliveryLocation.longitude ?? "",
  });
  const orderingStatus = getStoreOrderingStatus(restaurantSettings);
  const deliveryCoverage = getDeliveryCoverage({
    pinCode: deliveryLocation.pinCode,
    latitude: deliveryLocation.latitude,
    longitude: deliveryLocation.longitude,
  }, restaurantSettings);
  const orderingDisabled = orderingStatus.unavailable || !deliveryCoverage.serviceable;
  const statusMessage = orderingStatus.message;
  const [message, setMessage] = useState(
    orderingDisabled
      ? orderingStatus.unavailable ? statusMessage : deliveryCoverage.message
      : paymentMethods[0]
        ? `${paymentMethods[0]} is selected. You can place the order.`
        : "No payment method is enabled. Please contact support.",
  );
  const mapUrl = address.latitude && address.longitude ? `https://www.google.com/maps?q=${address.latitude},${address.longitude}` : "";
  const apiPaymentMethod: PaymentMethod = paymentMethod === "Online Pay" ? "RAZORPAY" : "COD";

  useEffect(() => {
    function refreshSession() {
      const session = readCustomerSession();
      setCustomerSession(session);
      if (session) {
        setAddress((current) => ({
          ...current,
          name: session.name,
          phone: session.mobile,
        }));
      }
    }

    refreshSession();
    return subscribeCustomerSession(refreshSession);
  }, []);

  async function loadRazorpayCheckout() {
    if (window.Razorpay) return true;

    return new Promise<boolean>((resolve) => {
      const existing = document.querySelector<HTMLScriptElement>("script[src='https://checkout.razorpay.com/v1/checkout.js']");
      if (existing) {
        existing.addEventListener("load", () => resolve(true), { once: true });
        existing.addEventListener("error", () => resolve(false), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function verifyRazorpayPayment(input: {
    orderNumber: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) {
    const response = await fetch("/api/payments/razorpay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok || !data.verified) {
      throw new Error(data.error || "Payment verification failed.");
    }
  }

  async function cancelUnpaidOrder(orderNumber: string) {
    await fetch(`/api/orders/${orderNumber}/customer-cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note: "Online payment was not completed. Checkout attempt cancelled before sending to kitchen.",
        notifyCustomer: false,
      }),
    }).catch(() => undefined);
  }

  async function openRazorpayCheckout(input: {
    keyId: string;
    orderId: string;
    amount: number;
    currency: string;
    orderNumber: string;
  }) {
    const loaded = await loadRazorpayCheckout();
    if (!loaded || !window.Razorpay) {
      await cancelUnpaidOrder(input.orderNumber);
      throw new Error("Online payment could not be loaded.");
    }

    const checkout = new window.Razorpay({
      key: input.keyId,
      amount: input.amount,
      currency: input.currency,
      name: "Wah Thali",
      description: `Order ${input.orderNumber}`,
      order_id: input.orderId,
      prefill: {
        name: address.name.trim(),
        contact: address.phone.trim(),
      },
      notes: {
        orderNumber: input.orderNumber,
      },
      theme: {
        color: "#8d0021",
      },
      handler: async (response) => {
        setSubmitting(true);
        setPlacingStage("Verifying your payment and placing the order.");
        setMessage("Verifying payment...");
        let keepOverlay = false;
        try {
          await verifyRazorpayPayment({
            orderNumber: input.orderNumber,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          writeStoredCart([], customerSession?.mobile);
          addNotification(customerSession?.mobile, {
            kind: "order",
            title: "Payment received",
            body: `Your order ${input.orderNumber} was placed successfully.`,
          });
          setPlacingStage("Payment received. Opening your live order tracker.");
          await wait(850);
          keepOverlay = true;
          router.push(`/order/${input.orderNumber}/track`);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Payment verification failed.");
        } finally {
          if (!keepOverlay) {
            setSubmitting(false);
            setPlacingStage(null);
          }
        }
      },
      modal: {
        ondismiss: () => {
          void cancelUnpaidOrder(input.orderNumber);
          setSubmitting(false);
          setPlacingStage(null);
          setMessage("Payment was not completed. The order was not sent to the kitchen.");
        },
      },
    });

    checkout.open();
    setPlacingStage(null);
  }

  async function placeOrder() {
    if (orderingDisabled || !paymentMethods.length || submitting) return;

    if (!cartLines.length) {
      setMessage("Your cart is empty. Add items before placing the order.");
      return;
    }

    if (!address.name.trim() || !address.phone.trim()) {
      setMessage("Please enter customer name and phone number.");
      return;
    }

    setSubmitting(true);
    setPlacingStage(apiPaymentMethod === "RAZORPAY" ? "Starting secure payment for your order." : "Creating your order and sending it to the kitchen.");
    setMessage(apiPaymentMethod === "RAZORPAY" ? "Starting secure payment..." : "Creating your order...");
    let keepOverlay = false;
    let keepRazorpaySubmitting = false;

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: address.name.trim(),
          customerMobile: address.phone.trim(),
          customerEmail: customerSession?.email,
          receiverName: address.name.trim(),
          receiverMobile: address.phone.trim(),
          deliveryAddress: [address.area.trim(), address.landmark.trim()].filter(Boolean).join(", "),
          deliveryLabel: "Checkout",
          restaurantNote: address.instructions.trim(),
          pinCode: address.pinCode.trim(),
          latitude: String(address.latitude || deliveryLocation.latitude || ""),
          longitude: String(address.longitude || deliveryLocation.longitude || ""),
          paymentMethod: apiPaymentMethod,
          items: cartLines,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Order could not be created. Please try again.");
        return;
      }

      if (apiPaymentMethod === "RAZORPAY") {
        if (!data.razorpay) {
          setMessage("Online payment could not be started for this order.");
          return;
        }

        await openRazorpayCheckout({
          keyId: data.razorpay.keyId,
          orderId: data.razorpay.orderId,
          amount: data.razorpay.amount,
          currency: data.razorpay.currency,
          orderNumber: data.order.orderNumber,
        });
        keepRazorpaySubmitting = true;
        return;
      }

      writeStoredCart([], customerSession?.mobile);
      setPlacingStage("Order placed successfully. Opening your live tracker.");
      await wait(850);
      keepOverlay = true;
      router.push(`/order/${data.order.orderNumber}/track`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Order could not be created. Please check your connection and try again.");
    } finally {
      if (!keepOverlay && !keepRazorpaySubmitting) {
        setSubmitting(false);
        setPlacingStage(null);
      }
    }
  }

  async function detectLocation() {
    if (!("geolocation" in navigator)) {
      setMessage("Location detection is not supported on this browser.");
      return;
    }

    setLocating(true);
    setMessage("Detecting your live location...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude.toFixed(6);
        const longitude = position.coords.longitude.toFixed(6);
        let area = address.area;
        let pinCode = address.pinCode;

        try {
          const response = await fetch(`/api/maps/reverse?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`, { cache: "no-store" });
          const data = await response.json();
          area = data.result?.area || data.result?.formattedAddress || area;
          pinCode = data.result?.pinCode || pinCode;
        } catch {
          area = area || "Detected location";
        }

        setAddress((current) => ({
          ...current,
          area,
          pinCode,
          latitude,
          longitude,
          instructions: current.instructions || `Live location: ${latitude}, ${longitude}`,
        }));
        saveDeliveryLocation({
          label: "Home",
          address: area,
          pinCode,
          latitude,
          longitude,
        });
        setMessage("Live location added to the delivery address.");
        setLocating(false);
      },
      (error) => {
        setMessage(error.message || "Location permission was denied.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
      {placingStage ? <OrderPlacingOverlay message={placingStage} /> : null}
      <section className="space-y-5">
        <div className="surface rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
            <MapPin className="text-red" /> Delivery address
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["name", "Name"],
              ["phone", "Phone"],
              ["area", "Area"],
              ["pinCode", "PIN code"],
              ["landmark", "Landmark"],
              ["instructions", "Delivery instructions"],
            ].map(([key, label]) => (
              <label key={key} className="text-sm font-bold">
                {label}
                <input
                  value={address[key as keyof typeof address]}
                  onChange={(event) => setAddress({ ...address, [key]: event.target.value })}
                  className="mt-2 h-11 w-full rounded-lg border border-border bg-cream px-3"
                />
              </label>
            ))}
          </div>
          <div className="mt-3 grid gap-2 rounded-2xl border border-border bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-sm font-black text-maroon">Live location for delivery</p>
              <p className="mt-1 text-xs font-semibold text-muted">
                {address.latitude && address.longitude ? `${address.latitude}, ${address.longitude}` : "Use device GPS to attach exact map coordinates to the order address."}
              </p>
              {mapUrl ? (
                <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-black text-red">
                  Open detected map pin
                </a>
              ) : null}
            </div>
            <button
              type="button"
              onClick={detectLocation}
              disabled={locating}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red px-4 text-sm font-black text-white disabled:opacity-60"
            >
              <LocateFixed size={17} /> {locating ? "Detecting..." : "Use current location"}
            </button>
          </div>
        </div>

        {restaurantSettings.storeMode !== "OPEN" ? (
          <div className="surface rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
              <Store className="text-red" /> Store status
            </h2>
            <p className="mt-3 rounded-xl bg-cream p-4 text-sm font-bold text-maroon">
              {statusMessage}
            </p>
            {restaurantSettings.storeMode === "BUSY" ? (
              <p className="mt-2 text-sm font-semibold text-muted">
                Orders are open, but the kitchen may add around {restaurantSettings.rushPrepBufferMinutes} minutes.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="surface rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
            <CalendarClock className="text-red" /> Delivery time
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => {
                setDeliveryMode("now");
                setMessage("Delivery now selected. ETA is 28-38 minutes.");
              }}
              className={`h-12 rounded-lg font-black ${
                deliveryMode === "now" ? "bg-maroon text-white" : "border border-border bg-white"
              }`}
            >
              Deliver now
            </button>
            <button
              onClick={() => {
                setDeliveryMode("schedule");
                setMessage("Scheduled order selected. Time slot selection will be required before payment.");
              }}
              className={`h-12 rounded-lg font-black ${
                deliveryMode === "schedule" ? "bg-maroon text-white" : "border border-border bg-white"
              }`}
            >
              Schedule order
            </button>
          </div>
        </div>

        <div className="surface rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
            <CreditCard className="text-red" /> Payment
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {paymentMethods.length ? paymentMethods.map((method) => (
              <button
                key={method}
                onClick={() => {
                  setPaymentMethod(method);
                  setMessage(`${method} selected.`);
                }}
                className={`h-12 rounded-lg font-black ${
                  paymentMethod === method ? "bg-red text-white" : "border border-border bg-white"
                }`}
              >
                {method}
              </button>
            )) : (
              <p className="rounded-lg bg-cream p-3 text-sm font-bold text-maroon">
                Payment is temporarily unavailable. Please contact {restaurantSettings.supportPhone}.
              </p>
            )}
          </div>
        </div>
      </section>

      <aside className="surface h-fit rounded-2xl p-5">
        <ShieldCheck className="text-maroon" />
        <h2 className="mt-3 text-xl font-black text-maroon">Server validated order</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Totals, modifiers, coupon, loyalty redemption, GST, and distance-based delivery rules are recalculated on the server before payment capture.
        </p>
        <div className="mt-4 grid gap-2 rounded-lg bg-cream p-3 text-xs font-bold text-muted">
          <p>Cancellation allowed only before preparation starts. Client rule: {business.cancellationWindow}.</p>
          <p>Approved refunds are processed in {business.refundTimeline}.</p>
          <div className="flex flex-wrap gap-2 text-red">
            <Link href="/terms-and-conditions">Terms</Link>
            <Link href="/refund-cancellation-policy">Refunds</Link>
            <Link href="/delivery-policy">Delivery & Pickup</Link>
            <Link href="/privacy-policy">Privacy</Link>
          </div>
        </div>
        <p className="mt-4 rounded-lg bg-cream p-3 text-sm font-bold text-maroon" aria-live="polite">
          {message}
        </p>
        {orderingDisabled || !paymentMethods.length ? (
          <button disabled className="mt-5 flex h-12 w-full cursor-not-allowed items-center justify-center rounded-lg bg-muted/30 font-black text-muted">
            Ordering not available
          </button>
        ) : (
          <button
            type="button"
            onClick={placeOrder}
            disabled={submitting}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-lg bg-red font-black text-white disabled:opacity-60"
          >
            {submitting ? "Placing order..." : "Place order"}
          </button>
        )}
      </aside>
    </div>
  );
}

