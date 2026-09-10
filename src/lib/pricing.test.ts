import { describe, expect, it } from "vitest";
import { settings } from "./data";
import { calculateCartTotals, getProductPrice, getProductUnitPricing, isCouponEligibleForCustomer } from "./pricing";
import { calculateLoyaltyRedemption, calculateWahPointsEarned } from "./rewards";
import type { Product } from "./types";

const testProducts: Product[] = [
  {
    id: "p1",
    slug: "exclusive-thali",
    name: "Exclusive Thali",
    category: "Exclusive Thali",
    categoryId: "exclusive-thali",
    description: "Test thali",
    image: "/wah-thali-meal-cutout-v2.png",
    dietaryType: "VEG",
    rating: 4.5,
    ratingCount: 1,
    prepTimeMinutes: 20,
    price: 199,
    originalPrice: 249,
    offer: "Chef special",
    available: true,
    spiceLevel: "Medium",
    variants: [
      { id: "regular", name: "Regular", price: 199 },
      { id: "large", name: "Large", price: 245 },
    ],
    addons: [{ id: "raita", name: "Raita", price: 29 }],
  },
  {
    id: "p2",
    slug: "mini-thali",
    name: "Mini Thali",
    category: "Mini Thali",
    categoryId: "mini-thali",
    description: "Test mini thali",
    image: "/wah-thali-meal-cutout-v2.png",
    dietaryType: "VEG",
    rating: 4.5,
    ratingCount: 1,
    prepTimeMinutes: 20,
    price: 99,
    originalPrice: 129,
    available: true,
    spiceLevel: "Medium",
    variants: [
      { id: "regular", name: "Regular", price: 99 },
      { id: "large", name: "Large", price: 144 },
    ],
    addons: [],
  },
];

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
      testProducts,
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
      testProducts,
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
      testProducts,
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
      testProducts,
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
      testProducts,
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
      testProducts,
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
      testProducts,
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

  it("uses point balance for point based coupons", () => {
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

    expect(isCouponEligibleForCustomer(coupon, { orderCount: 20, points: 2 })).toBe(false);
    expect(isCouponEligibleForCustomer(coupon, { orderCount: 0, points: 3 })).toBe(true);
  });

  it("caps Wah Points redemption by order and combined discount limits", () => {
    expect(calculateLoyaltyRedemption({
      foodValue: 299,
      couponDiscount: 0,
      availablePoints: 500,
    })).toEqual({ points: 290, discount: 29, reason: "" });

    expect(calculateLoyaltyRedemption({
      foodValue: 399,
      couponDiscount: 30,
      availablePoints: 500,
    })).toEqual({ points: 290, discount: 29, reason: "" });
  });

  it("awards base, first order, and reorder Wah Points", () => {
    const earned = calculateWahPointsEarned({
      eligibleFoodValue: 400,
      isFirstOrder: true,
      previousCompletedOrderAt: null,
      orderedAt: new Date("2026-09-10T10:00:00.000Z"),
    });

    expect(earned).toEqual({
      basePoints: 40,
      firstOrderBonusPoints: 40,
      reorderBonusPoints: 0,
      totalPoints: 80,
    });

    expect(calculateWahPointsEarned({
      eligibleFoodValue: 400,
      isFirstOrder: false,
      previousCompletedOrderAt: new Date("2026-09-01T10:00:00.000Z"),
      orderedAt: new Date("2026-09-10T10:00:00.000Z"),
    }).totalPoints).toBe(90);
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
