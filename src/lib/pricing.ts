import { coupons, products, settings } from "./data";
import type { BusinessSettings, CartLine, Coupon } from "./types";
import type { Product } from "./types";

export type CartTotals = {
  subtotal: number;
  discount: number;
  packaging: number;
  delivery: number;
  gst: number;
  grandTotal: number;
  freeDeliveryGap: number;
};

export type CouponCustomerContext = {
  isVip?: boolean;
  points?: number;
};

export function getProductPrice(line: CartLine, productCatalog: Product[] = products): number {
  const product = productCatalog.find((item) => item.id === line.productId);
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

export function getPricableCartLines(lines: CartLine[], productCatalog: Product[] = products): CartLine[] {
  return lines.filter((line) => {
    const product = productCatalog.find((item) => item.id === line.productId);
    if (!product) return false;
    const variant = product.variants.find((item) => item.id === line.variantId);
    if (!variant) return false;
    return line.addonIds.every((addonId) => product.addons.some((item) => item.id === addonId));
  });
}

export function isCouponEligibleForCustomer(coupon: Coupon, customer?: CouponCustomerContext) {
  if ((coupon.audience ?? "ALL") === "VIP") return Boolean(customer?.isVip);
  if (coupon.audience === "POINTS") return (customer?.points ?? 0) >= (coupon.minPoints ?? 0);
  return true;
}

export function applyCoupon(subtotal: number, coupon?: Coupon, customer?: CouponCustomerContext): number {
  if (!coupon || subtotal < coupon.minOrder || !isCouponEligibleForCustomer(coupon, customer)) {
    return 0;
  }

  if (coupon.type === "FIXED") {
    return Math.min(coupon.value, subtotal);
  }

  return Math.min((subtotal * coupon.value) / 100, coupon.maxDiscount ?? subtotal);
}

export function calculateCartTotals(
  lines: CartLine[],
  couponCode?: string,
  productCatalog: Product[] = products,
  couponCatalog: Coupon[] = coupons,
  activeSettings: BusinessSettings = settings,
  customer?: CouponCustomerContext,
): CartTotals {
  const pricableLines = getPricableCartLines(lines, productCatalog);
  const subtotal = pricableLines.reduce((total, line) => total + getProductPrice(line, productCatalog), 0);
  const coupon = couponCatalog.find((item) => item.code === couponCode?.toUpperCase());
  const discount = applyCoupon(subtotal, coupon, customer);
  const packaging = pricableLines.length > 0 ? activeSettings.packagingFee : 0;
  const delivery =
    pricableLines.length > 0 && subtotal - discount < activeSettings.freeDeliveryThreshold
      ? activeSettings.deliveryFee
      : 0;
  const taxable = Math.max(subtotal - discount + packaging + delivery, 0);
  const gst = Math.round(taxable * activeSettings.gstRate);
  const grandTotal = taxable + gst;
  const freeDeliveryGap = Math.max(activeSettings.freeDeliveryThreshold - (subtotal - discount), 0);

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
