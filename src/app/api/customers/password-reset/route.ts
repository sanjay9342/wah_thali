import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { hashPassword, normalizeEmail } from "@/lib/customer-auth";
import { logActivity } from "@/lib/db";
import { isMailConfigured, sendMail } from "@/lib/mail";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { readServerEnv } from "@/lib/server-env";

export const runtime = "nodejs";

const resetRequestSchema = z.object({
  email: z.string().email(),
});

const resetConfirmSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(6),
});

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

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  if (!isMailConfigured()) {
    return NextResponse.json(
      { error: "Password reset email is not configured on this server. Please contact support.", code: "EMAIL_NOT_CONFIGURED" },
      { status: 503 },
    );
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
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + resetTokenTtlMinutes * 60 * 1000);

    await prisma.$transaction([
      prisma.customerPasswordResetToken.updateMany({
        where: { customerId: customer.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      prisma.customerPasswordResetToken.create({
        data: {
          customerId: customer.id,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    const resetUrl = buildResetUrl(request, rawToken);
    try {
      await sendPasswordResetEmail({ to: email, name: customer.name, resetUrl });
    } catch (error) {
      await prisma.customerPasswordResetToken.updateMany({
        where: { tokenHash, usedAt: null },
        data: { usedAt: new Date() },
      });
      console.error("Password reset email failed.", error);
      return NextResponse.json({ error: "Could not send the password reset email. Please contact support." }, { status: 502 });
    }

    await logActivity({
      type: "CUSTOMER_PASSWORD_RESET_REQUESTED",
      actor: customer.mobile,
      entity: "Customer",
      entityId: customer.id,
      summary: `Password reset email sent for ${customer.name}`,
      metadata: { email },
    });
  }

  return NextResponse.json({
    message: "If that email is registered, a password reset link has been sent.",
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
