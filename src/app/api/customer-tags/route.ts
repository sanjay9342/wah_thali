import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const tagSchema = z.object({
  name: z.string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0 && value.length <= 32, "Tag name must be 1 to 32 characters."),
});

async function getHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ tags: ["VIP"], configured: false });
  }
  const access = await requireAdminPermission(request, "customers");
  if (!access.ok) return access.response;

  const tags = await prisma.customerTag.findMany({
    orderBy: { name: "asc" },
    select: { name: true },
  });

  return NextResponse.json({ tags: Array.from(new Set(["VIP", ...tags.map((tag) => tag.name)])).sort((a, b) => a.localeCompare(b)), configured: true });
}

async function postHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "customers");
  if (!access.ok) return access.response;

  const parsed = tagSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid tag", issues: parsed.error.flatten() }, { status: 400 });
  }

  const tag = await prisma.customerTag.upsert({
    where: { name: parsed.data.name },
    create: { name: parsed.data.name },
    update: {},
  });

  await logActivity({
    type: "CUSTOMER_TAG_SAVED",
    entity: "CustomerTag",
    entityId: tag.id,
    summary: `Saved customer tag ${tag.name}`,
  });

  return NextResponse.json({ tag }, { status: 201 });
}

export const GET = withApiErrorHandling(getHandler, "GET /api/customer-tags");
export const POST = withApiErrorHandling(postHandler, "POST /api/customer-tags");
