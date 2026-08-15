import { NextResponse } from "next/server";
import { z } from "zod";
import { getCouponsFromDb, getRestaurantSettingsFromDb, logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { createRazorpayOrder } from "@/lib/razorpay";
import type { CartLine, RestaurantSettings } from "@/lib/types";

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
  pinCode: z.string().trim().optional(),
  paymentMethod: z.enum(["COD", "RAZORPAY"]).default("COD"),
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

async function calculateServerOrder(lines: CartLine[], couponCode: string | undefined, settings: RestaurantSettings) {
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
    include: {
      customer: { select: { id: true, name: true, mobile: true, email: true } },
      items: true,
      payments: true,
      timeline: true,
    },
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

  if (isOutsideOrderingHours(settings)) {
    return NextResponse.json(
      { error: `Ordering is available during ${settings.openingHours}. Last orders close ${settings.lastOrderBufferMinutes} minutes before closing time.` },
      { status: 423 },
    );
  }

  if (settings.maxOrdersPerSlot > 0) {
    const liveOrders = await prisma.order.count({
      where: {
        status: { in: ["NEW", "CONFIRMED", "PREPARING", "PACKED"] },
      },
    });

    if (liveOrders >= settings.maxOrdersPerSlot) {
      return NextResponse.json(
        { error: "The kitchen is at capacity right now. Please try again shortly." },
        { status: 429 },
      );
    }
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
  if (data.paymentMethod === "RAZORPAY" && !settings.onlinePaymentsEnabled) {
    return NextResponse.json({ error: "Online payments are not enabled right now." }, { status: 423 });
  }

  const razorpayOrder = data.paymentMethod === "RAZORPAY"
    ? await createRazorpayOrder({
        amountRupees: calculated.grandTotal,
        receipt: orderNumber,
        notes: {
          orderNumber,
          customerMobile: data.customerMobile,
        },
      })
    : null;

  if (data.paymentMethod === "RAZORPAY") {
    if (!razorpayOrder?.ok) {
      console.error("Razorpay order creation failed.", {
        status: razorpayOrder?.status,
        message: razorpayOrder?.message,
      });
      return NextResponse.json({ error: "Online payment could not be started. Please try again." }, { status: 502 });
    }
  }

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
        status: data.paymentMethod === "RAZORPAY"
          ? "PENDING_PAYMENT"
          : settings.autoAcceptOrders ? "CONFIRMED" : "NEW",
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
            toStatus: data.paymentMethod === "RAZORPAY"
              ? "PENDING_PAYMENT"
              : settings.autoAcceptOrders ? "CONFIRMED" : "NEW",
            note: [
              data.paymentMethod === "RAZORPAY"
                ? "Order created and waiting for Razorpay payment."
                : settings.autoAcceptOrders ? "Order auto accepted from admin settings." : "Order created from website checkout.",
              calculated.couponCode ? `Coupon ${calculated.couponCode} applied.` : "",
              data.pinCode ? `Location: PIN ${data.pinCode}` : "",
            ].filter(Boolean).join(" "),
          },
        },
        payments: {
          create: {
            provider: data.paymentMethod === "RAZORPAY" ? "RAZORPAY" : "COD",
            providerPaymentId: razorpayOrder?.ok ? razorpayOrder.order.id : undefined,
            status: data.paymentMethod === "RAZORPAY" ? "CREATED" : "COD_PENDING",
            amount: calculated.grandTotal,
          },
        },
      },
      include: {
        customer: { select: { id: true, name: true, mobile: true, email: true } },
        items: true,
        payments: true,
        timeline: true,
      },
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

  return NextResponse.json({
    order,
    razorpay: razorpayOrder?.ok ? {
      keyId: razorpayOrder.keyId,
      orderId: razorpayOrder.order.id,
      amount: razorpayOrder.order.amount,
      currency: razorpayOrder.order.currency,
    } : undefined,
  }, { status: 201 });
}

function getStoreStatusMessage(settings: RestaurantSettings) {
  if (settings.storeStatusReason.trim()) return settings.storeStatusReason;
  if (settings.storeMode === "PAUSED") return settings.pausedMessage;
  if (settings.storeMode === "CLOSED") return settings.closedMessage;
  return "Restaurant is not accepting orders right now.";
}

function isOutsideOrderingHours(settings: RestaurantSettings) {
  const range = settings.openingHours.split(/\s*-\s*/);
  const openingMinutes = range[0] ? parseTimeToMinutes(range[0]) : null;
  const closingMinutes = range[1] ? parseTimeToMinutes(range[1]) : null;
  if (openingMinutes === null || closingMinutes === null) return false;

  const nowMinutes = getKolkataMinutes();
  const lastOrderMinutes = normalizeMinutes(closingMinutes - settings.lastOrderBufferMinutes);

  if (openingMinutes < closingMinutes) {
    return nowMinutes < openingMinutes || nowMinutes >= lastOrderMinutes;
  }

  return nowMinutes >= lastOrderMinutes && nowMinutes < openingMinutes;
}

function getKolkataMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);

  return hour * 60 + minute;
}

function parseTimeToMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;

  return hour * 60 + minute;
}

function normalizeMinutes(value: number) {
  return ((value % 1440) + 1440) % 1440;
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
