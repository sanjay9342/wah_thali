import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAccessAssignments } from "@/lib/admin-access";
import { requireAnyAdminPermission } from "@/lib/admin-api-auth";
import { hasAdminPermission } from "@/lib/admin-access-shared";
import {
  disableAdminPushSubscription,
  getStaffIdentityFromAccess,
  getStaffNotificationRecipients,
  getVapidPublicKey,
  isCurrentDeviceRegistered,
  isPushConfigured,
  normalizeStaffMobile,
  registerAdminPushSubscription,
  sendTestAdminPush,
  upsertStaffNotificationPreference,
} from "@/lib/admin-push-notifications";
import { isDatabaseConfigured } from "@/lib/prisma";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(10),
    auth: z.string().min(10),
  }),
});

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("register-device"),
    subscription: subscriptionSchema,
  }),
  z.object({
    action: z.literal("disable-device"),
    endpoint: z.string().url(),
  }),
  z.object({
    action: z.literal("device-status"),
    endpoint: z.string().url(),
  }),
  z.object({
    action: z.literal("update-recipient"),
    staffMobile: z.string().min(8),
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal("send-test"),
  }),
]);

async function getHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const access = await requireAnyAdminPermission(request, ["settings", "orders", "access"]);
  if (!access.ok) return access.response;

  const currentStaff = getStaffIdentityFromAccess(access.access);
  return NextResponse.json({
    pushConfigured: isPushConfigured(),
    vapidPublicKey: getVapidPublicKey(),
    currentStaff,
    canManageRecipients: hasAdminPermission(access.access.permissions, "access"),
    recipients: await getStaffNotificationRecipients(access.access),
  });
}

async function postHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const access = await requireAnyAdminPermission(request, ["settings", "orders", "access"]);
  if (!access.ok) return access.response;

  const parsed = postSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid push notification request.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const currentStaff = getStaffIdentityFromAccess(access.access);
  if (!currentStaff.staffMobile) {
    return NextResponse.json({ error: "Your staff account needs a mobile number before push notifications can be enabled." }, { status: 400 });
  }

  if (parsed.data.action === "register-device") {
    if (!isPushConfigured()) {
      return NextResponse.json({ error: "Web Push is not configured. Add VAPID keys first." }, { status: 503 });
    }

    await registerAdminPushSubscription({
      ...currentStaff,
      subscription: parsed.data.subscription,
      userAgent: request.headers.get("user-agent"),
    });
    await upsertStaffNotificationPreference({
      ...currentStaff,
      enabled: true,
    });
    return NextResponse.json({
      registered: true,
      recipients: await getStaffNotificationRecipients(access.access),
    });
  }

  if (parsed.data.action === "disable-device") {
    await disableAdminPushSubscription(parsed.data.endpoint, currentStaff.staffMobile);
    return NextResponse.json({
      registered: false,
      recipients: await getStaffNotificationRecipients(access.access),
    });
  }

  if (parsed.data.action === "device-status") {
    return NextResponse.json({
      registered: await isCurrentDeviceRegistered(parsed.data.endpoint, currentStaff.staffMobile),
    });
  }

  if (parsed.data.action === "send-test") {
    if (!isPushConfigured()) {
      return NextResponse.json({ error: "Web Push is not configured. Add VAPID keys first." }, { status: 503 });
    }
    const result = await sendTestAdminPush({
      staffMobile: currentStaff.staffMobile,
      origin: new URL(request.url).origin,
    });
    return NextResponse.json({ sent: result.sent, failed: result.failed });
  }

  if (!hasAdminPermission(access.access.permissions, "access")) {
    return NextResponse.json({ error: "Only staff users with Staff Access permission can change staff notification recipients." }, { status: 403 });
  }

  const staffMobile = normalizeStaffMobile(parsed.data.staffMobile);
  const assignment = (await getAdminAccessAssignments()).find((item) => normalizeStaffMobile(item.mobile) === staffMobile);
  if (!assignment) {
    return NextResponse.json({ error: "Staff member was not found in Staff Access." }, { status: 404 });
  }

  await upsertStaffNotificationPreference({
    staffMobile,
    staffName: assignment.name,
    role: assignment.role,
    enabled: parsed.data.enabled,
  });

  return NextResponse.json({
    recipients: await getStaffNotificationRecipients(access.access),
  });
}

export const GET = withApiErrorHandling(getHandler, "GET /api/admin/push-notifications");
export const POST = withApiErrorHandling(postHandler, "POST /api/admin/push-notifications");
