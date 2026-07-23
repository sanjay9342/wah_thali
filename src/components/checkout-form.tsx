"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, CreditCard, MapPin, ShieldCheck } from "lucide-react";
import { settings } from "@/lib/data";

const paymentMethods = ["Cash on Delivery", "Razorpay test mode", "UPI", "Cards and wallets"];

export function CheckoutForm() {
  const [deliveryMode, setDeliveryMode] = useState<"now" | "schedule">("now");
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]);
  const [message, setMessage] = useState("COD is selected. You can place the demo order.");

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
      <section className="space-y-5">
        <div className="surface rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
            <MapPin className="text-red" /> Delivery address
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {["Name", "Phone", "Area", "PIN code", "Landmark", "Delivery instructions"].map((field) => (
              <label key={field} className="text-sm font-bold">
                {field}
                <input className="mt-2 h-11 w-full rounded-lg border border-border bg-cream px-3" />
              </label>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">Serviceable PINs: {settings.serviceablePins.join(", ")}</p>
        </div>

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
            {paymentMethods.map((method) => (
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
            ))}
          </div>
        </div>
      </section>

      <aside className="surface h-fit rounded-2xl p-5">
        <ShieldCheck className="text-maroon" />
        <h2 className="mt-3 text-xl font-black text-maroon">Server validated order</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Totals, modifiers, coupon, loyalty redemption, GST, and delivery rules are recalculated on the server before payment capture.
        </p>
        <p className="mt-4 rounded-lg bg-cream p-3 text-sm font-bold text-maroon" aria-live="polite">
          {message}
        </p>
        <Link prefetch href="/order/WT-10021/confirmed" className="mt-5 flex h-12 items-center justify-center rounded-lg bg-red font-black text-white">
          Place order
        </Link>
      </aside>
    </div>
  );
}
