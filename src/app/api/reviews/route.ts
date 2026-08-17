import { NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const reviewSchema = z.object({
  orderNumber: z.string().min(1),
  productId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(400).optional(),
});

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const parsed = reviewSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { orderNumber, productId, rating, comment } = parsed.data;
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      customer: { select: { id: true, name: true, mobile: true, email: true } },
      items: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (order.status !== "DELIVERED") {
    return NextResponse.json({ error: "Reviews can be submitted after the order is delivered." }, { status: 409 });
  }

  const orderedItem = order.items.find((item) => item.productId === productId);
  if (!orderedItem) {
    return NextResponse.json({ error: "This dish was not part of the completed order." }, { status: 403 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const review = await tx.review.upsert({
      where: { orderId_productId: { orderId: order.id, productId } },
      update: { rating, comment: comment || null },
      create: {
        customerId: order.customerId,
        orderId: order.id,
        productId,
        rating,
        comment: comment || null,
      },
    });

    const aggregate = await tx.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const ratingAverage = Number((aggregate._avg.rating ?? rating).toFixed(1));
    const product = await tx.product.update({
      where: { id: productId },
      data: {
        rating: ratingAverage,
        ratingCount: aggregate._count.rating,
      },
    });

    return { review, product };
  });

  await logActivity({
    type: "REVIEW_SUBMITTED",
    entity: "Product",
    entityId: productId,
    summary: `${order.customer.name} rated ${orderedItem.name} ${rating}/5`,
    metadata: { orderNumber, rating },
  });

  return NextResponse.json({
    review: result.review,
    productRating: Number(result.product.rating),
    productRatingCount: result.product.ratingCount,
  });
}
