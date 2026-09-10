import "server-only";

import type { Prisma } from "@prisma/client";
import {
  calculateLoyaltyRedemption,
  calculateWahPointsEarned,
  getLoyaltyExpiryDate,
  getRewardTier,
  rewardMilestones,
  wahPointsRule,
} from "@/lib/rewards";
import { prisma } from "@/lib/prisma";

export { wahPointsRule };

type LoyaltyStore = typeof prisma | Prisma.TransactionClient;
const paidOnlineStatuses = ["PAID", "AUTHORIZED"] as const;
type LoyaltyLedgerDelegate = {
  findMany: (args: Parameters<typeof prisma.loyaltyPointLedger.findMany>[0]) => ReturnType<typeof prisma.loyaltyPointLedger.findMany>;
  count: (args: Parameters<typeof prisma.loyaltyPointLedger.count>[0]) => ReturnType<typeof prisma.loyaltyPointLedger.count>;
  createMany: (args: Parameters<typeof prisma.loyaltyPointLedger.createMany>[0]) => ReturnType<typeof prisma.loyaltyPointLedger.createMany>;
};

function getLoyaltyLedger(store: LoyaltyStore) {
  return (store as LoyaltyStore & { loyaltyPointLedger?: LoyaltyLedgerDelegate }).loyaltyPointLedger;
}

export type LoyaltySummary = {
  availablePoints: number;
  expiringPoints: number;
  expiringAt?: string;
  nextRewardPoints: number;
  nextRewardDiscount: number;
};

export async function getCustomerLoyaltySummary(customerId: string, fallbackPoints = 0, store: LoyaltyStore = prisma): Promise<LoyaltySummary> {
  const now = new Date();
  const ledger = getLoyaltyLedger(store);
  const entries = ledger ? await ledger.findMany({
    where: {
      customerId,
      OR: [
        { points: { lt: 0 } },
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    orderBy: { expiresAt: "asc" },
    select: { points: true, expiresAt: true },
  }).catch(() => []) : [];
  const hasLedger = entries.length > 0;
  const availablePoints = Math.max(0, entries.reduce((total, entry) => total + entry.points, 0));
  const balance = hasLedger ? availablePoints : Math.max(0, fallbackPoints);
  const expiringEntry = entries.find((entry) => entry.points > 0 && entry.expiresAt);
  const expiringAt = expiringEntry?.expiresAt;
  const expiringPoints = expiringAt
    ? entries
      .filter((entry) => entry.points > 0 && entry.expiresAt?.getTime() === expiringAt.getTime())
      .reduce((total, entry) => total + entry.points, 0)
    : 0;
  const next = rewardMilestones.find((milestone) => balance < milestone.points) ?? rewardMilestones[rewardMilestones.length - 1];

  return {
    availablePoints: balance,
    expiringPoints,
    expiringAt: expiringAt?.toISOString(),
    nextRewardPoints: next.points,
    nextRewardDiscount: next.value,
  };
}

export async function refreshLoyaltyAccount(customerId: string, store: LoyaltyStore = prisma) {
  const account = await store.loyaltyAccount.findUnique({ where: { customerId }, select: { points: true } }).catch(() => null);
  const summary = await getCustomerLoyaltySummary(customerId, account?.points ?? 0, store);
  await store.loyaltyAccount.upsert({
    where: { customerId },
    create: { customerId, points: summary.availablePoints, tier: getRewardTier(summary.availablePoints) },
    update: { points: summary.availablePoints, tier: getRewardTier(summary.availablePoints) },
  });
  return summary;
}

export async function getRedeemableLoyaltyForOrder(input: {
  customerId?: string;
  foodValue: number;
  couponDiscount?: number;
  requestedPoints?: number;
}) {
  if (!input.customerId) {
    return calculateLoyaltyRedemption({ foodValue: input.foodValue, couponDiscount: input.couponDiscount, availablePoints: 0, requestedPoints: 0 });
  }
  const account = await prisma.loyaltyAccount.findUnique({ where: { customerId: input.customerId }, select: { points: true } }).catch(() => null);
  const summary = await getCustomerLoyaltySummary(input.customerId, account?.points ?? 0);
  return calculateLoyaltyRedemption({
    foodValue: input.foodValue,
    couponDiscount: input.couponDiscount,
    availablePoints: summary.availablePoints,
    requestedPoints: input.requestedPoints,
  });
}

export async function recordLoyaltyForPaidOrder(
  store: Prisma.TransactionClient,
  input: {
    orderId: string;
    orderNumber: string;
    customerId: string;
    eligibleFoodValue: number;
    redeemedPoints?: number;
    orderedAt?: Date;
  },
) {
  const ledger = getLoyaltyLedger(store);
  const existingEntries = ledger ? await ledger.count({ where: { orderId: input.orderId } }).catch(() => 0) : 0;
  if (existingEntries > 0) return refreshLoyaltyAccount(input.customerId, store);

  const orderedAt = input.orderedAt ?? new Date();
  const customer = await store.customer.findUnique({
    where: { id: input.customerId },
    select: { completedOrderCount: true, lastCompletedOrderAt: true },
  });
  const priorPlacedOrders = await store.order.findMany({
    where: {
      customerId: input.customerId,
      id: { not: input.orderId },
      OR: [
        { payments: { some: { provider: "COD" } } },
        { payments: { some: { provider: "RAZORPAY", status: { in: [...paidOnlineStatuses] } } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { createdAt: true },
  }).catch(() => []);
  const previousCompletedOrderAt = customer?.lastCompletedOrderAt ?? priorPlacedOrders[0]?.createdAt;
  const earned = calculateWahPointsEarned({
    eligibleFoodValue: input.eligibleFoodValue,
    isFirstOrder: Math.max(customer?.completedOrderCount ?? 0, priorPlacedOrders.length) === 0,
    previousCompletedOrderAt,
    orderedAt,
  });
  const entries: Prisma.LoyaltyPointLedgerCreateManyInput[] = [];

  if ((input.redeemedPoints ?? 0) > 0) {
    entries.push({
      customerId: input.customerId,
      orderId: input.orderId,
      points: -Math.abs(input.redeemedPoints ?? 0),
      type: "REDEEMED",
      description: `Redeemed on order ${input.orderNumber}`,
    });
  }
  if (earned.basePoints > 0) {
    entries.push({
      customerId: input.customerId,
      orderId: input.orderId,
      points: earned.basePoints,
      type: "EARNED",
      description: `Earned on food value for order ${input.orderNumber}`,
      expiresAt: getLoyaltyExpiryDate("BASE", orderedAt),
    });
  }
  if (earned.firstOrderBonusPoints > 0) {
    entries.push({
      customerId: input.customerId,
      orderId: input.orderId,
      points: earned.firstOrderBonusPoints,
      type: "FIRST_ORDER_BONUS",
      description: `First order 2x bonus for ${input.orderNumber}`,
      expiresAt: getLoyaltyExpiryDate("FIRST_ORDER_BONUS", orderedAt),
    });
  }
  if (earned.reorderBonusPoints > 0) {
    entries.push({
      customerId: input.customerId,
      orderId: input.orderId,
      points: earned.reorderBonusPoints,
      type: "REORDER_BONUS",
      description: `30 day reorder bonus for ${input.orderNumber}`,
      expiresAt: getLoyaltyExpiryDate("REORDER_BONUS", orderedAt),
    });
  }

  if (entries.length && ledger) {
    await ledger.createMany({ data: entries });
  }
  await store.order.update({
    where: { id: input.orderId },
    data: {
      loyaltyPointsEarned: earned.totalPoints,
      loyaltyPointsRedeemed: Math.max(0, input.redeemedPoints ?? 0),
    },
  });
  await store.customer.update({
    where: { id: input.customerId },
    data: {
      completedOrderCount: { increment: 1 },
      lastCompletedOrderAt: orderedAt,
    },
  });

  return refreshLoyaltyAccount(input.customerId, store);
}

export async function reverseLoyaltyForOrder(store: Prisma.TransactionClient, orderId: string, reason: string) {
  const order = await store.order.findUnique({
    where: { id: orderId },
    select: { customerId: true, loyaltyPointsEarned: true, loyaltyPointsRedeemed: true, orderNumber: true },
  });
  if (!order) return null;

  const ledger = getLoyaltyLedger(store);
  const alreadyReversed = ledger ? await ledger.count({ where: { orderId, type: "REVERSAL" } }).catch(() => 0) : 0;
  if (alreadyReversed > 0) return refreshLoyaltyAccount(order.customerId, store);

  const entries: Prisma.LoyaltyPointLedgerCreateManyInput[] = [];
  if (order.loyaltyPointsEarned > 0) {
    entries.push({
      customerId: order.customerId,
      orderId,
      points: -order.loyaltyPointsEarned,
      type: "REVERSAL",
      description: `${reason}: removed points from ${order.orderNumber}`,
    });
  }
  if (order.loyaltyPointsRedeemed > 0) {
    entries.push({
      customerId: order.customerId,
      orderId,
      points: order.loyaltyPointsRedeemed,
      type: "REVERSAL",
      description: `${reason}: restored redeemed points from ${order.orderNumber}`,
      expiresAt: getLoyaltyExpiryDate("BASE"),
    });
  }
  if (entries.length && ledger) await ledger.createMany({ data: entries });

  await store.customer.updateMany({
    where: { id: order.customerId, completedOrderCount: { gt: 0 } },
    data: { completedOrderCount: { decrement: 1 } },
  });
  return refreshLoyaltyAccount(order.customerId, store);
}

export function getWahPointsRuleSummary() {
  return [
    `Earn 1 Wah Point for every Rs ${wahPointsRule.pointsPerSpendRupees} eligible food spend after discounts.`,
    `First order earns ${wahPointsRule.firstOrderMultiplier}x points.`,
    `Order again within ${wahPointsRule.reorderBonusDays} days to get ${wahPointsRule.reorderBonusPoints} bonus points.`,
    `${wahPointsRule.redemptionPoints} points gives Rs ${wahPointsRule.redemptionDiscount} off above Rs ${wahPointsRule.minimumRedemptionOrderValue}.`,
    `Point redemption is capped at ${wahPointsRule.maxRedemptionPercent}% of food value, and coupon plus points cannot exceed ${wahPointsRule.maxCombinedDiscountPercent}%.`,
    `Regular points expire in ${wahPointsRule.pointsExpireDays} days; bonus points expire in ${wahPointsRule.bonusPointsExpireDays} days.`,
  ];
}
