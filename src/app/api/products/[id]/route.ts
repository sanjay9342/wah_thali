import { NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  image: z.string().url().nullable().optional(),
  price: z.coerce.number().int().nonnegative().optional(),
  originalPrice: z.coerce.number().int().nonnegative().nullable().optional(),
  dietaryType: z.string().optional(),
  available: z.boolean().optional(),
  prepTimeMinutes: z.coerce.number().int().positive().optional(),
  spiceLevel: z.string().optional(),
  bestseller: z.boolean().optional(),
  offer: z.string().nullable().optional(),
  stock: z.coerce.number().int().nonnegative().optional(),
  reorderAt: z.coerce.number().int().nonnegative().optional(),
  margin: z.coerce.number().int().min(0).max(100).optional(),
  addons: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    price: z.coerce.number().int().nonnegative(),
    available: z.boolean().default(true),
  })).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const { id } = await params;
  const parsed = updateProductSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product update", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { category, image, prepTimeMinutes, stock, reorderAt, margin, addons, ...productUpdate } = parsed.data;
  const product = await prisma.product.update({
    where: { id },
    data: {
      ...productUpdate,
      prepMinutes: prepTimeMinutes,
      category: category
        ? {
            connectOrCreate: {
              where: { slug: slugify(category) },
              create: { name: category, slug: slugify(category) },
            },
          }
        : undefined,
      images:
        image !== undefined
          ? {
              deleteMany: {},
              ...(image ? { create: { url: image, alt: productUpdate.name ?? "Product image", sortOrder: 0 } } : {}),
            }
          : undefined,
      addons:
        addons !== undefined
          ? {
              deleteMany: {},
              create: addons.map((addon) => ({
                name: addon.name,
                price: addon.price,
                available: addon.available,
              })),
            }
          : undefined,
      inventory:
        stock !== undefined || reorderAt !== undefined || margin !== undefined
          ? {
              upsert: {
                create: {
                  stock: stock ?? 0,
                  reorderAt: reorderAt ?? 0,
                  margin: margin ?? 0,
                },
                update: {
                  stock,
                  reorderAt,
                  margin,
                },
              },
            }
          : undefined,
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
    type: "PRODUCT_UPDATED",
    entity: "Product",
    entityId: product.id,
    summary: `Updated product ${product.name}`,
    metadata: parsed.data,
  });

  return NextResponse.json({ product });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const { id } = await params;
  const orderUsage = await prisma.orderItem.count({ where: { productId: id } });

  if (orderUsage === 0) {
    const product = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUniqueOrThrow({ where: { id } });
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productVariantOption.deleteMany({ where: { productId: id } });
      await tx.productAddon.deleteMany({ where: { productId: id } });
      await tx.inventoryItem.deleteMany({ where: { productId: id } });
      await tx.cartItem.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
      return existing;
    });

    await logActivity({
      type: "PRODUCT_DELETED",
      entity: "Product",
      entityId: product.id,
      summary: `Deleted product ${product.name}`,
    });

    return NextResponse.json({ deleted: true, product });
  }

  const product = await prisma.product.update({
    where: { id },
    data: { available: false },
  });

  await logActivity({
    type: "PRODUCT_HIDDEN",
    entity: "Product",
    entityId: product.id,
    summary: `Hidden product ${product.name}`,
  });

  return NextResponse.json({ deleted: false, archived: true, product });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
