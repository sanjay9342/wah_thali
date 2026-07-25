import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminProductsFromDb, logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const productSchema = z.object({
  category: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().min(1),
  price: z.coerce.number().int().nonnegative(),
  originalPrice: z.coerce.number().int().nonnegative().nullable().optional(),
  image: z.string().url().optional(),
  dietaryType: z.string().default("VEG"),
  available: z.boolean().default(true),
  prepTimeMinutes: z.coerce.number().int().positive().default(25),
  spiceLevel: z.string().default("Medium"),
  bestseller: z.boolean().default(false),
  offer: z.string().nullable().optional(),
  stock: z.coerce.number().int().nonnegative().default(0),
  reorderAt: z.coerce.number().int().nonnegative().default(0),
  margin: z.coerce.number().int().min(0).max(100).default(0),
});

export async function GET() {
  const products = await getAdminProductsFromDb();
  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const parsed = productSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { category, image, prepTimeMinutes, stock, reorderAt, margin, ...product } = parsed.data;
  const slug = product.slug ?? slugify(product.name);
  const saved = await prisma.product.create({
    data: {
      ...product,
      slug,
      prepMinutes: prepTimeMinutes,
      category: {
        connectOrCreate: {
          where: { slug: slugify(category) },
          create: { name: category, slug: slugify(category) },
        },
      },
      images: image ? { create: { url: image, alt: product.name, sortOrder: 0 } } : undefined,
      variants: { create: { name: "Regular", price: 0 } },
      inventory: { create: { stock, reorderAt, margin } },
    },
    include: {
      category: true,
      images: { orderBy: { sortOrder: "asc" } },
      variants: true,
      addons: true,
      inventory: true,
    },
  });

  await logActivity({
    type: "PRODUCT_CREATED",
    entity: "Product",
    entityId: saved.id,
    summary: `Created product ${saved.name}`,
  });

  return NextResponse.json({ product: saved }, { status: 201 });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
