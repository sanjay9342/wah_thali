import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { withApiErrorHandling } from "@/lib/api-error";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import {
  cancelActiveCampaigns,
  getWhatsAppRetentionConfig,
  processDueRetentionMessages,
  scheduleDormantRetention,
  seedWhatsAppTemplateRegistry,
  updateWhatsAppRetentionConfig,
} from "@/lib/whatsapp-retention";
import { getWhatsAppMessagingConfigStatus, sendWhatsAppTemplate } from "@/lib/whatsapp";

const stepSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  templateName: z.string().min(1),
  stage: z.enum(["FIRST", "SECOND", "LOYAL", "COOLING", "WINBACK"]),
  delayHours: z.coerce.number().min(0),
  enabled: z.boolean(),
  bodyVariables: z.array(z.string()),
  buttonVariables: z.array(z.string()),
});

const configSchema = z.object({
  enabled: z.boolean().optional(),
  orderLink: z.string().url().optional(),
  menuLink: z.string().url().optional(),
  googleReviewLink: z.string().url().optional(),
  firstReturnCouponCode: z.string().trim().min(1).optional(),
  firstReturnDiscountAmount: z.coerce.number().min(0).optional(),
  winbackCouponCode: z.string().trim().min(1).optional(),
  winbackDiscountAmount: z.coerce.number().min(0).optional(),
  couponExpiryDays: z.coerce.number().int().min(1).max(30).optional(),
  sendWindowStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  sendWindowEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  dormantCoolingDays: z.coerce.number().int().min(1).max(180).optional(),
  dormantWinbackDays: z.coerce.number().int().min(1).max(180).optional(),
  dormantFinalDays: z.coerce.number().int().min(1).max(180).optional(),
  steps: z.array(stepSchema).optional(),
}).strict();

const templateUpdateSchema = z.object({
  id: z.string().min(1),
  templateName: z.string().trim().min(1),
  label: z.string().trim().min(1),
  category: z.string().trim().min(1),
  stage: z.string().trim().min(1),
  enabled: z.boolean(),
  preview: z.string().trim().optional().or(z.literal("")),
  bodyVariableKeys: z.array(z.string().trim()).default([]),
  buttonVariableKeys: z.array(z.string().trim()).default([]),
});

const couponUpdateSchema = z.object({
  id: z.string().min(1),
  code: z.string().trim().min(1),
  label: z.string().trim().min(1),
  type: z.enum(["FIXED", "PERCENT"]),
  value: z.coerce.number().int().min(0),
  minOrder: z.coerce.number().int().min(0),
  maxDiscount: z.coerce.number().int().min(0).nullable(),
  active: z.boolean(),
  customerUsageLimit: z.coerce.number().int().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

const automationPayloadSchema = z.object({
  config: configSchema.optional(),
  templates: z.array(templateUpdateSchema).optional(),
  coupons: z.array(couponUpdateSchema).optional(),
}).strict();

const actionSchema = z.object({
  action: z.enum(["process_due", "schedule_dormant", "seed_templates", "cancel_customer_campaigns", "test_template", "test_all_templates"]),
  customerId: z.string().optional(),
  templateName: z.string().trim().min(1).optional(),
  testMobile: z.string().trim().min(8).optional(),
});

async function getHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "automation");
  if (!access.ok) return access.response;

  const [config, templates, coupons, stats, recentMessages, activeCampaigns, dormantCount, customerTrackers] = await Promise.all([
    getWhatsAppRetentionConfig(),
    prisma.whatsAppTemplateRegistry.findMany({ orderBy: [{ sortOrder: "asc" }, { templateName: "asc" }] }),
    prisma.coupon.findMany({
      where: { code: { in: ["WAH50", "WAH100"] } },
      orderBy: { code: "asc" },
    }),
    getRetentionStats(),
    prisma.retentionMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      include: {
        customer: { select: { id: true, name: true, mobile: true } },
        order: { select: { orderNumber: true } },
      },
    }),
    prisma.retentionCampaign.findMany({
      where: { status: "ACTIVE" },
      orderBy: { startedAt: "desc" },
      take: 50,
      include: {
        customer: { select: { id: true, name: true, mobile: true, completedOrderCount: true, marketingStage: true } },
        order: { select: { orderNumber: true } },
        messages: { orderBy: { scheduledAt: "asc" } },
      },
    }),
    prisma.customer.count({
      where: {
        completedOrderCount: { gt: 0 },
        lastCompletedOrderAt: { lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        whatsappMarketingOptIn: true,
        whatsappMarketingOptOut: false,
      },
    }),
    getCustomerRetentionTrackers(),
  ]);

  return NextResponse.json({
    config,
    messagingStatus: getWhatsAppMessagingConfigStatus(),
    templates,
    coupons,
    stats,
    recentMessages,
    activeCampaigns,
    dormantCount,
    customerTrackers,
  });
}

async function patchHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "automation");
  if (!access.ok) return access.response;

  const rawBody = await request.json();
  const parsed = automationPayloadSchema.safeParse(
    rawBody && typeof rawBody === "object" && ("config" in rawBody || "templates" in rawBody || "coupons" in rawBody)
      ? rawBody
      : { config: rawBody },
  );
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid automation settings.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const config = parsed.data.config ? await updateWhatsAppRetentionConfig(parsed.data.config) : await getWhatsAppRetentionConfig();

  if (parsed.data.templates?.length) {
    await Promise.all(parsed.data.templates.map((template, index) =>
      prisma.whatsAppTemplateRegistry.update({
        where: { id: template.id },
        data: {
          templateName: template.templateName,
          label: template.label,
          category: template.category,
          stage: template.stage,
          enabled: template.enabled,
          preview: template.preview || null,
          bodyVariableKeys: template.bodyVariableKeys,
          buttonVariableKeys: template.buttonVariableKeys,
          sortOrder: index,
        },
      }),
    ));
  }

  if (parsed.data.coupons?.length) {
    await Promise.all(parsed.data.coupons.map((coupon) =>
      prisma.coupon.update({
        where: { id: coupon.id },
        data: {
          code: coupon.code.toUpperCase(),
          label: coupon.label,
          type: coupon.type,
          value: coupon.value,
          minOrder: coupon.minOrder,
          maxDiscount: coupon.maxDiscount,
          active: coupon.active,
          customerUsageLimit: coupon.customerUsageLimit,
          startsAt: new Date(coupon.startsAt),
          endsAt: new Date(coupon.endsAt),
        },
      }),
    ));
  }

  await logActivity({
    type: "WHATSAPP_RETENTION_CONFIG_UPDATED",
    entity: "BusinessSetting",
    entityId: "whatsappRetentionConfig",
    summary: "WhatsApp retention strategy updated",
  });

  return NextResponse.json({ config });
}

async function postHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "automation");
  if (!access.ok) return access.response;

  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid automation action.", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.action === "seed_templates") {
    const templates = await seedWhatsAppTemplateRegistry();
    return NextResponse.json({ ok: true, templates });
  }

  if (parsed.data.action === "process_due") {
    const result = await processDueRetentionMessages();
    return NextResponse.json({ ok: true, result });
  }

  if (parsed.data.action === "schedule_dormant") {
    const result = await scheduleDormantRetention();
    return NextResponse.json({ ok: true, result });
  }

  if (parsed.data.action === "test_template") {
    if (!parsed.data.templateName) {
      return NextResponse.json({ error: "Template name is required." }, { status: 400 });
    }
    if (!parsed.data.testMobile) {
      return NextResponse.json({ error: "Test mobile is required." }, { status: 400 });
    }

    const template = await prisma.whatsAppTemplateRegistry.findUnique({
      where: { templateName: parsed.data.templateName },
    });
    const bodyKeys = template?.bodyVariableKeys.length ? template.bodyVariableKeys : getFallbackTemplateKeys(parsed.data.templateName);
    const buttonKeys = template?.buttonVariableKeys ?? [];
    const result = await sendWhatsAppTemplate({
      mobile: parsed.data.testMobile,
      templateName: parsed.data.templateName,
      parameters: bodyKeys.map((key) => getTestVariableValue(key)),
      buttonParameters: buttonKeys.map((key) => getTestVariableValue(key)),
    });

    await logActivity({
      type: result.ok ? "WHATSAPP_TEMPLATE_TEST_SENT" : "WHATSAPP_TEMPLATE_TEST_FAILED",
      entity: "WhatsAppTemplateRegistry",
      entityId: template?.id ?? parsed.data.templateName,
      summary: `Tested WhatsApp template ${parsed.data.templateName}`,
      metadata: { templateName: parsed.data.templateName, ok: result.ok, message: result.ok ? result.messageId : result.message } as Prisma.InputJsonValue,
    });

    return NextResponse.json({ ok: result.ok, result });
  }

  if (parsed.data.action === "test_all_templates") {
    if (!parsed.data.testMobile) {
      return NextResponse.json({ error: "Test mobile is required." }, { status: 400 });
    }

    let templates = await prisma.whatsAppTemplateRegistry.findMany({ orderBy: [{ sortOrder: "asc" }, { templateName: "asc" }] });
    if (!templates.length) {
      templates = await seedWhatsAppTemplateRegistry();
    }

    const results = [];
    for (const template of templates) {
      const bodyKeys = template.bodyVariableKeys.length ? template.bodyVariableKeys : getFallbackTemplateKeys(template.templateName);
      const buttonKeys = template.buttonVariableKeys ?? [];
      const result = await sendWhatsAppTemplate({
        mobile: parsed.data.testMobile,
        templateName: template.templateName,
        parameters: bodyKeys.map((key) => getTestVariableValue(key)),
        buttonParameters: buttonKeys.map((key) => getTestVariableValue(key)),
      });
      results.push({
        templateName: template.templateName,
        label: template.label,
        ok: result.ok,
        messageId: result.ok ? result.messageId : undefined,
        error: result.ok ? undefined : result.message,
      });
    }

    const sent = results.filter((result) => result.ok).length;
    await logActivity({
      type: "WHATSAPP_TEMPLATE_TEST_ALL",
      entity: "WhatsAppTemplateRegistry",
      summary: `Tested ${results.length} WhatsApp templates. Sent: ${sent}`,
      metadata: { sent, failed: results.length - sent } as Prisma.InputJsonValue,
    });

    return NextResponse.json({ ok: results.every((result) => result.ok), sent, failed: results.length - sent, results });
  }

  if (parsed.data.action === "cancel_customer_campaigns") {
    if (!parsed.data.customerId) {
      return NextResponse.json({ error: "Customer ID is required." }, { status: 400 });
    }
    const cancelled = await cancelActiveCampaigns(parsed.data.customerId, "Cancelled manually from admin automation page.");
    return NextResponse.json({ ok: true, cancelled });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}

async function getRetentionStats() {
  const [
    optedIn,
    optedOut,
    scheduled,
    sent,
    failed,
    skipped,
    activeCampaigns,
    completedCampaigns,
  ] = await Promise.all([
    prisma.customer.count({ where: { whatsappMarketingOptIn: true, whatsappMarketingOptOut: false } }),
    prisma.customer.count({ where: { whatsappMarketingOptOut: true } }),
    prisma.retentionMessage.count({ where: { status: "SCHEDULED" } }),
    prisma.retentionMessage.count({ where: { status: "SENT" } }),
    prisma.retentionMessage.count({ where: { status: "FAILED" } }),
    prisma.retentionMessage.count({ where: { status: "SKIPPED" } }),
    prisma.retentionCampaign.count({ where: { status: "ACTIVE" } }),
    prisma.retentionCampaign.count({ where: { status: "COMPLETED" } }),
  ]);

  return {
    optedIn,
    optedOut,
    scheduled,
    sent,
    failed,
    skipped,
    activeCampaigns,
    completedCampaigns,
  };
}

async function getCustomerRetentionTrackers() {
  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { completedOrderCount: { gt: 0 } },
        { retentionMessages: { some: {} } },
        { retentionCampaigns: { some: {} } },
      ],
    },
    orderBy: [{ lastCompletedOrderAt: "desc" }, { updatedAt: "desc" }],
    take: 200,
    select: {
      id: true,
      name: true,
      mobile: true,
      whatsappMarketingOptIn: true,
      whatsappMarketingOptOut: true,
      completedOrderCount: true,
      lastCompletedOrderAt: true,
      marketingStage: true,
      orders: {
        where: { status: "DELIVERED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { orderNumber: true, createdAt: true },
      },
      tickets: {
        where: {
          OR: [
            { category: { contains: "complaint", mode: "insensitive" } },
            { category: { contains: "feedback", mode: "insensitive" } },
          ],
          status: { in: ["OPEN", "NEW", "PENDING", "IN_PROGRESS", "ESCALATED"] },
        },
        take: 1,
        select: { id: true, status: true, category: true },
      },
      retentionCampaigns: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { id: true, stage: true, status: true, cancelReason: true },
      },
      retentionMessages: {
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          templateName: true,
          stepKey: true,
          stage: true,
          status: true,
          scheduledAt: true,
          sentAt: true,
          failureReason: true,
        },
      },
    },
  });

  return customers.map((customer) => {
    const nextMessage = customer.retentionMessages
      .filter((message) => message.status === "SCHEDULED")
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0] ?? null;
    const lastMessage = customer.retentionMessages
      .filter((message) => message.status !== "SCHEDULED")
      .sort((a, b) => (b.sentAt ?? b.scheduledAt).getTime() - (a.sentAt ?? a.scheduledAt).getTime())[0] ?? customer.retentionMessages[0] ?? null;
    const activeCampaign = customer.retentionCampaigns.find((campaign) => campaign.status === "ACTIVE") ?? customer.retentionCampaigns[0] ?? null;
    const blockedReason =
      customer.whatsappMarketingOptOut ? "Opted out" :
      !customer.whatsappMarketingOptIn ? "No opt-in" :
      customer.tickets[0] ? "Open complaint" :
      "";

    return {
      id: customer.id,
      name: customer.name,
      mobile: customer.mobile,
      optedIn: customer.whatsappMarketingOptIn,
      optedOut: customer.whatsappMarketingOptOut,
      completedOrderCount: customer.completedOrderCount,
      lastCompletedOrderAt: customer.lastCompletedOrderAt,
      lastDeliveredOrderNumber: customer.orders[0]?.orderNumber ?? null,
      lastDeliveredOrderAt: customer.orders[0]?.createdAt ?? null,
      marketingStage: customer.marketingStage,
      campaign: activeCampaign,
      nextMessage,
      lastMessage,
      blockedReason,
      complaint: customer.tickets[0] ?? null,
    };
  });
}

export const GET = withApiErrorHandling(getHandler, "GET /api/admin/whatsapp-retention");
export const PATCH = withApiErrorHandling(patchHandler, "PATCH /api/admin/whatsapp-retention");
export const POST = withApiErrorHandling(postHandler, "POST /api/admin/whatsapp-retention");

function getFallbackTemplateKeys(templateName: string) {
  if (templateName.includes("offer") || templateName.includes("reward")) {
    return ["customer_name", "first_return_discount_amount", "first_return_coupon_code", "coupon_expiry_date"];
  }
  if (templateName.includes("winback_01")) {
    return ["customer_name", "winback_discount_amount", "winback_coupon_code", "coupon_expiry_date"];
  }
  return ["customer_name"];
}

function getTestVariableValue(key: string) {
  const values: Record<string, string> = {
    customer_name: "Test Customer",
    order_link: "https://wahthali.in/menu",
    menu_link: "https://wahthali.in/menu",
    google_review_link: "https://app.reviewus.in/rate-us?businessId=7125",
    first_return_coupon_code: "WAH50",
    first_return_discount_amount: "50",
    winback_coupon_code: "WAH100",
    winback_discount_amount: "100",
    coupon_expiry_date: "7 days",
    order_number: "TEST-ORDER",
  };
  return values[key] ?? "Test";
}
