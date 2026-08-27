import { coupons, products, settings } from "./data";
import type { BusinessSettings, CartLine, CategoryOfferMap, Coupon } from "./types";
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
  orderCount?: number;
  points?: number;
  tags?: string[];
};

export type ProductUnitPricing = {
  originalUnitPrice: number;
  unitPrice: number;
  discountPerUnit: number;
  offerText?: string;
};

export function getProductUnitPricing(product: Product, categoryOffers: CategoryOfferMap = {}, variantPrice = 0, addonTotal = 0): ProductUnitPricing {
  const originalBasePrice = product.originalPrice ?? product.price;
  const offerText = getProductOfferText(product, categoryOffers);
  const discount = getOfferDiscount(product.price + variantPrice, offerText);
  const unitPrice = Math.max(product.price + variantPrice - discount, 0) + addonTotal;

  return {
    originalUnitPrice: originalBasePrice + variantPrice + addonTotal,
    unitPrice,
    discountPerUnit: Math.max(originalBasePrice + variantPrice + addonTotal - unitPrice, 0),
    offerText,
  };
}

export function getProductPrice(line: CartLine, productCatalog: Product[] = products, categoryOffers: CategoryOfferMap = {}): number {
  const product = productCatalog.find((item) => item.id === line.productId);
  if (!product) {
    throw new Error(`Product ${line.productId} not found`);
  }

  const variant = getCartLineVariant(product, line.variantId);
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

  return getProductUnitPricing(product, categoryOffers, variant.price, addonTotal).unitPrice * line.quantity;
}

export function getPricableCartLines(lines: CartLine[], productCatalog: Product[] = products): CartLine[] {
  return lines.filter((line) => {
    const product = productCatalog.find((item) => item.id === line.productId);
    if (!product) return false;
    const variant = getCartLineVariant(product, line.variantId);
    if (!variant) return false;
    return line.addonIds.every((addonId) => product.addons.some((item) => item.id === addonId));
  });
}

function getCartLineVariant(product: Product, variantId: string) {
  const variant = product.variants.find((item) => item.id === variantId);
  if (variant) return variant;
  if (product.variants.length === 0 && variantId === "regular") {
    return { id: "regular", name: "Regular", price: 0 };
  }
  return null;
}

export function isCouponEligibleForCustomer(coupon: Coupon, customer?: CouponCustomerContext) {
  if ((coupon.audience ?? "ALL") === "VIP") return Boolean(customer?.isVip);
  if (coupon.audience === "POINTS") return (customer?.orderCount ?? customer?.points ?? 0) >= getCouponOrderCountRequirement(coupon);
  if (coupon.audience === "TAGS") return hasMatchingCouponTag(coupon.tagNames, customer?.tags);
  return true;
}

function getCouponOrderCountRequirement(coupon: Pick<Coupon, "minPoints">) {
  return Math.max(1, Number(coupon.minPoints ?? 1));
}

function hasMatchingCouponTag(couponTags: string[] | undefined, customerTags: string[] | undefined) {
  const required = new Set((couponTags ?? []).map((tag) => tag.trim()).filter(Boolean));
  if (!required.size) return false;
  return (customerTags ?? []).some((tag) => required.has(tag));
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
  categoryOffers: CategoryOfferMap = {},
  deliveryDistanceKm?: number | null,
): CartTotals {
  const pricableLines = getPricableCartLines(lines, productCatalog);
  const subtotal = pricableLines.reduce((total, line) => total + getProductPrice(line, productCatalog, categoryOffers), 0);
  const coupon = couponCatalog.find((item) => item.code === couponCode?.toUpperCase());
  const discount = applyCoupon(subtotal, coupon, customer);
  const packaging = pricableLines.length > 0 ? activeSettings.packagingFee : 0;
  const freeDeliveryEnabled = activeSettings.freeDeliveryThreshold > 0;
  const eligibleOrderValue = subtotal - discount;
  const delivery = getDeliveryFee(activeSettings, eligibleOrderValue, pricableLines.length > 0, deliveryDistanceKm);
  const taxable = Math.max(subtotal - discount + packaging + delivery, 0);
  const gst = Math.round(taxable * normalizeGstRate(activeSettings.gstRate));
  const grandTotal = taxable + gst;
  const freeDeliveryGap = freeDeliveryEnabled ? Math.max(activeSettings.freeDeliveryThreshold - eligibleOrderValue, 0) : 0;

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

export function getDeliveryFee(settings: BusinessSettings, eligibleOrderValue: number, hasItems: boolean, distanceKm?: number | null) {
  if (!hasItems) return 0;
  if (settings.freeDeliveryThreshold > 0 && eligibleOrderValue >= settings.freeDeliveryThreshold) return 0;

  if (settings.deliveryFeeMode === "PERCENT") {
    return Math.max(Math.round((eligibleOrderValue * Math.max(settings.deliveryFeePercent, 0)) / 100), 0);
  }

  if (settings.deliveryFeeMode === "DISTANCE") {
    return getDistanceDeliveryFee(settings, distanceKm);
  }

  return Math.max(Math.round(settings.deliveryFee), 0);
}

export function getDistanceDeliveryFee(settings: Pick<BusinessSettings, "deliveryFee" | "deliveryDistanceSlabs">, distanceKm?: number | null) {
  const slabs = normalizeDeliveryDistanceSlabs(settings.deliveryDistanceSlabs);
  if (!slabs.length || distanceKm === null || distanceKm === undefined || !Number.isFinite(distanceKm)) {
    return Math.max(Math.round(settings.deliveryFee), 0);
  }

  const matchingSlab = slabs.find((slab) => distanceKm <= slab.upToKm);
  return Math.max(Math.round((matchingSlab ?? slabs[slabs.length - 1]).fee), 0);
}

export function normalizeDeliveryDistanceSlabs(value: unknown): BusinessSettings["deliveryDistanceSlabs"] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const row = item as Partial<{ upToKm: number | string; fee: number | string }>;
      return {
        upToKm: Number(row.upToKm),
        fee: Number(row.fee),
      };
    })
    .filter((item) => Number.isFinite(item.upToKm) && item.upToKm > 0 && Number.isFinite(item.fee) && item.fee >= 0)
    .sort((a, b) => a.upToKm - b.upToKm)
    .slice(0, 20);
}

export function normalizeGstRate(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value > 1 ? value / 100 : value;
}

function getProductOfferText(product: Product, categoryOffers: CategoryOfferMap) {
  return product.offer?.trim() || categoryOffers[slugifyCategory(product.category)]?.trim() || undefined;
}

export function getOfferDiscount(price: number, offerText?: string) {
  if (!offerText) return 0;
  const normalized = offerText.toLowerCase().replace(/,/g, "");
  const percent = normalized.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percent) {
    const cap = normalized.match(/(?:up\s*to|upto|max|maximum)[^\d]*(\d+(?:\.\d+)?)/);
    const discount = Math.round((price * Number(percent[1])) / 100);
    return Math.min(discount, cap ? Math.round(Number(cap[1])) : price);
  }

  const fixed = normalized.match(/(?:rs\.?|inr|\u20b9)\s*(\d+(?:\.\d+)?)\s*(?:off|discount)?/) ?? normalized.match(/(\d+(?:\.\d+)?)\s*(?:rs|rupees)\s*off/);
  if (fixed) return Math.min(Math.round(Number(fixed[1])), price);

  return 0;
}

function slugifyCategory(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatRupees(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
