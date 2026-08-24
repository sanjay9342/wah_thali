import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const customerUpdateSchema = z.object({
  isVip: z.boolean().optional(),
  tagNames: z.array(z.string().min(1)).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    summary: `${parsed.data.isVip ? "Marked" : "Updated"} ${customer.name} as ${parsed.data.isVip ? "VIP" : "non-VIP"}`,
  });

  return NextResponse.json({ customer: { ...customer, isVip: parsed.data.isVip } });
}

function normalizeTagNames(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 12);
}
