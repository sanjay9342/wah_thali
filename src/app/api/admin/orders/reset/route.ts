import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const RESET_CONFIRMATION_TEXT = "RESET ORDERS";

const resetSchema = z.object({
  confirmation: z.literal(RESET_CONFIRMATION_TEXT),
});

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const access = await requireAdminPermission(request, "settings");
  if (!access.ok) return access.response;

  const parsed = resetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: `Type ${RESET_CONFIRMATION_TEXT} to reset all order history.` }, { status: 400 });
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const orders = await tx.order.findMany({ select: { id: true } });
    const orderIds = orders.map((order) => order.id);

    if (!orderIds.length) {
      const loyaltyAccounts = await tx.loyaltyAccount.updateMany({
        data: { points: 0, tier: "Starter" },
      });

      return {
        orders: 0,
        items: 0,
        payments: 0,
        timeline: 0,
        reviews: 0,
        loyaltyAccounts: loyaltyAccounts.count,
      };
    }

    const reviews = await tx.review.deleteMany({ where: { orderId: { in: orderIds } } });
    const payments = await tx.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    const timeline = await tx.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
    const items = await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    const ordersDeleted = await tx.order.deleteMany({ where: { id: { in: orderIds } } });
    const loyaltyAccounts = await tx.loyaltyAccount.updateMany({
      data: { points: 0, tier: "Starter" },
    });

    return {
      orders: ordersDeleted.count,
      items: items.count,
      payments: payments.count,
      timeline: timeline.count,
      reviews: reviews.count,
      loyaltyAccounts: loyaltyAccounts.count,
    };
  });

  await logActivity({
    type: "ORDER_HISTORY_RESET",
    actor: access.access.assignment?.mobile,
    entity: "Order",
    summary: `Reset order history and deleted ${deleted.orders} orders`,
    metadata: deleted,
  });

  return NextResponse.json({ deleted });
}
