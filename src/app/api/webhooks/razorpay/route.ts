import { withApiErrorHandling } from "@/lib/api-error";
import type { Prisma } from "@prisma/client";
import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRestaurantSettingsFromDb, logActivity } from "@/lib/db";
import { notifyOrderStatus, notifyOwnerOrderAlert } from "@/lib/customer-messaging";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import type { OrderStatus } from "@/lib/types";

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
      };
    };
    refund?: {
      entity?: {
        id?: string;
        amount?: number;
        payment_id?: string;
        status?: "pending" | "processed" | "failed";
        speed_requested?: string;
        speed_processed?: string;
        acquirer_data?: Record<string, string | null>;
      };
    };
  };
};

function readEnv(key: string) {
  const raw = process.env[key]?.trim();
  return raw?.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1") ?? "";
}

function safeCompare(expected: string, actual: string | null) {
  if (!actual) return false;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function verifySignature(rawBody: string, signature: string | null) {
  const secret = readEnv("RAZORPAY_WEBHOOK_SECRET");
  if (!secret) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeCompare(expected, signature);
}

function getPaymentStatus(event: string | undefined) {
  if (event === "payment.captured") return "PAID";
  if (event === "payment.authorized") return "AUTHORIZED";
  if (event === "payment.failed") return "FAILED";
  return null;
}

async function postHandler(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid Razorpay webhook signature." }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
  const event = payload.event;
  const paymentId = payload.payload?.payment?.entity?.id;
  const razorpayOrderId = payload.payload?.payment?.entity?.order_id;
  const refund = payload.payload?.refund?.entity;
  const refundId = refund?.id;
  const refundPaymentId = refund?.payment_id;
  const eventId = refundId ? `${event}:${refundId}` : paymentId ? `${event}:${paymentId}` : `${event}:${Date.now()}`;

  await prisma.webhookEvent.upsert({
    where: { provider_eventId: { provider: "razorpay", eventId } },
    create: { provider: "razorpay", eventId, payload },
    update: { payload },
  });

  const status = getPaymentStatus(event);
  if (status && (paymentId || razorpayOrderId)) {
    const payment = await prisma.payment.findFirst({
      where: {
        provider: "RAZORPAY",
        OR: [
          paymentId ? { providerPaymentId: paymentId } : {},
          razorpayOrderId ? { providerPaymentId: razorpayOrderId } : {},
        ],
      },
      include: { order: { include: { items: true } } },
    });

    if (payment) {
      const settings = await getRestaurantSettingsFromDb();
      let notifiedStatus: OrderStatus | null = null;
      let notificationNote = "";
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            providerPaymentId: paymentId ?? payment.providerPaymentId,
            status,
          },
        });

        if ((status === "PAID" || status === "AUTHORIZED") && payment.order.status === "PENDING_PAYMENT") {
          const nextStatus = settings.autoAcceptOrders ? "CONFIRMED" : "NEW";
          await tx.order.update({
            where: { id: payment.orderId },
            data: {
              status: nextStatus,
              timeline: {
                create: {
                  fromStatus: "PENDING_PAYMENT",
                  toStatus: nextStatus,
                  note: `Razorpay webhook confirmed payment: ${paymentId}`,
                },
              },
            },
          });
          if (payment.order.couponCode && payment.order.discount > 0) {
            await redeemCouponForSuccessfulOrder(tx, {
              couponCode: payment.order.couponCode,
              orderId: payment.orderId,
              customerId: payment.order.customerId,
              discount: payment.order.discount,
              orderTotal: payment.order.grandTotal,
              fulfillmentMethod: payment.order.fulfillmentMethod === "PICKUP" ? "PICKUP" : "DELIVERY",
            });
          }
          notifiedStatus = nextStatus;
          notificationNote = `Razorpay webhook confirmed payment: ${paymentId}`;
        }

        if (status === "FAILED" && payment.order.status === "PENDING_PAYMENT" && payment.status !== "FAILED") {
          for (const item of payment.order.items) {
            await tx.inventoryItem.updateMany({
              where: { productId: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          }

          await tx.order.update({
            where: { id: payment.orderId },
            data: {
              status: "CANCELLED",
              timeline: {
                create: {
                  fromStatus: "PENDING_PAYMENT",
                  toStatus: "CANCELLED",
                  note: `Razorpay webhook reported payment failed: ${paymentId ?? razorpayOrderId}`,
                },
              },
            },
          });
          notifiedStatus = "CANCELLED";
          notificationNote = `Razorpay webhook reported payment failed: ${paymentId ?? razorpayOrderId}`;
        }
      });
      if (notifiedStatus) {
        const notifiedOrder = await prisma.order.findUnique({
          where: { id: payment.orderId },
          include: {
            customer: { select: { id: true, name: true, mobile: true, email: true } },
            items: true,
            payments: true,
            timeline: { orderBy: { createdAt: "asc" } },
          },
        });
        if (settings.ownerWhatsAppOrderAlerts && notifiedOrder && notifiedStatus !== "CANCELLED") {
          await notifyOwnerOrderAlert(notifiedOrder, settings.whatsappNumber, "NEW_ORDER", notificationNote).catch((error) => {
            console.error("Owner Razorpay webhook order WhatsApp alert failed.", error);
          });
        }

        if (settings.whatsappOrderAlerts && notifiedOrder) {
          await notifyOrderStatus(notifiedOrder, notifiedStatus, notificationNote).catch((error) => {
            console.error("Razorpay webhook WhatsApp/customer notification failed.", error);
          });
        }
      }
    }
  }

  if (event?.startsWith("refund.") && refundId && refundPaymentId) {
    const payment = await prisma.payment.findFirst({
      where: {
        provider: "RAZORPAY",
        providerPaymentId: refundPaymentId,
      },
      include: {
        order: {
          include: {
            customer: { select: { id: true, name: true, mobile: true, email: true } },
            items: true,
            payments: true,
            timeline: { orderBy: { createdAt: "asc" } },
          },
        },
      },
    });

    if (payment) {
      const refundedAmountRupees = refund.amount ? Math.round(refund.amount / 100) : payment.amount;
      const fullyRefunded = refundedAmountRupees >= payment.amount;
      const nextPaymentStatus =
        event === "refund.failed" || refund.status === "failed"
          ? "PAID"
          : event === "refund.processed" || refund.status === "processed"
            ? fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED"
            : "REFUND_PENDING";

      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: nextPaymentStatus },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: payment.orderId,
            fromStatus: payment.order.status,
            toStatus: payment.order.status,
            note: [
              `Razorpay ${event} for refund ${refundId}.`,
              `Payment status: ${nextPaymentStatus}.`,
              refund.amount ? `Refund amount: Rs ${refundedAmountRupees}.` : "",
            ].filter(Boolean).join(" "),
          },
        });
      });

      await logActivity({
        type: "RAZORPAY_REFUND_WEBHOOK",
        entity: "Payment",
        entityId: payment.id,
        summary: `Razorpay refund webhook: ${event}`,
        metadata: {
          orderNumber: payment.order.orderNumber,
          paymentId: refundPaymentId,
          refundId,
          refundStatus: refund.status,
          paymentStatus: nextPaymentStatus,
          amount: refundedAmountRupees,
          speedRequested: refund.speed_requested,
          speedProcessed: refund.speed_processed,
          acquirerData: refund.acquirer_data,
        },
      });
    }
  }

  await logActivity({
    type: "RAZORPAY_WEBHOOK_RECEIVED",
    entity: "WebhookEvent",
    entityId: eventId,
    summary: `Razorpay webhook received: ${event}`,
    metadata: { paymentId, razorpayOrderId, refundId, refundPaymentId },
  });

  return NextResponse.json({ ok: true });
}

export const POST = withApiErrorHandling(postHandler, "POST /api/webhooks/razorpay");

async function redeemCouponForSuccessfulOrder(
  tx: Prisma.TransactionClient,
  input: {
    couponCode: string;
    orderId: string;
    customerId: string;
    discount: number;
    orderTotal: number;
    fulfillmentMethod: "DELIVERY" | "PICKUP";
  },
) {
  const coupon = await tx.coupon.findUnique({ where: { code: input.couponCode }, select: { id: true } });
  await tx.couponRedemption.upsert({
    where: { orderId: input.orderId },
    create: {
      couponCode: input.couponCode,
      couponId: coupon?.id,
      orderId: input.orderId,
      customerId: input.customerId,
      discount: input.discount,
      orderTotal: input.orderTotal,
      orderSource: "WEBSITE",
      fulfillmentMethod: input.fulfillmentMethod,
    },
    update: {
      couponCode: input.couponCode,
      couponId: coupon?.id,
      customerId: input.customerId,
      discount: input.discount,
      orderTotal: input.orderTotal,
      orderSource: "WEBSITE",
      fulfillmentMethod: input.fulfillmentMethod,
    },
  });
}
