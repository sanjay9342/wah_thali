import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRestaurantSettingsFromDb, logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

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
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
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
      message: "RAZORPAY_KEY_SECRET is not configured. Verification adapter is ready.",
    });
  }

  const { orderNumber, razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;
  const expected = createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const verified = safeCompareHex(expected, razorpay_signature);

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { payments: true },
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

  if (verified) {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: razorpay_payment_id,
          status: "PAID",
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: settings.autoAcceptOrders ? "CONFIRMED" : "NEW",
          timeline: {
            create: {
              fromStatus: order.status,
              toStatus: settings.autoAcceptOrders ? "CONFIRMED" : "NEW",
              note: `Razorpay payment verified: ${razorpay_payment_id}`,
            },
          },
        },
      });
    });
  } else {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
  }

  await logActivity({
    type: verified ? "PAYMENT_VERIFIED" : "PAYMENT_VERIFICATION_FAILED",
    entity: "Payment",
    entityId: razorpay_payment_id,
    summary: `Razorpay payment ${verified ? "verified" : "failed verification"}`,
    metadata: { orderNumber, razorpay_order_id, razorpay_payment_id },
  });

  return NextResponse.json({ verified });
}
