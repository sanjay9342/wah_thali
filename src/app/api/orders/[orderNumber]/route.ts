import { NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { canTransitionOrder } from "@/lib/state-machines";

const updateOrderSchema = z.object({
  status: z.enum([
    "NEW",
    "CONFIRMED",
    "PREPARING",
    "PACKED",
    "READY_FOR_PICKUP",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
  ]),
  note: z.string().optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ order: null, configured: false }, { status: 404 });
  }

  const { orderNumber } = await params;
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { customer: true, items: true, payments: true, timeline: { orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json({ order, configured: true }, { status: order ? 200 : 404 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const { orderNumber } = await params;
  const parsed = updateOrderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order update", issues: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({ where: { orderNumber } });
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!canTransitionOrder(existing.status as never, parsed.data.status as never)) {
    return NextResponse.json({ error: `Cannot move from ${existing.status} to ${parsed.data.status}` }, { status: 409 });
  }

  const order = await prisma.order.update({
    where: { orderNumber },
    data: {
      status: parsed.data.status,
      timeline: {
        create: {
          fromStatus: existing.status,
          toStatus: parsed.data.status,
          note: parsed.data.note,
        },
      },
    },
    include: { customer: true, items: true, timeline: { orderBy: { createdAt: "asc" } } },
  });

  await logActivity({
    type: "ORDER_STATUS_UPDATED",
    entity: "Order",
    entityId: order.id,
    summary: `${order.orderNumber} moved to ${order.status}`,
  });

  return NextResponse.json({ order });
}
