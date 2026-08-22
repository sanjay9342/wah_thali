import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRestaurantSettingsFromDb, logActivity } from "@/lib/db";
import { notifyOrderStatus } from "@/lib/customer-messaging";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import type { OrderStatus } from "@/lib/types";

const paymentSchema = z.object({
  orderNumber: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

function safeCompareHex(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const parsed = paymentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payment payload" }, { status: 400 });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    return NextResponse.json({
      verified: false,
      testMode: true,
      message: "Online payment verification is not configured yet.",
    });
  }

  const { orderNumber, razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;
  const expected = createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const verified = safeCompareHex(expected, razorpay_signature);

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true, payments: true },
  });
  const payment = order?.payments.find((item) =>
    item.provider === "RAZORPAY" &&
    (item.providerPaymentId === razorpay_order_id || item.providerPaymentId === razorpay_payment_id)
  );

  if (!order || !payment) {
    return NextResponse.json({ error: "Matching Razorpay order was not found." }, { status: 404 });
  }

  if (verified && payment.status === "PAID") {
    return NextResponse.json({ verified });
  }

  const settings = await getRestaurantSettingsFromDb();
  let notifiedStatus: OrderStatus | null = null;
  let notificationNote = "";

  if (verified) {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: razorpay_payment_id,
          status: "PAID",
        },
      });

      if (order.status === "PENDING_PAYMENT") {
        const nextStatus = settings.autoAcceptOrders ? "CONFIRMED" : "NEW";
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: nextStatus,
            timeline: {
              create: {
                fromStatus: order.status,
                toStatus: nextStatus,
                note: `Razorpay payment verified: ${razorpay_payment_id}`,
              },
            },
          },
        });
        notifiedStatus = nextStatus;
        notificationNote = `Razorpay payment verified: ${razorpay_payment_id}`;
      }
    });
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });

      if (order.status === "PENDING_PAYMENT" && payment.status !== "FAILED") {
        for (const item of order.items) {
          await tx.inventoryItem.updateMany({
            where: { productId: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "CANCELLED",
            timeline: {
              create: {
                fromStatus: "PENDING_PAYMENT",
                toStatus: "CANCELLED",
                note: "Razorpay payment verification failed. Checkout attempt cancelled before sending to kitchen.",
              },
            },
          },
        });
        notifiedStatus = "CANCELLED";
        notificationNote = "Razorpay payment verification failed. Checkout attempt cancelled before sending to kitchen.";
      }
    });
  }

  await logActivity({
    type: verified ? "PAYMENT_VERIFIED" : "PAYMENT_VERIFICATION_FAILED",
    entity: "Payment",
    entityId: razorpay_payment_id,
    summary: `Razorpay payment ${verified ? "verified" : "failed verification"}`,
    metadata: { orderNumber, razorpay_order_id, razorpay_payment_id },
  });

  if (notifiedStatus) {
    const notifiedOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        customer: { select: { id: true, name: true, mobile: true, email: true } },
        items: true,
        timeline: { orderBy: { createdAt: "asc" } },
      },
    });
    if (settings.whatsappOrderAlerts && notifiedOrder) {
      await notifyOrderStatus(notifiedOrder, notifiedStatus, notificationNote).catch((error) => {
        console.error("Payment status WhatsApp/customer notification failed.", error);
      });
    }
  }

  return NextResponse.json({ verified });
}
