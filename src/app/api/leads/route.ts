import { NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const leadSchema = z.object({
  intent: z.enum(["Office meals", "Monthly subscription", "Bulk event", "Daily staff lunch"]),
  name: z.string().min(1),
  phone: z.string().min(8),
  email: z.string().email().optional().or(z.literal("")),
  company: z.string().optional().or(z.literal("")),
  headcount: z.coerce.number().int().positive().optional(),
  mealsPerDay: z.coerce.number().int().positive().optional(),
  planFrequency: z.string().optional().or(z.literal("")),
  startDate: z.string().optional().or(z.literal("")),
  area: z.string().min(1),
  budget: z.string().optional().or(z.literal("")),
  deliveryTime: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const parsed = leadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid enquiry details", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const score = Math.min(100, 25 + (data.headcount ?? data.mealsPerDay ?? 1) * 2);
  const note = [
    `Need: ${data.intent}`,
    data.email ? `Email: ${data.email}` : "",
    data.headcount ? `People: ${data.headcount}` : "",
    data.mealsPerDay ? `Meals per day: ${data.mealsPerDay}` : "",
    data.planFrequency ? `Plan: ${data.planFrequency}` : "",
    data.startDate ? `Start date: ${data.startDate}` : "",
    data.area ? `Area: ${data.area}` : "",
    data.budget ? `Budget: ${data.budget}` : "",
    data.deliveryTime ? `Delivery time: ${data.deliveryTime}` : "",
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

  await logActivity({
    type: "LEAD_CREATED",
    entity: "Lead",
    entityId: result.lead.id,
    summary: `Created ${data.intent} enquiry for ${data.name}`,
    metadata: { intent: data.intent, area: data.area, score },
  });

  return NextResponse.json(result, { status: 201 });
}
