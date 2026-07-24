import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/db";

const paymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = paymentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payment payload" }, { status: 400 });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    return NextResponse.json({
      verified: false,
      testMode: true,
      message: "RAZORPAY_KEY_SECRET is not configured. Verification adapter is ready.",
    });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;
  const expected = createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const verified = timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));

  await logActivity({
    type: verified ? "PAYMENT_VERIFIED" : "PAYMENT_VERIFICATION_FAILED",
    entity: "Payment",
    entityId: razorpay_payment_id,
    summary: `Razorpay payment ${verified ? "verified" : "failed verification"}`,
    metadata: { razorpay_order_id, razorpay_payment_id },
  });

  return NextResponse.json({ verified });
}
