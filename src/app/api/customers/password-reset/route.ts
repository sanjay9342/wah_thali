import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { hashPassword, normalizeEmail } from "@/lib/customer-auth";
import { consumeCustomerOtp, createCustomerOtp, verifyCustomerOtp } from "@/lib/customer-otp";
import { logActivity } from "@/lib/db";
import { isMailConfigured, sendMail } from "@/lib/mail";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { readServerEnv } from "@/lib/server-env";
import { getWhatsAppOtpConfigStatus, sendWhatsAppOtp } from "@/lib/whatsapp";

export const runtime = "nodejs";

const resetRequestSchema = z.object({
  email: z.string().email(),
});

const resetConfirmSchema = z.union([
  z.object({
    token: z.string().min(32),
    password: z.string().min(6),
  }),
  z.object({
    email: z.string().email(),
    otp: z.string().min(4),
    password: z.string().min(6),
  }),
]);

const resetTokenTtlMinutes = 60;

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getBaseUrl(request: Request) {
  const configuredUrl = readServerEnv("NEXT_PUBLIC_SITE_URL") || readServerEnv("SITE_URL");
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  const url = new URL(request.url);
  return url.origin;
}

function buildResetUrl(request: Request, token: string) {
  const resetUrl = new URL("/login", getBaseUrl(request));
  resetUrl.searchParams.set("mode", "reset");
  resetUrl.searchParams.set("token", token);
  return resetUrl.toString();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendPasswordResetEmail(input: { to: string; name: string; resetUrl: string }) {
  const safeName = escapeHtml(input.name);
  const safeUrl = escapeHtml(input.resetUrl);

  await sendMail({
    to: input.to,
    subject: "Reset your Wah Thali password",
    text: [
      `Hi ${input.name},`,
      "",
      "Use this link to reset your Wah Thali password:",
      input.resetUrl,
      "",
      `This link expires in ${resetTokenTtlMinutes} minutes. If you did not request this, you can ignore this email.`,
      "",
      "Wah Thali",
    ].join("\n"),
    html: [
      `<p>Hi ${safeName},</p>`,
      "<p>Use the button below to reset your Wah Thali password.</p>",
      `<p><a href="${safeUrl}" style="display:inline-block;background:#8d0021;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px">Reset password</a></p>`,
      `<p>This link expires in ${resetTokenTtlMinutes} minutes. If you did not request this, you can ignore this email.</p>`,
      "<p>Wah Thali</p>",
    ].join(""),
  });
}

async function createPasswordResetUrl(request: Request, customerId: string) {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + resetTokenTtlMinutes * 60 * 1000);

  await prisma.$transaction([
    prisma.customerPasswordResetToken.updateMany({
      where: { customerId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.customerPasswordResetToken.create({
      data: {
        customerId,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  return {
    resetUrl: buildResetUrl(request, rawToken),
    tokenHash,
  };
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const parsed = resetRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const customer = await prisma.customer.findUnique({
    where: { email },
    select: { id: true, name: true, mobile: true, email: true },
  });

  if (customer) {
    if (isMailConfigured()) {
      const { resetUrl, tokenHash } = await createPasswordResetUrl(request, customer.id);
      try {
        await sendPasswordResetEmail({ to: email, name: customer.name, resetUrl });
      } catch (error) {
        await prisma.customerPasswordResetToken.updateMany({
          where: { tokenHash, usedAt: null },
          data: { usedAt: new Date() },
        });
        console.error("Password reset email failed.", error);
        return NextResponse.json({ error: "Could not send the password reset email. Please try WhatsApp OTP or contact support." }, { status: 502 });
      }

      await logActivity({
        type: "CUSTOMER_PASSWORD_RESET_REQUESTED",
        actor: customer.mobile,
        entity: "Customer",
        entityId: customer.id,
        summary: `Password reset email sent for ${customer.name}`,
        metadata: { email, channel: "email" },
      });

      return NextResponse.json({
        message: "If that email is registered, a password reset link has been sent.",
        resetMode: "email",
      });
    }

    const whatsAppConfig = getWhatsAppOtpConfigStatus();
    if (!whatsAppConfig.configured) {
      if (process.env.NODE_ENV !== "production") {
        const { resetUrl } = await createPasswordResetUrl(request, customer.id);
        return NextResponse.json({
          message: "Email and WhatsApp are not configured. Development reset link created.",
          resetMode: "link",
          resetUrl,
        });
      }

      console.error("Password reset delivery is not configured.", { missing: whatsAppConfig.missing });
      return NextResponse.json(
        {
          error: "Password reset delivery is not configured on this server. Please contact support.",
          code: "RESET_DELIVERY_NOT_CONFIGURED",
          missing: whatsAppConfig.missing,
        },
        { status: 503 },
      );
    }

    let otp: Awaited<ReturnType<typeof createCustomerOtp>>;
    try {
      otp = await createCustomerOtp(customer.mobile, "password_reset");
    } catch (error) {
      console.error("Password reset OTP creation failed.", error);
      return NextResponse.json({ error: "Could not create password reset OTP. Please try again." }, { status: 500 });
    }

    const sendResult = await sendWhatsAppOtp(customer.mobile, otp.code);
    if (!sendResult.ok) {
      await consumeCustomerOtp(otp.id);
      console.error("Password reset WhatsApp OTP send failed.", {
        status: sendResult.status,
        message: sendResult.message,
      });
      return NextResponse.json({ error: "Could not send the password reset OTP. Please contact support." }, { status: 502 });
    }

    await logActivity({
      type: "CUSTOMER_PASSWORD_RESET_REQUESTED",
      actor: customer.mobile,
      entity: "Customer",
      entityId: customer.id,
      summary: `Password reset WhatsApp OTP sent for ${customer.name}`,
      metadata: { email, channel: "whatsapp_otp" },
    });

    return NextResponse.json({
      message: `Password reset OTP sent to your registered WhatsApp number ending ${customer.mobile.slice(-4)}.`,
      resetMode: "whatsapp_otp",
    });
  }

  return NextResponse.json({
    message: "If that email is registered, password reset instructions have been sent.",
  });
}

export async function PATCH(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const parsed = resetConfirmSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reset link or password. Password must be at least 6 characters." }, { status: 400 });
  }

  if ("otp" in parsed.data) {
    const email = normalizeEmail(parsed.data.email);
    const customer = await prisma.customer.findUnique({
      where: { email },
      select: { id: true, name: true, mobile: true, email: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Invalid OTP or email. Please request a fresh reset OTP." }, { status: 400 });
    }

    const otpResult = await verifyCustomerOtp(customer.mobile, "password_reset", parsed.data.otp.trim());
    if (!otpResult.ok) {
      return NextResponse.json({ error: otpResult.message }, { status: 400 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await prisma.$transaction([
      prisma.customer.update({
        where: { id: customer.id },
        data: { passwordHash },
      }),
      prisma.customerPasswordResetToken.updateMany({
        where: { customerId: customer.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    await logActivity({
      type: "CUSTOMER_PASSWORD_RESET_COMPLETED",
      actor: customer.mobile,
      entity: "Customer",
      entityId: customer.id,
      summary: `Password reset completed with WhatsApp OTP for ${customer.name}`,
      metadata: { email: customer.email, channel: "whatsapp_otp" },
    });

    return NextResponse.json({ message: "Your password has been reset. Please log in with your new password." });
  }

  const tokenHash = hashResetToken(parsed.data.token);
  const resetToken = await prisma.customerPasswordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      customerId: true,
      customer: { select: { id: true, name: true, mobile: true, email: true } },
    },
  });

  if (!resetToken) {
    return NextResponse.json({ error: "This reset link is invalid or expired. Please request a new one." }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const usedAt = new Date();

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: resetToken.customerId },
      data: { passwordHash },
    }),
    prisma.customerPasswordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt },
    }),
    prisma.customerPasswordResetToken.updateMany({
      where: {
        customerId: resetToken.customerId,
        id: { not: resetToken.id },
        usedAt: null,
      },
      data: { usedAt },
    }),
  ]);

  await logActivity({
    type: "CUSTOMER_PASSWORD_RESET_COMPLETED",
    actor: resetToken.customer.mobile,
    entity: "Customer",
    entityId: resetToken.customer.id,
    summary: `Password reset completed for ${resetToken.customer.name}`,
    metadata: { email: resetToken.customer.email },
  });

  return NextResponse.json({ message: "Your password has been reset. Please log in with your new password." });
}
