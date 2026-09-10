import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { parseIstDateInput } from "@/lib/time";

const customerUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  mobile: z.string()
    .optional()
    .transform((value) => value ? value.replace(/\D/g, "").slice(-10) : undefined)
    .refine((value) => value === undefined || value.length >= 8, "Mobile number must include at least 8 digits."),
  email: z.string().trim().email().optional().or(z.literal("")).transform((value) => value || null).optional(),
  birthday: z.string().optional().or(z.literal("")),
  anniversary: z.string().optional().or(z.literal("")),
  isVip: z.boolean().optional(),
  tagNames: z.array(z.string().min(1)).optional(),
});

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

function toPublicCustomer<Customer extends object>(customer: Customer) {
  const publicCustomer = { ...customer } as Customer & { passwordHash?: string | null };
  delete publicCustomer.passwordHash;
  return publicCustomer;
}

async function patchHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "customers");
  if (!access.ok) return access.response;

  const { id } = await params;
  const parsed = customerUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid customer update", issues: parsed.error.flatten() }, { status: 400 });
  }

  const customer = await prisma.customer.findUniqueOrThrow({ where: { id }, select: { id: true, name: true, mobile: true } });
  const hasProfileUpdate = parsed.data.name !== undefined ||
    parsed.data.mobile !== undefined ||
    parsed.data.email !== undefined ||
    parsed.data.birthday !== undefined ||
    parsed.data.anniversary !== undefined;

  if (hasProfileUpdate) {
    await prisma.customer.update({
      where: { id },
      data: {
        name: parsed.data.name,
        mobile: parsed.data.mobile,
        email: parsed.data.email,
        birthday: parsed.data.birthday !== undefined ? parseOptionalIstDate(parsed.data.birthday) : undefined,
        anniversary: parsed.data.anniversary !== undefined ? parseOptionalIstDate(parsed.data.anniversary) : undefined,
      },
    });
  }

  if (parsed.data.tagNames !== undefined) {
    const nextTagNames = normalizeTagNames(parsed.data.tagNames);
    await prisma.$transaction(async (tx) => {
      await tx.customerTagAssignment.deleteMany({ where: { customerId: id } });
      for (const tagName of nextTagNames) {
        const tag = await tx.customerTag.upsert({
          where: { name: tagName },
          create: { name: tagName },
          update: {},
        });
        await tx.customerTagAssignment.create({
          data: { customerId: id, tagId: tag.id },
        });
      }
    });
  } else if (parsed.data.isVip !== undefined) {
    const vipTag = await prisma.customerTag.upsert({
      where: { name: "VIP" },
      create: { name: "VIP" },
      update: {},
    });

    if (parsed.data.isVip) {
      await prisma.customerTagAssignment.upsert({
        where: { customerId_tagId: { customerId: id, tagId: vipTag.id } },
        create: { customerId: id, tagId: vipTag.id },
        update: {},
      });
    } else {
      await prisma.customerTagAssignment.deleteMany({ where: { customerId: id, tagId: vipTag.id } });
    }
  }

  await logActivity({
    type: "CUSTOMER_UPDATED",
    actor: customer.mobile,
    entity: "Customer",
    entityId: customer.id,
    summary: hasProfileUpdate ? `Updated customer ${customer.name}` : `${parsed.data.isVip ? "Marked" : "Updated"} ${customer.name} as ${parsed.data.isVip ? "VIP" : "non-VIP"}`,
  });

  const updatedCustomer = await prisma.customer.findUniqueOrThrow({
    where: { id },
    select: publicCustomerSelect,
  });

  return NextResponse.json({ customer: toPublicCustomer(updatedCustomer) });
}

async function deleteHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "customers");
  if (!access.ok) return access.response;

  const { id } = await params;
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id },
    select: { id: true, name: true, mobile: true, orders: { select: { id: true }, take: 1 } },
  });

  if (customer.orders.length) {
    return NextResponse.json({ error: "This customer has order history, so it cannot be deleted. Keep the record for invoices and reports." }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    const leadIds = await tx.lead.findMany({ where: { customerId: id }, select: { id: true } });
    await tx.leadStageHistory.deleteMany({ where: { leadId: { in: leadIds.map((lead) => lead.id) } } });
    await tx.lead.deleteMany({ where: { customerId: id } });
    await tx.retentionMessage.deleteMany({ where: { customerId: id } });
    await tx.retentionCampaign.deleteMany({ where: { customerId: id } });
    await tx.customerPasswordResetToken.deleteMany({ where: { customerId: id } });
    await tx.customerTagAssignment.deleteMany({ where: { customerId: id } });
    await tx.customerNote.deleteMany({ where: { customerId: id } });
    await tx.customerAddress.deleteMany({ where: { customerId: id } });
    await tx.loyaltyPointLedger.deleteMany({ where: { customerId: id } });
    await tx.loyaltyAccount.deleteMany({ where: { customerId: id } });
    await tx.supportTicket.deleteMany({ where: { customerId: id } });
    await tx.customer.delete({ where: { id } });
  });

  await logActivity({
    type: "CUSTOMER_DELETED",
    actor: customer.mobile,
    entity: "Customer",
    entityId: customer.id,
    summary: `Deleted customer ${customer.name}`,
  });

  return NextResponse.json({ deleted: true, customer: { id: customer.id, name: customer.name } });
}

function normalizeTagNames(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 12);
}

function parseOptionalIstDate(value: string | undefined) {
  if (!value) return null;
  return parseIstDateInput(value, "start");
}

export const PATCH = withApiErrorHandling(patchHandler, "PATCH /api/customers/[id]");
export const DELETE = withApiErrorHandling(deleteHandler, "DELETE /api/customers/[id]");
