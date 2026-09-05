import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRestaurantSettingsFromDb, logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { readServerEnv } from "@/lib/server-env";
import { sendWhatsAppTemplate, sendWhatsAppText } from "@/lib/whatsapp";

const leadSchema = z.object({
  intent: z.enum([
    "Office meals",
    "Monthly subscription",
    "Bulk event",
    "Daily staff lunch",
    "Corporate Orders",
    "Corporate and Office Orders",
    "Monthly Subscription",
    "Monthly Subscriptions",
    "Party and Bulk Orders",
    "Party or Bulk Orders",
  ]),
  name: z.string().min(1),
  phone: z.string().regex(/^\d{10}$/, "Enter a valid 10 digit mobile number."),
  email: z.string().email().optional().or(z.literal("")),
  company: z.string().optional().or(z.literal("")),
  headcount: z.coerce.number().int().positive().optional(),
  mealsPerDay: z.coerce.number().int().positive().optional(),
  planFrequency: z.string().optional().or(z.literal("")),
  startDate: z.string().min(1, "Event date is required."),
  area: z.string().min(1),
  budget: z.string().optional().or(z.literal("")),
  deliveryTime: z.string().min(1, "Preferred time to call is required."),
  notes: z.string().optional().or(z.literal("")),
});

async function postHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const parsed = leadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid enquiry details", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const score = Math.min(100, 25 + (data.headcount ?? data.mealsPerDay ?? 1) * 2);
  const note = [
    `Need: ${data.intent}`,
    data.email ? `Email: ${data.email}` : "",
    data.headcount ? `People: ${data.headcount}` : "",
    data.mealsPerDay ? `Meals per day: ${data.mealsPerDay}` : "",
    data.planFrequency ? `Plan: ${data.planFrequency}` : "",
    data.startDate ? `Event date: ${data.startDate}` : "",
    data.area ? `Area: ${data.area}` : "",
    data.budget ? `Budget: ${data.budget}` : "",
    data.deliveryTime ? `Preferred time to call: ${data.deliveryTime}` : "",
    data.notes ? `Notes: ${data.notes}` : "",
  ].filter(Boolean).join("\n");

  const result = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { mobile: data.phone },
      create: {
        name: data.name,
        mobile: data.phone,
        loyalty: { create: { points: 0, tier: "Starter" } },
      },
      update: {
        name: data.name,
      },
    });

    const lead = await tx.lead.create({
      data: {
        customerId: customer.id,
        source: `Website ${data.intent}`,
        name: data.name,
        phone: data.phone,
        company: data.company || undefined,
        score,
        history: {
          create: {
            toStage: "NEW",
            note,
          },
        },
      },
      include: { history: true },
    });

    await tx.customerNote.create({
      data: {
        customerId: customer.id,
        body: note,
      },
    });

    return { customer, lead };
  });

  const adminNotification = await notifyAdminLead(data, result.lead.id).catch((error) => ({
    ok: false,
    channel: "whatsapp" as const,
    message: error instanceof Error ? error.message : "Admin WhatsApp notification failed.",
  }));

  await logActivity({
    type: "LEAD_CREATED",
    entity: "Lead",
    entityId: result.lead.id,
    summary: `Created ${data.intent} enquiry for ${data.name}`,
    metadata: { intent: data.intent, area: data.area, score, adminNotification },
  });

  return NextResponse.json({ ...result, adminNotification }, { status: 201 });
}

async function notifyAdminLead(data: z.infer<typeof leadSchema>, leadId: string) {
  const settings = await getRestaurantSettingsFromDb();
  const adminMobile = (settings.leadWhatsAppNumber || settings.whatsappNumber).trim();
  if (!adminMobile) {
    return {
      ok: true,
      channel: "skipped" as const,
      message: "Admin WhatsApp number is not configured.",
    };
  }

  const lines = [
    "New Wah Thali enquiry",
    `Type: ${data.intent}`,
    `Name: ${data.name}`,
    `Mobile: ${data.phone}`,
    data.email ? `Email: ${data.email}` : "",
    data.company ? `Company: ${data.company}` : "",
    `Location: ${data.area}`,
    data.headcount ? `Guests/headcount: ${data.headcount}` : "",
    data.mealsPerDay ? `Meals per day: ${data.mealsPerDay}` : "",
    data.planFrequency ? `Plan: ${data.planFrequency}` : "",
    data.startDate ? `Event date: ${data.startDate}` : "",
    data.budget ? `Budget: ${data.budget}` : "",
    data.deliveryTime ? `Preferred time to call: ${data.deliveryTime}` : "",
    data.notes ? `Notes: ${data.notes}` : "",
    `Lead ID: ${leadId}`,
  ].filter(Boolean);
  const messageText = lines.join("\n");
  const adminUrl = `${(readServerEnv("NEXT_PUBLIC_SITE_URL") || "https://wahthali.in").replace(/\/$/, "")}/admin/bulk-leads`;
  const fullTemplateParameters = [
    "Wah Thali",
    leadId,
    "Bulk enquiry",
    `${data.name} - ${data.phone}`,
    data.budget || "-",
    messageText,
    adminUrl,
  ];
  const templateName = readServerEnv("META_WHATSAPP_LEAD_TEMPLATE_NAME");

  let lastTemplateFailure: { ok: false; status?: number; message: string; channel?: string } | undefined;
  const templateVariants = templateName ? buildLeadTemplateParameterVariants(fullTemplateParameters, adminUrl) : [];
  for (const variant of templateVariants) {
    const result = await sendWhatsAppTemplate({
      mobile: adminMobile,
      templateName,
      parameters: variant.body,
      headerParameters: variant.header,
      buttonParameters: variant.button,
    });

    if (result.ok) {
      return {
        ...result,
        channel: "template" as const,
        templateName,
        parameterCount: variant.body.length,
        headerParameterCount: variant.header.length,
        buttonParameterCount: variant.button.length,
      };
    }

    lastTemplateFailure = { ...result, channel: "template" };
  }

  const freeformEnabled = ["1", "true", "yes", "on"].includes(readServerEnv("META_WHATSAPP_FREEFORM_NOTIFICATIONS").toLowerCase());
  if (!freeformEnabled) {
    return lastTemplateFailure ?? {
      ok: false,
      channel: "skipped" as const,
      message: "Set META_WHATSAPP_LEAD_TEMPLATE_NAME to an approved Meta template, or enable META_WHATSAPP_FREEFORM_NOTIFICATIONS for service-window text messages.",
    };
  }

  const result = await sendWhatsAppText({
    mobile: adminMobile,
    text: messageText,
  });

  return { ...result, channel: "whatsapp" as const };
}

export const POST = withApiErrorHandling(postHandler, "POST /api/leads");

function buildLeadTemplateParameterVariants(parameters: string[], adminUrl: string) {
  const variants = new Map<string, { body: string[]; header: string[]; button: string[] }>();

  function add(body: string[], header: string[] = [], button: string[] = []) {
    variants.set(`${header.length}:${body.length}:${button.length}:${[...header, ...body, ...button].join("\u001f")}`, {
      body,
      header,
      button,
    });
  }

  for (let count = parameters.length; count >= 0; count -= 1) {
    const variant = count === 1 ? [parameters[5]] : parameters.slice(0, count);
    add(variant);
    add(variant, ["Wah Thali"]);
    add(variant, [], [adminUrl]);
    add(variant, ["Wah Thali"], [adminUrl]);
  }

  return Array.from(variants.values());
}
