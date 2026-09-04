import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { getAdminProductsFromDb, logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const imagePathSchema = z.string().trim().refine((value) => value.startsWith("/") || z.url().safeParse(value).success, {
  message: "Image must be a public path or URL.",
});

const productSchema = z.object({
  category: z.string().min(1),
  categoryId: z.string().min(1).optional(),
  name: z.string().min(1),
  displayName: nullableTrimmedText(120),
  kitchenName: nullableTrimmedText(120),
  reportCode: nullableReportCode(),
  slug: z.string().min(1).optional(),
  description: z.string().trim().optional().default(""),
  price: z.coerce.number().int().nonnegative(),
  originalPrice: z.coerce.number().int().nonnegative().nullable().optional(),
  image: imagePathSchema.optional(),
  dietaryType: z.string().default("VEG"),
  rating: z.coerce.number().min(0).max(5).default(4.5),
  available: z.boolean().default(true),
  prepTimeMinutes: z.coerce.number().int().positive().default(25),
  spiceLevel: z.string().default("Medium"),
  bestseller: z.boolean().default(false),
  offer: z.string().nullable().optional(),
  stock: z.coerce.number().int().nonnegative().default(0),
  reorderAt: z.coerce.number().int().nonnegative().default(0),
  margin: z.coerce.number().int().min(0).max(100).default(0),
  addons: z.array(z.object({
    name: z.string().min(1),
    price: z.coerce.number().int().nonnegative(),
    available: z.boolean().default(true),
  })).default([]),
  variants: z.array(z.object({
    name: z.string().min(1),
    price: z.coerce.number().int().nonnegative(),
    available: z.boolean().default(true),
  })).default([]),
});

async function getHandler() {
  const products = await getAdminProductsFromDb();
  return NextResponse.json({ products });
}

async function postHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "inventory");
  if (!access.ok) return access.response;

  const parsed = productSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { category, categoryId, image, prepTimeMinutes, stock, reorderAt, margin, addons, variants, ...product } = parsed.data;
  const slug = product.slug ?? slugify(product.name);
  if (product.reportCode) {
    const duplicate = await prisma.product.findFirst({
      where: { reportCode: product.reportCode },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: "This report shortcut code is already used by another product." }, { status: 409 });
    }
  }
  const saved = await prisma.product.create({
    data: {
      ...product,
      slug,
      prepMinutes: prepTimeMinutes,
      category: categoryId
        ? { connect: { id: categoryId } }
        : {
            connectOrCreate: {
              where: { slug: slugify(category) },
              create: { name: category, slug: slugify(category) },
            },
          },
      images: image ? { create: { url: image, alt: product.name, sortOrder: 0 } } : undefined,
      variants: variants.length ? { create: variants } : undefined,
      addons: addons.length ? { create: addons } : undefined,
      inventory: { create: { stock, reorderAt, margin } },
    },
    include: {
      category: { include: { parent: true } },
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

  if (!saved) {
    return NextResponse.json({ error: "This report shortcut code is already used by another product." }, { status: 409 });
  }

  await logActivity({
    type: "PRODUCT_CREATED",
    entity: "Product",
    entityId: saved.id,
    summary: `Created product ${saved.name}`,
  });
  revalidateTag("storefront", { expire: 0 });

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

export const GET = withApiErrorHandling(getHandler, "GET /api/products");
export const POST = withApiErrorHandling(postHandler, "POST /api/products");
