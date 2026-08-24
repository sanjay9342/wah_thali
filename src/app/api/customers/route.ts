import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { parseIstDateInput } from "@/lib/time";

const customerSchema = z.object({
  name: z.string().min(1),
  mobile: z.string()
    .transform((value) => value.replace(/\D/g, "").slice(-10))
    .refine((value) => value.length >= 8, "Mobile number must include at least 8 digits."),
  email: z.string().email().optional().or(z.literal("")).transform((value) => value || undefined),
  birthday: z.string().optional().or(z.literal("")),
  anniversary: z.string().optional().or(z.literal("")),
  tags: z.array(z.string().min(1)).default([]),
  note: z.string().optional().or(z.literal("")),
  address: z.object({
    label: z.string().optional().or(z.literal("")),
    line1: z.string().optional().or(z.literal("")),
    area: z.string().optional().or(z.literal("")),
    city: z.string().optional().or(z.literal("")),
    state: z.string().optional().or(z.literal("")),
    pinCode: z.string().optional().or(z.literal("")),
    landmark: z.string().optional().or(z.literal("")),
  }).optional(),
});

function toPublicCustomer<Customer extends object>(customer: Customer) {
  const publicCustomer = { ...customer } as Customer & { passwordHash?: string | null };
  delete publicCustomer.passwordHash;
  return publicCustomer;
}

const publicCustomerSelect = {
  id: true,
  name: true,
  mobile: true,
  email: true,
  birthday: true,
  anniversary: true,
  tags: { include: { tag: { select: { name: true } } } },
  createdAt: true,
  updatedAt: true,
  loyalty: true,
  orders: { orderBy: { createdAt: "desc" as const }, take: 5 },
};

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ customers: [], configured: false });
  }
  const access = await requireAdminPermission(request, "customers");
  if (!access.ok) return access.response;

  const customers = await prisma.customer.findMany({
    orderBy: { updatedAt: "desc" },
    select: publicCustomerSelect,
  });

  return NextResponse.json({ customers: customers.map(toPublicCustomer), configured: true });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "customers");
  if (!access.ok) return access.response;

  const parsed = customerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid customer payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { tags, note, address, birthday, anniversary, ...customerData } = parsed.data;
  const birthdayDate = birthday ? parseIstDateInput(birthday, "start") : null;
  const anniversaryDate = anniversary ? parseIstDateInput(anniversary, "start") : null;
  const tagNames = normalizeTagNames(tags);

  const customer = await prisma.$transaction(async (tx) => {
    const saved = await tx.customer.upsert({
      where: { mobile: customerData.mobile },
      create: {
        ...customerData,
        birthday: birthdayDate,
        anniversary: anniversaryDate,
        loyalty: { create: { points: 0, tier: "Starter" } },
      },
      update: {
        ...customerData,
        birthday: birthdayDate,
        anniversary: anniversaryDate,
      },
      select: { id: true, name: true, mobile: true },
    });

    if (tagNames.length) {
      for (const tagName of tagNames) {
        const tag = await tx.customerTag.upsert({
          where: { name: tagName },
          create: { name: tagName },
          update: {},
        });
        await tx.customerTagAssignment.upsert({
          where: { customerId_tagId: { customerId: saved.id, tagId: tag.id } },
          create: { customerId: saved.id, tagId: tag.id },
          update: {},
        });
      }
    }

    if (note?.trim()) {
      await tx.customerNote.create({ data: { customerId: saved.id, body: note.trim() } });
    }

    const addressLine = address?.line1?.trim();
    const addressArea = address?.area?.trim();
    const pinCode = address?.pinCode?.replace(/\D/g, "").slice(0, 6);
    if (addressLine && addressArea && pinCode) {
      await tx.customerAddress.create({
        data: {
          customerId: saved.id,
          label: address?.label?.trim() || "Admin",
          line1: addressLine,
          area: addressArea,
          city: address?.city?.trim() || "Kolkata",
          state: address?.state?.trim() || "West Bengal",
          pinCode,
          landmark: address?.landmark?.trim() || null,
          isDefault: false,
        },
      });
    }

    return tx.customer.findUniqueOrThrow({
      where: { id: saved.id },
      select: publicCustomerSelect,
    });
  });

  await logActivity({
    type: "CUSTOMER_SAVED",
    entity: "Customer",
    entityId: customer.id,
    summary: `Saved customer ${customer.name}`,
  });

  return NextResponse.json({ customer: toPublicCustomer(customer) }, { status: 201 });
}

function normalizeTagNames(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 12);
}
