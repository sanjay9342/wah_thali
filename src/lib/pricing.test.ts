import { describe, expect, it } from "vitest";
import { settings } from "./data";
import { calculateCartTotals, getProductPrice, getProductUnitPricing, isCouponEligibleForCustomer } from "./pricing";

describe("cart pricing", () => {
  it("keeps the customer price and exposes the real strike price for dishes", () => {
    const pricing = getProductUnitPricing({
      id: "strike-test",
      slug: "strike-test",
      name: "Strike Test",
      category: "Mini Thali",
      description: "Test dish",
      image: "/wah-thali-meal-cutout-v2.png",
      dietaryType: "VEG",
      rating: 4.5,
      ratingCount: 1,
      prepTimeMinutes: 20,
      price: 100,
      originalPrice: 150,
      available: true,
      spiceLevel: "Medium",
      variants: [{ id: "regular", name: "Regular", price: 0 }],
      addons: [],
    });

    expect(pricing.unitPrice).toBe(100);
    expect(pricing.originalUnitPrice).toBe(150);
    expect(pricing.discountPerUnit).toBe(50);
  });

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

    expect(totals.subtotal).toBe(548);
    expect(totals.discount).toBe(50);
    expect(totals.delivery).toBe(40);
    expect(totals.packaging).toBe(0);
    expect(totals.gst).toBe(27);
    expect(totals.grandTotal).toBe(565);
  });

  it("applies category offer discounts when a dish has no dish offer", () => {
    const lineTotal = getProductPrice(
      {
        productId: "p2",
        variantId: "large",
        addonIds: [],
        quantity: 1,
      },
      undefined,
      { "mini-thali": "20% OFF up to Rs 15" },
    );

    expect(lineTotal).toBe(129);
  });

  it("prices dishes that have no variation rows as the regular dish", () => {
    const dishWithoutVariations = {
      id: "no-variation",
      slug: "no-variation",
      name: "No Variation Dish",
      category: "Mini Thali",
      description: "",
      image: "/wah-thali-meal-cutout-v2.png",
      dietaryType: "VEG" as const,
      rating: 4.5,
      ratingCount: 1,
      prepTimeMinutes: 20,
      price: 120,
      originalPrice: 150,
      available: true,
      spiceLevel: "Medium" as const,
      variants: [],
      addons: [],
    };

    const lineTotal = getProductPrice({
      productId: "no-variation",
      variantId: "regular",
      addonIds: [],
      quantity: 2,
    }, [dishWithoutVariations]);

    expect(lineTotal).toBe(240);
  });

  it("lets dish offers override category offers", () => {
    const lineTotal = getProductPrice(
      {
        productId: "p1",
        variantId: "large",
        addonIds: [],
        quantity: 1,
      },
      undefined,
      { "exclusive-thali": "50% OFF" },
    );

    expect(lineTotal).toBe(245);
  });

  it("charges delivery when free delivery threshold is 0", () => {
    const totals = calculateCartTotals(
      [
        {
          productId: "p2",
          variantId: "regular",
          addonIds: [],
          quantity: 1,
        },
      ],
      undefined,
      undefined,
      undefined,
      { ...settings, deliveryFee: 40, freeDeliveryThreshold: 0 },
    );

    expect(totals.delivery).toBe(40);
    expect(totals.freeDeliveryGap).toBe(0);
  });

  it("makes delivery free above the configured order price", () => {
    const totals = calculateCartTotals(
      [
        {
          productId: "p1",
          variantId: "large",
          addonIds: ["raita"],
          quantity: 2,
        },
      ],
      undefined,
      undefined,
      undefined,
      { ...settings, deliveryFee: 40, freeDeliveryThreshold: 499 },
    );

    expect(totals.subtotal).toBe(548);
    expect(totals.delivery).toBe(0);
    expect(totals.freeDeliveryGap).toBe(0);
  });

  it("calculates delivery as a percentage of the discounted order price", () => {
    const totals = calculateCartTotals(
      [
        {
          productId: "p2",
          variantId: "regular",
          addonIds: [],
          quantity: 1,
        },
      ],
      undefined,
      undefined,
      undefined,
      { ...settings, deliveryFeeMode: "PERCENT", deliveryFeePercent: 10, freeDeliveryThreshold: 0 },
    );

    expect(totals.subtotal).toBe(99);
    expect(totals.delivery).toBe(10);
  });

  it("calculates delivery from distance slabs", () => {
    const totals = calculateCartTotals(
      [
        {
          productId: "p2",
          variantId: "regular",
          addonIds: [],
          quantity: 1,
        },
      ],
      undefined,
      undefined,
      undefined,
      {
        ...settings,
        deliveryFee: 40,
        deliveryFeeMode: "DISTANCE",
        deliveryDistanceSlabs: [
          { upToKm: 1, fee: 20 },
          { upToKm: 3, fee: 35 },
          { upToKm: 5, fee: 60 },
        ],
        freeDeliveryThreshold: 0,
      },
      undefined,
      undefined,
      2.4,
    );

    expect(totals.delivery).toBe(35);
  });

  it("uses order count for order-count based coupons", () => {
    const coupon = {
      code: "FAMILY10",
      label: "10% off family orders",
      type: "PERCENT" as const,
      value: 10,
      minOrder: 699,
      maxDiscount: 120,
      audience: "POINTS" as const,
      minPoints: 3,
    };

    expect(isCouponEligibleForCustomer(coupon, { orderCount: 2, points: 99 })).toBe(false);
    expect(isCouponEligibleForCustomer(coupon, { orderCount: 3, points: 0 })).toBe(true);
  });

  it("uses customer tags for tag based coupons", () => {
    const coupon = {
      code: "BULK10",
      label: "Bulk order offer",
      type: "PERCENT" as const,
      value: 10,
      minOrder: 999,
      audience: "TAGS" as const,
      tagNames: ["Bulk order", "Office"],
    };

    expect(isCouponEligibleForCustomer(coupon, { tags: ["VIP"] })).toBe(false);
    expect(isCouponEligibleForCustomer(coupon, { tags: ["Office"] })).toBe(true);
  });
});
