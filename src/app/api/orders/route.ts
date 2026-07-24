import { NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const orderItemSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  price: z.coerce.number().int().nonnegative(),
});

const orderSchema = z.object({
  customerMobile: z.string().min(8),
  customerName: z.string().min(1),
  subtotal: z.coerce.number().int().nonnegative(),
  discount: z.coerce.number().int().nonnegative().default(0),
  gst: z.coerce.number().int().nonnegative(),
  grandTotal: z.coerce.number().int().nonnegative(),
  items: z.array(orderItemSchema).min(1),
});

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ orders: [], configured: false });
  }

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { customer: true, items: true, payments: true, timeline: true },
    take: 100,
  });

  return NextResponse.json({ orders, configured: true });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const parsed = orderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const orderNumber = `WT-${Date.now().toString().slice(-6)}`;
  const order = await prisma.order.create({
    data: {
      orderNumber,
      subtotal: data.subtotal,
      discount: data.discount,
      gst: data.gst,
      grandTotal: data.grandTotal,
      customer: {
        connectOrCreate: {
          where: { mobile: data.customerMobile },
          create: { mobile: data.customerMobile, name: data.customerName },
        },
      },
      items: { create: data.items },
      timeline: { create: { toStatus: "NEW", note: "Order created from website checkout." } },
    },
    include: { customer: true, items: true, timeline: true },
  });

  await logActivity({
    type: "ORDER_CREATED",
    entity: "Order",
    entityId: order.id,
    summary: `Created order ${order.orderNumber}`,
    metadata: { grandTotal: order.grandTotal },
  });

  return NextResponse.json({ order }, { status: 201 });
}
