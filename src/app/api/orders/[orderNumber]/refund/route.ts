import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { createRazorpayRefund } from "@/lib/razorpay";

const refundSchema = z.object({
  reason: z.string().trim().optional(),
  speed: z.enum(["normal", "optimum"]).default("normal"),
});

const refundablePaymentStatuses = new Set(["PAID"]);
const blockedRefundStatuses = new Set(["REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED"]);

async function postHandler(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "orders");
  if (!access.ok) return access.response;

  const { orderNumber } = await params;
  const parsed = refundSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid refund payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      customer: { select: { id: true, name: true, mobile: true, email: true } },
      payments: true,
      timeline: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (order.status !== "CANCELLED") {
    return NextResponse.json({ error: "Refunds can be initiated only after the order is declined/cancelled." }, { status: 409 });
  }

  const razorpayPayment = order.payments.find((payment) => payment.provider === "RAZORPAY");
  if (!razorpayPayment) {
    return NextResponse.json({ error: "This order was not paid online through Razorpay." }, { status: 409 });
  }

  if (blockedRefundStatuses.has(razorpayPayment.status)) {
    return NextResponse.json({ error: "Refund has already been initiated or completed for this order." }, { status: 409 });
  }

  if (!refundablePaymentStatuses.has(razorpayPayment.status)) {
    return NextResponse.json({ error: "Only captured/paid Razorpay payments can be refunded." }, { status: 409 });
  }

  if (!razorpayPayment.providerPaymentId?.startsWith("pay_")) {
    return NextResponse.json({ error: "Razorpay payment id is missing. Please verify payment capture before refunding." }, { status: 409 });
  }

  const refund = await createRazorpayRefund({
    paymentId: razorpayPayment.providerPaymentId,
    amountRupees: razorpayPayment.amount,
    receipt: `refund_${order.orderNumber}`,
    speed: parsed.data.speed,
    notes: {
      orderNumber: order.orderNumber,
      customerMobile: order.customer.mobile,
      reason: parsed.data.reason || "Restaurant declined order",
    },
  });

  if (!refund.ok) {
    await logActivity({
      type: "RAZORPAY_REFUND_FAILED",
      entity: "Payment",
      entityId: razorpayPayment.id,
      summary: `Refund failed for ${order.orderNumber}`,
      metadata: {
        orderNumber: order.orderNumber,
        paymentId: razorpayPayment.providerPaymentId,
        status: refund.status,
        message: refund.message,
      },
    });

    return NextResponse.json({ error: refund.message }, { status: refund.status ?? 502 });
  }

  const nextPaymentStatus = refund.refund.status === "processed" ? "REFUNDED" : "REFUND_PENDING";
  const updatedOrder = await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: razorpayPayment.id },
      data: { status: nextPaymentStatus },
    });

    return tx.order.update({
      where: { id: order.id },
      data: {
        timeline: {
          create: {
            fromStatus: order.status,
            toStatus: order.status,
            note: [
              `Razorpay refund ${refund.refund.id} ${nextPaymentStatus === "REFUNDED" ? "processed" : "initiated"}.`,
              `Amount: Rs ${razorpayPayment.amount}.`,
              `Reason: ${parsed.data.reason || "Restaurant declined order"}.`,
            ].join(" "),
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
    type: "RAZORPAY_REFUND_INITIATED",
    entity: "Payment",
    entityId: razorpayPayment.id,
    summary: `Refund initiated for ${order.orderNumber}`,
    metadata: {
      orderNumber: order.orderNumber,
      paymentId: razorpayPayment.providerPaymentId,
      refundId: refund.refund.id,
      refundStatus: refund.refund.status,
      amount: razorpayPayment.amount,
      speedRequested: refund.refund.speed_requested,
      speedProcessed: refund.refund.speed_processed,
      acquirerData: refund.refund.acquirer_data,
    },
  });

  return NextResponse.json({
    order: updatedOrder,
    refund: refund.refund,
    paymentStatus: nextPaymentStatus,
  });
}

export const POST = withApiErrorHandling(postHandler, "POST /api/orders/[orderNumber]/refund");
