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

function otpServiceUnavailable(message: string, code: string, missing?: string[]) {
  return NextResponse.json({ error: message, code, missing }, { status: 503 });
}

function getWhatsAppFailureCode(message: string, status?: number) {
  const normalized = message.toLowerCase();
  if (status === 401 || status === 403 || normalized.includes("token") || normalized.includes("permission")) {
    return "WHATSAPP_AUTH_FAILED";
  }
  if (normalized.includes("template") || normalized.includes("language")) {
    return "WHATSAPP_TEMPLATE_FAILED";
  }
  if (normalized.includes("parameter") || normalized.includes("component") || normalized.includes("button")) {
    return "WHATSAPP_TEMPLATE_PARAMETERS_FAILED";
  }
  return "WHATSAPP_SEND_FAILED";
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return otpServiceUnavailable("Login and registration are temporarily offline because the live server is missing its database connection.", "DATABASE_NOT_CONFIGURED");
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

  const whatsAppConfig = getWhatsAppOtpConfigStatus();
  if (!whatsAppConfig.configured) {
    console.error("WhatsApp OTP is not configured.", { missing: whatsAppConfig.missing });
    return otpServiceUnavailable("WhatsApp OTP is not configured on this server. Please contact support.", "WHATSAPP_NOT_CONFIGURED", whatsAppConfig.missing);
  }

  let otp: Awaited<ReturnType<typeof createCustomerOtp>>;
  try {
    otp = await createCustomerOtp(mobile, parsed.data.purpose);
  } catch (error) {
    console.error("Customer OTP creation failed.", error);
    return NextResponse.json({ error: "Could not create OTP. Please try again.", code: "OTP_CREATE_FAILED" }, { status: 500 });
  }

  const sendResult = await sendWhatsAppOtp(mobile, otp.code);
  if (!sendResult.ok) {
    await consumeCustomerOtp(otp.id);
    console.error("WhatsApp OTP send failed.", {
      status: sendResult.status,
      message: sendResult.message,
    });
    return NextResponse.json(
      {
        error: "Could not send WhatsApp OTP. Please contact support.",
        code: getWhatsAppFailureCode(sendResult.message, sendResult.status),
      },
      { status: 502 },
    );
  }
  const messageId = sendResult.messageId;

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
    }).catch((error) => {
      console.error("WhatsApp OTP message log failed.", error);
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
    message: "WhatsApp OTP sent. It expires in 5 minutes.",
  });
}
