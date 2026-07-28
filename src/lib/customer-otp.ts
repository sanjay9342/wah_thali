import "server-only";

import { hashPassword, verifyPassword } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export type CustomerOtpPurpose = "signin" | "signup";

function createCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createCustomerOtp(mobile: string, purpose: CustomerOtpPurpose) {
  const code = createCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.customerOtp.updateMany({
    where: { mobile, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const otp = await prisma.customerOtp.create({
    data: {
      mobile,
      purpose,
      codeHash: await hashPassword(code),
      expiresAt,
    },
  });

  return { id: otp.id, code, expiresAt };
}

export async function verifyCustomerOtp(mobile: string, purpose: CustomerOtpPurpose, code: string) {
  const otp = await prisma.customerOtp.findFirst({
    where: {
      mobile,
      purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return { ok: false, message: "Please send a fresh WhatsApp OTP." };
  }
  if (otp.attempts >= 5) {
    return { ok: false, message: "Too many OTP attempts. Please send a fresh OTP." };
  }

  const valid = await verifyPassword(code, otp.codeHash);
  if (!valid) {
    await prisma.customerOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, message: "Invalid OTP. Please check and try again." };
  }

  await prisma.customerOtp.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });

  return { ok: true, message: "OTP verified." };
}
