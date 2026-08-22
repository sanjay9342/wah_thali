import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteCouponRule, logActivity, saveCouponRule } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { parseIstDateInput } from "@/lib/time";

function istDateSchema(boundary: "start" | "end") {
  return z.preprocess((value) => {
    if (value instanceof Date) return value;
    if (typeof value === "string") return parseIstDateInput(value, boundary) ?? value;
    return value;
  }, z.date());
}

const couponSchema = z.object({
  code: z.string().min(2).transform((value) => value.toUpperCase()).optional(),
  label: z.string().min(1).optional(),
  type: z.enum(["FIXED", "PERCENT"]).optional(),
  value: z.coerce.number().int().positive().optional(),
  minOrder: z.coerce.number().int().nonnegative().optional(),
  maxDiscount: z.coerce.number().int().positive().nullable().optional(),
  startsAt: istDateSchema("start").optional(),
  endsAt: istDateSchema("end").optional(),
  active: z.boolean().optional(),
  audience: z.enum(["ALL", "VIP", "POINTS"]).optional(),
  minPoints: z.coerce.number().int().nonnegative().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const { code } = await params;
  const parsed = couponSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid coupon update", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { audience, minPoints, ...couponData } = parsed.data;
  const coupon = await prisma.coupon.update({
    where: { code: code.toUpperCase() },
    data: couponData,
  });
  if (audience !== undefined || minPoints !== undefined) {
    await saveCouponRule(coupon.code, { audience: audience ?? "ALL", minPoints: minPoints ?? 0 });
  }

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
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const { code } = await params;
  const coupon = await prisma.coupon.delete({ where: { code: code.toUpperCase() } });
  await deleteCouponRule(code);
  return NextResponse.json({ deleted: true, coupon });
}
