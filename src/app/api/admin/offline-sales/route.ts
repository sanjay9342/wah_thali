import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { getRestaurantSettingsFromDb, logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { normalizeGstRate } from "@/lib/pricing";
import { parseIstDateInput } from "@/lib/time";

const offlineSaleSchema = z.object({
  saleAt: z.string().trim().min(1),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "OTHER"]).default("CASH"),
  customerName: z.string().trim().min(1).max(120).default("Walk-in customer"),
  customerMobile: z.string().trim().max(20).optional().or(z.literal("")),
  discount: z.coerce.number().int().nonnegative().default(0),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.coerce.number().int().positive(),
    price: z.coerce.number().int().nonnegative().optional(),
  })).min(1),
});

async function postHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const access = await requireAdminPermission(request, "offlineSales");
  if (!access.ok) return access.response;

  const parsed = offlineSaleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid offline sale payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const createdAt = parseIstDateInput(data.saleAt);
  if (!createdAt) {
    return NextResponse.json({ error: "Please select a valid sale date and time." }, { status: 400 });
  }
  if (createdAt.getTime() > Date.now() + 60 * 1000) {
    return NextResponse.json({ error: "Offline sale date cannot be in the future." }, { status: 400 });
  }

  const productIds = [...new Set(data.items.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, displayName: true, kitchenName: true, price: true },
  });
  const productById = new Map(products.map((product) => [product.id, product]));
  const missingProduct = productIds.find((productId) => !productById.has(productId));
  if (missingProduct) {
    return NextResponse.json({ error: "One selected dish was not found. Refresh the page and try again." }, { status: 409 });
  }

  const items = data.items.map((item) => {
    const product = productById.get(item.productId);
    if (!product) throw new Error(`Product ${item.productId} was not found.`);
    const price = item.price ?? product.price;
    return {
      productId: product.id,
      name: product.kitchenName || product.displayName || product.name,
      quantity: item.quantity,
      price,
      lineTotal: price * item.quantity,
    };
  });
  const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);
  const discount = Math.min(data.discount, subtotal);
  const settings = await getRestaurantSettingsFromDb();
  const taxable = Math.max(subtotal - discount, 0);
  const gst = Math.round(taxable * normalizeGstRate(settings.gstRate));
  const grandTotal = taxable + gst;
  const orderNumber = await getNextOfflineOrderNumber();
  const customerMobile = data.customerMobile?.trim() || `OFFLINE-${orderNumber}`;
  const payment = getOfflinePayment(data.paymentMethod);
  const actor = access.access.assignment?.name ?? access.access.assignment?.mobile ?? access.access.source ?? "Admin";

  const order = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { mobile: customerMobile },
      create: {
        mobile: customerMobile,
        name: data.customerName,
        completedOrderCount: 1,
        lastCompletedOrderAt: createdAt,
      },
      update: {
        name: data.customerName,
        completedOrderCount: { increment: 1 },
        lastCompletedOrderAt: createdAt,
      },
      select: { id: true },
    });

    return tx.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        status: "DELIVERED",
        subtotal,
        discount,
        fulfillmentMethod: "PICKUP",
        orderSource: "OFFLINE",
        gst,
        grandTotal,
        createdAt,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
        },
        payments: {
          create: {
            provider: payment.provider,
            status: payment.status,
            amount: grandTotal,
            createdAt,
          },
        },
        timeline: {
          create: [
            {
              toStatus: "CONFIRMED",
              note: ["Offline sale entered by admin.", `Payment: ${payment.label}`, data.note ? `Note: ${data.note}` : ""].filter(Boolean).join(" | "),
              createdAt,
            },
            {
              fromStatus: "CONFIRMED",
              toStatus: "DELIVERED",
              note: "Offline sale marked delivered for reporting.",
              createdAt,
            },
          ],
        },
      },
      include: {
        customer: { select: { id: true, name: true, mobile: true } },
        items: true,
        payments: true,
        timeline: true,
      },
    });
  });

  await logActivity({
    type: "OFFLINE_SALE_CREATED",
    actor,
    entity: "Order",
    entityId: order.id,
    summary: `Entered offline sale ${order.orderNumber}`,
    metadata: {
      orderNumber: order.orderNumber,
      paymentMethod: data.paymentMethod,
      grandTotal,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
    } as Prisma.InputJsonValue,
  });

  return NextResponse.json({ order }, { status: 201 });
}

async function getNextOfflineOrderNumber() {
  const latest = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: "OFF" } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });
  const latestNumber = latest?.orderNumber.replace(/^OFF/i, "");
  const nextNumber = latestNumber && /^\d+$/.test(latestNumber) ? Number(latestNumber) + 1 : 1;

  return `OFF${nextNumber.toString().padStart(4, "0")}`;
}

function getOfflinePayment(paymentMethod: z.infer<typeof offlineSaleSchema>["paymentMethod"]) {
  if (paymentMethod === "CASH") return { provider: "COD", status: "COD_COLLECTED" as const, label: "Cash collected" };
  if (paymentMethod === "UPI") return { provider: "OFFLINE_UPI", status: "PAID" as const, label: "Offline UPI paid" };
  if (paymentMethod === "CARD") return { provider: "OFFLINE_CARD", status: "PAID" as const, label: "Offline card paid" };
  return { provider: "OFFLINE_OTHER", status: "PAID" as const, label: "Offline payment paid" };
}

export const POST = withApiErrorHandling(postHandler, "POST /api/admin/offline-sales");
