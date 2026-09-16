import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { logActivity } from "@/lib/db";
import { getWahPointsRuleFromDb, saveWahPointsRuleToDb } from "@/lib/loyalty-rule";
import { isDatabaseConfigured } from "@/lib/prisma";
import { normalizeWahPointsRule } from "@/lib/rewards";

const loyaltyRuleSchema = z.object({
  pointsPerSpendRupees: z.coerce.number().int().positive(),
  redemptionPoints: z.coerce.number().int().positive(),
  redemptionDiscount: z.coerce.number().int().positive(),
  minimumRedemptionOrderValue: z.coerce.number().int().nonnegative(),
  maxRedemptionPercent: z.coerce.number().int().min(0).max(100),
  maxCombinedDiscountPercent: z.coerce.number().int().min(0).max(100),
  firstOrderMultiplier: z.coerce.number().int().positive(),
  reorderBonusPoints: z.coerce.number().int().nonnegative(),
  reorderBonusDays: z.coerce.number().int().nonnegative(),
  pointsExpireDays: z.coerce.number().int().positive(),
  bonusPointsExpireDays: z.coerce.number().int().positive(),
}).strict().refine((rule) => rule.maxCombinedDiscountPercent >= rule.maxRedemptionPercent, {
  message: "Coupon plus points cap should be equal to or higher than the points-only cap.",
  path: ["maxCombinedDiscountPercent"],
});

async function getHandler(request: Request) {
  const access = await requireAdminPermission(request, "settings");
  if (!access.ok) return access.response;

  const rule = await getWahPointsRuleFromDb();
  return NextResponse.json({ rule });
}

async function patchHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const access = await requireAdminPermission(request, "settings");
  if (!access.ok) return access.response;

  const parsed = loyaltyRuleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid loyalty rule.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const rule = normalizeWahPointsRule(parsed.data);
  await saveWahPointsRuleToDb(rule);
  await logActivity({
    type: "LOYALTY_RULE_UPDATED",
    actor: access.access.assignment?.name ?? access.access.assignment?.mobile ?? access.access.source ?? "Admin",
    entity: "BusinessSetting",
    entityId: "loyaltyRule",
    summary: "Updated Wah Points loyalty rule",
    metadata: rule,
  });

  return NextResponse.json({ rule, saved: true });
}

export const GET = withApiErrorHandling(getHandler, "GET /api/admin/loyalty-rule");
export const PATCH = withApiErrorHandling(patchHandler, "PATCH /api/admin/loyalty-rule");
