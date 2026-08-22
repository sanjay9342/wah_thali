import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatRupees } from "@/lib/pricing";
import { readServerEnv } from "@/lib/server-env";
import { sendWhatsAppTemplate, sendWhatsAppText } from "@/lib/whatsapp";
import type { Coupon, OrderStatus } from "@/lib/types";

type MessageKind = "account" | "order" | "offer" | "system";

type MessageResult = {
  ok: boolean;
  messageId?: string;
  status?: number;
  message?: string;
  channel: "template" | "text" | "skipped";
};

type NotifyCustomerInput = {
  mobile: string;
  title: string;
  body: string;
  kind: MessageKind;
  templateName?: string;
  templateParameters?: string[];
  metadata?: Record<string, unknown>;
};

type OrderForMessage = {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  discount: number;
  gst: number;
  grandTotal: number;
  createdAt?: Date | string;
  customer: { name: string; mobile: string; email?: string | null };
  items: Array<{ name: string; quantity: number; price: number }>;
  timeline?: Array<{ note?: string | null; toStatus?: string; createdAt?: Date | string }>;
};

const orderStatusCopy: Record<OrderStatus, { label: string; body: string }> = {
  PENDING_PAYMENT: { label: "Payment pending", body: "Your payment is pending. We will start once payment is confirmed." },
  NEW: { label: "Order placed", body: "We received your order and shared it with the Wah Thali kitchen." },
  CONFIRMED: { label: "Accepted", body: "Good news, your order has been accepted by Wah Thali." },
  PREPARING: { label: "Preparing", body: "Your food is being prepared fresh." },
  PACKED: { label: "Packed", body: "Your food is prepared and packed." },
  READY_FOR_PICKUP: { label: "Ready", body: "Your order is ready for pickup." },
  OUT_FOR_DELIVERY: { label: "Shipped", body: "Your order is out for delivery." },
  DELIVERED: { label: "Delivered", body: "Your order has been delivered. Thank you for ordering from Wah Thali." },
  CANCELLED: { label: "Declined", body: "Your order was declined by the restaurant." },
};

const whatsAppOrderNotificationStatuses = new Set<OrderStatus>(["NEW", "DELIVERED", "CANCELLED"]);

function truthyEnv(key: string) {
  return ["1", "true", "yes", "on"].includes(readServerEnv(key).toLowerCase());
}

function getTemplateName(specificKey: string, fallbackKey: string) {
  return readServerEnv(specificKey) || readServerEnv(fallbackKey);
}

function getSiteUrl() {
  return readServerEnv("NEXT_PUBLIC_SITE_URL") || readServerEnv("SITE_URL") || "";
}

function getOrderTrackingUrl(orderNumber: string) {
  const siteUrl = getSiteUrl().replace(/\/$/, "");
  return siteUrl ? `${siteUrl}/order/${orderNumber}/track` : `/order/${orderNumber}/track`;
}

function getLatestNote(order: OrderForMessage, note?: string) {
  return note?.trim() || order.timeline?.at(-1)?.note?.trim() || "";
}

function getOrderItemsText(order: OrderForMessage) {
  return order.items.map((item) => `${item.quantity} x ${item.name}`).join(", ");
}

function getOrderBillText(order: OrderForMessage) {
  const lines = [
    `Items: ${getOrderItemsText(order)}`,
    `Subtotal: ${formatRupees(order.subtotal)}`,
    order.discount ? `Discount: -${formatRupees(order.discount)}` : "",
    `GST: ${formatRupees(order.gst)}`,
    `Total bill: ${formatRupees(order.grandTotal)}`,
  ].filter(Boolean);
  return lines.join("\n");
}

function getCouponBenefit(coupon: Coupon) {
  if (coupon.type === "FIXED") return formatRupees(coupon.value);
  return coupon.maxDiscount ? `${coupon.value}% up to ${formatRupees(coupon.maxDiscount)}` : `${coupon.value}%`;
}

async function sendWhatsAppNotification(input: NotifyCustomerInput): Promise<MessageResult> {
  if (input.templateName) {
    const result = await sendWhatsAppTemplate({
      mobile: input.mobile,
      templateName: input.templateName,
      parameters: input.templateParameters,
    });
    return { ...result, channel: "template" };
  }

  if (!truthyEnv("META_WHATSAPP_FREEFORM_NOTIFICATIONS")) {
    return {
      ok: false,
      channel: "skipped",
      message: "No WhatsApp template configured and META_WHATSAPP_FREEFORM_NOTIFICATIONS is not enabled.",
    };
  }

  const result = await sendWhatsAppText({
    mobile: input.mobile,
    text: `${input.title}\n\n${input.body}`,
  });
  return { ...result, channel: "text" };
}

export async function notifyCustomer(input: NotifyCustomerInput) {
  const whatsapp = await sendWhatsAppNotification(input).catch((error): MessageResult => ({
    ok: false,
    channel: "skipped",
    message: error instanceof Error ? error.message : "WhatsApp send failed.",
  }));

  await prisma.activityEvent.create({
    data: {
      type: "CUSTOMER_NOTIFICATION",
      actor: input.mobile,
      entity: input.kind === "order" ? "Order" : input.kind === "offer" ? "Coupon" : "Customer",
      entityId: typeof input.metadata?.entityId === "string" ? input.metadata.entityId : input.mobile,
      summary: input.title,
      metadata: {
        body: input.body,
        kind: input.kind,
        read: false,
        whatsapp,
        ...input.metadata,
      } as Prisma.InputJsonValue,
    },
  });

  return whatsapp;
}

export async function notifyOrderStatus(order: OrderForMessage, status: OrderStatus = order.status as OrderStatus, note?: string) {
  if (!whatsAppOrderNotificationStatuses.has(status)) {
    return {
      ok: true,
      channel: "skipped" as const,
      message: `WhatsApp order notification skipped for ${status}.`,
    };
  }

  const copy = orderStatusCopy[status] ?? { label: status, body: "Your order status was updated." };
  const latestNote = getLatestNote(order, note);
  const reason = status === "CANCELLED" && latestNote ? `\nReason: ${latestNote}` : latestNote ? `\nNote: ${latestNote}` : "";
  const bill = getOrderBillText(order);
  const trackingUrl = getOrderTrackingUrl(order.orderNumber);
  const title = `Wah Thali ${copy.label}: ${order.orderNumber}`;
  const body = [
    `Hi ${order.customer.name}, ${copy.body}`,
    `Order: ${order.orderNumber}`,
    bill,
    `Track: ${trackingUrl}`,
    reason,
  ].filter(Boolean).join("\n\n");
  const templateName = getTemplateName(
    `META_WHATSAPP_ORDER_${status}_TEMPLATE_NAME`,
    "META_WHATSAPP_ORDER_STATUS_TEMPLATE_NAME",
  );

  return notifyCustomer({
    mobile: order.customer.mobile,
    title,
    body,
    kind: "order",
    templateName,
    templateParameters: [
      order.customer.name,
      order.orderNumber,
      copy.label,
      getOrderItemsText(order),
      formatRupees(order.grandTotal),
      latestNote || "-",
      trackingUrl,
    ],
    metadata: {
      entityId: order.id,
      orderNumber: order.orderNumber,
      status,
    },
  });
}

function customerMatchesCoupon(customer: {
  tags: Array<{ tag?: { name?: string } }>;
  orders: Array<{ items: Array<{ quantity: number }> }>;
}, coupon: Coupon) {
  const audience = coupon.audience ?? "ALL";
  const orderCount = customer.orders.length;
  if (audience === "VIP") return customer.tags.some((assignment) => assignment.tag?.name === "VIP");
  if (audience === "POINTS") return orderCount >= (coupon.minPoints ?? 0);
  return true;
}

export async function notifyCouponAudience(coupon: Coupon) {
  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      name: true,
      mobile: true,
      tags: { include: { tag: { select: { name: true } } } },
      orders: {
        include: { items: { select: { quantity: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
    take: 500,
  });
  const eligibleCustomers = customers.filter((customer) => customerMatchesCoupon(customer, coupon));
  const templateName = getTemplateName("META_WHATSAPP_COUPON_TEMPLATE_NAME", "META_WHATSAPP_OFFER_TEMPLATE_NAME");
  const expires = coupon.endsAt ? new Date(coupon.endsAt).toLocaleDateString("en-IN") : "limited time";

  const results = await Promise.allSettled(
    eligibleCustomers.map((customer) => {
      const orderCount = customer.orders.length;
      const itemQuantity = customer.orders.reduce(
        (total, order) => total + order.items.reduce((sum, item) => sum + item.quantity, 0),
        0,
      );
      const body = [
        `Hi ${customer.name}, Wah Thali has a coupon for you.`,
        `${coupon.code}: ${coupon.label}`,
        `Benefit: ${getCouponBenefit(coupon)}`,
        coupon.minOrder > 0 ? `Minimum order: ${formatRupees(coupon.minOrder)}` : "No minimum order.",
        `Valid till: ${expires}`,
        `Your Wah Thali history: ${orderCount} orders, ${itemQuantity} items ordered.`,
      ].join("\n");

      return notifyCustomer({
        mobile: customer.mobile,
        title: `Wah Thali coupon: ${coupon.code}`,
        body,
        kind: "offer",
        templateName,
        templateParameters: [
          customer.name,
          coupon.code,
          coupon.label,
          getCouponBenefit(coupon),
          coupon.minOrder > 0 ? formatRupees(coupon.minOrder) : "No minimum",
          expires,
        ],
        metadata: {
          entityId: coupon.code,
          couponCode: coupon.code,
          orderCount,
          itemQuantity,
        },
      });
    }),
  );

  return {
    eligible: eligibleCustomers.length,
    sent: results.filter((result) => result.status === "fulfilled" && result.value.ok).length,
    failed: results.filter((result) => result.status === "rejected" || (result.status === "fulfilled" && !result.value.ok)).length,
  };
}
