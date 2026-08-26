import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-api-auth";
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
  audience: z.enum(["ALL", "VIP", "POINTS", "TAGS"]).optional(),
  minPoints: z.coerce.number().int().nonnegative().optional(),
  tagNames: z.array(z.string().min(1)).optional(),
});

async function patchHandler(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "coupons");
  if (!access.ok) return access.response;

  const { code } = await params;
  const parsed = couponSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid coupon update", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { audience, minPoints, tagNames, ...couponData } = parsed.data;
  const coupon = await prisma.coupon.update({
    where: { code: code.toUpperCase() },
    data: couponData,
  });
  if (audience !== undefined || minPoints !== undefined || tagNames !== undefined) {
    await saveCouponRule(coupon.code, { audience: audience ?? "ALL", minPoints: minPoints ?? 0, tagNames: tagNames ?? [] });
  }

  await logActivity({
    type: "COUPON_UPDATED",
    entity: "Coupon",
    entityId: coupon.id,
    summary: `Updated coupon ${coupon.code}`,
  });

  return NextResponse.json({ coupon });
}

async function deleteHandler(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "coupons");
  if (!access.ok) return access.response;

  const { code } = await params;
  const coupon = await prisma.coupon.delete({ where: { code: code.toUpperCase() } });
  await deleteCouponRule(code);
  return NextResponse.json({ deleted: true, coupon });
}

export const PATCH = withApiErrorHandling(patchHandler, "PATCH /api/coupons/[code]");
export const DELETE = withApiErrorHandling(deleteHandler, "DELETE /api/coupons/[code]");
