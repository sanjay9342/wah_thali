import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getRestaurantSettingsFromDb, logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const settingsSchema = z.record(z.string(), z.unknown());

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

  const entries = await Promise.all(
    Object.entries(parsed.data).map(([key, value]) =>
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

  return NextResponse.json({ settings: entries });
}
