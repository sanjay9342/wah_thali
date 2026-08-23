import { NextResponse } from "next/server";
import { normalizeMobile } from "@/lib/customer-auth";
import { notifyOrderCustomerCancelled } from "@/lib/customer-messaging";
import { getRestaurantSettingsFromDb, logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const sessionCookie = "wah_thali_customer_mobile";
const customerCancelableStatuses = new Set(["PENDING_PAYMENT", "NEW"]);
const customerCancelNote = "Customer cancelled before the restaurant accepted the order.";

function getSessionMobile(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return normalizeMobile(
    cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${sessionCookie}=`))
      ?.split("=")[1] ?? "",
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const sessionMobile = getSessionMobile(request);
  if (!sessionMobile) {
    return NextResponse.json({ error: "Please sign in to cancel this order." }, { status: 401 });
  }

  const { orderNumber } = await params;
  const settings = await getRestaurantSettingsFromDb();
  const existing = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      customer: { select: { id: true, name: true, mobile: true, email: true } },
      items: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (normalizeMobile(existing.customer.mobile) !== sessionMobile) {
    return NextResponse.json({ error: "You can cancel only your own order." }, { status: 403 });
  }

  if (!customerCancelableStatuses.has(existing.status)) {
    return NextResponse.json({ error: "This order is already accepted. Please contact support for help." }, { status: 409 });
  }

  const order = await prisma.$transaction(async (tx) => {
    for (const item of existing.items) {
      await tx.inventoryItem.updateMany({
        where: { productId: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }

    return tx.order.update({
      where: { orderNumber },
      data: {
        status: "CANCELLED",
        timeline: {
          create: {
            fromStatus: existing.status,
            toStatus: "CANCELLED",
            note: customerCancelNote,
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
    type: "ORDER_CUSTOMER_CANCELLED",
    actor: existing.customer.mobile,
    entity: "Order",
    entityId: order.id,
    summary: `${order.orderNumber} cancelled by customer before acceptance`,
    metadata: { orderNumber: order.orderNumber, previousStatus: existing.status, whatsappOrderAlerts: settings.whatsappOrderAlerts },
  });

  if (settings.whatsappOrderAlerts) {
    await notifyOrderCustomerCancelled(order).catch((error) => {
      console.error("Customer cancelled order WhatsApp notification failed.", error);
    });
  }

  return NextResponse.json({ order });
}
