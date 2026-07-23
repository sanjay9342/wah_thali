import { describe, expect, it } from "vitest";
import { calculateCartTotals } from "./pricing";

describe("cart pricing", () => {
  it("calculates GST, delivery, packaging, and coupon discount", () => {
    const totals = calculateCartTotals(
      [
        {
          productId: "p1",
          variantId: "large",
          addonIds: ["raita"],
          quantity: 2,
        },
      ],
      "WAH50",
    );

    expect(totals.subtotal).toBe(634);
    expect(totals.discount).toBe(50);
    expect(totals.delivery).toBe(0);
    expect(totals.packaging).toBe(18);
    expect(totals.gst).toBe(30);
    expect(totals.grandTotal).toBe(632);
  });
});
