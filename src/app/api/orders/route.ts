import { NextResponse } from "next/server";
import { z } from "zod";
import { getCouponsFromDb, getRestaurantSettingsFromDb, logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import type { BusinessSettings, CartLine, RestaurantSettings } from "@/lib/types";

const orderItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).default("regular"),
  addonIds: z.array(z.string().min(1)).default([]),
  quantity: z.coerce.number().int().positive(),
});

const orderSchema = z.object({
  customerMobile: z.string().min(8),
  customerName: z.string().min(1),
  couponCode: z.string().trim().optional(),
  items: z.array(orderItemSchema).min(1),
});

function calculateDiscount(subtotal: number, couponCode: string | undefined, coupons: Awaited<ReturnType<typeof getCouponsFromDb>>) {
  const coupon = coupons.find((item) => item.code === couponCode?.toUpperCase());
  if (!coupon || subtotal < coupon.minOrder) return { coupon: null, discount: 0 };

  const discount =
    coupon.type === "FIXED"
      ? Math.min(coupon.value, subtotal)
      : Math.min(Math.round((subtotal * coupon.value) / 100), coupon.maxDiscount ?? subtotal);

  return { coupon, discount };
}

async function calculateServerOrder(lines: CartLine[], couponCode: string | undefined, settings: BusinessSettings) {
  const products = await prisma.product.findMany({
    where: { id: { in: lines.map((line) => line.productId) } },
    include: { variants: true, addons: true, inventory: true },
  });

  const items = lines.map((line) => {
    const product = products.find((item) => item.id === line.productId);
    if (!product) throw new Error(`Product ${line.productId} was not found.`);
    if (!product.available) throw new Error(`${product.name} is currently unavailable.`);
    if (product.inventory && product.inventory.stock < line.quantity) {
      throw new Error(`${product.name} has only ${product.inventory.stock} portions left.`);
    }

    const variant =
      product.variants.find((item) => item.id === `${product.id}-${line.variantId}` || item.id === line.variantId) ??
      product.variants.find((item) => item.name.toLowerCase() === "regular");
    if (!variant || !variant.available) throw new Error(`Selected variant is unavailable for ${product.name}.`);

    const addonTotal = line.addonIds.reduce((total, addonId) => {
      const addon = product.addons.find((item) => item.id === `${product.id}-${addonId}` || item.id === addonId);
      if (!addon || !addon.available) throw new Error(`Selected addon is unavailable for ${product.name}.`);
      return total + addon.price;
    }, 0);

    const unitPrice = product.price + variant.price + addonTotal;
    return {
      productId: product.id,
      name: product.name,
      quantity: line.quantity,
      price: unitPrice,
      lineTotal: unitPrice * line.quantity,
    };
  });

  const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);
  const coupons = await getCouponsFromDb();
  const { coupon, discount } = calculateDiscount(subtotal, couponCode, coupons);
  const packaging = items.length ? settings.packagingFee : 0;
  const delivery = items.length && subtotal - discount < settings.freeDeliveryThreshold ? settings.deliveryFee : 0;
  const taxable = Math.max(subtotal - discount + packaging + delivery, 0);
  const gst = Math.round(taxable * settings.gstRate);

  return {
    items,
    subtotal,
    discount,
    gst,
    grandTotal: taxable + gst,
    couponCode: coupon?.code,
  };
}

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ orders: [], configured: false });
  }

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { customer: true, items: true, payments: true, timeline: true },
    take: 100,
  });

  return NextResponse.json({ orders, configured: true });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const parsed = orderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const settings = await getRestaurantSettingsFromDb();

  if (settings.storeMode === "CLOSED" || settings.storeMode === "PAUSED") {
    return NextResponse.json(
      { error: getStoreStatusMessage(settings), storeMode: settings.storeMode },
      { status: 423 },
    );
  }

  const calculated = await calculateServerOrder(data.items, data.couponCode, settings).catch((error) => {
    console.error("Server order validation failed.", error);
    return null;
  });

  if (!calculated) {
    return NextResponse.json({ error: "Some cart items are no longer available. Please refresh your cart." }, { status: 409 });
  }

  if (calculated.subtotal < settings.minimumOrder) {
    return NextResponse.json(
      { error: `Minimum order is Rs ${settings.minimumOrder}. Add more items to continue.` },
      { status: 409 },
    );
  }

  const orderNumber = await getNextOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    for (const item of calculated.items) {
      const updated = await tx.inventoryItem.updateMany({
        where: { productId: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (updated.count === 0) {
        throw new Error(`Stock reservation failed for ${item.name}.`);
      }
    }

    return tx.order.create({
      data: {
        orderNumber,
        subtotal: calculated.subtotal,
        discount: calculated.discount,
        gst: calculated.gst,
        grandTotal: calculated.grandTotal,
        customer: {
          connectOrCreate: {
            where: { mobile: data.customerMobile },
            create: { mobile: data.customerMobile, name: data.customerName },
          },
        },
        items: {
          create: calculated.items.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
        },
        timeline: {
          create: {
            toStatus: "NEW",
            note: calculated.couponCode
              ? `Order created from website checkout. Coupon ${calculated.couponCode} applied.`
              : "Order created from website checkout.",
          },
        },
      },
      include: { customer: true, items: true, timeline: true },
    });
  }).catch((error) => {
    console.error("Order creation transaction failed.", error);
    return null;
  });

  if (!order) {
    return NextResponse.json({ error: "Order could not be created because stock changed. Please review your cart." }, { status: 409 });
  }

  await logActivity({
    type: "ORDER_CREATED",
    entity: "Order",
    entityId: order.id,
    summary: `Created order ${order.orderNumber}`,
    metadata: { grandTotal: order.grandTotal, couponCode: calculated.couponCode },
  });

  return NextResponse.json({ order }, { status: 201 });
}

function getStoreStatusMessage(settings: RestaurantSettings) {
  if (settings.storeStatusReason.trim()) return settings.storeStatusReason;
  if (settings.storeMode === "PAUSED") return settings.pausedMessage;
  if (settings.storeMode === "CLOSED") return settings.closedMessage;
  return "Restaurant is not accepting orders right now.";
}

async function getNextOrderNumber() {
  const latest = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: "WH" } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });
  const latestNumber = latest?.orderNumber.replace(/^WH/i, "");
  const nextNumber = latestNumber && /^\d+$/.test(latestNumber) ? Number(latestNumber) + 1 : 1;

  return `WH${nextNumber.toString().padStart(4, "0")}`;
}
