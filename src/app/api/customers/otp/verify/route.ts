import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeMobile } from "@/lib/customer-auth";
import { verifyCustomerOtp } from "@/lib/customer-otp";
import { isDatabaseConfigured } from "@/lib/prisma";

const verifySchema = z.object({
  mobile: z.string().min(8),
  purpose: z.enum(["signin", "signup", "password_reset"]),
  otp: z.string().min(4),
});

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const parsed = verifySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid OTP details." }, { status: 400 });
  }

  const mobile = normalizeMobile(parsed.data.mobile);
  if (mobile.length !== 10) {
    return NextResponse.json({ error: "Please enter a valid 10 digit WhatsApp number." }, { status: 400 });
  }

  const result = await verifyCustomerOtp(mobile, parsed.data.purpose, parsed.data.otp.trim());
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 401 });
  }

  return NextResponse.json({ message: result.message });
}
