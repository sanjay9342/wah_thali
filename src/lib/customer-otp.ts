import "server-only";

import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdminClient } from "@/lib/supabase";

export type CustomerOtpPurpose = "signin" | "signup" | "password_reset";

function createCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getSupabaseOrThrow() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase server credentials are missing.");
  return supabase;
}

export async function createCustomerOtp(mobile: string, purpose: CustomerOtpPurpose) {
  const code = createCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const codeHash = await hashPassword(code);

  try {
    await prisma.customerOtp.updateMany({
      where: { mobile, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const otp = await prisma.customerOtp.create({
      data: {
        mobile,
        purpose,
        codeHash,
        expiresAt,
      },
    });

    return { id: otp.id, code, expiresAt };
  } catch (error) {
    console.error("Prisma OTP create failed. Falling back to Supabase HTTPS.", error);
    const supabase = getSupabaseOrThrow();
    const consumedAt = new Date().toISOString();

    await supabase
      .from("CustomerOtp")
      .update({ consumedAt })
      .eq("mobile", mobile)
      .eq("purpose", purpose)
      .is("consumedAt", null);

    const id = randomUUID();
    const { error: insertError } = await supabase.from("CustomerOtp").insert({
      id,
      mobile,
      purpose,
      codeHash,
      expiresAt: expiresAt.toISOString(),
      attempts: 0,
    });

    if (insertError) throw new Error(insertError.message);
    return { id, code, expiresAt };
  }
}

export async function consumeCustomerOtp(id: string) {
  try {
    await prisma.customerOtp.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  } catch (error) {
    console.error("Prisma OTP consume failed. Falling back to Supabase HTTPS.", error);
    const supabase = getSupabaseOrThrow();
    const { error: updateError } = await supabase
      .from("CustomerOtp")
      .update({ consumedAt: new Date().toISOString() })
      .eq("id", id);
    if (updateError) throw new Error(updateError.message);
  }
}

export async function verifyCustomerOtp(mobile: string, purpose: CustomerOtpPurpose, code: string) {
  let otp: { id: string; codeHash: string; attempts: number } | null = null;
  let useSupabase = false;

  try {
    otp = await prisma.customerOtp.findFirst({
      where: {
        mobile,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, codeHash: true, attempts: true },
    });
  } catch (error) {
    console.error("Prisma OTP verify read failed. Falling back to Supabase HTTPS.", error);
    useSupabase = true;
    const supabase = getSupabaseOrThrow();
    const { data, error: selectError } = await supabase
      .from("CustomerOtp")
      .select("id, codeHash, attempts")
      .eq("mobile", mobile)
      .eq("purpose", purpose)
      .is("consumedAt", null)
      .gt("expiresAt", new Date().toISOString())
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) throw new Error(selectError.message);
    otp = data;
  }

  if (!otp) {
    return { ok: false, message: "Please send a fresh WhatsApp OTP." };
  }
  if (otp.attempts >= 5) {
    return { ok: false, message: "Too many OTP attempts. Please send a fresh OTP." };
  }

  const valid = await verifyPassword(code, otp.codeHash);
  if (!valid) {
    if (useSupabase) {
      const supabase = getSupabaseOrThrow();
      const { error: updateError } = await supabase
        .from("CustomerOtp")
        .update({ attempts: otp.attempts + 1 })
        .eq("id", otp.id);
      if (updateError) throw new Error(updateError.message);
    } else {
      await prisma.customerOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
    }
    return { ok: false, message: "Invalid OTP. Please check and try again." };
  }

  if (useSupabase) {
    const supabase = getSupabaseOrThrow();
    const { error: updateError } = await supabase
      .from("CustomerOtp")
      .update({ consumedAt: new Date().toISOString() })
      .eq("id", otp.id);
    if (updateError) throw new Error(updateError.message);
  } else {
    await prisma.customerOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
  }

  return { ok: true, message: "OTP verified." };
}
