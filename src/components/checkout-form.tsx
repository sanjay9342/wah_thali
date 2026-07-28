"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, CreditCard, LocateFixed, MapPin, ShieldCheck, Store } from "lucide-react";
import { business } from "@/lib/business";
import { writeStoredCart } from "@/lib/cart-storage";
import { readCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";
import { saveDeliveryLocation, useDeliveryLocation } from "@/lib/delivery-location";
import { useStoredCart } from "@/lib/use-stored-cart";
import type { RestaurantSettings } from "@/lib/types";

export function CheckoutForm({ restaurantSettings }: { restaurantSettings: RestaurantSettings }) {
  const router = useRouter();
  const paymentMethods = [
    ...(restaurantSettings.codEnabled ? ["Cash on Delivery"] : []),
    ...(restaurantSettings.onlinePaymentsEnabled ? ["Razorpay", "UPI", "Cards and wallets"] : []),
  ];
  const deliveryLocation = useDeliveryLocation();
  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  const cartLines = useStoredCart(customerSession?.mobile);
  const [deliveryMode, setDeliveryMode] = useState<"now" | "schedule">("now");
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0] ?? "No payment method");
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
  const orderingDisabled = restaurantSettings.storeMode === "CLOSED" || restaurantSettings.storeMode === "PAUSED";
  const statusMessage = getStoreStatusMessage(restaurantSettings);
  const [message, setMessage] = useState(
    orderingDisabled
      ? statusMessage
      : paymentMethods[0]
        ? `${paymentMethods[0]} is selected. You can place the order.`
        : "No payment method is enabled. Please contact support.",
  );
  const mapUrl = address.latitude && address.longitude ? `https://www.google.com/maps?q=${address.latitude},${address.longitude}` : "";

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
    setMessage("Creating your order...");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: address.name.trim(),
          customerMobile: address.phone.trim(),
          pinCode: address.pinCode.trim(),
          items: cartLines,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Order could not be created. Please try again.");
        return;
      }

      writeStoredCart([], customerSession?.mobile);
      router.push(`/order/${data.order.orderNumber}/confirmed`);
    } catch {
      setMessage("Order could not be created. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
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
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          const details = data.address ?? {};
          area = [details.suburb, details.neighbourhood, details.city_district, details.city, details.state].filter(Boolean).slice(0, 3).join(", ") || data.display_name || area;
          pinCode = details.postcode || pinCode;
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
          <div className="mt-3 rounded-2xl bg-cream p-3 text-sm text-muted">
            <p className="font-bold text-charcoal">Delivery rules</p>
            <p className="mt-1">Delivery charges are auto calculated by distance. Packaging charge is Nil.</p>
            <div className="mt-2 grid gap-1 text-xs font-bold sm:grid-cols-2">
              {business.deliveryCharges.map((charge) => (
                <span key={charge.label}>
                  {charge.label}: Rs {charge.amount}
                </span>
              ))}
            </div>
            <p className="mt-2">Delivery is currently open for all locations.</p>
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
            <Link href="/delivery-policy">Delivery</Link>
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

function getStoreStatusMessage(settings: RestaurantSettings) {
  if (settings.storeStatusReason.trim()) return settings.storeStatusReason;
  if (settings.storeMode === "BUSY") return settings.busyMessage;
  if (settings.storeMode === "PAUSED") return settings.pausedMessage;
  if (settings.storeMode === "CLOSED") return settings.closedMessage;
  return "Restaurant is accepting orders.";
}
