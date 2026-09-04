import "server-only";

import { unstable_cache } from "next/cache";
import { Prisma, type PaymentStatus } from "@prisma/client";
import { coupons as fallbackCoupons, products as fallbackProducts, settings as fallbackSettings } from "@/lib/data";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { defaultNewOrderSound, getNewOrderSound } from "@/lib/order-sounds";
import { normalizeDeliveryDistanceSlabs, normalizeGstRate } from "@/lib/pricing";
import { getRewardTier, rewardCoupons } from "@/lib/rewards";
import { getIstDayRangeUtc } from "@/lib/time";
import type { AdvancedSettings, AdminCustomer, AdminOrder, AdminProduct, BusinessSettings, CategoryImageMap, CategoryOfferMap, CategoryOption, Coupon, HomeSlide, Product, RestaurantSettings, StoreMode } from "@/lib/types";

const paidOnlineStatuses: PaymentStatus[] = ["PAID", "AUTHORIZED"];
const storefrontCacheSeconds = 60;
const businessSettingKeys = Object.keys(fallbackSettings);

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    category: { include: { parent: true } };
    images: { orderBy: { sortOrder: "asc" } };
    variants: true;
    addons: true;
    inventory: true;
  };
}>;

function toProduct(product: ProductWithRelations): Product {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    displayName: product.displayName ?? undefined,
    kitchenName: product.kitchenName ?? undefined,
    reportCode: product.reportCode ?? undefined,
    category: product.category.name,
    categoryId: product.category.id,
    parentCategory: product.category.parent?.name ?? undefined,
    description: product.description,
    image: product.images[0]?.url ?? "/wah-thali-meal-cutout-v2.png",
    dietaryType: product.dietaryType as Product["dietaryType"],
    rating: Number(product.rating),
    ratingCount: product.ratingCount,
    prepTimeMinutes: product.prepMinutes,
    price: product.price,
    originalPrice: product.originalPrice ?? undefined,
    bestseller: product.bestseller,
    offer: product.offer ?? undefined,
    available: product.available,
    spiceLevel: product.spiceLevel as Product["spiceLevel"],
    variants: product.variants.map((variant) => ({
      id: variant.id.replace(`${product.id}-`, ""),
      name: variant.name,
      price: variant.price,
    })),
    addons: product.addons.map((addon) => ({
      id: addon.id.replace(`${product.id}-`, ""),
      name: addon.name,
      price: addon.price,
    })),
  };
}

function toAdminProduct(product: ProductWithRelations): AdminProduct {
  return {
    ...toProduct(product),
    image: product.images[0]?.url ?? "",
    stock: product.inventory?.stock ?? 0,
    reorderAt: product.inventory?.reorderAt ?? 0,
    margin: product.inventory?.margin ?? 0,
  };
}

async function getProductSortOrderFromDb(): Promise<string[]> {
  if (!isDatabaseConfigured()) return [];

  try {
    const row = await prisma.businessSetting.findUnique({ where: { key: "productSortOrder" } });
    return isStringArray(row?.value) ? row.value : [];
  } catch (error) {
    console.error("Product sort order read failed.", error);
    return [];
  }
}

function applyProductSortOrder<T extends { id: string; name: string; available?: boolean }>(products: T[], order: string[]) {
  if (!order.length) return products;
  const position = new Map(order.map((id, index) => [id, index]));
  return [...products].sort((a, b) => {
    const aOrder = position.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = position.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder || a.name.localeCompare(b.name);
  });
}

export async function getProductsFromDb(): Promise<Product[]> {
  if (!isDatabaseConfigured()) return fallbackProducts;

  try {
    const [products, productOrder] = await Promise.all([
      prisma.product.findMany({
      where: { category: { visible: true } },
      orderBy: { name: "asc" },
      include: {
        category: { include: { parent: true } },
        images: { orderBy: { sortOrder: "asc" } },
        variants: true,
        addons: true,
        inventory: true,
      },
      }),
      getProductSortOrderFromDb(),
    ]);

    return applyProductSortOrder(products.map(toProduct), productOrder);
  } catch (error) {
    console.error("Database product read failed. Falling back to local product data.", error);
    return fallbackProducts;
  }
}

export async function getAdminProductsFromDb(): Promise<AdminProduct[]> {
  if (!isDatabaseConfigured()) {
    return fallbackProducts.map((product) => ({
      ...product,
      stock: 0,
      reorderAt: 0,
      margin: 0,
    }));
  }

  try {
    const [products, productOrder] = await Promise.all([
      prisma.product.findMany({
      orderBy: { name: "asc" },
      include: {
        category: { include: { parent: true } },
        images: { orderBy: { sortOrder: "asc" } },
        variants: true,
        addons: true,
        inventory: true,
      },
      }),
      getProductSortOrderFromDb(),
    ]);

    return products.length ? applyProductSortOrder(products.map(toAdminProduct), productOrder) : [];
  } catch (error) {
    console.error("Database admin product read failed. Falling back to local product data.", error);
    return fallbackProducts.map((product) => ({
      ...product,
      stock: 0,
      reorderAt: 0,
      margin: 0,
    }));
  }
}

export async function getCategoriesFromDb(): Promise<string[]> {
  if (!isDatabaseConfigured()) return [...new Set(fallbackProducts.map((product) => product.category))];

  try {
    const categories = await prisma.category.findMany({
      where: { visible: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return categories.map((category) => category.name);
  } catch (error) {
    console.error("Database category read failed. Falling back to local categories.", error);
    return [...new Set(fallbackProducts.map((product) => product.category))];
  }
}

export async function getCategoryOptionsFromDb({ visibleOnly = true }: { visibleOnly?: boolean } = {}): Promise<CategoryOption[]> {
  if (!isDatabaseConfigured()) {
    return [...new Set(fallbackProducts.map((product) => product.category))].map((name, index) => ({
      id: name,
      name,
      parentId: null,
      sortOrder: index + 1,
      visible: true,
    }));
  }

  try {
    const categories = await prisma.category.findMany({
      where: visibleOnly ? { visible: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { parent: { select: { id: true, name: true } } },
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      parentId: category.parentId,
      parentName: category.parent?.name,
      sortOrder: category.sortOrder,
      visible: category.visible,
    }));
  } catch (error) {
    console.error("Database category option read failed. Falling back to local categories.", error);
    return [...new Set(fallbackProducts.map((product) => product.category))].map((name, index) => ({
      id: name,
      name,
      parentId: null,
      sortOrder: index + 1,
      visible: true,
    }));
  }
}

function isCategoryImageMap(value: unknown): value is CategoryImageMap {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function getCategoryImagesFromDb(): Promise<CategoryImageMap> {
  if (!isDatabaseConfigured()) return {};

  try {
    const row = await prisma.businessSetting.findUnique({ where: { key: "categoryImages" } });
    return isCategoryImageMap(row?.value) ? row.value : {};
  } catch (error) {
    console.error("Category image read failed.", error);
    return {};
  }
}

function isCategoryOfferMap(value: unknown): value is CategoryOfferMap {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function getCategoryOffersFromDb(): Promise<CategoryOfferMap> {
  if (!isDatabaseConfigured()) return {};

  try {
    const row = await prisma.businessSetting.findUnique({ where: { key: "categoryOffers" } });
    return isCategoryOfferMap(row?.value) ? row.value : {};
  } catch (error) {
    console.error("Category offer read failed.", error);
    return {};
  }
}

type CouponRule = Pick<Coupon, "audience" | "minPoints" | "minCustomerOrders" | "tagNames">;
type CouponRuleMap = Record<string, CouponRule>;

function isCouponRuleMap(value: unknown): value is CouponRuleMap {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function getCouponRulesFromDb(): Promise<CouponRuleMap> {
  if (!isDatabaseConfigured()) return {};

  try {
    const row = await prisma.businessSetting.findUnique({ where: { key: "couponEligibility" } });
    return isCouponRuleMap(row?.value) ? row.value : {};
  } catch (error) {
    console.error("Coupon eligibility read failed.", error);
    return {};
  }
}

export async function saveCouponRule(code: string, rule: CouponRule) {
  const rules = await getCouponRulesFromDb();
  const normalizedCode = code.toUpperCase();
  const normalizedRule: CouponRule = {
    audience: rule.audience ?? "ALL",
    minPoints: rule.audience === "POINTS" ? Math.max(1, Number(rule.minPoints ?? 1)) : 0,
    tagNames: rule.audience === "TAGS" ? normalizeTagNames(rule.tagNames ?? []) : [],
  };

  if (normalizedRule.audience === "ALL" || (normalizedRule.audience === "TAGS" && !normalizedRule.tagNames?.length)) {
    delete rules[normalizedCode];
  } else {
    rules[normalizedCode] = normalizedRule;
  }

  await prisma.businessSetting.upsert({
    where: { key: "couponEligibility" },
    create: { key: "couponEligibility", value: rules as Prisma.InputJsonValue },
    update: { value: rules as Prisma.InputJsonValue },
  });
}

export async function deleteCouponRule(code: string) {
  const rules = await getCouponRulesFromDb();
  delete rules[code.toUpperCase()];

  await prisma.businessSetting.upsert({
    where: { key: "couponEligibility" },
    create: { key: "couponEligibility", value: rules as Prisma.InputJsonValue },
    update: { value: rules as Prisma.InputJsonValue },
  });
}

function applyCouponRules(coupons: Array<{
  code: string;
  label: string;
  type: string;
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  audience?: string;
  minCustomerOrders?: number;
  redemptionLimit?: number | null;
  customerUsageLimit?: number;
  productIds?: string[];
  categoryIds?: string[];
  channels?: string[];
  fulfillmentMethods?: string[];
  startsAt: Date;
  endsAt: Date;
}>, rules: CouponRuleMap): Coupon[] {
  return coupons.map((coupon) => {
    const rule = rules[coupon.code] ?? {};
    return {
      code: coupon.code,
      label: coupon.label,
      type: coupon.type as Coupon["type"],
      value: coupon.value,
      minOrder: coupon.minOrder,
      maxDiscount: coupon.maxDiscount ?? undefined,
      audience: (coupon.audience ?? rule.audience ?? "ALL") as Coupon["audience"],
      minPoints: rule.minPoints ?? coupon.minCustomerOrders ?? 0,
      minCustomerOrders: coupon.minCustomerOrders ?? rule.minCustomerOrders ?? rule.minPoints ?? 0,
      redemptionLimit: coupon.redemptionLimit ?? undefined,
      customerUsageLimit: coupon.customerUsageLimit ?? 1,
      productIds: coupon.productIds ?? [],
      categoryIds: coupon.categoryIds ?? [],
      channels: (coupon.channels?.length ? coupon.channels : ["WEBSITE"]) as Coupon["channels"],
      fulfillmentMethods: (coupon.fulfillmentMethods?.length ? coupon.fulfillmentMethods : ["DELIVERY", "PICKUP"]) as Coupon["fulfillmentMethods"],
      tagNames: rule.tagNames ?? [],
      startsAt: coupon.startsAt.toISOString(),
      endsAt: coupon.endsAt.toISOString(),
    };
  });
}

function normalizeTagNames(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 12);
}

export async function getCouponsFromDb(): Promise<Coupon[]> {
  if (!isDatabaseConfigured()) return fallbackCoupons;

  try {
    const now = new Date();
    const [coupons, rules, redemptionCounts] = await Promise.all([
      prisma.coupon.findMany({
      where: {
        active: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: { code: "asc" },
    }),
      getCouponRulesFromDb(),
      prisma.couponRedemption.groupBy({
        by: ["couponCode"],
        _count: { _all: true },
      }).catch(() => []),
    ]);
    const redeemedCountByCode = new Map(redemptionCounts.map((row) => [row.couponCode, row._count._all]));

    return withRewardCoupons(applyCouponRules(coupons, rules)
      .map((coupon) => ({ ...coupon, redeemedCount: redeemedCountByCode.get(coupon.code) ?? 0 }))
      .filter((coupon) => !coupon.redemptionLimit || (coupon.redeemedCount ?? 0) < coupon.redemptionLimit));
  } catch (error) {
    console.error("Database coupon read failed. Falling back to local coupons.", error);
    return fallbackCoupons;
  }
}

export async function getAdminCouponsFromDb(): Promise<Array<Coupon & { active: boolean }>> {
  if (!isDatabaseConfigured()) return [];

  const [coupons, rules, redemptionCounts] = await Promise.all([
    prisma.coupon.findMany({ orderBy: { code: "asc" } }),
    getCouponRulesFromDb(),
    prisma.couponRedemption.groupBy({
      by: ["couponCode"],
      _count: { _all: true },
    }).catch(() => []),
  ]);
  const redemptionCountByCode = new Map(redemptionCounts.map((row) => [row.couponCode, row._count._all]));

  return withRewardCoupons(applyCouponRules(coupons, rules)).map((coupon) => ({
    ...coupon,
    redeemedCount: redemptionCountByCode.get(coupon.code) ?? 0,
    active: coupons.find((item) => item.code === coupon.code)?.active ?? true,
  }));
}

function withRewardCoupons(coupons: Coupon[]) {
  const couponByCode = new Map(coupons.map((coupon) => [coupon.code, coupon]));
  for (const rewardCoupon of rewardCoupons) {
    couponByCode.set(rewardCoupon.code, {
      ...rewardCoupon,
      startsAt: rewardCoupon.startsAt ?? "2026-01-01T00:00:00.000Z",
      endsAt: rewardCoupon.endsAt ?? "2028-01-01T00:00:00.000Z",
    });
  }
  return Array.from(couponByCode.values());
}

export async function getBusinessSettingsFromDb(): Promise<BusinessSettings> {
  if (!isDatabaseConfigured()) return fallbackSettings;

  try {
    const rows = await prisma.businessSetting.findMany();
    if (!rows.length) return fallbackSettings;

    const settings = rows.reduce<BusinessSettings>((settings, row) => {
      if (!businessSettingKeys.includes(row.key)) return settings;

      return {
        ...settings,
        [row.key]: row.value,
      };
    }, fallbackSettings);

    return withDefaultKitchenCoordinates(normalizeBusinessSettings(settings));
  } catch (error) {
    console.error("Database settings read failed. Falling back to local settings.", error);
    return fallbackSettings;
  }
}

function normalizeBusinessSettings(settings: BusinessSettings): BusinessSettings {
  const deliveryFeeMode = settings.deliveryFeeMode === "PERCENT" || settings.deliveryFeeMode === "DISTANCE"
    ? settings.deliveryFeeMode
    : "FLAT";

  return {
    ...settings,
    gstRate: normalizeGstRate(Number(settings.gstRate)),
    deliveryFeeMode,
    deliveryFeePercent: Number.isFinite(Number(settings.deliveryFeePercent)) ? Number(settings.deliveryFeePercent) : fallbackSettings.deliveryFeePercent,
    deliveryDistanceSlabs: normalizeDeliveryDistanceSlabs(settings.deliveryDistanceSlabs).length
      ? normalizeDeliveryDistanceSlabs(settings.deliveryDistanceSlabs)
      : fallbackSettings.deliveryDistanceSlabs,
  };
}

function withDefaultKitchenCoordinates(settings: BusinessSettings): BusinessSettings {
  if (settings.kitchenLatitude || settings.kitchenLongitude) return settings;
  const normalizedAddress = settings.kitchenAddress.toLowerCase();
  if (!normalizedAddress.includes("rajdanga") && !normalizedAddress.includes("kasba")) return settings;

  return {
    ...settings,
    kitchenLatitude: fallbackSettings.kitchenLatitude,
    kitchenLongitude: fallbackSettings.kitchenLongitude,
  };
}

export const defaultAdvancedSettings: AdvancedSettings = {
  storeMode: "OPEN",
  storeStatusReason: "",
  busyMessage: "The kitchen is busy right now. Orders are open, but prep time may be longer than usual.",
  pausedMessage: "Ordering is paused for a short time. Please check back soon.",
  closedMessage: "The restaurant is closed right now. Please order during opening hours.",
  autoAcceptOrders: false,
  requireDeclineReason: true,
  maxOrdersPerSlot: 25,
  defaultPrepMinutes: 25,
  rushPrepBufferMinutes: 10,
  lastOrderBufferMinutes: 30,
  codEnabled: true,
  onlinePaymentsEnabled: false,
  lowStockAlertThreshold: 5,
  newOrderSoundEnabled: true,
  newOrderSound: defaultNewOrderSound,
  whatsappOrderAlerts: false,
  ownerWhatsAppOrderAlerts: true,
  adminDailyDigestTime: "21:00",
};

const advancedSettingKeys = Object.keys(defaultAdvancedSettings) as (keyof AdvancedSettings)[];

function readString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readStoreMode(value: unknown): StoreMode {
  return value === "OPEN" || value === "BUSY" || value === "PAUSED" || value === "CLOSED" ? value : "OPEN";
}

export async function getAdvancedSettingsFromDb(): Promise<AdvancedSettings> {
  if (!isDatabaseConfigured()) return defaultAdvancedSettings;

  try {
    const rows = await prisma.businessSetting.findMany({
      where: { key: { in: advancedSettingKeys } },
    });
    const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));

    return {
      storeMode: readStoreMode(values.storeMode),
      storeStatusReason: readString(values.storeStatusReason, defaultAdvancedSettings.storeStatusReason),
      busyMessage: readString(values.busyMessage, defaultAdvancedSettings.busyMessage),
      pausedMessage: readString(values.pausedMessage, defaultAdvancedSettings.pausedMessage),
      closedMessage: readString(values.closedMessage, defaultAdvancedSettings.closedMessage),
      autoAcceptOrders: readBoolean(values.autoAcceptOrders, defaultAdvancedSettings.autoAcceptOrders),
      requireDeclineReason: readBoolean(values.requireDeclineReason, defaultAdvancedSettings.requireDeclineReason),
      maxOrdersPerSlot: readNumber(values.maxOrdersPerSlot, defaultAdvancedSettings.maxOrdersPerSlot),
      defaultPrepMinutes: readNumber(values.defaultPrepMinutes, defaultAdvancedSettings.defaultPrepMinutes),
      rushPrepBufferMinutes: readNumber(values.rushPrepBufferMinutes, defaultAdvancedSettings.rushPrepBufferMinutes),
      lastOrderBufferMinutes: readNumber(values.lastOrderBufferMinutes, defaultAdvancedSettings.lastOrderBufferMinutes),
      codEnabled: readBoolean(values.codEnabled, defaultAdvancedSettings.codEnabled),
      onlinePaymentsEnabled: readBoolean(values.onlinePaymentsEnabled, defaultAdvancedSettings.onlinePaymentsEnabled),
      lowStockAlertThreshold: readNumber(values.lowStockAlertThreshold, defaultAdvancedSettings.lowStockAlertThreshold),
      newOrderSoundEnabled: readBoolean(values.newOrderSoundEnabled, defaultAdvancedSettings.newOrderSoundEnabled),
      newOrderSound: getNewOrderSound(values.newOrderSound),
      whatsappOrderAlerts: readBoolean(values.whatsappOrderAlerts, defaultAdvancedSettings.whatsappOrderAlerts),
      ownerWhatsAppOrderAlerts: readBoolean(values.ownerWhatsAppOrderAlerts, defaultAdvancedSettings.ownerWhatsAppOrderAlerts),
      adminDailyDigestTime: readString(values.adminDailyDigestTime, defaultAdvancedSettings.adminDailyDigestTime),
    };
  } catch (error) {
    console.error("Advanced settings read failed. Falling back to defaults.", error);
    return defaultAdvancedSettings;
  }
}

export async function getRestaurantSettingsFromDb(): Promise<RestaurantSettings> {
  const [businessSettings, advancedSettings] = await Promise.all([
    getBusinessSettingsFromDb(),
    getAdvancedSettingsFromDb(),
  ]);

  return { ...businessSettings, ...advancedSettings };
}

export const defaultHomeSlides: HomeSlide[] = [];

function isHomeSlides(value: unknown): value is HomeSlide[] {
  return Array.isArray(value) && value.every((slide) => {
    if (!slide || typeof slide !== "object") return false;
    const item = slide as Record<string, unknown>;
    return ["id", "eyebrow", "title", "body", "code", "image"].every((key) => typeof item[key] === "string") &&
      (item.targetCategory === undefined || typeof item.targetCategory === "string");
  });
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export async function getHomeDishCategoriesFromDb(): Promise<string[]> {
  if (!isDatabaseConfigured()) return [];

  try {
    const row = await prisma.businessSetting.findUnique({ where: { key: "homeDishCategories" } });
    return isStringArray(row?.value) ? row.value : [];
  } catch (error) {
    console.error("Home dish category read failed.", error);
    return [];
  }
}

export async function getCartSuggestionCategoriesFromDb(): Promise<string[]> {
  if (!isDatabaseConfigured()) return [];

  try {
    const row = await prisma.businessSetting.findUnique({ where: { key: "cartSuggestionCategories" } });
    return isStringArray(row?.value) ? row.value : [];
  } catch (error) {
    console.error("Cart suggestion category read failed.", error);
    return [];
  }
}

export async function getHomeSlidesFromDb(): Promise<HomeSlide[]> {
  if (!isDatabaseConfigured()) return defaultHomeSlides;

  try {
    const row = await prisma.businessSetting.findUnique({ where: { key: "homeSlides" } });
    const slides = isHomeSlides(row?.value) ? row.value : defaultHomeSlides;
    return slides
      .filter((slide) => slide.active)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (error) {
    console.error("Home slide read failed. Falling back to default slides.", error);
    return defaultHomeSlides;
  }
}

export const getPublicHomePageDataFromDb = unstable_cache(
  async () => {
    const [categories, categoryOptions, products, slides, categoryImages, categoryOffers, restaurantSettings, coupons, homeDishCategories] = await Promise.all([
      getCategoriesFromDb(),
      getCategoryOptionsFromDb(),
      getProductsFromDb(),
      getHomeSlidesFromDb(),
      getCategoryImagesFromDb(),
      getCategoryOffersFromDb(),
      getRestaurantSettingsFromDb(),
      getCouponsFromDb(),
      getHomeDishCategoriesFromDb(),
    ]);

    return { categories, categoryOptions, products, slides, categoryImages, categoryOffers, restaurantSettings, coupons, homeDishCategories };
  },
  ["public-home-page-data"],
  { revalidate: storefrontCacheSeconds, tags: ["storefront", "storefront-home"] },
);

export const getPublicMenuPageDataFromDb = unstable_cache(
  async () => {
    const [categories, categoryOptions, products, slides, categoryImages, categoryOffers, restaurantSettings, homeDishCategories] = await Promise.all([
      getCategoriesFromDb(),
      getCategoryOptionsFromDb(),
      getProductsFromDb(),
      getHomeSlidesFromDb(),
      getCategoryImagesFromDb(),
      getCategoryOffersFromDb(),
      getRestaurantSettingsFromDb(),
      getHomeDishCategoriesFromDb(),
    ]);

    return { categories, categoryOptions, products, slides, categoryImages, categoryOffers, restaurantSettings, homeDishCategories };
  },
  ["public-menu-page-data"],
  { revalidate: storefrontCacheSeconds, tags: ["storefront", "storefront-menu"] },
);

export const getPublicCartPageDataFromDb = unstable_cache(
  async () => {
    const [products, coupons, restaurantSettings, categoryOffers, cartSuggestionCategories] = await Promise.all([
      getProductsFromDb(),
      getCouponsFromDb(),
      getRestaurantSettingsFromDb(),
      getCategoryOffersFromDb(),
      getCartSuggestionCategoriesFromDb(),
    ]);

    return { products, coupons, restaurantSettings, categoryOffers, cartSuggestionCategories };
  },
  ["public-cart-page-data"],
  { revalidate: storefrontCacheSeconds, tags: ["storefront", "storefront-cart"] },
);

export const getPublicOffersPageDataFromDb = unstable_cache(
  async () => {
    const coupons = await getCouponsFromDb();
    return { coupons };
  },
  ["public-offers-page-data"],
  { revalidate: storefrontCacheSeconds, tags: ["storefront", "storefront-offers"] },
);

export const getPublicWishlistPageDataFromDb = unstable_cache(
  async () => {
    const products = await getProductsFromDb();
    return { products };
  },
  ["public-wishlist-page-data"],
  { revalidate: storefrontCacheSeconds, tags: ["storefront", "storefront-wishlist"] },
);

export async function getAdminOrdersFromDb(): Promise<AdminOrder[]> {
  if (!isDatabaseConfigured()) return [];

  const baseInclude = {
    customer: { select: { id: true, name: true, mobile: true, email: true } },
    items: true,
    payments: true,
    timeline: { orderBy: { createdAt: "asc" as const } },
  };
  const reviewInclude = {
    ...baseInclude,
    reviews: {
      include: { product: { select: { name: true } } },
      orderBy: { createdAt: "desc" as const },
    },
  };

  try {
    const orders = await prisma.order.findMany({
      where: visiblePlacedOrderWhere(),
      include: reviewInclude,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return orders.map(toAdminOrder);
  } catch (error) {
    if (!isMissingReviewOrderColumn(error)) throw error;
    console.error("Review.orderId is missing in the database. Loading admin orders without review summaries.", error);
  }

  const orders = await prisma.order.findMany({
    where: visiblePlacedOrderWhere(),
    include: {
      ...baseInclude,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return orders.map((order) => toAdminOrder({ ...order, reviews: [] }));
}

function visiblePlacedOrderWhere(): Prisma.OrderWhereInput {
  return {
    OR: [
      { payments: { some: { provider: "COD" } } },
      { payments: { some: { provider: "RAZORPAY", status: { in: paidOnlineStatuses } } } },
    ],
  };
}

function toAdminOrder(order: Prisma.OrderGetPayload<{
  include: {
    customer: { select: { id: true; name: true; mobile: true; email: true } };
    items: true;
    payments: true;
    timeline: true;
  };
}> & {
  reviews?: Array<{
    id: string;
    product: { name: string };
    rating: number;
    comment: string | null;
    createdAt: Date;
  }>;
}): AdminOrder {
  return {
    orderNumber: order.orderNumber,
    customerName: order.customer.name,
    customerMobile: order.customer.mobile,
    customerEmail: order.customer.email ?? undefined,
    status: order.status as AdminOrder["status"],
    subtotal: order.subtotal,
    discount: order.discount,
    gst: order.gst,
    amount: order.grandTotal,
    items: order.items.map((item) => ({ productId: item.productId, name: item.name, quantity: item.quantity, price: item.price })),
    itemSummary: order.items.map((item) => `${item.quantity} x ${item.name}`).join(", "),
    payments: order.payments.map((payment) => ({
      provider: payment.provider,
      status: payment.status,
      amount: payment.amount,
      providerPaymentId: payment.providerPaymentId,
    })),
    paymentSummary: getAdminPaymentSummary(order.payments[0]),
    createdAt: order.createdAt.toISOString(),
    timeline: order.timeline.map((event) => ({
      toStatus: event.toStatus,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
    })),
    reviews: (order.reviews ?? []).map((review) => ({
      id: review.id,
      productName: review.product.name,
      rating: review.rating,
      comment: review.comment ?? undefined,
      createdAt: review.createdAt.toISOString(),
    })),
  };
}

function isMissingReviewOrderColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Review.orderId") || (message.includes("Review") && message.includes("orderId"));
}

function getAdminPaymentSummary(payment?: { provider: string; status: string }) {
  if (!payment) return "Cash on Delivery";
  if (payment.provider === "COD") return "Cash on Delivery";
  if (payment.status === "REFUND_PENDING") return "Refund pending";
  if (payment.status === "PARTIALLY_REFUNDED") return "Partially refunded";
  if (payment.status === "REFUNDED") return "Refunded";
  if (payment.status === "PAID" || payment.status === "AUTHORIZED") return "Online payment received";
  if (payment.status === "CREATED") return "Online payment pending";
  return "Online payment";
}

export async function getAdminCustomersFromDb(): Promise<AdminCustomer[]> {
  if (!isDatabaseConfigured()) return [];

  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      name: true,
      mobile: true,
      email: true,
      birthday: true,
      anniversary: true,
      updatedAt: true,
      tags: { include: { tag: { select: { name: true } } } },
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          orderNumber: true,
          status: true,
          grandTotal: true,
          createdAt: true,
          items: { select: { name: true, quantity: true } },
          payments: { select: { provider: true, status: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return customers.map((customer) => {
    const ltv = customer.orders.reduce((total, order) => total + order.grandTotal, 0);
    const rewardOrderCount = customer.orders.length;
    const tagNames = customer.tags.map((assignment) => assignment.tag.name);

    return {
    id: customer.id,
    name: customer.name,
    mobile: customer.mobile,
    email: customer.email ?? undefined,
    birthday: customer.birthday?.toISOString(),
    anniversary: customer.anniversary?.toISOString(),
    tags: tagNames,
    orders: customer.orders.length,
    ltv,
    points: rewardOrderCount,
    tier: getRewardTier(rewardOrderCount),
    isVip: tagNames.includes("VIP"),
    lastOrder: customer.orders[0]?.createdAt.toISOString(),
    orderHistory: customer.orders.slice(0, 20).map((order) => ({
      orderNumber: order.orderNumber,
      status: order.status as AdminOrder["status"],
      amount: order.grandTotal,
      createdAt: order.createdAt.toISOString(),
      itemSummary: order.items.map((item) => `${item.quantity} x ${item.name}`).join(", "),
      paymentSummary: getAdminPaymentSummary(order.payments[0]),
    })),
    };
  });
}

export async function getCustomerTagsFromDb(): Promise<string[]> {
  if (!isDatabaseConfigured()) return ["VIP"];

  const tags = await prisma.customerTag.findMany({
    orderBy: { name: "asc" },
    select: { name: true },
  });

  return Array.from(new Set(["VIP", ...tags.map((tag) => tag.name)])).sort((a, b) => a.localeCompare(b));
}

export async function getAdminDashboardMetrics(preloadedProducts?: AdminProduct[]) {
  if (!isDatabaseConfigured()) {
    return {
      salesToday: 0,
      netRevenue: 0,
      totalOrders: 0,
      openOrders: 0,
      repeatCustomers: 0,
      activeProducts: 0,
      totalProducts: 0,
      activeCoupons: 0,
      unavailableItems: 0,
      lowStock: [] as AdminProduct[],
      actionQueue: [] as string[],
    };
  }

  const today = getIstDayRangeUtc();

  const [ordersToday, totalOrders, openOrders, repeatCustomers, products, coupons] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: today.start, lt: today.end } } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: { in: ["NEW", "CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"] } } }),
    prisma.customer.count({ where: { orders: { some: {} } } }),
    preloadedProducts ? Promise.resolve(preloadedProducts) : getAdminProductsFromDb(),
    getCouponsFromDb(),
  ]);

  const salesToday = ordersToday.reduce((total, order) => total + order.grandTotal, 0);
  const lowStock = products.filter((product) => product.stock <= product.reorderAt);

  return {
    salesToday,
    netRevenue: ordersToday.reduce((total, order) => total + order.subtotal - order.discount, 0),
    totalOrders,
    openOrders,
    repeatCustomers,
    activeProducts: products.filter((product) => product.available).length,
    totalProducts: products.length,
    activeCoupons: coupons.length,
    unavailableItems: products.filter((product) => !product.available).length,
    lowStock,
    actionQueue: [
      ...(openOrders ? [`${openOrders} orders need kitchen action`] : []),
      ...(products.some((product) => !product.available) ? [`${products.filter((product) => !product.available).length} menu items are offline`] : []),
    ],
  };
}

export async function logActivity(input: {
  type: string;
  actor?: string;
  entity: string;
  entityId?: string;
  summary: string;
  metadata?: Prisma.InputJsonValue;
}) {
  if (!isDatabaseConfigured()) return null;

  try {
    return await prisma.activityEvent.create({ data: input });
  } catch (error) {
    console.error("Activity log write failed.", error);
    return null;
  }
}
