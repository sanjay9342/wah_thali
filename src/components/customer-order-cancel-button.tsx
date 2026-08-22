"use client";

import { XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CustomerOrderCancelButton({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
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
        onClick={cancelOrder}
        disabled={submitting}
        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-[#f2b6bc] bg-white px-4 text-[13px] font-black text-red disabled:opacity-60"
      >
        <XCircle size={15} />
        {submitting ? "Cancelling..." : "Cancel order"}
      </button>
      {message ? <p className="mt-2 text-center text-[11px] font-bold text-muted" aria-live="polite">{message}</p> : null}
    </div>
  );
}
