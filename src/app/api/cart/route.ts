import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeMobile } from "@/lib/customer-auth";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const cartLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).default("regular"),
  addonIds: z.array(z.string().min(1)).default([]),
  quantity: z.coerce.number().int().positive(),
  instructions: z.string().optional(),
});

const cartSchema = z.object({
  mobile: z.string().min(8),
  items: z.array(cartLineSchema),
});

function readLineMeta(note?: string | null) {
  if (!note) return {};
  try {
    const parsed = JSON.parse(note);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function toCartLine(item: {
  productId: string;
  quantity: number;
  note?: string | null;
}) {
  const meta = readLineMeta(item.note) as {
    variantId?: string;
    addonIds?: string[];
    instructions?: string;
  };

  return {
    productId: item.productId,
    variantId: meta.variantId || "regular",
    addonIds: Array.isArray(meta.addonIds) ? meta.addonIds : [],
    quantity: item.quantity,
    instructions: meta.instructions,
  };
}

async function getHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ items: [], configured: false }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const mobile = normalizeMobile(searchParams.get("mobile") ?? "");
  if (!mobile) {
    return NextResponse.json({ items: [] });
  }

  const customer = await prisma.customer.findUnique({ where: { mobile }, select: { id: true } });
  const cart = customer
    ? await prisma.cart.findFirst({
        where: { customerId: customer.id },
        orderBy: { updatedAt: "desc" },
        include: { items: true },
      })
    : null;
  return NextResponse.json({ items: cart?.items.map(toCartLine) ?? [], configured: true });
}

async function putHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const parsed = cartSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cart payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const mobile = normalizeMobile(parsed.data.mobile);
  const customer = await prisma.customer.findUnique({ where: { mobile }, select: { id: true } });
  if (!customer) {
    return NextResponse.json({ error: "Login first to save cart." }, { status: 404 });
  }

  const existingCart = await prisma.cart.findFirst({
    where: { customerId: customer.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  const cart = existingCart ?? await prisma.cart.create({
    data: { customerId: customer.id },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
    ...parsed.data.items.map((item) =>
      prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: item.productId,
          quantity: item.quantity,
          note: JSON.stringify({
            variantId: item.variantId,
            addonIds: item.addonIds,
            instructions: item.instructions,
          }),
        },
      }),
    ),
  ]);

  return NextResponse.json({ items: parsed.data.items });
}

export const GET = withApiErrorHandling(getHandler, "GET /api/cart");
export const PUT = withApiErrorHandling(putHandler, "PUT /api/cart");
