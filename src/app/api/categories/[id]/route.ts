import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const categorySchema = z.object({
  name: z.string().trim().min(1).optional(),
  parentId: nullableParentId(),
  image: z.string().optional(),
  offer: z.string().optional(),
  visible: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

async function patchHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "categories");
  if (!access.ok) return access.response;

  const { id } = await params;
  const parsed = categorySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category update", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { image, offer, ...categoryData } = parsed.data;
  const previous = await prisma.category.findUniqueOrThrow({ where: { id } });
  if (categoryData.name) {
    const duplicate = await prisma.category.findFirst({
      where: { slug: slugify(categoryData.name), NOT: { id } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: "This category already exists. Use a different category name." }, { status: 409 });
    }
  }
  if (categoryData.parentId === id) {
    return NextResponse.json({ error: "A category cannot be its own parent." }, { status: 400 });
  }
  if (categoryData.parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: categoryData.parentId },
      select: { parentId: true },
    });
    if (!parent || parent.parentId) {
      return NextResponse.json({ error: "Subcategories can only be assigned under a main category." }, { status: 400 });
    }
  }
  if (categoryData.parentId && await wouldCreateCategoryCycle(id, categoryData.parentId)) {
    return NextResponse.json({ error: "A category cannot use one of its own subcategories as a parent." }, { status: 400 });
  }
  const category = await prisma.category.update({
    where: { id },
    data: {
      ...categoryData,
      slug: categoryData.name ? slugify(categoryData.name) : undefined,
    },
  });

  if (image !== undefined || categoryData.name) {
    const existing = await prisma.businessSetting.findUnique({ where: { key: "categoryImages" } });
    const images = getImageMap(existing?.value);
    const previousSlug = previous.slug;
    const nextSlug = category.slug;
    const nextImage = image !== undefined ? image.trim() : images[previousSlug];

    delete images[previousSlug];
    if (nextImage) images[nextSlug] = nextImage;

    await prisma.businessSetting.upsert({
      where: { key: "categoryImages" },
      create: { key: "categoryImages", value: images as Prisma.InputJsonValue },
      update: { value: images as Prisma.InputJsonValue },
    });
  }

  if (offer !== undefined || categoryData.name) {
    const existing = await prisma.businessSetting.findUnique({ where: { key: "categoryOffers" } });
    const offers = getTextMap(existing?.value);
    const previousSlug = previous.slug;
    const nextSlug = category.slug;
    const nextOffer = offer !== undefined ? offer.trim() : offers[previousSlug];

    delete offers[previousSlug];
    if (nextOffer) offers[nextSlug] = nextOffer;

    await prisma.businessSetting.upsert({
      where: { key: "categoryOffers" },
      create: { key: "categoryOffers", value: offers as Prisma.InputJsonValue },
      update: { value: offers as Prisma.InputJsonValue },
    });
  }

  await logActivity({
    type: "CATEGORY_UPDATED",
    entity: "Category",
    entityId: category.id,
    summary: `Updated category ${category.name}`,
  });
  revalidateTag("storefront", { expire: 0 });

  return NextResponse.json({ category });
}

function getImageMap(value: unknown): Record<string, string> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, string>) : {};
}

function getTextMap(value: unknown): Record<string, string> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, string>) : {};
}

function nullableParentId() {
  return z.preprocess(
    (value) => value === "" ? null : value,
    z.string().min(1).nullable().optional(),
  );
}

async function wouldCreateCategoryCycle(categoryId: string, parentId: string) {
  const visited = new Set<string>();
  let currentParentId: string | null = parentId;

  while (currentParentId) {
    if (currentParentId === categoryId) return true;
    if (visited.has(currentParentId)) return true;
    visited.add(currentParentId);

    const parent: { parentId: string | null } | null = await prisma.category.findUnique({
      where: { id: currentParentId },
      select: { parentId: true },
    });
    currentParentId = parent?.parentId ?? null;
  }

  return false;
}

async function deleteHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "categories");
  if (!access.ok) return access.response;

  const { id } = await params;
  const [products, children] = await Promise.all([
    prisma.product.count({ where: { categoryId: id } }),
    prisma.category.count({ where: { parentId: id } }),
  ]);

  if (products > 0 || children > 0) {
    const category = await prisma.category.update({ where: { id }, data: { visible: false } });
    revalidateTag("storefront", { expire: 0 });
    return NextResponse.json({ deleted: false, archived: true, category });
  }

  const category = await prisma.category.delete({ where: { id } });
  revalidateTag("storefront", { expire: 0 });
  return NextResponse.json({ deleted: true, category });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const PATCH = withApiErrorHandling(patchHandler, "PATCH /api/categories/[id]");
export const DELETE = withApiErrorHandling(deleteHandler, "DELETE /api/categories/[id]");
