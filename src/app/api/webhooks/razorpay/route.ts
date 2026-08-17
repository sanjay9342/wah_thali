import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRestaurantSettingsFromDb, logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
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

export async function POST(request: NextRequest) {
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
  const eventId = paymentId ? `${event}:${paymentId}` : `${event}:${Date.now()}`;

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
      include: { order: true },
    });

    if (payment) {
      const settings = await getRestaurantSettingsFromDb();
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            providerPaymentId: paymentId ?? payment.providerPaymentId,
            status,
          },
        });

        if ((status === "PAID" || status === "AUTHORIZED") && payment.order.status === "PENDING_PAYMENT") {
          await tx.order.update({
            where: { id: payment.orderId },
            data: {
              status: settings.autoAcceptOrders ? "CONFIRMED" : "NEW",
              timeline: {
                create: {
                  fromStatus: "PENDING_PAYMENT",
                  toStatus: settings.autoAcceptOrders ? "CONFIRMED" : "NEW",
                  note: `Razorpay webhook confirmed payment: ${paymentId}`,
                },
              },
            },
          });
        }
      });
    }
  }

  await logActivity({
    type: "RAZORPAY_WEBHOOK_RECEIVED",
    entity: "WebhookEvent",
    entityId: eventId,
    summary: `Razorpay webhook received: ${event}`,
    metadata: { paymentId, razorpayOrderId },
  });

  return NextResponse.json({ ok: true });
}
