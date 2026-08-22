import type { Coupon } from "@/lib/types";

export const rewardMilestones = [
  { orders: 10, value: 10, code: "REWARD10" },
  { orders: 20, value: 20, code: "REWARD20" },
  { orders: 30, value: 30, code: "REWARD30" },
] as const;

export const rewardCoupons: Coupon[] = rewardMilestones.map((milestone) => ({
  code: milestone.code,
  label: `${milestone.orders} order reward`,
  type: "FIXED",
  value: milestone.value,
  minOrder: 0,
  audience: "POINTS",
  minPoints: milestone.orders,
}));

export function getRewardTier(orderCount: number) {
  if (orderCount >= 30) return "Royal";
  if (orderCount >= 20) return "Gold";
  if (orderCount >= 10) return "Silver";
  return "Starter";
}

export function getRewardState(orderCount: number) {
  const completed = rewardMilestones.filter((milestone) => orderCount >= milestone.orders);
  const next = rewardMilestones.find((milestone) => orderCount < milestone.orders) ?? null;
  const previousOrders = completed.at(-1)?.orders ?? 0;
  const targetOrders = next?.orders ?? rewardMilestones.at(-1)?.orders ?? 30;
  const span = Math.max(targetOrders - previousOrders, 1);
  const progress = next ? Math.min(100, Math.max(0, ((orderCount - previousOrders) / span) * 100)) : 100;

  return {
    completed,
    next,
    progress,
    ordersToNext: next ? Math.max(next.orders - orderCount, 0) : 0,
    tier: getRewardTier(orderCount),
  };
}
