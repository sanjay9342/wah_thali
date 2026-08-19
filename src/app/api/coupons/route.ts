import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminCouponsFromDb, getCouponsFromDb, logActivity, saveCouponRule } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const couponSchema = z.object({
  code: z.string().min(2).transform((value) => value.toUpperCase()),
  label: z.string().min(1),
  type: z.enum(["FIXED", "PERCENT"]),
  value: z.coerce.number().int().positive(),
  minOrder: z.coerce.number().int().nonnegative(),
  maxDiscount: z.coerce.number().int().positive().nullable().optional(),
  startsAt: z.coerce.date().default(new Date()),
  endsAt: z.coerce.date().default(new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)),
  active: z.boolean().default(true),
  audience: z.enum(["ALL", "VIP", "POINTS"]).default("ALL"),
  minPoints: z.coerce.number().int().nonnegative().default(0),
});

export async function GET() {
  if (isDatabaseConfigured()) {
    const coupons = await getAdminCouponsFromDb();
    return NextResponse.json({ coupons });
  }

  const coupons = await getCouponsFromDb();
  return NextResponse.json({ coupons });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const parsed = couponSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid coupon payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { audience, minPoints, ...couponData } = parsed.data;
  const coupon = await prisma.coupon.upsert({
    where: { code: couponData.code },
    create: couponData,
    update: couponData,
  });
  await saveCouponRule(coupon.code, { audience, minPoints });

  await logActivity({
    type: "COUPON_SAVED",
    entity: "Coupon",
    entityId: coupon.id,
    summary: `Saved coupon ${coupon.code}`,
  });

  return NextResponse.json({ coupon }, { status: 201 });
}
