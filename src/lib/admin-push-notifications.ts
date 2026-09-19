import "server-only";

import type { Prisma } from "@prisma/client";
import webpush from "web-push";
import { getAdminAccessAssignments } from "@/lib/admin-access";
import type { AdminAccessAssignment, AdminAccessResult } from "@/lib/admin-access-shared";
import { business } from "@/lib/business";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export type StaffNotificationRecipient = {
  staffMobile: string;
  staffName: string;
  role: string;
  active: boolean;
  enabled: boolean;
  deviceCount: number;
};

export type BrowserPushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export function normalizeStaffMobile(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "").slice(-10);
}

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || process.env.VAPID_PUBLIC_KEY?.trim() || "";
}

function getVapidPrivateKey() {
  return process.env.VAPID_PRIVATE_KEY?.trim() || "";
}

export function isPushConfigured() {
  return Boolean(getVapidPublicKey() && getVapidPrivateKey());
}

function configureWebPush() {
  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(`mailto:${business.email}`, publicKey, privateKey);
  return true;
}

export function getStaffIdentityFromAccess(access: AdminAccessResult) {
  const assignment = access.assignment;
  return {
    staffMobile: normalizeStaffMobile(assignment?.mobile),
    staffName: assignment?.name || "Wah Thali staff",
    role: access.role || assignment?.role || "STAFF",
  };
}

export async function getStaffNotificationRecipients(access?: AdminAccessResult): Promise<StaffNotificationRecipient[]> {
  if (!isDatabaseConfigured()) return [];

  const staffByMobile = new Map<string, Pick<AdminAccessAssignment, "name" | "mobile" | "role" | "active">>();
  for (const assignment of await getAdminAccessAssignments()) {
    const staffMobile = normalizeStaffMobile(assignment.mobile);
    if (!staffMobile) continue;
    staffByMobile.set(staffMobile, {
      name: assignment.name,
      mobile: staffMobile,
      role: assignment.role,
      active: assignment.active,
    });
  }

  if (access?.source === "bootstrap") {
    const current = getStaffIdentityFromAccess(access);
    if (current.staffMobile && !staffByMobile.has(current.staffMobile)) {
      staffByMobile.set(current.staffMobile, {
        name: current.staffName,
        mobile: current.staffMobile,
        role: current.role,
        active: true,
      });
    }
  }

  const staffMobiles = Array.from(staffByMobile.keys());
  if (!staffMobiles.length) return [];

  const [preferences, deviceCounts] = await Promise.all([
    prisma.adminNotificationPreference.findMany({
      where: { staffMobile: { in: staffMobiles } },
      select: { staffMobile: true, newOrderPushEnabled: true },
    }),
    prisma.adminPushSubscription.groupBy({
      by: ["staffMobile"],
      where: { staffMobile: { in: staffMobiles }, enabled: true },
      _count: { _all: true },
    }),
  ]);
  const enabledByMobile = new Map(preferences.map((item) => [item.staffMobile, item.newOrderPushEnabled]));
  const devicesByMobile = new Map(deviceCounts.map((item) => [item.staffMobile, item._count._all]));

  return Array.from(staffByMobile.values())
    .map((staff) => ({
      staffMobile: normalizeStaffMobile(staff.mobile),
      staffName: staff.name,
      role: staff.role,
      active: staff.active,
      enabled: enabledByMobile.get(normalizeStaffMobile(staff.mobile)) ?? false,
      deviceCount: devicesByMobile.get(normalizeStaffMobile(staff.mobile)) ?? 0,
    }))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.staffName.localeCompare(b.staffName));
}

export async function upsertStaffNotificationPreference(input: {
  staffMobile: string;
  staffName: string;
  role: string;
  enabled: boolean;
}) {
  const staffMobile = normalizeStaffMobile(input.staffMobile);
  if (!staffMobile) throw new Error("Staff mobile is required.");

  return prisma.adminNotificationPreference.upsert({
    where: { staffMobile },
    create: {
      staffMobile,
      staffName: input.staffName,
      role: input.role,
      newOrderPushEnabled: input.enabled,
    },
    update: {
      staffName: input.staffName,
      role: input.role,
      newOrderPushEnabled: input.enabled,
    },
  });
}

export async function registerAdminPushSubscription(input: {
  staffMobile: string;
  staffName: string;
  role: string;
  subscription: BrowserPushSubscription;
  userAgent?: string | null;
}) {
  const staffMobile = normalizeStaffMobile(input.staffMobile);
  if (!staffMobile) throw new Error("Staff mobile is required.");

  return prisma.adminPushSubscription.upsert({
    where: { endpoint: input.subscription.endpoint },
    create: {
      staffMobile,
      staffName: input.staffName,
      role: input.role,
      endpoint: input.subscription.endpoint,
      p256dh: input.subscription.keys.p256dh,
      auth: input.subscription.keys.auth,
      userAgent: input.userAgent || undefined,
      enabled: true,
      lastSeenAt: new Date(),
    },
    update: {
      staffMobile,
      staffName: input.staffName,
      role: input.role,
      p256dh: input.subscription.keys.p256dh,
      auth: input.subscription.keys.auth,
      userAgent: input.userAgent || undefined,
      enabled: true,
      failedAt: null,
      failureReason: null,
      lastSeenAt: new Date(),
    },
  });
}

export async function disableAdminPushSubscription(endpoint: string, staffMobile: string) {
  return prisma.adminPushSubscription.updateMany({
    where: { endpoint, staffMobile: normalizeStaffMobile(staffMobile) },
    data: { enabled: false },
  });
}

export async function isCurrentDeviceRegistered(endpoint: string, staffMobile: string) {
  const row = await prisma.adminPushSubscription.findFirst({
    where: { endpoint, staffMobile: normalizeStaffMobile(staffMobile), enabled: true },
    select: { id: true },
  });
  return Boolean(row);
}

export async function sendTestAdminPush(input: {
  staffMobile: string;
  origin: string;
}) {
  return sendAdminPushToStaff({
    staffMobile: input.staffMobile,
    payload: {
      title: "Wah Thali",
      body: "Test notification from Wah Thali admin.",
      orderNumber: "TEST",
      url: `${input.origin}/admin/orders`,
      tag: `wah-thali-test-${Date.now()}`,
    },
  });
}

export async function notifyStaffNewOrder(order: {
  id: string;
  orderNumber: string;
  grandTotal: number;
  fulfillmentMethod: string;
  items: { name: string; quantity: number }[];
}) {
  if (!isDatabaseConfigured() || !isPushConfigured()) return;

  const idempotencyKey = `admin-push-new-order:${order.id}`;
  try {
    await prisma.idempotencyKey.create({
      data: {
        key: idempotencyKey,
        scope: "ADMIN_PUSH_NEW_ORDER",
        response: { orderNumber: order.orderNumber } as Prisma.InputJsonValue,
      },
    });
  } catch {
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://wahthali.in";
  const itemSummary = order.items
    .slice(0, 3)
    .map((item) => `${item.quantity}x ${item.name}`)
    .join(", ");
  const body = [
    `Order ${order.orderNumber}`,
    `Rs ${order.grandTotal}`,
    order.fulfillmentMethod === "PICKUP" ? "Self pickup" : "Delivery",
    itemSummary,
  ].filter(Boolean).join(" | ");

  await sendAdminPushToEnabledStaff({
    title: "New Order Received",
    body,
    orderNumber: order.orderNumber,
    url: `${siteUrl}/admin/orders?order=${encodeURIComponent(order.orderNumber)}`,
    tag: `wah-thali-order-${order.orderNumber}`,
  }).catch((error) => {
    console.error("Admin new order push notification failed.", error);
  });
}

async function sendAdminPushToEnabledStaff(payload: PushPayload) {
  const enabledPreferences = await prisma.adminNotificationPreference.findMany({
    where: { newOrderPushEnabled: true },
    select: { staffMobile: true },
  });
  const staffMobiles = enabledPreferences.map((item) => item.staffMobile);
  if (!staffMobiles.length) return { sent: 0, failed: 0 };

  return sendAdminPushWhere({
    where: { staffMobile: { in: staffMobiles }, enabled: true },
    payload,
  });
}

async function sendAdminPushToStaff(input: { staffMobile: string; payload: PushPayload }) {
  return sendAdminPushWhere({
    where: { staffMobile: normalizeStaffMobile(input.staffMobile), enabled: true },
    payload: input.payload,
  });
}

type PushPayload = {
  title: string;
  body: string;
  orderNumber: string;
  url: string;
  tag: string;
};

async function sendAdminPushWhere(input: {
  where: Prisma.AdminPushSubscriptionWhereInput;
  payload: PushPayload;
}) {
  if (!configureWebPush()) return { sent: 0, failed: 0 };

  const subscriptions = await prisma.adminPushSubscription.findMany({
    where: input.where,
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  let sent = 0;
  let failed = 0;
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify(input.payload),
      );
      sent += 1;
    } catch (error) {
      failed += 1;
      const statusCode = typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : 0;
      await prisma.adminPushSubscription.update({
        where: { id: subscription.id },
        data: {
          enabled: statusCode === 404 || statusCode === 410 ? false : undefined,
          failedAt: new Date(),
          failureReason: error instanceof Error ? error.message.slice(0, 500) : "Push delivery failed.",
        },
      }).catch(() => undefined);
    }
  }));

  return { sent, failed };
}
