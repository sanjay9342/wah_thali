import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeMobile } from "@/lib/customer-auth";
import {
  defaultCustomerNotificationPreferences,
  getCustomerNotificationPreferences,
  setCustomerNotificationPreferences,
} from "@/lib/customer-notification-preferences";
import { isDatabaseConfigured } from "@/lib/prisma";

const mobileSchema = z.object({
  mobile: z.string().min(8),
});

const preferencesSchema = mobileSchema.extend({
  appMuted: z.boolean(),
  whatsappMuted: z.boolean(),
});

async function getHandler(request: Request) {
  const { searchParams } = new URL(request.url);
  const mobile = normalizeMobile(searchParams.get("mobile") ?? "");
  if (!mobile) {
    return NextResponse.json({ error: "Mobile number is required." }, { status: 400 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      preferences: defaultCustomerNotificationPreferences,
      configured: false,
    }, { status: 503 });
  }

  const preferences = await getCustomerNotificationPreferences(mobile);
  return NextResponse.json({ preferences, configured: true });
}

async function putHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const parsed = preferencesSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notification preferences", issues: parsed.error.flatten() }, { status: 400 });
  }

  const mobile = normalizeMobile(parsed.data.mobile);
  if (!mobile) {
    return NextResponse.json({ error: "Mobile number is required." }, { status: 400 });
  }

  const preferences = {
    appMuted: parsed.data.appMuted,
    whatsappMuted: parsed.data.whatsappMuted,
  };
  await setCustomerNotificationPreferences(mobile, preferences);

  return NextResponse.json({ preferences, configured: true });
}

export const GET = withApiErrorHandling(getHandler, "GET /api/customers/notification-preferences");
export const PUT = withApiErrorHandling(putHandler, "PUT /api/customers/notification-preferences");
