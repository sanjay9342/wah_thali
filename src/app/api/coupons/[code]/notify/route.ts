import { NextResponse } from "next/server";
import { getAdminCouponsFromDb } from "@/lib/db";
import { notifyCouponAudience } from "@/lib/customer-messaging";
import { isDatabaseConfigured } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const { code } = await params;
  const coupons = await getAdminCouponsFromDb();
  const coupon = coupons.find((item) => item.code === code.toUpperCase());
  if (!coupon) {
    return NextResponse.json({ error: "Coupon was not found." }, { status: 404 });
  }
  if (!coupon.active) {
    return NextResponse.json({ error: "Only active coupons can be notified." }, { status: 409 });
  }

  const result = await notifyCouponAudience(coupon);
  return NextResponse.json({ ok: true, ...result });
}
