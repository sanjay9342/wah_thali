import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const imagePathSchema = z.string().trim().refine((value) => value.startsWith("/") || z.url().safeParse(value).success, {
  message: "Image must be a public path or URL.",
});

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  displayName: nullableTrimmedText(120),
  kitchenName: nullableTrimmedText(120),
  reportCode: nullableReportCode(),
  description: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  image: imagePathSchema.nullable().optional(),
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
  variants: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    price: z.coerce.number().int().nonnegative(),
    available: z.boolean().default(true),
  })).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "inventory");
  if (!access.ok) return access.response;

  const { id } = await params;
  const parsed = updateProductSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product update", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { category, image, prepTimeMinutes, stock, reorderAt, margin, addons, variants, ...productUpdate } = parsed.data;
  const variantRows = variants !== undefined
    ? variants.length
      ? variants
      : [{ name: "Regular", price: 0, available: true }]
    : undefined;
  if (productUpdate.reportCode) {
    const duplicate = await prisma.product.findFirst({
      where: { reportCode: productUpdate.reportCode, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: "This report shortcut code is already used by another product." }, { status: 409 });
    }
  }
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
      variants:
        variantRows !== undefined
          ? {
              deleteMany: {},
              create: variantRows.map((variant) => ({
                name: variant.name,
                price: variant.price,
                available: variant.available,
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
  }).catch((error) => {
    if (isUniqueReportCodeError(error)) {
      return null;
    }
    throw error;
  });

  if (!product) {
    return NextResponse.json({ error: "This report shortcut code is already used by another product." }, { status: 409 });
  }

  await logActivity({
    type: "PRODUCT_UPDATED",
    entity: "Product",
    entityId: product.id,
    summary: `Updated product ${product.name}`,
    metadata: parsed.data,
  });

  return NextResponse.json({ product });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "inventory");
  if (!access.ok) return access.response;

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

function nullableTrimmedText(max: number) {
  return z.preprocess(
    (value) => typeof value === "string" ? value.trim() : value,
    z.string().max(max).nullable().optional(),
  ).transform((value) => value || null);
}

function nullableReportCode() {
  return z.preprocess(
    (value) => typeof value === "string" ? value.trim().toUpperCase() : value,
    z.string().max(24).regex(/^[A-Z0-9_-]*$/, "Shortcut code can use letters, numbers, hyphen, or underscore.").nullable().optional(),
  ).transform((value) => value || null);
}

function isUniqueReportCodeError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("reportCode");
}
