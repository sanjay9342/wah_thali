import { NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  price: z.coerce.number().int().nonnegative().optional(),
  originalPrice: z.coerce.number().int().nonnegative().nullable().optional(),
  dietaryType: z.string().optional(),
  available: z.boolean().optional(),
  prepTimeMinutes: z.coerce.number().int().positive().optional(),
  stock: z.coerce.number().int().nonnegative().optional(),
  reorderAt: z.coerce.number().int().nonnegative().optional(),
  margin: z.coerce.number().int().nonnegative().optional(),
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

  const { prepTimeMinutes, stock, reorderAt, margin, ...productUpdate } = parsed.data;
  const product = await prisma.product.update({
    where: { id },
    data: {
      ...productUpdate,
      prepMinutes: prepTimeMinutes,
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

  return NextResponse.json({ product });
}
