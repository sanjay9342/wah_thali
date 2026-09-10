import "server-only";

import { OrderStatus, Prisma } from "@prisma/client";
import { addHours, addDays, differenceInCalendarDays } from "date-fns";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { sendWhatsAppTemplate, sendWhatsAppText } from "@/lib/whatsapp";

type RetentionStatus = "SCHEDULED" | "SENDING" | "SENT" | "SKIPPED" | "FAILED" | "CANCELLED";
type CampaignStatus = "ACTIVE" | "CANCELLED" | "COMPLETED";

export type RetentionStepConfig = {
  key: string;
  label: string;
  templateName: string;
  stage: "FIRST" | "SECOND" | "LOYAL" | "COOLING" | "WINBACK";
  delayHours: number;
  enabled: boolean;
  bodyVariables: string[];
  buttonVariables: string[];
};

export type WhatsAppRetentionConfig = {
  enabled: boolean;
  orderLink: string;
  menuLink: string;
  googleReviewLink: string;
  firstReturnCouponCode: string;
  firstReturnDiscountAmount: number;
  winbackCouponCode: string;
  winbackDiscountAmount: number;
  couponExpiryDays: number;
  sendWindowStart: string;
  sendWindowEnd: string;
  dormantCoolingDays: number;
  dormantWinbackDays: number;
  dormantFinalDays: number;
  steps: RetentionStepConfig[];
};

type RetentionOrder = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: Date;
  customer: {
    id: string;
    name: string;
    mobile: string;
    whatsappMarketingOptIn: boolean;
    whatsappMarketingOptOut: boolean;
  };
};

const retentionConfigKey = "whatsappRetentionConfig";
const liveOrderStatuses: OrderStatus[] = ["NEW", "CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"];
const openSupportStatuses = ["OPEN", "NEW", "PENDING", "IN_PROGRESS", "ESCALATED"];

export const defaultWhatsAppRetentionConfig: WhatsAppRetentionConfig = {
  enabled: false,
  orderLink: "https://wahthali.in/menu",
  menuLink: "https://wahthali.in/menu",
  googleReviewLink: "https://app.reviewus.in/rate-us?businessId=7125",
  firstReturnCouponCode: "WAH50",
  firstReturnDiscountAmount: 50,
  winbackCouponCode: "WAH100",
  winbackDiscountAmount: 100,
  couponExpiryDays: 7,
  sendWindowStart: "11:00",
  sendWindowEnd: "12:30",
  dormantCoolingDays: 30,
  dormantWinbackDays: 45,
  dormantFinalDays: 60,
  steps: [
    {
      key: "fo_01_thank_you",
      label: "First order thank you",
      templateName: "wa_fo_01_thank_you",
      stage: "FIRST",
      delayHours: 0,
      enabled: true,
      bodyVariables: ["customer_name"],
      buttonVariables: [],
    },
    {
      key: "fo_02_feedback",
      label: "First order feedback",
      templateName: "wa_fo_02_feedback",
      stage: "FIRST",
      delayHours: 3,
      enabled: true,
      bodyVariables: ["customer_name"],
      buttonVariables: [],
    },
    {
      key: "fo_03_reminder",
      label: "Day 3 brand reminder",
      templateName: "wa_fo_03_reminder",
      stage: "FIRST",
      delayHours: 72,
      enabled: true,
      bodyVariables: ["customer_name"],
      buttonVariables: [],
    },
    {
      key: "fo_04_reorder",
      label: "Day 6 reorder",
      templateName: "wa_fo_04_reorder",
      stage: "FIRST",
      delayHours: 144,
      enabled: true,
      bodyVariables: ["customer_name"],
      buttonVariables: [],
    },
    {
      key: "fo_05_offer",
      label: "Day 10 first return offer",
      templateName: "wa_fo_05_offer",
      stage: "FIRST",
      delayHours: 240,
      enabled: true,
      bodyVariables: ["customer_name", "first_return_discount_amount", "first_return_coupon_code", "coupon_expiry_date"],
      buttonVariables: [],
    },
    {
      key: "fo_06_final",
      label: "Day 15 final reminder",
      templateName: "wa_fo_06_final",
      stage: "FIRST",
      delayHours: 360,
      enabled: true,
      bodyVariables: ["customer_name"],
      buttonVariables: [],
    },
    {
      key: "so_01_thank_you",
      label: "Second order thank you",
      templateName: "wa_so_01_thank_you",
      stage: "SECOND",
      delayHours: 0,
      enabled: true,
      bodyVariables: ["customer_name"],
      buttonVariables: [],
    },
    {
      key: "so_02_reorder",
      label: "Day 5 repeat reminder",
      templateName: "wa_so_02_reorder",
      stage: "SECOND",
      delayHours: 120,
      enabled: true,
      bodyVariables: ["customer_name"],
      buttonVariables: [],
    },
    {
      key: "so_03_discovery",
      label: "Day 10 menu discovery",
      templateName: "wa_so_03_discovery",
      stage: "SECOND",
      delayHours: 240,
      enabled: true,
      bodyVariables: ["customer_name"],
      buttonVariables: [],
    },
    {
      key: "so_04_reward",
      label: "Day 18 repeat reward",
      templateName: "wa_so_04_reward",
      stage: "SECOND",
      delayHours: 432,
      enabled: true,
      bodyVariables: ["customer_name", "first_return_discount_amount", "first_return_coupon_code", "coupon_expiry_date"],
      buttonVariables: [],
    },
    {
      key: "loyal_01",
      label: "Third order light reminder",
      templateName: "wa_fo_03_reminder",
      stage: "LOYAL",
      delayHours: 168,
      enabled: true,
      bodyVariables: ["customer_name"],
      buttonVariables: [],
    },
    {
      key: "cooling_01",
      label: "30 day cooling",
      templateName: "wa_cooling_01",
      stage: "COOLING",
      delayHours: 720,
      enabled: true,
      bodyVariables: ["customer_name"],
      buttonVariables: [],
    },
    {
      key: "winback_01",
      label: "45 day win-back offer",
      templateName: "wa_winback_01",
      stage: "WINBACK",
      delayHours: 1080,
      enabled: true,
      bodyVariables: ["customer_name", "winback_discount_amount", "winback_coupon_code", "coupon_expiry_date"],
      buttonVariables: [],
    },
    {
      key: "winback_02",
      label: "60 day final win-back",
      templateName: "wa_winback_02",
      stage: "WINBACK",
      delayHours: 1440,
      enabled: true,
      bodyVariables: ["customer_name"],
      buttonVariables: [],
    },
  ],
};

export const retentionTemplateRegistry = [
  ["wa_fo_01_thank_you", "First order thank you", "Utility", "FIRST", "Hi {{1}}, thank you for ordering from Wah Thali."],
  ["wa_fo_02_feedback", "First order feedback", "Utility", "FIRST", "Hey {{1}}, how was your Wah Thali today?"],
  ["wa_review_01", "Review request", "Marketing", "FEEDBACK", "Yay! We are really happy you enjoyed your meal, {{1}}."],
  ["wa_fo_03_reminder", "First order day 3 reminder", "Marketing", "FIRST", "Hi {{1}}, hope you enjoyed your first Wah Thali."],
  ["wa_fo_04_reorder", "First order day 6 reorder", "Marketing", "FIRST", "Hi {{1}}, what is for lunch today?"],
  ["wa_fo_05_offer", "First order day 10 offer", "Marketing", "FIRST", "Hey {{1}}, we would love to have you back at Wah Thali."],
  ["wa_fo_06_final", "First order final reminder", "Marketing", "FIRST", "Hey {{1}}, just checking in one last time."],
  ["wa_so_01_thank_you", "Second order thank you", "Marketing", "SECOND", "Hey {{1}}, back again!"],
  ["wa_so_02_reorder", "Second order day 5 reorder", "Marketing", "SECOND", "Hi {{1}}, ready for another Wah Thali?"],
  ["wa_so_03_discovery", "Second order menu discovery", "Marketing", "SECOND", "Hey {{1}}, had Wah Thali twice?"],
  ["wa_so_04_reward", "Second order reward", "Marketing", "SECOND", "Hi {{1}}, you are becoming a regular."],
  ["wa_cooling_01", "Cooling reminder", "Marketing", "DORMANT", "Hey {{1}}, haven't seen you at Wah Thali for a little while."],
  ["wa_winback_01", "Win-back offer", "Marketing", "DORMANT", "Hey {{1}}, it has been a while."],
  ["wa_winback_02", "Final win-back", "Marketing", "DORMANT", "Hey {{1}}, we have not seen you in a while."],
] as const;

export async function getWhatsAppRetentionConfig() {
  if (!isDatabaseConfigured()) return defaultWhatsAppRetentionConfig;
  const row = await prisma.businessSetting.findUnique({ where: { key: retentionConfigKey } });
  return normalizeRetentionConfig(row?.value);
}

export async function updateWhatsAppRetentionConfig(input: Partial<WhatsAppRetentionConfig>) {
  const current = await getWhatsAppRetentionConfig();
  const next = normalizeRetentionConfig({ ...current, ...input });
  await prisma.businessSetting.upsert({
    where: { key: retentionConfigKey },
    create: { key: retentionConfigKey, value: next as unknown as Prisma.InputJsonValue },
    update: { value: next as unknown as Prisma.InputJsonValue },
  });
  await syncRetentionCoupons(next);
  return next;
}

export async function syncRetentionCoupons(config: WhatsAppRetentionConfig) {
  if (!isDatabaseConfigured()) return [];

  const now = new Date();
  const endsAt = addDays(now, Math.max(1, Number(config.couponExpiryDays || 7)));
  const couponInputs = [
    {
      code: config.firstReturnCouponCode,
      label: `First return offer - Rs ${config.firstReturnDiscountAmount} off`,
      value: config.firstReturnDiscountAmount,
      minOrder: 299,
      audience: "EXISTING",
      minCustomerOrders: 1,
    },
    {
      code: config.winbackCouponCode,
      label: `Win-back offer - Rs ${config.winbackDiscountAmount} off`,
      value: config.winbackDiscountAmount,
      minOrder: 399,
      audience: "EXISTING",
      minCustomerOrders: 1,
    },
  ]
    .map((coupon) => ({ ...coupon, code: coupon.code.trim().toUpperCase() }))
    .filter((coupon) => coupon.code && coupon.value > 0);

  const uniqueCoupons = Array.from(new Map(couponInputs.map((coupon) => [coupon.code, coupon])).values());

  return Promise.all(uniqueCoupons.map((coupon) =>
    prisma.coupon.upsert({
      where: { code: coupon.code },
      create: {
        code: coupon.code,
        label: coupon.label,
        type: "FIXED",
        value: coupon.value,
        minOrder: coupon.minOrder,
        maxDiscount: null,
        active: config.enabled,
        audience: coupon.audience,
        minCustomerOrders: coupon.minCustomerOrders,
        customerUsageLimit: 1,
        startsAt: now,
        endsAt,
        channels: ["WHATSAPP"],
        fulfillmentMethods: ["DELIVERY", "PICKUP"],
      },
      update: {
        label: coupon.label,
        type: "FIXED",
        value: coupon.value,
        active: config.enabled,
        audience: coupon.audience,
        minCustomerOrders: coupon.minCustomerOrders,
        startsAt: now,
        endsAt,
        channels: ["WHATSAPP"],
        fulfillmentMethods: ["DELIVERY", "PICKUP"],
      },
    }),
  ));
}

export async function seedWhatsAppTemplateRegistry() {
  const rows = await Promise.all(retentionTemplateRegistry.map(([templateName, label, category, stage, preview], index) =>
    prisma.whatsAppTemplateRegistry.upsert({
      where: { templateName },
      create: {
        templateName,
        label,
        category,
        stage,
        preview,
        sortOrder: index,
        bodyVariableKeys: getTemplateBodyKeys(templateName),
        buttonVariableKeys: getTemplateButtonKeys(templateName),
      },
      update: {
        label,
        category,
        stage,
        preview,
        sortOrder: index,
        bodyVariableKeys: getTemplateBodyKeys(templateName),
        buttonVariableKeys: getTemplateButtonKeys(templateName),
      },
    }),
  ));
  return rows;
}

export async function updateCustomerRetentionStats(customerId: string) {
  const [count, latest] = await Promise.all([
    prisma.order.count({ where: { customerId, status: "DELIVERED" } }),
    prisma.order.findFirst({
      where: { customerId, status: "DELIVERED" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  return prisma.customer.update({
    where: { id: customerId },
    data: {
      completedOrderCount: count,
      lastCompletedOrderAt: latest?.createdAt ?? null,
      marketingStage: count === 0 ? null : count === 1 ? "NEW" : count === 2 ? "REPEAT" : count < 6 ? "LOYAL" : "REGULAR",
    },
  });
}

export async function scheduleRetentionForDeliveredOrder(orderId: string) {
  const config = await getWhatsAppRetentionConfig();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          mobile: true,
          whatsappMarketingOptIn: true,
          whatsappMarketingOptOut: true,
        },
      },
    },
  });
  if (!order || order.status !== "DELIVERED") return null;

  const existingCampaign = await prisma.retentionCampaign.findFirst({
    where: {
      orderId: order.id,
      status: { in: ["ACTIVE", "COMPLETED"] },
    },
    include: { messages: { select: { id: true, status: true } } },
  });
  if (existingCampaign?.messages.some((message) => message.status !== "CANCELLED")) {
    return existingCampaign;
  }

  const customer = await updateCustomerRetentionStats(order.customer.id);
  await cancelActiveCampaigns(order.customer.id, `New delivered order ${order.orderNumber} reset the retention cycle.`);

  if (!config.enabled || !order.customer.whatsappMarketingOptIn || order.customer.whatsappMarketingOptOut) return null;
  if (await hasOpenComplaint(order.customer.id)) return null;

  const count = customer.completedOrderCount;
  const stage = count === 1 ? "FIRST" : count === 2 ? "SECOND" : "LOYAL";
  const steps = config.steps.filter((step) => step.enabled && step.stage === stage);
  if (!steps.length) return null;

  const campaign = await prisma.retentionCampaign.create({
    data: {
      customerId: order.customer.id,
      orderId: order.id,
      stage,
      currentStep: steps[0]?.key,
      messages: {
        create: steps.map((step) => ({
          customerId: order.customer.id,
          orderId: order.id,
          templateName: step.templateName,
          stepKey: step.key,
          stage: step.stage,
          scheduledAt: alignToSendWindow(addHours(new Date(), step.delayHours), config),
          bodyParameters: resolveVariables(step.bodyVariables, order, config) as unknown as Prisma.InputJsonValue,
          buttonParameters: resolveVariables(step.buttonVariables, order, config) as unknown as Prisma.InputJsonValue,
          metadata: { label: step.label } as Prisma.InputJsonValue,
        })),
      },
    },
  });

  await prisma.customer.update({
    where: { id: order.customer.id },
    data: { activeRetentionCampaignId: campaign.id },
  });

  await logActivity({
    type: "WHATSAPP_RETENTION_SCHEDULED",
    entity: "RetentionCampaign",
    entityId: campaign.id,
    summary: `Scheduled ${stage.toLowerCase()} retention flow for ${order.customer.name}`,
  });

  return campaign;
}

export async function processDueRetentionMessages(limit = 25) {
  const config = await getWhatsAppRetentionConfig();
  if (!config.enabled) return { processed: 0, sent: 0, skipped: 0, failed: 0, disabled: true };

  const due = await prisma.retentionMessage.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: new Date() },
    },
    include: {
      campaign: true,
      customer: true,
      order: { select: { id: true, orderNumber: true, createdAt: true, status: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const message of due) {
    const claim = await prisma.retentionMessage.updateMany({
      where: { id: message.id, status: "SCHEDULED" },
      data: { status: "SENDING" satisfies RetentionStatus },
    });
    if (!claim.count) continue;

    const skipReason = await getSkipReason(message.customer.id, message.campaign?.startedAt, message.customer.whatsappMarketingOptIn, message.customer.whatsappMarketingOptOut);
    if (skipReason) {
      skipped += 1;
      await markRetentionMessage(message.id, "SKIPPED", { failureReason: skipReason });
      if (message.campaignId) await cancelCampaign(message.campaignId, skipReason);
      continue;
    }

    const result = await sendWhatsAppTemplate({
      mobile: message.customer.mobile,
      templateName: message.templateName,
      parameters: toStringArray(message.bodyParameters),
      buttonParameters: toStringArray(message.buttonParameters),
    });

    if (result.ok) {
      sent += 1;
      await prisma.retentionMessage.update({
        where: { id: message.id },
        data: { status: "SENT", sentAt: new Date(), messageId: result.messageId },
      });
      if (result.messageId) {
        await prisma.whatsAppMessage.upsert({
          where: { messageId: result.messageId },
          create: {
            messageId: result.messageId,
            phone: message.customer.mobile,
            direction: "OUTBOUND",
            body: message.templateName,
            status: "SENT",
          },
          update: { status: "SENT" },
        });
      }
      await completeCampaignIfDone(message.campaignId);
    } else {
      failed += 1;
      await markRetentionMessage(message.id, "FAILED", { failureReason: result.message || "WhatsApp send failed." });
    }
  }

  return { processed: due.length, sent, skipped, failed, disabled: false };
}

export async function cancelActiveCampaigns(customerId: string, reason: string) {
  const campaigns = await prisma.retentionCampaign.findMany({
    where: { customerId, status: "ACTIVE" },
    select: { id: true },
  });
  await Promise.all(campaigns.map((campaign) => cancelCampaign(campaign.id, reason)));
  return campaigns.length;
}

export async function handleInboundRetentionReply(phone: string, text: string) {
  const normalizedText = text.trim().toLowerCase();
  const digits = phone.replace(/\D/g, "");
  const mobile = digits.length > 10 ? digits.slice(-10) : digits;
  const customer = await prisma.customer.findFirst({
    where: { mobile: { endsWith: mobile } },
    select: { id: true, name: true, mobile: true },
  });

  if (["stop", "unsubscribe", "opt out", "opt-out"].some((keyword) => normalizedText.includes(keyword))) {
    if (!customer) return { handled: false, action: "OPT_OUT", reason: "No matching customer." };
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        whatsappMarketingOptOut: true,
        whatsappMarketingOptOutAt: new Date(),
      },
    });
    await cancelActiveCampaigns(customer.id, "Customer opted out by WhatsApp reply.");
    return { handled: true, action: "OPT_OUT" };
  }

  if (normalizedText.includes("loved")) {
    await sendFeedbackBranchMessage(customer ?? { name: "there", mobile }, "REVIEW_REQUEST");
    return { handled: true, action: "REVIEW_REQUEST" };
  }

  if (normalizedText.includes("something") || normalizedText.includes("not right") || normalizedText.includes("wrong")) {
    if (customer) {
      await prisma.supportTicket.create({
        data: {
          customerId: customer.id,
          category: "WhatsApp feedback",
          priority: "High",
          status: "OPEN",
        },
      });
      await cancelActiveCampaigns(customer.id, "Customer reported a problem. Human support required.");
    }
    await sendFeedbackBranchMessage(customer ?? { name: "there", mobile }, "COMPLAINT_OPENED");
    return { handled: true, action: "COMPLAINT_OPENED" };
  }

  if (normalizedText.includes("good")) {
    await sendFeedbackBranchMessage(customer ?? { name: "there", mobile }, "FEEDBACK_GOOD");
    return { handled: true, action: "FEEDBACK_GOOD" };
  }

  return { handled: false };
}

export async function scheduleDormantRetention() {
  const config = await getWhatsAppRetentionConfig();
  if (!config.enabled) return { scheduled: 0, disabled: true };
  const customers = await prisma.customer.findMany({
    where: {
      completedOrderCount: { gt: 0 },
      lastCompletedOrderAt: { not: null },
      whatsappMarketingOptIn: true,
      whatsappMarketingOptOut: false,
    },
    select: {
      id: true,
      name: true,
      mobile: true,
      lastCompletedOrderAt: true,
    },
    take: 500,
  });

  let scheduled = 0;
  for (const customer of customers) {
    if (!customer.lastCompletedOrderAt || await hasOpenComplaint(customer.id)) continue;
    const days = differenceInCalendarDays(new Date(), customer.lastCompletedOrderAt);
    const step =
      days >= config.dormantFinalDays ? config.steps.find((item) => item.key === "winback_02") :
      days >= config.dormantWinbackDays ? config.steps.find((item) => item.key === "winback_01") :
      days >= config.dormantCoolingDays ? config.steps.find((item) => item.key === "cooling_01") :
      null;
    if (!step?.enabled) continue;
    const alreadyExists = await prisma.retentionMessage.findFirst({
      where: {
        customerId: customer.id,
        stepKey: step.key,
        status: { in: ["SCHEDULED", "SENDING", "SENT"] },
      },
      select: { id: true },
    });
    if (alreadyExists) continue;

    const campaign = await prisma.retentionCampaign.create({
      data: {
        customerId: customer.id,
        stage: step.stage,
        currentStep: step.key,
        messages: {
          create: {
            customerId: customer.id,
            templateName: step.templateName,
            stepKey: step.key,
            stage: step.stage,
            scheduledAt: alignToSendWindow(new Date(), config),
            bodyParameters: resolveVariables(step.bodyVariables, { customer, id: "", orderNumber: "", status: "", createdAt: new Date() }, config) as unknown as Prisma.InputJsonValue,
            buttonParameters: resolveVariables(step.buttonVariables, { customer, id: "", orderNumber: "", status: "", createdAt: new Date() }, config) as unknown as Prisma.InputJsonValue,
            metadata: { label: step.label, dormantDays: days } as Prisma.InputJsonValue,
          },
        },
      },
    });
    await prisma.customer.update({
      where: { id: customer.id },
      data: { activeRetentionCampaignId: campaign.id, marketingStage: step.key === "cooling_01" ? "COOLING" : "DORMANT" },
    });
    scheduled += 1;
  }

  return { scheduled, disabled: false };
}

function normalizeRetentionConfig(value: unknown): WhatsAppRetentionConfig {
  const raw = typeof value === "object" && value ? value as Partial<WhatsAppRetentionConfig> : {};
  const steps = Array.isArray(raw.steps) ? raw.steps : defaultWhatsAppRetentionConfig.steps;
  const defaultStepsByKey = new Map(defaultWhatsAppRetentionConfig.steps.map((step) => [step.key, step]));

  return {
    ...defaultWhatsAppRetentionConfig,
    ...raw,
    enabled: Boolean(raw.enabled),
    firstReturnDiscountAmount: Number(raw.firstReturnDiscountAmount ?? defaultWhatsAppRetentionConfig.firstReturnDiscountAmount),
    winbackDiscountAmount: Number(raw.winbackDiscountAmount ?? defaultWhatsAppRetentionConfig.winbackDiscountAmount),
    couponExpiryDays: Number(raw.couponExpiryDays ?? defaultWhatsAppRetentionConfig.couponExpiryDays),
    dormantCoolingDays: Number(raw.dormantCoolingDays ?? defaultWhatsAppRetentionConfig.dormantCoolingDays),
    dormantWinbackDays: Number(raw.dormantWinbackDays ?? defaultWhatsAppRetentionConfig.dormantWinbackDays),
    dormantFinalDays: Number(raw.dormantFinalDays ?? defaultWhatsAppRetentionConfig.dormantFinalDays),
    steps: steps.map((step) => {
      const item = step as Partial<RetentionStepConfig>;
      const fallback = defaultStepsByKey.get(String(item.key)) ?? defaultWhatsAppRetentionConfig.steps[0];
      return {
        ...fallback,
        ...item,
        key: String(item.key ?? fallback.key),
        label: String(item.label ?? fallback.label),
        templateName: String(item.templateName ?? fallback.templateName),
        delayHours: Math.max(0, Number(item.delayHours ?? fallback.delayHours)),
        enabled: item.enabled !== false,
        bodyVariables: Array.isArray(item.bodyVariables) ? item.bodyVariables.map(String) : fallback.bodyVariables,
        buttonVariables: Array.isArray(item.buttonVariables) ? item.buttonVariables.map(String) : fallback.buttonVariables,
      };
    }),
  };
}

function resolveVariables(keys: string[], order: RetentionOrder | { id: string; orderNumber: string; status: string; createdAt: Date; customer: { id: string; name: string; mobile: string } }, config: WhatsAppRetentionConfig) {
  return keys.map((key) => {
    if (key === "customer_name") return order.customer.name;
    if (key === "order_link") return config.orderLink;
    if (key === "menu_link") return config.menuLink;
    if (key === "google_review_link") return config.googleReviewLink;
    if (key === "first_return_coupon_code") return config.firstReturnCouponCode;
    if (key === "first_return_discount_amount") return String(config.firstReturnDiscountAmount);
    if (key === "winback_coupon_code") return config.winbackCouponCode;
    if (key === "winback_discount_amount") return String(config.winbackDiscountAmount);
    if (key === "coupon_expiry_date") return formatDate(addDays(new Date(), config.couponExpiryDays));
    if (key === "order_number") return order.orderNumber;
    return "";
  });
}

function alignToSendWindow(date: Date, config: WhatsAppRetentionConfig) {
  if (date.getHours() === 0 && date.getMinutes() === 0) return date;
  const [startHour, startMinute] = config.sendWindowStart.split(":").map(Number);
  const [endHour, endMinute] = config.sendWindowEnd.split(":").map(Number);
  const start = new Date(date);
  start.setHours(startHour || 11, startMinute || 0, 0, 0);
  const end = new Date(date);
  end.setHours(endHour || 12, endMinute || 30, 0, 0);
  if (date < start) return start;
  if (date > end) return addDays(start, 1);
  return date;
}

async function getSkipReason(customerId: string, campaignStartedAt: Date | null | undefined, optedIn: boolean, optedOut: boolean) {
  if (!optedIn) return "Customer has not opted in for WhatsApp marketing.";
  if (optedOut) return "Customer opted out of WhatsApp marketing.";
  if (await hasOpenComplaint(customerId)) return "Customer has an open complaint.";
  if (campaignStartedAt) {
    const newerOrder = await prisma.order.findFirst({
      where: {
        customerId,
        createdAt: { gt: campaignStartedAt },
        status: { in: liveOrderStatuses },
      },
      select: { id: true },
    });
    if (newerOrder) return "Customer placed a newer order.";
  }
  return "";
}

async function hasOpenComplaint(customerId: string) {
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      customerId,
      OR: [
        { category: { contains: "complaint", mode: "insensitive" } },
        { category: { contains: "feedback", mode: "insensitive" } },
      ],
      status: { in: openSupportStatuses },
    },
    select: { id: true },
  });
  return Boolean(ticket);
}

async function markRetentionMessage(id: string, status: RetentionStatus, data: { failureReason?: string } = {}) {
  return prisma.retentionMessage.update({
    where: { id },
    data: {
      status,
      failureReason: data.failureReason,
      cancelledAt: status === "CANCELLED" || status === "SKIPPED" ? new Date() : undefined,
    },
  });
}

async function cancelCampaign(campaignId: string, reason: string) {
  await prisma.retentionMessage.updateMany({
    where: { campaignId, status: { in: ["SCHEDULED", "SENDING"] } },
    data: { status: "CANCELLED", cancelledAt: new Date(), failureReason: reason },
  });
  await prisma.retentionCampaign.updateMany({
    where: { id: campaignId, status: "ACTIVE" },
    data: { status: "CANCELLED" satisfies CampaignStatus, cancelledAt: new Date(), cancelReason: reason },
  });
}

async function completeCampaignIfDone(campaignId: string | null) {
  if (!campaignId) return;
  const remaining = await prisma.retentionMessage.count({
    where: { campaignId, status: { in: ["SCHEDULED", "SENDING"] } },
  });
  if (remaining) return;
  await prisma.retentionCampaign.updateMany({
    where: { id: campaignId, status: "ACTIVE" },
    data: { status: "COMPLETED" satisfies CampaignStatus, completedAt: new Date() },
  });
}

async function sendFeedbackBranchMessage(customer: { id?: string; name: string; mobile: string }, action: "REVIEW_REQUEST" | "FEEDBACK_GOOD" | "COMPLAINT_OPENED") {
  const config = await getWhatsAppRetentionConfig();
  const text =
    action === "REVIEW_REQUEST"
      ? [
          `Yay! We are really happy you enjoyed your meal, ${customer.name}.`,
          "If you have a moment, we would really appreciate a quick Google review.",
          config.googleReviewLink,
        ].join("\n\n")
      : action === "COMPLAINT_OPENED"
        ? `We are really sorry, ${customer.name}. Please tell us what went wrong. We would like to make it right.`
        : "Thank you! We are glad to hear that.";

  const result = action === "REVIEW_REQUEST"
    ? await sendWhatsAppTemplate({
        mobile: customer.mobile,
        templateName: "wa_review_01",
        parameters: [customer.name],
      })
    : await sendWhatsAppText({ mobile: customer.mobile, text });

  if (result.ok) {
    const messageId = result.messageId ?? `feedback-${action}-${customer.id ?? customer.mobile}-${Date.now()}`;
    await prisma.whatsAppMessage.upsert({
      where: { messageId },
      create: {
        messageId,
        phone: customer.mobile,
        direction: "OUTBOUND",
        body: text,
        status: "SENT",
      },
      update: { status: "SENT", body: text },
    });
  }

  await logActivity({
    type: result.ok ? "WHATSAPP_FEEDBACK_REPLY_SENT" : "WHATSAPP_FEEDBACK_REPLY_FAILED",
    actor: customer.mobile,
    entity: customer.id ? "Customer" : "WhatsAppMessage",
    entityId: customer.id ?? customer.mobile,
    summary: `${action} feedback branch ${result.ok ? "sent" : "failed"}`,
    metadata: { action, message: result.ok ? result.messageId : result.message } as Prisma.InputJsonValue,
  });

  return result;
}

function toStringArray(value: Prisma.JsonValue | null) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function getTemplateBodyKeys(templateName: string) {
  const step = defaultWhatsAppRetentionConfig.steps.find((item) => item.templateName === templateName);
  return step?.bodyVariables ?? ["customer_name"];
}

function getTemplateButtonKeys(templateName: string) {
  const step = defaultWhatsAppRetentionConfig.steps.find((item) => item.templateName === templateName);
  return step?.buttonVariables ?? [];
}
