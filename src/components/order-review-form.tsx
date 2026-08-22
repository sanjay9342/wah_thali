"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useRouter } from "next/navigation";

export function OrderReviewForm({
  orderNumber,
  productId,
  productName,
  existingReview,
}: {
  orderNumber: string;
  productId: string;
  productName: string;
  existingReview?: { rating: number; comment: string | null };
}) {
  const router = useRouter();
  const [rating, setRating] = useState(existingReview?.rating ?? 5);
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [message, setMessage] = useState(existingReview ? `Saved rating: ${existingReview.rating}/5. You can update it.` : "");
  const [submitting, setSubmitting] = useState(false);
  const [closed, setClosed] = useState(false);

  async function submitReview() {
    setSubmitting(true);
    setMessage("Saving your review...");

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, productId, rating, comment }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Review could not be saved.");
        return;
      }

      setRating(5);
      setComment("");
      setMessage("");
      setClosed(true);
      router.refresh();
    } catch {
      setMessage("Review could not be saved. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (closed) return null;

  return (
    <div className="mt-4 rounded-2xl bg-[#fff8f9] p-3 ring-1 ring-[#f1dce1]">
      <p className="text-sm font-black text-charcoal">{existingReview ? "Update rating" : "Rate"} {productName}</p>
      <div className="mt-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            className={`grid h-8 w-8 place-items-center rounded-xl ${
              value <= rating ? "bg-maroon text-white" : "bg-white text-muted"
            }`}
            aria-label={`${value} star rating`}
          >
            <Star size={15} className={value <= rating ? "fill-white" : ""} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        className="mt-3 min-h-18 w-full resize-none rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-charcoal"
        placeholder="Write a short review"
        maxLength={400}
      />
      <button
        type="button"
        onClick={submitReview}
        disabled={submitting}
        className="mt-3 h-10 w-full rounded-xl bg-maroon text-sm font-black text-white disabled:opacity-60"
      >
        {submitting ? "Submitting..." : existingReview ? "Update review" : "Submit review"}
      </button>
      {message ? <p className="mt-2 text-xs font-bold text-muted" aria-live="polite">{message}</p> : null}
    </div>
  );
}
