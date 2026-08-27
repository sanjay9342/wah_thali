import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import type { PaymentStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { getCategoryOffersFromDb, getCouponsFromDb, getRestaurantSettingsFromDb, logActivity } from "@/lib/db";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { getDeliveryCoverage } from "@/lib/delivery-radius";
import { normalizeEmail } from "@/lib/customer-auth";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { createRazorpayOrder } from "@/lib/razorpay";
import { notifyOrderStatus, notifyOwnerOrderAlert } from "@/lib/customer-messaging";
import { getStoreOrderingStatus } from "@/lib/store-hours";
import type { CartLine, OrderStatus, RestaurantSettings } from "@/lib/types";
import { getDeliveryFee, getOfferDiscount, isCouponEligibleForCustomer, normalizeGstRate, type CouponCustomerContext } from "@/lib/pricing";
import { getModifierOptionLabel, getModifierSelectionIssue, getProductModifierGroups } from "@/lib/product-modifiers";
import { getRewardTier } from "@/lib/rewards";

const paidOnlineStatuses: PaymentStatus[] = ["PAID", "AUTHORIZED"];

const orderItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).default("regular"),
  addonIds: z.array(z.string().min(1)).default([]),
  quantity: z.coerce.number().int().positive(),
});

const orderSchema = z.object({
  customerMobile: z.string().min(8),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional().or(z.literal("")),
  couponCode: z.string().trim().optional(),
  fulfillmentMethod: z.enum(["DELIVERY", "PICKUP"]).default("DELIVERY"),
  receiverName: z.string().trim().optional(),
  receiverMobile: z.string().trim().optional(),
  deliveryAddress: z.string().trim().optional(),
  deliveryLabel: z.string().trim().optional(),
  restaurantNote: z.string().trim().optional(),
  pinCode: z.string().trim().optional(),
  latitude: z.string().trim().optional(),
  longitude: z.string().trim().optional(),
  paymentMethod: z.enum(["COD", "RAZORPAY"]).default("COD"),
  items: z.array(orderItemSchema).min(1),
});

function calculateDiscount(subtotal: number, couponCode: string | undefined, coupons: Awaited<ReturnType<typeof getCouponsFromDb>>, customer?: CouponCustomerContext) {
  const coupon = coupons.find((item) => item.code === couponCode?.toUpperCase());
  if (!coupon || subtotal < coupon.minOrder || !isCouponEligibleForCustomer(coupon, customer)) return { coupon: null, discount: 0 };

  const discount =
    coupon.type === "FIXED"
      ? Math.min(coupon.value, subtotal)
      : Math.min(Math.round((subtotal * coupon.value) / 100), coupon.maxDiscount ?? subtotal);

  return { coupon, discount };
}

async function calculateServerOrder(lines: CartLine[], couponCode: string | undefined, settings: RestaurantSettings, customer?: CouponCustomerContext, deliveryDistanceKm?: number | null, fulfillmentMethod: "DELIVERY" | "PICKUP" = "DELIVERY") {
  const products = await prisma.product.findMany({
    where: { id: { in: lines.map((line) => line.productId) } },
    include: { category: true, variants: true, addons: true, inventory: true },
  });
  const categoryOffers = await getCategoryOffersFromDb();

  const items = lines.map((line) => {
    const product = products.find((item) => item.id === line.productId);
    if (!product) throw new Error(`Product ${line.productId} was not found.`);
    if (!product.available) throw new Error(`${product.name} is currently unavailable.`);
    const variant =
      product.variants.find((item) => item.id === `${product.id}-${line.variantId}` || item.id === line.variantId) ??
      product.variants.find((item) => item.name.toLowerCase() === "regular") ??
      (product.variants.length === 0 && line.variantId === "regular"
        ? { id: "regular", name: "Regular", price: 0, available: true }
        : null);
    if (!variant || !variant.available) throw new Error(`Selected variant is unavailable for ${product.name}.`);

    const selectedAddons = line.addonIds.map((addonId) => {
      const addon = product.addons.find((item) => item.id === `${product.id}-${addonId}` || item.id === addonId);
      if (!addon || !addon.available) throw new Error(`Selected addon is unavailable for ${product.name}.`);
      return addon;
    });
    const addonQuantities = selectedAddons.reduce<Record<string, number>>((quantities, addon) => {
      quantities[addon.id] = (quantities[addon.id] ?? 0) + 1;
      return quantities;
    }, {});
    const modifierSelectionIssue = getModifierSelectionIssue(getProductModifierGroups({ addons: product.addons }), addonQuantities);
    if (modifierSelectionIssue) throw new Error(`${product.name}: ${modifierSelectionIssue}`);
    const addonTotal = selectedAddons.reduce((total, addon) => total + addon.price, 0);
    const addonNames = selectedAddons.map((addon) => getModifierOptionLabel(addon.name));
    const variantName = variant.name.toLowerCase() === "regular" ? "" : variant.name;

    const dishPrice = product.price + variant.price;
    const offerText = product.offer?.trim() || categoryOffers[product.category.slug]?.trim();
    const unitPrice = Math.max(dishPrice - getOfferDiscount(dishPrice, offerText), 0) + addonTotal;
    return {
      productId: product.id,
      name: [product.name, variantName, addonNames.length ? `With ${addonNames.join(", ")}` : ""].filter(Boolean).join(" - "),
      quantity: line.quantity,
      price: unitPrice,
      lineTotal: unitPrice * line.quantity,
    };
  });

  const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);
  const coupons = await getCouponsFromDb();
  const { coupon, discount } = calculateDiscount(subtotal, couponCode, coupons, customer);
  const packaging = items.length ? settings.packagingFee : 0;
  const eligibleOrderValue = subtotal - discount;
  const delivery = fulfillmentMethod === "PICKUP" ? 0 : getDeliveryFee(settings, eligibleOrderValue, items.length > 0, deliveryDistanceKm);
  const taxable = Math.max(subtotal - discount + packaging + delivery, 0);
  const gst = Math.round(taxable * normalizeGstRate(settings.gstRate));

  return {
    items,
    subtotal,
    discount,
    gst,
    grandTotal: taxable + gst,
    couponCode: coupon?.code,
  };
}

async function getHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ orders: [], configured: false });
  }
  const access = await requireAdminPermission(request, "orders");
  if (!access.ok) return access.response;

  const baseInclude = {
    customer: { select: { id: true, name: true, mobile: true, email: true } },
    items: true,
    payments: true,
    timeline: { orderBy: { createdAt: "asc" as const } },
  };

  try {
    const orders = await prisma.order.findMany({
      where: visiblePlacedOrderWhere(),
      orderBy: { createdAt: "desc" },
      include: {
        ...baseInclude,
        reviews: {
          include: { product: { select: { name: true } } },
          orderBy: { createdAt: "desc" as const },
        },
      },
      take: 100,
    });

    return NextResponse.json({ orders, configured: true });
  } catch (error) {
    if (!isMissingReviewOrderColumn(error)) throw error;
    console.error("Review.orderId is missing in the database. Returning orders without review summaries.", error);
  }

  const orders = await prisma.order.findMany({
    where: visiblePlacedOrderWhere(),
    orderBy: { createdAt: "desc" },
    include: baseInclude,
    take: 100,
  });

  return NextResponse.json({ orders: orders.map((order) => ({ ...order, reviews: [] })), configured: true });
}

async function postHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const parsed = orderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const isPickup = data.fulfillmentMethod === "PICKUP";
  const customerEmail = data.customerEmail ? normalizeEmail(data.customerEmail) : "";
  const settings = await getRestaurantSettingsFromDb();
  const orderingStatus = getStoreOrderingStatus(settings);
  const existingCustomer = await prisma.customer.findUnique({
    where: { mobile: data.customerMobile },
    select: {
      tags: { include: { tag: { select: { name: true } } } },
    },
  });
  const rewardOrderCount = await prisma.order.count({
    where: {
      customer: { mobile: data.customerMobile },
      ...visiblePlacedOrderWhere(),
    },
  });
  const couponCustomer = {
    isVip: existingCustomer?.tags.some((assignment) => assignment.tag.name === "VIP") ?? false,
    orderCount: rewardOrderCount,
    points: rewardOrderCount,
    tags: existingCustomer?.tags.map((assignment) => assignment.tag.name) ?? [],
  };

  if (orderingStatus.unavailable) {
    return NextResponse.json(
      { error: orderingStatus.message, storeMode: settings.storeMode, outsideOrderingHours: orderingStatus.outsideOrderingHours },
      { status: 423 },
    );
  }

  const deliveryCoverage = isPickup
    ? {
        serviceable: true,
        needsLocation: false,
        distanceKm: null,
        message: "Self pickup selected.",
      }
    : getDeliveryCoverage({
        pinCode: data.pinCode,
        latitude: data.latitude,
        longitude: data.longitude,
      }, settings);

  if (!deliveryCoverage.serviceable) {
    return NextResponse.json(
      { error: deliveryCoverage.message, needsLocation: deliveryCoverage.needsLocation, distanceKm: deliveryCoverage.distanceKm },
      { status: 422 },
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

  const calculatedResult = await calculateServerOrder(data.items, data.couponCode, settings, couponCustomer, deliveryCoverage.distanceKm, data.fulfillmentMethod)
    .then((order) => ({ order, error: null as string | null }))
    .catch((error) => {
    console.error("Server order validation failed.", error);
    return {
      order: null,
      error: error instanceof Error ? error.message : null,
    };
  });

  if (!calculatedResult.order) {
    return NextResponse.json({ error: calculatedResult.error || "Some cart items are no longer available. Please refresh your cart." }, { status: 409 });
  }
  const calculated = calculatedResult.order;

  if (data.couponCode && !calculated.couponCode) {
    return NextResponse.json({ error: "This coupon is not eligible for this customer or order." }, { status: 409 });
  }

  if (calculated.subtotal < settings.minimumOrder) {
    return NextResponse.json(
      { error: `Minimum order is Rs ${settings.minimumOrder}. Add more items to continue.` },
      { status: 409 },
    );
  }

  const orderNumber = await getNextOrderNumber();
  if (customerEmail) {
    const existingEmailCustomer = await prisma.customer.findUnique({
      where: { email: customerEmail },
      select: { mobile: true },
    });
    if (existingEmailCustomer && existingEmailCustomer.mobile !== data.customerMobile) {
      return NextResponse.json({ error: "This email is already linked to another customer account." }, { status: 409 });
    }
  }

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
    const customer = await tx.customer.upsert({
      where: { mobile: data.customerMobile },
      create: {
        mobile: data.customerMobile,
        name: data.customerName,
        email: customerEmail || undefined,
      },
      update: {
        name: data.customerName,
        ...(customerEmail ? { email: customerEmail } : {}),
      },
      select: { id: true },
    });

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
        customer: { connect: { id: customer.id } },
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
                ? "Order created and waiting for online payment."
                : settings.autoAcceptOrders ? "Order auto accepted from admin settings." : "Order created from website checkout.",
              data.receiverName || data.receiverMobile ? `Receiver: ${[data.receiverName, data.receiverMobile].filter(Boolean).join(", ")}` : "",
              customerEmail ? `Email: ${customerEmail}` : "",
              data.deliveryAddress ? `Address: ${data.deliveryAddress}` : "",
              data.deliveryLabel ? `Address type: ${data.deliveryLabel}` : "",
              isPickup ? "Fulfillment: Self pickup" : "Fulfillment: Delivery",
              isPickup && settings.kitchenAddress ? `Pickup address: ${settings.kitchenAddress}` : "",
              data.restaurantNote ? `Customer note: ${data.restaurantNote}` : "",
              calculated.couponCode ? `Coupon ${calculated.couponCode} applied.` : "",
              !isPickup && data.pinCode ? `Location: PIN ${data.pinCode}` : "",
              !isPickup && data.latitude && data.longitude ? `GPS: ${data.latitude}, ${data.longitude}` : "",
              !isPickup && deliveryCoverage.distanceKm !== null ? `Distance: ${deliveryCoverage.distanceKm.toFixed(2)} km.` : "",
            ].filter(Boolean).join(" | "),
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
    return NextResponse.json({ error: "Order could not be created. Please review your cart and try again." }, { status: 409 });
  }

  await logActivity({
    type: "ORDER_CREATED",
    entity: "Order",
    entityId: order.id,
    summary: `Created order ${order.orderNumber}`,
    metadata: { grandTotal: order.grandTotal, couponCode: calculated.couponCode },
  });

  if (settings.ownerWhatsAppOrderAlerts && order.status !== "PENDING_PAYMENT") {
    await notifyOwnerOrderAlert(order, settings.whatsappNumber, "NEW_ORDER").catch((error) => {
      console.error("Owner new order WhatsApp alert failed.", error);
    });
  }

  if (settings.whatsappOrderAlerts) {
    await notifyOrderStatus(order, order.status as OrderStatus).catch((error) => {
      console.error("Order WhatsApp/customer notification failed.", error);
    });
  }

  const nextRewardOrderCount = await prisma.order.count({
    where: {
      customer: { mobile: data.customerMobile },
      ...visiblePlacedOrderWhere(),
    },
  });
  await prisma.loyaltyAccount.upsert({
    where: { customerId: order.customer.id },
    create: { customerId: order.customer.id, points: nextRewardOrderCount, tier: getRewardTier(nextRewardOrderCount) },
    update: { points: nextRewardOrderCount, tier: getRewardTier(nextRewardOrderCount) },
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

function isMissingReviewOrderColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Review.orderId") || (message.includes("Review") && message.includes("orderId"));
}

function visiblePlacedOrderWhere(): Prisma.OrderWhereInput {
  return {
    OR: [
      { payments: { some: { provider: "COD" } } },
      { payments: { some: { provider: "RAZORPAY", status: { in: paidOnlineStatuses } } } },
    ],
  };
}

export const GET = withApiErrorHandling(getHandler, "GET /api/orders");
export const POST = withApiErrorHandling(postHandler, "POST /api/orders");
