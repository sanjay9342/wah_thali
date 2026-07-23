import { coupons, products, settings } from "./data";
import type { CartLine, Coupon } from "./types";

export type CartTotals = {
  subtotal: number;
  discount: number;
  packaging: number;
  delivery: number;
  gst: number;
  grandTotal: number;
  freeDeliveryGap: number;
};

export function getProductPrice(line: CartLine): number {
  const product = products.find((item) => item.id === line.productId);
  if (!product) {
    throw new Error(`Product ${line.productId} not found`);
  }

  const variant = product.variants.find((item) => item.id === line.variantId);
  if (!variant) {
    throw new Error(`Variant ${line.variantId} not allowed for ${product.name}`);
  }

  const addonTotal = line.addonIds.reduce((total, addonId) => {
    const addon = product.addons.find((item) => item.id === addonId);
    if (!addon) {
      throw new Error(`Addon ${addonId} not allowed for ${product.name}`);
    }
    return total + addon.price;
  }, 0);

  return (product.price + variant.price + addonTotal) * line.quantity;
}

export function applyCoupon(subtotal: number, coupon?: Coupon): number {
  if (!coupon || subtotal < coupon.minOrder) {
    return 0;
  }

  if (coupon.type === "FIXED") {
    return Math.min(coupon.value, subtotal);
  }

  return Math.min((subtotal * coupon.value) / 100, coupon.maxDiscount ?? subtotal);
}

export function calculateCartTotals(lines: CartLine[], couponCode?: string): CartTotals {
  const subtotal = lines.reduce((total, line) => total + getProductPrice(line), 0);
  const coupon = coupons.find((item) => item.code === couponCode?.toUpperCase());
  const discount = applyCoupon(subtotal, coupon);
  const packaging = lines.length > 0 ? settings.packagingFee : 0;
  const delivery =
    lines.length > 0 && subtotal - discount < settings.freeDeliveryThreshold
      ? settings.deliveryFee
      : 0;
  const taxable = Math.max(subtotal - discount + packaging + delivery, 0);
  const gst = Math.round(taxable * settings.gstRate);
  const grandTotal = taxable + gst;
  const freeDeliveryGap = Math.max(settings.freeDeliveryThreshold - (subtotal - discount), 0);

  return {
    subtotal,
    discount,
    packaging,
    delivery,
    gst,
    grandTotal,
    freeDeliveryGap,
  };
}

export function formatRupees(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
