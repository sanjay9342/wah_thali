import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const categorySchema = z.object({
  name: z.string().min(1).optional(),
  image: z.string().optional(),
  offer: z.string().optional(),
  visible: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const { id } = await params;
  const parsed = categorySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category update", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { image, offer, ...categoryData } = parsed.data;
  const previous = await prisma.category.findUniqueOrThrow({ where: { id } });
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

  return NextResponse.json({ category });
}

function getImageMap(value: unknown): Record<string, string> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, string>) : {};
}

function getTextMap(value: unknown): Record<string, string> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, string>) : {};
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const { id } = await params;
  const products = await prisma.product.count({ where: { categoryId: id } });

  if (products > 0) {
    const category = await prisma.category.update({ where: { id }, data: { visible: false } });
    return NextResponse.json({ deleted: false, archived: true, category });
  }

  const category = await prisma.category.delete({ where: { id } });
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
