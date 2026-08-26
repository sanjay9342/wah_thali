import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRestaurantSettingsFromDb, logActivity } from "@/lib/db";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { notifyOrderStatus, notifyOwnerOrderAlert } from "@/lib/customer-messaging";
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

async function getHandler(_request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ order: null, configured: false }, { status: 404 });
  }

  const { orderNumber } = await params;
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      customer: { select: { id: true, name: true, mobile: true, email: true } },
      items: true,
      payments: true,
      timeline: { orderBy: { createdAt: "asc" } },
    },
  });

  return NextResponse.json({ order, configured: true }, { status: order ? 200 : 404 });
}

async function patchHandler(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "orders");
  if (!access.ok) return access.response;

  const { orderNumber } = await params;
  const parsed = updateOrderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order update", issues: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await getRestaurantSettingsFromDb();

  if (settings.requireDeclineReason && parsed.data.status === "CANCELLED" && !parsed.data.note?.trim()) {
    return NextResponse.json({ error: "Decline reason is required." }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({ where: { orderNumber }, include: { items: true } });
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!canTransitionOrder(existing.status as never, parsed.data.status as never)) {
    return NextResponse.json({ error: `Cannot move from ${existing.status} to ${parsed.data.status}` }, { status: 409 });
  }

  const order = await prisma.$transaction(async (tx) => {
    if (parsed.data.status === "CANCELLED" && existing.status !== "CANCELLED") {
      for (const item of existing.items) {
        await tx.inventoryItem.updateMany({
          where: { productId: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    return tx.order.update({
      where: { orderNumber },
      data: {
        status: parsed.data.status,
        timeline: {
          create: {
            fromStatus: existing.status,
            toStatus: parsed.data.status,
            note: parsed.data.note?.trim() || (parsed.data.status === "CANCELLED" ? "Order declined by restaurant." : undefined),
          },
        },
      },
      include: {
        customer: { select: { id: true, name: true, mobile: true, email: true } },
        items: true,
        payments: true,
        timeline: { orderBy: { createdAt: "asc" } },
      },
    });
  });

  await logActivity({
    type: "ORDER_STATUS_UPDATED",
    entity: "Order",
    entityId: order.id,
    summary: `${order.orderNumber} moved to ${order.status}`,
  });

  if (settings.ownerWhatsAppOrderAlerts && parsed.data.status === "CANCELLED") {
    await notifyOwnerOrderAlert(order, settings.whatsappNumber, "CANCELLED", parsed.data.note).catch((error) => {
      console.error("Owner cancelled order WhatsApp alert failed.", error);
    });
  }

  if (settings.whatsappOrderAlerts) {
    await notifyOrderStatus(order, parsed.data.status, parsed.data.note).catch((error) => {
      console.error("Order status WhatsApp/customer notification failed.", error);
    });
  }

  return NextResponse.json({ order });
}

export const GET = withApiErrorHandling(getHandler, "GET /api/orders/[orderNumber]");
export const PATCH = withApiErrorHandling(patchHandler, "PATCH /api/orders/[orderNumber]");
