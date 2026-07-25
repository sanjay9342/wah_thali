import { NextResponse } from "next/server";
import { z } from "zod";
import { getCouponsFromDb, logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const couponSchema = z.object({
  code: z.string().min(2).transform((value) => value.toUpperCase()),
  label: z.string().min(1),
  type: z.enum(["FIXED", "PERCENT"]),
  value: z.coerce.number().int().positive(),
  minOrder: z.coerce.number().int().nonnegative(),
  maxDiscount: z.coerce.number().int().positive().optional(),
  startsAt: z.coerce.date().default(new Date()),
  endsAt: z.coerce.date().default(new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)),
  active: z.boolean().default(true),
});

export async function GET() {
  if (isDatabaseConfigured()) {
    const coupons = await prisma.coupon.findMany({ orderBy: { code: "asc" } });
    return NextResponse.json({ coupons });
  }

  const coupons = await getCouponsFromDb();
  return NextResponse.json({ coupons });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const parsed = couponSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid coupon payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const coupon = await prisma.coupon.upsert({
    where: { code: parsed.data.code },
    create: parsed.data,
    update: parsed.data,
  });

  await logActivity({
    type: "COUPON_SAVED",
    entity: "Coupon",
    entityId: coupon.id,
    summary: `Saved coupon ${coupon.code}`,
  });

  return NextResponse.json({ coupon }, { status: 201 });
}
