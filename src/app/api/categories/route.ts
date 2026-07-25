import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const categorySchema = z.object({
  name: z.string().min(1),
  image: z.string().optional(),
  visible: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ categories: [], configured: false });
  }

  const [categories, imageSetting] = await Promise.all([
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
  ]);
  const images = getImageMap(imageSetting?.value);

  return NextResponse.json({
    categories: categories.map((category) => ({
      ...category,
      image: images[category.slug] ?? category.products[0]?.images[0]?.url ?? "/wah-thali-meal-cutout-v2.png",
    })),
    configured: true,
  });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const parsed = categorySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { image, ...categoryData } = parsed.data;
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

  await logActivity({
    type: "CATEGORY_SAVED",
    entity: "Category",
    entityId: category.id,
    summary: `Saved category ${category.name}`,
  });

  return NextResponse.json({ category }, { status: 201 });
}

function getImageMap(value: unknown): Record<string, string> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, string>) : {};
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
