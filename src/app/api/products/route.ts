import { NextResponse } from "next/server";
import { z } from "zod";
import { getProductsFromDb, logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const productSchema = z.object({
  category: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  price: z.coerce.number().int().nonnegative(),
  image: z.string().url().optional(),
  dietaryType: z.string().default("VEG"),
  available: z.boolean().default(true),
  prepTimeMinutes: z.coerce.number().int().positive().default(25),
});

export async function GET() {
  const products = await getProductsFromDb();
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

  const { category, image, prepTimeMinutes, ...product } = parsed.data;
  const saved = await prisma.product.create({
    data: {
      ...product,
      prepMinutes: prepTimeMinutes,
      category: {
        connectOrCreate: {
          where: { slug: category.toLowerCase().replaceAll(" ", "-").replaceAll("'", "") },
          create: { name: category, slug: category.toLowerCase().replaceAll(" ", "-").replaceAll("'", "") },
        },
      },
      images: image ? { create: { url: image, alt: product.name, sortOrder: 0 } } : undefined,
      variants: { create: { id: `${product.slug}-regular`, name: "Regular", price: 0 } },
      inventory: { create: { stock: 0, reorderAt: 0, margin: 0 } },
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
