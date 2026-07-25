"use client";

import { useState } from "react";
import { Star } from "lucide-react";

export function OrderReviewForm({
  orderNumber,
  productId,
  productName,
}: {
  orderNumber: string;
  productId: string;
  productName: string;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

      setMessage(`Thanks. ${productName} is now rated ${data.productRating} (${data.productRatingCount}).`);
      setComment("");
    } catch {
      setMessage("Review could not be saved. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl bg-cream p-3">
      <p className="text-sm font-black text-charcoal">Rate {productName}</p>
      <div className="mt-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            className={`grid h-9 w-9 place-items-center rounded-xl ${
              value <= rating ? "bg-maroon text-white" : "bg-white text-muted"
            }`}
            aria-label={`${value} star rating`}
          >
            <Star size={16} className={value <= rating ? "fill-white" : ""} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        className="mt-3 min-h-20 w-full resize-none rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-charcoal"
        placeholder="Write a short review"
        maxLength={400}
      />
      <button
        type="button"
        onClick={submitReview}
        disabled={submitting}
        className="mt-3 h-10 w-full rounded-xl bg-red text-sm font-black text-white disabled:opacity-60"
      >
        {submitting ? "Submitting..." : "Submit review"}
      </button>
      {message ? <p className="mt-2 text-xs font-bold text-muted" aria-live="polite">{message}</p> : null}
    </div>
  );
}
