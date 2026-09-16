import "server-only";

import { Prisma } from "@prisma/client";
import { defaultWahPointsRule, normalizeWahPointsRule, type WahPointsRule } from "@/lib/rewards";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export async function getWahPointsRuleFromDb(): Promise<WahPointsRule> {
  if (!isDatabaseConfigured()) return defaultWahPointsRule;

  try {
    const row = await prisma.businessSetting.findUnique({ where: { key: "loyaltyRule" } });
    return normalizeWahPointsRule(row?.value);
  } catch (error) {
    console.error("Loyalty rule read failed. Falling back to defaults.", error);
    return defaultWahPointsRule;
  }
}

export async function saveWahPointsRuleToDb(rule: WahPointsRule) {
  return prisma.businessSetting.upsert({
    where: { key: "loyaltyRule" },
    create: { key: "loyaltyRule", value: rule as unknown as Prisma.InputJsonValue },
    update: { value: rule as unknown as Prisma.InputJsonValue },
  });
}
