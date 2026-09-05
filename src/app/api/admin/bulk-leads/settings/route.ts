import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { getRestaurantSettingsFromDb, logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const leadSettingsSchema = z.object({
  leadWhatsAppNumber: z.string().trim().min(1),
});

async function patchHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const access = await requireAdminPermission(request, "leads");
  if (!access.ok) return access.response;

  const parsed = leadSettingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lead settings payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.businessSetting.upsert({
    where: { key: "leadWhatsAppNumber" },
    create: { key: "leadWhatsAppNumber", value: parsed.data.leadWhatsAppNumber as Prisma.InputJsonValue },
    update: { value: parsed.data.leadWhatsAppNumber as Prisma.InputJsonValue },
  });

  await logActivity({
    type: "SETTINGS_UPDATED",
    entity: "BusinessSetting",
    summary: "Updated bulk enquiry WhatsApp notification number",
  });

  const settings = await getRestaurantSettingsFromDb();
  return NextResponse.json({ settings });
}

export const PATCH = withApiErrorHandling(patchHandler, "PATCH /api/admin/bulk-leads/settings");
