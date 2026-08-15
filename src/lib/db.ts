import "server-only";

import { Prisma } from "@prisma/client";
import { coupons as fallbackCoupons, products as fallbackProducts, settings as fallbackSettings } from "@/lib/data";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import type { AdvancedSettings, AdminCustomer, AdminOrder, AdminProduct, BusinessSettings, CategoryImageMap, CategoryOfferMap, Coupon, HomeSlide, Product, RestaurantSettings, StoreMode } from "@/lib/types";

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    category: true;
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
    category: product.category.name,
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
    stock: product.inventory?.stock ?? 0,
    reorderAt: product.inventory?.reorderAt ?? 0,
    margin: product.inventory?.margin ?? 0,
  };
}

export async function getProductsFromDb(): Promise<Product[]> {
  if (!isDatabaseConfigured()) return fallbackProducts;

  try {
    const products = await prisma.product.findMany({
      where: { category: { visible: true } },
      orderBy: { name: "asc" },
      include: {
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
        variants: true,
        addons: true,
        inventory: true,
      },
    });

    return products.map(toProduct);
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
    const products = await prisma.product.findMany({
      orderBy: { name: "asc" },
      include: {
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
        variants: true,
        addons: true,
        inventory: true,
      },
    });

    return products.length ? products.map(toAdminProduct) : [];
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

export async function getCouponsFromDb(): Promise<Coupon[]> {
  if (!isDatabaseConfigured()) return fallbackCoupons;

  try {
    const now = new Date();
    const coupons = await prisma.coupon.findMany({
      where: {
        active: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: { code: "asc" },
    });

    return coupons.map((coupon) => ({
      code: coupon.code,
      label: coupon.label,
      type: coupon.type as Coupon["type"],
      value: coupon.value,
      minOrder: coupon.minOrder,
      maxDiscount: coupon.maxDiscount ?? undefined,
      startsAt: coupon.startsAt.toISOString(),
      endsAt: coupon.endsAt.toISOString(),
    }));
  } catch (error) {
    console.error("Database coupon read failed. Falling back to local coupons.", error);
    return fallbackCoupons;
  }
}

export async function getBusinessSettingsFromDb(): Promise<BusinessSettings> {
  if (!isDatabaseConfigured()) return fallbackSettings;

  try {
    const rows = await prisma.businessSetting.findMany();
    if (!rows.length) return fallbackSettings;

    return rows.reduce<BusinessSettings>((settings, row) => {
      return {
        ...settings,
        [row.key]: row.value,
      };
    }, fallbackSettings);
  } catch (error) {
    console.error("Database settings read failed. Falling back to local settings.", error);
    return fallbackSettings;
  }
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
  whatsappOrderAlerts: true,
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
      whatsappOrderAlerts: readBoolean(values.whatsappOrderAlerts, defaultAdvancedSettings.whatsappOrderAlerts),
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

export const defaultHomeSlides: HomeSlide[] = [
  {
    id: "thali-deal",
    eyebrow: "Thali deal",
    title: "Flat 20% OFF",
    body: "on all Thalis Today!",
    code: "WAHTHALI20",
    image: "/wah-thali-meal-cutout-v2.png",
    targetCategory: "Exclusive Thali",
    active: true,
    sortOrder: 1,
  },
  {
    id: "family-feast",
    eyebrow: "Family feast",
    title: "Combo at Rs 499",
    body: "2 thalis, dessert, and drinks.",
    code: "FAMILY10",
    image: "/wah-thali-meal-cutout-v2.png",
    targetCategory: "Indian Combo",
    active: true,
    sortOrder: 2,
  },
  {
    id: "lunch-saver",
    eyebrow: "Lunch saver",
    title: "Mini meals from Rs 99",
    body: "Fast office lunch, fresh daily.",
    code: "MINI99",
    image: "/wah-thali-meal-cutout-v2.png",
    targetCategory: "Meal at 99",
    active: true,
    sortOrder: 3,
  },
];

function isHomeSlides(value: unknown): value is HomeSlide[] {
  return Array.isArray(value) && value.every((slide) => {
    if (!slide || typeof slide !== "object") return false;
    const item = slide as Record<string, unknown>;
    return ["id", "eyebrow", "title", "body", "code", "image"].every((key) => typeof item[key] === "string") &&
      (item.targetCategory === undefined || typeof item.targetCategory === "string");
  });
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

export async function getAdminOrdersFromDb(): Promise<AdminOrder[]> {
  if (!isDatabaseConfigured()) return [];

  const orders = await prisma.order.findMany({
    include: {
      customer: { select: { id: true, name: true, mobile: true, email: true } },
      items: true,
      payments: true,
      timeline: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return orders.map((order) => ({
    orderNumber: order.orderNumber,
    customerName: order.customer.name,
    customerMobile: order.customer.mobile,
    status: order.status as AdminOrder["status"],
    amount: order.grandTotal,
    itemSummary: order.items.map((item) => `${item.quantity} x ${item.name}`).join(", "),
    paymentSummary: order.payments[0]?.status ? `${order.payments[0].provider} ${order.payments[0].status}` : "COD pending",
    createdAt: order.createdAt.toISOString(),
    timeline: order.timeline.map((event) => ({
      toStatus: event.toStatus,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
    })),
  }));
}

export async function getAdminCustomersFromDb(): Promise<AdminCustomer[]> {
  if (!isDatabaseConfigured()) return [];

  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      name: true,
      mobile: true,
      email: true,
      updatedAt: true,
      loyalty: true,
      orders: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    mobile: customer.mobile,
    email: customer.email ?? undefined,
    orders: customer.orders.length,
    ltv: customer.orders.reduce((total, order) => total + order.grandTotal, 0),
    points: customer.loyalty?.points ?? 0,
    tier: customer.loyalty?.tier ?? "Starter",
    lastOrder: customer.orders[0]?.createdAt.toISOString(),
  }));
}

export async function getAdminDashboardMetrics() {
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [ordersToday, totalOrders, openOrders, repeatCustomers, products, coupons] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: today } } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: { in: ["NEW", "CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"] } } }),
    prisma.customer.count({ where: { orders: { some: {} } } }),
    getAdminProductsFromDb(),
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
      ...lowStock.slice(0, 3).map((product) => `${product.name} low stock: ${product.stock} left`),
      ...(openOrders ? [`${openOrders} orders need kitchen action`] : []),
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
