import type { Coupon } from "@/lib/types";

export const wahPointsRule = {
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
} as const;

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

export function getRewardTier(points: number) {
  if (points >= 500) return "Royal";
  if (points >= 250) return "Gold";
  if (points >= 100) return "Silver";
  return "Starter";
}

export function getRewardState(points: number) {
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
    ordersToNext: next ? Math.max(Math.ceil((next.points - points) / (299 / wahPointsRule.pointsPerSpendRupees)), 0) : 0,
    tier: getRewardTier(points),
  };
}

export function calculateBaseWahPoints(eligibleFoodValue: number) {
  return Math.max(0, Math.floor(eligibleFoodValue / wahPointsRule.pointsPerSpendRupees));
}

export function calculateWahPointsEarned(input: {
  eligibleFoodValue: number;
  isFirstOrder: boolean;
  previousCompletedOrderAt?: Date | string | null;
  orderedAt?: Date;
}) {
  const orderedAt = input.orderedAt ?? new Date();
  const basePoints = calculateBaseWahPoints(input.eligibleFoodValue);
  const firstOrderBonusPoints = input.isFirstOrder ? basePoints : 0;
  const reorderBonusPoints = shouldApplyReorderBonus(input.previousCompletedOrderAt, orderedAt)
    ? wahPointsRule.reorderBonusPoints
    : 0;

  return {
    basePoints,
    firstOrderBonusPoints,
    reorderBonusPoints,
    totalPoints: basePoints + firstOrderBonusPoints + reorderBonusPoints,
  };
}

export function shouldApplyReorderBonus(previousCompletedOrderAt: Date | string | null | undefined, orderedAt = new Date()) {
  if (!previousCompletedOrderAt) return false;
  const previousTime = new Date(previousCompletedOrderAt).getTime();
  if (!Number.isFinite(previousTime)) return false;
  return orderedAt.getTime() - previousTime <= wahPointsRule.reorderBonusDays * 24 * 60 * 60 * 1000;
}

export function getLoyaltyExpiryDate(type: "BASE" | "FIRST_ORDER_BONUS" | "REORDER_BONUS", earnedAt = new Date()) {
  const days = type === "REORDER_BONUS" ? wahPointsRule.bonusPointsExpireDays : wahPointsRule.pointsExpireDays;
  return new Date(earnedAt.getTime() + days * 24 * 60 * 60 * 1000);
}

export function calculateLoyaltyRedemption(input: {
  foodValue: number;
  couponDiscount?: number;
  availablePoints: number;
  requestedPoints?: number;
}) {
  const foodValue = Math.max(0, Math.round(input.foodValue));
  const couponDiscount = Math.max(0, Math.round(input.couponDiscount ?? 0));
  const availablePoints = Math.max(0, Math.floor(input.availablePoints));
  const requestedPoints = Math.max(0, Math.floor(input.requestedPoints ?? availablePoints));

  if (foodValue < wahPointsRule.minimumRedemptionOrderValue) {
    return { points: 0, discount: 0, reason: `Minimum food order is Rs ${wahPointsRule.minimumRedemptionOrderValue}.` };
  }

  const maxLoyaltyDiscount = Math.floor((foodValue * wahPointsRule.maxRedemptionPercent) / 100);
  const maxCombinedDiscount = Math.floor((foodValue * wahPointsRule.maxCombinedDiscountPercent) / 100);
  const combinedRemainingDiscount = Math.max(maxCombinedDiscount - couponDiscount, 0);
  const discountCap = Math.min(maxLoyaltyDiscount, combinedRemainingDiscount);
  const pointCap = Math.floor((discountCap * wahPointsRule.redemptionPoints) / wahPointsRule.redemptionDiscount);
  const redeemablePoints = Math.floor(Math.min(availablePoints, requestedPoints, pointCap) / 10) * 10;
  const discount = Math.floor((redeemablePoints * wahPointsRule.redemptionDiscount) / wahPointsRule.redemptionPoints);

  return { points: redeemablePoints, discount, reason: redeemablePoints > 0 ? "" : "Not enough eligible Wah Points for this order." };
}
