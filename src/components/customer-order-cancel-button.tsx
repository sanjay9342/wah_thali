"use client";

import { AlertTriangle, X, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CustomerOrderCancelButton({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState("");

  async function cancelOrder() {
    if (submitting) return;
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(`/api/orders/${orderNumber}/customer-cancel`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error ?? "Order could not be cancelled.");
        return;
      }

      setMessage("Order cancelled.");
      setConfirmOpen(false);
      router.refresh();
    } catch {
      setMessage("Order could not be cancelled. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => {
          setMessage("");
          setConfirmOpen(true);
        }}
        disabled={submitting}
        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-[#f2b6bc] bg-white px-4 text-[13px] font-black text-red disabled:opacity-60"
      >
        <XCircle size={15} />
        Cancel order
      </button>
      {message ? <p className="mt-2 text-center text-[11px] font-bold text-muted" aria-live="polite">{message}</p> : null}
      {confirmOpen ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-charcoal/45 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white text-left shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#f0d7dd] p-5">
              <div className="flex gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#fff4f5] text-red">
                  <AlertTriangle size={21} />
                </span>
                <div>
                  <h2 className="text-lg font-black text-maroon">Cancel this order?</h2>
                  <p className="mt-1 text-sm font-semibold leading-6 text-muted">
                    Order {orderNumber} will be cancelled and removed from the kitchen queue. This action cannot be undone.
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setConfirmOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border" aria-label="Close cancellation confirmation">
                <X size={17} />
              </button>
            </div>
            <div className="p-5">
              <p className="rounded-xl bg-cream px-3 py-2 text-xs font-black leading-5 text-maroon">
                Please confirm only if you no longer want this food order.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={submitting}
                  className="h-11 rounded-xl border border-border px-4 text-sm font-black text-charcoal disabled:opacity-60"
                >
                  Keep order
                </button>
                <button
                  type="button"
                  onClick={cancelOrder}
                  disabled={submitting}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red px-4 text-sm font-black text-white disabled:opacity-60"
                >
                  <XCircle size={16} />
                  {submitting ? "Cancelling..." : "Yes, cancel order"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
