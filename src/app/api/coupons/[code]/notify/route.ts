import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { getAdminCouponsFromDb } from "@/lib/db";
import { notifyCouponAudience } from "@/lib/customer-messaging";
import { isDatabaseConfigured } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "coupons");
  if (!access.ok) return access.response;

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
