import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { getAdminCouponsFromDb, getCouponsFromDb, logActivity, saveCouponRule } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { getIstDateInputValue, parseIstDateInput } from "@/lib/time";

function istDateSchema(boundary: "start" | "end") {
  return z.preprocess((value) => {
    if (value instanceof Date) return value;
    if (typeof value === "string") return parseIstDateInput(value, boundary) ?? value;
    return value;
  }, z.date());
}

const couponSchema = z.object({
  code: z.string().min(2).transform((value) => value.toUpperCase()),
  label: z.string().min(1),
  type: z.enum(["FIXED", "PERCENT"]),
  value: z.coerce.number().int().positive(),
  minOrder: z.coerce.number().int().nonnegative(),
  maxDiscount: z.coerce.number().int().positive().nullable().optional(),
  startsAt: istDateSchema("start").default(() => parseIstDateInput(getIstDateInputValue(), "start") ?? new Date()),
  endsAt: istDateSchema("end").default(() => parseIstDateInput(getIstDateInputValue(new Date(), 30), "end") ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)),
  active: z.boolean().default(true),
  audience: z.enum(["ALL", "VIP", "POINTS", "TAGS"]).default("ALL"),
  minPoints: z.coerce.number().int().nonnegative().default(0),
  tagNames: z.array(z.string().min(1)).default([]),
});

async function getHandler() {
  if (isDatabaseConfigured()) {
    const coupons = await getAdminCouponsFromDb();
    return NextResponse.json({ coupons });
  }

  const coupons = await getCouponsFromDb();
  return NextResponse.json({ coupons });
}

async function postHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "coupons");
  if (!access.ok) return access.response;

  const parsed = couponSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid coupon payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { audience, minPoints, tagNames, ...couponData } = parsed.data;
  const coupon = await prisma.coupon.upsert({
    where: { code: couponData.code },
    create: couponData,
    update: couponData,
  });
  await saveCouponRule(coupon.code, { audience, minPoints, tagNames });

  await logActivity({
    type: "COUPON_SAVED",
    entity: "Coupon",
    entityId: coupon.id,
    summary: `Saved coupon ${coupon.code}`,
  });

  return NextResponse.json({ coupon }, { status: 201 });
}

export const GET = withApiErrorHandling(getHandler, "GET /api/coupons");
export const POST = withApiErrorHandling(postHandler, "POST /api/coupons");
