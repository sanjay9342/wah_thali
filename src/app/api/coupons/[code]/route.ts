import { NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const couponSchema = z.object({
  code: z.string().min(2).transform((value) => value.toUpperCase()).optional(),
  label: z.string().min(1).optional(),
  type: z.enum(["FIXED", "PERCENT"]).optional(),
  value: z.coerce.number().int().positive().optional(),
  minOrder: z.coerce.number().int().nonnegative().optional(),
  maxDiscount: z.coerce.number().int().positive().nullable().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const { code } = await params;
  const parsed = couponSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid coupon update", issues: parsed.error.flatten() }, { status: 400 });
  }

  const coupon = await prisma.coupon.update({
    where: { code: code.toUpperCase() },
    data: parsed.data,
  });

  await logActivity({
    type: "COUPON_UPDATED",
    entity: "Coupon",
    entityId: coupon.id,
    summary: `Updated coupon ${coupon.code}`,
  });

  return NextResponse.json({ coupon });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const { code } = await params;
  const coupon = await prisma.coupon.delete({ where: { code: code.toUpperCase() } });
  return NextResponse.json({ deleted: true, coupon });
}
