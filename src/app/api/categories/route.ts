import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const categorySchema = z.object({
  name: z.string().min(1),
  parentId: nullableParentId(),
  image: z.string().optional(),
  offer: z.string().optional(),
  visible: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

const reorderSchema = z.object({
  order: z.array(z.object({
    id: z.string().min(1),
    sortOrder: z.coerce.number().int().min(1),
  })).min(1).optional(),
  cartSuggestionCategories: z.array(z.string().trim().min(1)).max(2).optional(),
});

async function getHandler() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ categories: [], configured: false });
  }

  const [categories, imageSetting, offerSetting, cartSuggestionSetting] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { products: true } },
        products: {
          take: 1,
          include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
        },
      },
    }),
    prisma.businessSetting.findUnique({ where: { key: "categoryImages" } }),
    prisma.businessSetting.findUnique({ where: { key: "categoryOffers" } }),
    prisma.businessSetting.findUnique({ where: { key: "cartSuggestionCategories" } }),
  ]);
  const images = getImageMap(imageSetting?.value);
  const offers = getTextMap(offerSetting?.value);
  const cartSuggestionCategories = getStringArray(cartSuggestionSetting?.value);

  return NextResponse.json({
    categories: categories.map((category) => ({
      ...category,
      image: images[category.slug] ?? "",
      offer: offers[category.slug] ?? "",
    })),
    cartSuggestionCategories,
    configured: true,
  });
}

async function postHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "categories");
  if (!access.ok) return access.response;

  const parsed = categorySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { image, offer, ...categoryData } = parsed.data;
  const slug = slugify(categoryData.name);
  const category = await prisma.category.upsert({
    where: { slug: slugify(parsed.data.name) },
    create: { ...categoryData, slug },
    update: categoryData,
  });

  if (image !== undefined) {
    const existing = await prisma.businessSetting.findUnique({ where: { key: "categoryImages" } });
    const images = getImageMap(existing?.value);
    if (image.trim()) {
      images[slug] = image.trim();
    } else {
      delete images[slug];
    }
    await prisma.businessSetting.upsert({
      where: { key: "categoryImages" },
      create: { key: "categoryImages", value: images as Prisma.InputJsonValue },
      update: { value: images as Prisma.InputJsonValue },
    });
  }

  if (offer !== undefined) {
    const existing = await prisma.businessSetting.findUnique({ where: { key: "categoryOffers" } });
    const offers = getTextMap(existing?.value);
    if (offer.trim()) {
      offers[slug] = offer.trim();
    } else {
      delete offers[slug];
    }
    await prisma.businessSetting.upsert({
      where: { key: "categoryOffers" },
      create: { key: "categoryOffers", value: offers as Prisma.InputJsonValue },
      update: { value: offers as Prisma.InputJsonValue },
    });
  }

  await logActivity({
    type: "CATEGORY_SAVED",
    entity: "Category",
    entityId: category.id,
    summary: `Saved category ${category.name}`,
  });
  revalidateTag("storefront", { expire: 0 });

  return NextResponse.json({ category }, { status: 201 });
}

async function patchHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "categories");
  if (!access.ok) return access.response;

  const parsed = reorderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category order", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (!parsed.data.order && parsed.data.cartSuggestionCategories === undefined) {
    return NextResponse.json({ error: "No category update supplied." }, { status: 400 });
  }

  const updates = parsed.data.order?.map((item, index) =>
    prisma.category.update({
      where: { id: item.id },
      data: { sortOrder: index + 1 },
    }),
  ) ?? [];
  if (updates.length) {
    await prisma.$transaction(updates);
  }

  if (parsed.data.cartSuggestionCategories !== undefined) {
    const cartSuggestionCategories = parsed.data.cartSuggestionCategories.slice(0, 2);
    await Promise.all([
      prisma.businessSetting.upsert({
        where: { key: "cartSuggestionCategories" },
        create: { key: "cartSuggestionCategories", value: cartSuggestionCategories as Prisma.InputJsonValue },
        update: { value: cartSuggestionCategories as Prisma.InputJsonValue },
      }),
      prisma.businessSetting.upsert({
        where: { key: "homeDishCategories" },
        create: { key: "homeDishCategories", value: cartSuggestionCategories as Prisma.InputJsonValue },
        update: { value: cartSuggestionCategories as Prisma.InputJsonValue },
      }),
    ]);
  }

  await logActivity({
    type: "CATEGORY_REORDERED",
    entity: "Category",
    summary: updates.length ? `Reordered ${updates.length} categories` : "Updated cart suggestion categories",
    metadata: parsed.data as Prisma.InputJsonValue,
  });
  revalidateTag("storefront", { expire: 0 });

  return NextResponse.json({ ok: true });
}

function getImageMap(value: unknown): Record<string, string> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, string>) : {};
}

function getTextMap(value: unknown): Record<string, string> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, string>) : {};
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

function nullableParentId() {
  return z.preprocess(
    (value) => value === "" ? null : value,
    z.string().min(1).nullable().optional(),
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const GET = withApiErrorHandling(getHandler, "GET /api/categories");
export const POST = withApiErrorHandling(postHandler, "POST /api/categories");
export const PATCH = withApiErrorHandling(patchHandler, "PATCH /api/categories");
