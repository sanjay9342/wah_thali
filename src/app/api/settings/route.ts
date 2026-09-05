import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { getRestaurantSettingsFromDb, logActivity } from "@/lib/db";
import { newOrderSoundIds } from "@/lib/order-sounds";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { normalizeDeliveryDistanceSlabs, normalizeGstRate } from "@/lib/pricing";
import { formatMinutesAsClock, parseOpeningHours } from "@/lib/store-hours";

const settingsSchema = z.object({
  openingHours: z.string().trim().refine((value) => parseOpeningHours(value) !== null, "Use a valid range, for example 11:30 AM - 10:00 PM."),
  supportPhone: z.string().trim().regex(/^\d{10}$/, "Support phone must be a valid 10 digit number."),
  whatsappNumber: z.string().trim().regex(/^\d{10,15}$/, "WhatsApp number must contain 10 to 15 digits without +."),
  leadWhatsAppNumber: z.string().trim().regex(/^\d{10,15}$/, "Lead WhatsApp number must contain 10 to 15 digits without +."),
  minimumOrder: z.number().finite().nonnegative(),
  deliveryFee: z.number().finite().nonnegative(),
  deliveryFeeMode: z.enum(["FLAT", "PERCENT", "DISTANCE"]),
  deliveryFeePercent: z.number().finite().min(0).max(100),
  deliveryDistanceSlabs: z.array(z.object({
    upToKm: z.number().finite().positive(),
    fee: z.number().finite().nonnegative(),
  })).max(20),
  freeDeliveryThreshold: z.number().finite().nonnegative(),
  packagingFee: z.number().finite().nonnegative(),
  gstRate: z.number().finite().min(0).max(100),
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
  newOrderSound: z.enum(newOrderSoundIds),
  whatsappOrderAlerts: z.boolean(),
  ownerWhatsAppOrderAlerts: z.boolean(),
  adminDailyDigestTime: z.string().trim().regex(/^\d{2}:\d{2}$/),
  homeDishCategories: z.array(z.string().trim().min(1)).max(24),
}).partial().strict();

async function getHandler() {
  const settings = await getRestaurantSettingsFromDb();
  return NextResponse.json({ settings });
}

async function patchHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "settings");
  if (!access.ok) return access.response;

  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid settings payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const openingRange = parsed.data.openingHours ? parseOpeningHours(parsed.data.openingHours) : null;
  const normalized = {
    ...parsed.data,
    gstRate: parsed.data.gstRate === undefined ? undefined : normalizeGstRate(parsed.data.gstRate),
    deliveryDistanceSlabs: parsed.data.deliveryDistanceSlabs === undefined
      ? undefined
      : normalizeDeliveryDistanceSlabs(parsed.data.deliveryDistanceSlabs),
    openingHours: openingRange
      ? `${formatMinutesAsClock(openingRange.openingMinutes)} - ${formatMinutesAsClock(openingRange.closingMinutes)}`
      : parsed.data.openingHours,
  };
  const currentSettings = await getRestaurantSettingsFromDb();
  const nextRestrictionEnabled = normalized.locationRestrictionEnabled ?? currentSettings.locationRestrictionEnabled;
  const nextKitchenLatitude = normalized.kitchenLatitude ?? currentSettings.kitchenLatitude;
  const nextKitchenLongitude = normalized.kitchenLongitude ?? currentSettings.kitchenLongitude;
  const nextRadiusKm = normalized.deliveryRadiusKm ?? currentSettings.deliveryRadiusKm;

  if (nextRestrictionEnabled) {
    const kitchenLatitude = parseCoordinate(nextKitchenLatitude, 90);
    const kitchenLongitude = parseCoordinate(nextKitchenLongitude, 180);
    if (kitchenLatitude === null || kitchenLongitude === null) {
      return NextResponse.json(
        { error: "Kitchen latitude and longitude are required before enabling delivery radius restriction." },
        { status: 400 },
      );
    }
    if (Number(nextRadiusKm) <= 0) {
      return NextResponse.json(
        { error: "Allowed delivery radius must be greater than 0 km." },
        { status: 400 },
      );
    }
  }

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

function parseCoordinate(value: string | number | undefined, maxAbs: number) {
  if (value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && Math.abs(numeric) <= maxAbs ? numeric : null;
}

export const GET = withApiErrorHandling(getHandler, "GET /api/settings");
export const PATCH = withApiErrorHandling(patchHandler, "PATCH /api/settings");
