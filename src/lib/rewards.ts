import type { Coupon } from "@/lib/types";

export type WahPointsRule = {
  pointsPerSpendRupees: number;
  redemptionPoints: number;
  redemptionDiscount: number;
  minimumRedemptionOrderValue: number;
  maxRedemptionPercent: number;
  maxCombinedDiscountPercent: number;
  firstOrderMultiplier: number;
  reorderBonusPoints: number;
  reorderBonusDays: number;
  pointsExpireDays: number;
  bonusPointsExpireDays: number;
};

export const defaultWahPointsRule: WahPointsRule = {
  pointsPerSpendRupees: 10,
  redemptionPoints: 100,
  redemptionDiscount: 10,
  minimumRedemptionOrderValue: 299,
  maxRedemptionPercent: 10,
  maxCombinedDiscountPercent: 15,
  firstOrderMultiplier: 2,
  reorderBonusPoints: 50,
  reorderBonusDays: 30,
  pointsExpireDays: 90,
  bonusPointsExpireDays: 30,
};

export const wahPointsRule = defaultWahPointsRule;

export const deprecatedRewardCouponCodes = ["REWARD10", "REWARD20", "REWARD30"] as const;

export const rewardMilestones = [
  { points: 100, value: 10, code: "WAHPOINTS100" },
  { points: 250, value: 25, code: "WAHPOINTS250" },
  { points: 500, value: 50, code: "WAHPOINTS500" },
] as const;

export const rewardCoupons: Coupon[] = rewardMilestones.map((milestone) => ({
  code: milestone.code,
  label: `${milestone.points} Wah Points reward`,
  type: "FIXED",
  value: milestone.value,
  minOrder: wahPointsRule.minimumRedemptionOrderValue,
  audience: "POINTS",
  minPoints: milestone.points,
}));

export function normalizeWahPointsRule(value: unknown): WahPointsRule {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<Record<keyof WahPointsRule, unknown>> : {};
  return {
    pointsPerSpendRupees: positiveInt(input.pointsPerSpendRupees, defaultWahPointsRule.pointsPerSpendRupees),
    redemptionPoints: positiveInt(input.redemptionPoints, defaultWahPointsRule.redemptionPoints),
    redemptionDiscount: positiveInt(input.redemptionDiscount, defaultWahPointsRule.redemptionDiscount),
    minimumRedemptionOrderValue: nonNegativeInt(input.minimumRedemptionOrderValue, defaultWahPointsRule.minimumRedemptionOrderValue),
    maxRedemptionPercent: percentInt(input.maxRedemptionPercent, defaultWahPointsRule.maxRedemptionPercent),
    maxCombinedDiscountPercent: percentInt(input.maxCombinedDiscountPercent, defaultWahPointsRule.maxCombinedDiscountPercent),
    firstOrderMultiplier: positiveInt(input.firstOrderMultiplier, defaultWahPointsRule.firstOrderMultiplier),
    reorderBonusPoints: nonNegativeInt(input.reorderBonusPoints, defaultWahPointsRule.reorderBonusPoints),
    reorderBonusDays: nonNegativeInt(input.reorderBonusDays, defaultWahPointsRule.reorderBonusDays),
    pointsExpireDays: positiveInt(input.pointsExpireDays, defaultWahPointsRule.pointsExpireDays),
    bonusPointsExpireDays: positiveInt(input.bonusPointsExpireDays, defaultWahPointsRule.bonusPointsExpireDays),
  };
}

export function getRewardTier(points: number) {
  if (points >= 500) return "Royal";
  if (points >= 250) return "Gold";
  if (points >= 100) return "Silver";
  return "Starter";
}

export function getRewardState(points: number, rule: WahPointsRule = wahPointsRule) {
  const completed = rewardMilestones.filter((milestone) => points >= milestone.points);
  const next = rewardMilestones.find((milestone) => points < milestone.points) ?? null;
  const previousPoints = completed.at(-1)?.points ?? 0;
  const targetPoints = next?.points ?? rewardMilestones.at(-1)?.points ?? 500;
  const span = Math.max(targetPoints - previousPoints, 1);
  const progress = next ? Math.min(100, Math.max(0, ((points - previousPoints) / span) * 100)) : 100;

  return {
    completed,
    next,
    progress,
    pointsToNext: next ? Math.max(next.points - points, 0) : 0,
    ordersToNext: next ? Math.max(Math.ceil((next.points - points) / (299 / rule.pointsPerSpendRupees)), 0) : 0,
    tier: getRewardTier(points),
  };
}

export function calculateBaseWahPoints(eligibleFoodValue: number, rule: WahPointsRule = wahPointsRule) {
  return Math.max(0, Math.floor(eligibleFoodValue / rule.pointsPerSpendRupees));
}

export function calculateWahPointsEarned(input: {
  eligibleFoodValue: number;
  isFirstOrder: boolean;
  previousCompletedOrderAt?: Date | string | null;
  orderedAt?: Date;
}, rule: WahPointsRule = wahPointsRule) {
  const orderedAt = input.orderedAt ?? new Date();
  const basePoints = calculateBaseWahPoints(input.eligibleFoodValue, rule);
  const firstOrderBonusPoints = input.isFirstOrder ? basePoints * Math.max(rule.firstOrderMultiplier - 1, 0) : 0;
  const reorderBonusPoints = shouldApplyReorderBonus(input.previousCompletedOrderAt, orderedAt, rule)
    ? rule.reorderBonusPoints
    : 0;

  return {
    basePoints,
    firstOrderBonusPoints,
    reorderBonusPoints,
    totalPoints: basePoints + firstOrderBonusPoints + reorderBonusPoints,
  };
}

export function shouldApplyReorderBonus(previousCompletedOrderAt: Date | string | null | undefined, orderedAt = new Date(), rule: WahPointsRule = wahPointsRule) {
  if (!previousCompletedOrderAt) return false;
  const previousTime = new Date(previousCompletedOrderAt).getTime();
  if (!Number.isFinite(previousTime)) return false;
  return orderedAt.getTime() - previousTime <= rule.reorderBonusDays * 24 * 60 * 60 * 1000;
}

export function getLoyaltyExpiryDate(type: "BASE" | "FIRST_ORDER_BONUS" | "REORDER_BONUS", earnedAt = new Date(), rule: WahPointsRule = wahPointsRule) {
  const days = type === "REORDER_BONUS" ? rule.bonusPointsExpireDays : rule.pointsExpireDays;
  return new Date(earnedAt.getTime() + days * 24 * 60 * 60 * 1000);
}

export function calculateLoyaltyRedemption(input: {
  foodValue: number;
  couponDiscount?: number;
  availablePoints: number;
  requestedPoints?: number;
}, rule: WahPointsRule = wahPointsRule) {
  const foodValue = Math.max(0, Math.round(input.foodValue));
  const couponDiscount = Math.max(0, Math.round(input.couponDiscount ?? 0));
  const availablePoints = Math.max(0, Math.floor(input.availablePoints));
  const requestedPoints = Math.max(0, Math.floor(input.requestedPoints ?? availablePoints));

  if (foodValue < rule.minimumRedemptionOrderValue) {
    return { points: 0, discount: 0, reason: `Minimum food order is Rs ${rule.minimumRedemptionOrderValue}.` };
  }

  const maxLoyaltyDiscount = Math.floor((foodValue * rule.maxRedemptionPercent) / 100);
  const maxCombinedDiscount = Math.floor((foodValue * rule.maxCombinedDiscountPercent) / 100);
  const combinedRemainingDiscount = Math.max(maxCombinedDiscount - couponDiscount, 0);
  const discountCap = Math.min(maxLoyaltyDiscount, combinedRemainingDiscount);
  const pointCap = Math.floor((discountCap * rule.redemptionPoints) / rule.redemptionDiscount);
  const redeemablePoints = Math.floor(Math.min(availablePoints, requestedPoints, pointCap) / 10) * 10;
  const discount = Math.floor((redeemablePoints * rule.redemptionDiscount) / rule.redemptionPoints);

  return { points: redeemablePoints, discount, reason: redeemablePoints > 0 ? "" : "Not enough eligible Wah Points for this order." };
}

function positiveInt(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

function nonNegativeInt(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : fallback;
}

function percentInt(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 && numeric <= 100 ? numeric : fallback;
}
