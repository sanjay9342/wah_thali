import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeMobile } from "@/lib/customer-auth";
import { consumeCustomerOtp, createCustomerOtp } from "@/lib/customer-otp";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { getWhatsAppOtpConfigStatus, sendWhatsAppOtp } from "@/lib/whatsapp";

const otpSchema = z.object({
  mobile: z.string().min(8),
  purpose: z.enum(["signin", "signup"]),
});

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const parsed = otpSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid WhatsApp number." }, { status: 400 });
  }

  const mobile = normalizeMobile(parsed.data.mobile);
  if (mobile.length !== 10) {
    return NextResponse.json({ error: "Please enter a valid 10 digit WhatsApp number." }, { status: 400 });
  }

  if (parsed.data.purpose === "signin") {
    const customer = await prisma.customer.findUnique({ where: { mobile }, select: { id: true } });
    if (!customer) {
      return NextResponse.json({ error: "No account found for this WhatsApp number. Please create an account." }, { status: 404 });
    }
  }

  const otp = await createCustomerOtp(mobile, parsed.data.purpose);
  const whatsAppConfig = getWhatsAppOtpConfigStatus();
  const canSkipSend = process.env.NODE_ENV !== "production" && !whatsAppConfig.configured;
  let messageId: string | undefined;

  if (!canSkipSend) {
    const sendResult = await sendWhatsAppOtp(mobile, otp.code);
    if (!sendResult.ok) {
      await consumeCustomerOtp(otp.id);
      console.error("WhatsApp OTP send failed.", {
        status: sendResult.status,
        message: sendResult.message,
      });
      return NextResponse.json({ error: "Could not send WhatsApp OTP. Please try again." }, { status: 502 });
    }
    messageId = sendResult.messageId;
  }

  if (messageId) {
    await prisma.whatsAppMessage.upsert({
      where: { messageId },
      create: {
        messageId,
        phone: mobile,
        direction: "OUTBOUND",
        body: `OTP for ${parsed.data.purpose}`,
        status: "SENT",
      },
      update: { status: "SENT" },
    });
  }

  await logActivity({
    type: "CUSTOMER_OTP_CREATED",
    actor: mobile,
    entity: "CustomerOtp",
    entityId: otp.id,
    summary: `Created ${parsed.data.purpose} OTP for ${mobile}`,
  });

  return NextResponse.json({
    message: canSkipSend
      ? "WhatsApp OTP created in development mode. Configure Meta env values to send it."
      : "WhatsApp OTP sent. It expires in 5 minutes.",
    devOtp: process.env.NODE_ENV === "production" ? undefined : otp.code,
  });
}
