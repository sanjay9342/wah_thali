import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getRestaurantSettingsFromDb, logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { formatMinutesAsClock, parseOpeningHours } from "@/lib/store-hours";

const settingsSchema = z.object({
  openingHours: z.string().trim().refine((value) => parseOpeningHours(value) !== null, "Use a valid range, for example 11:30 AM - 10:00 PM."),
  supportPhone: z.string().trim().min(1),
  whatsappNumber: z.string().trim().min(1),
  minimumOrder: z.number().finite().nonnegative(),
  deliveryFee: z.number().finite().nonnegative(),
  freeDeliveryThreshold: z.number().finite().nonnegative(),
  packagingFee: z.number().finite().nonnegative(),
  gstRate: z.number().finite().min(0).max(1),
  serviceablePins: z.array(z.string().trim().min(1)),
  locationRestrictionEnabled: z.boolean(),
  kitchenAddress: z.string(),
  kitchenLatitude: z.string().trim(),
  kitchenLongitude: z.string().trim(),
  deliveryRadiusKm: z.number().finite().positive(),
  storeMode: z.enum(["OPEN", "BUSY", "PAUSED", "CLOSED"]),
  storeStatusReason: z.string(),
  busyMessage: z.string(),
  pausedMessage: z.string(),
  closedMessage: z.string(),
  autoAcceptOrders: z.boolean(),
  requireDeclineReason: z.boolean(),
  maxOrdersPerSlot: z.number().finite().int().nonnegative(),
  defaultPrepMinutes: z.number().finite().int().positive(),
  rushPrepBufferMinutes: z.number().finite().int().nonnegative(),
  lastOrderBufferMinutes: z.number().finite().int().min(0).max(1439),
  codEnabled: z.boolean(),
  onlinePaymentsEnabled: z.boolean(),
  lowStockAlertThreshold: z.number().finite().int().nonnegative(),
  newOrderSoundEnabled: z.boolean(),
  whatsappOrderAlerts: z.boolean(),
  adminDailyDigestTime: z.string().trim().regex(/^\d{2}:\d{2}$/),
}).partial().strict();

export async function GET() {
  const settings = await getRestaurantSettingsFromDb();
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const openingRange = parsed.data.openingHours ? parseOpeningHours(parsed.data.openingHours) : null;
  const normalized = {
    ...parsed.data,
    openingHours: openingRange
      ? `${formatMinutesAsClock(openingRange.openingMinutes)} - ${formatMinutesAsClock(openingRange.closingMinutes)}`
      : parsed.data.openingHours,
  };

  const entries = await Promise.all(
    Object.entries(normalized).filter(([, value]) => value !== undefined).map(([key, value]) =>
      prisma.businessSetting.upsert({
        where: { key },
        create: { key, value: value as Prisma.InputJsonValue },
        update: { value: value as Prisma.InputJsonValue },
      }),
    ),
  );

  await logActivity({
    type: "SETTINGS_UPDATED",
    entity: "BusinessSetting",
    summary: `Updated ${entries.length} setting values`,
  });

  const settings = await getRestaurantSettingsFromDb();

  return NextResponse.json({ settings, savedKeys: entries.map((entry) => entry.key) });
}
