import "server-only";

import { Prisma } from "@prisma/client";
import { coupons as fallbackCoupons, products as fallbackProducts, settings as fallbackSettings } from "@/lib/data";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import type { BusinessSettings, Coupon, Product } from "@/lib/types";

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

export async function getProductsFromDb(): Promise<Product[]> {
  if (!isDatabaseConfigured()) return fallbackProducts;

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

    return products.length ? products.map(toProduct) : fallbackProducts;
  } catch (error) {
    console.error("Database product read failed. Falling back to local product data.", error);
    return fallbackProducts;
  }
}

export async function getCategoriesFromDb(): Promise<string[]> {
  if (!isDatabaseConfigured()) return [...new Set(fallbackProducts.map((product) => product.category))];

  try {
    const categories = await prisma.category.findMany({
      where: { visible: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return categories.length ? categories.map((category) => category.name) : [...new Set(fallbackProducts.map((product) => product.category))];
  } catch (error) {
    console.error("Database category read failed. Falling back to local categories.", error);
    return [...new Set(fallbackProducts.map((product) => product.category))];
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

    return coupons.length
      ? coupons.map((coupon) => ({
          code: coupon.code,
          label: coupon.label,
          type: coupon.type as Coupon["type"],
          value: coupon.value,
          minOrder: coupon.minOrder,
          maxDiscount: coupon.maxDiscount ?? undefined,
        }))
      : fallbackCoupons;
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
