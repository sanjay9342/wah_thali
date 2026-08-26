import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import type { PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { logActivity } from "@/lib/db";
import { hashPassword, normalizeEmail, normalizeMobile, verifyPassword } from "@/lib/customer-auth";
import { verifyCustomerOtp } from "@/lib/customer-otp";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const paidOnlineStatuses: PaymentStatus[] = ["PAID", "AUTHORIZED"];

const authSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("password"),
    email: z.string().email(),
    password: z.string().min(6),
  }),
  z.object({
    method: z.literal("whatsapp_otp"),
    mobile: z.string().min(8),
    otp: z.string().min(4),
  }),
]);

const publicCustomerSelect = {
  id: true,
  name: true,
  mobile: true,
  email: true,
  addresses: true,
  loyalty: true,
  orders: {
    where: {
      OR: [
        { payments: { some: { provider: "COD" } } },
        { payments: { some: { provider: "RAZORPAY", status: { in: paidOnlineStatuses } } } },
      ],
    },
    orderBy: { createdAt: "desc" as const },
    take: 20,
    include: { items: true },
  },
};

const passwordCustomerSelect = {
  ...publicCustomerSelect,
  passwordHash: true,
};

function toPublicCustomer<Customer extends object>(customer: Customer) {
  const publicCustomer = { ...customer } as Customer & { passwordHash?: string | null };
  delete publicCustomer.passwordHash;
  return publicCustomer;
}

function parseEnvList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getBootstrapAdminEmails() {
  return [
    ...parseEnvList(process.env.ADMIN_EMAILS),
    ...parseEnvList(process.env.WAH_ADMIN_EMAILS),
    ...parseEnvList(process.env.ADMIN_BOOTSTRAP_EMAILS),
  ].map(normalizeEmail);
}

function getBootstrapAdminMobile() {
  return normalizeMobile(
    parseEnvList(process.env.ADMIN_MOBILES)[0] ??
      parseEnvList(process.env.WAH_ADMIN_MOBILES)[0] ??
      process.env.ADMIN_BOOTSTRAP_MOBILE ??
      "",
  );
}

function getBootstrapAdminPassword() {
  return process.env.ADMIN_BOOTSTRAP_PASSWORD || process.env.WAH_ADMIN_BOOTSTRAP_PASSWORD || "";
}

async function upsertBootstrapAdmin(email: string, password: string) {
  const bootstrapPassword = getBootstrapAdminPassword();
  const adminEmails = getBootstrapAdminEmails();
  if (!bootstrapPassword || !adminEmails.includes(email) || password !== bootstrapPassword) return null;

  const mobile = getBootstrapAdminMobile();
  if (!mobile) {
    console.error("Admin bootstrap login is configured without ADMIN_MOBILES or ADMIN_BOOTSTRAP_MOBILE.");
    return null;
  }

  return prisma.customer.upsert({
    where: { mobile },
    create: {
      name: process.env.ADMIN_BOOTSTRAP_NAME || "Wah Thali Admin",
      mobile,
      email,
      passwordHash: await hashPassword(password),
      loyalty: { create: { points: 0, tier: "Admin" } },
    },
    update: {
      email,
      passwordHash: await hashPassword(password),
    },
    select: passwordCustomerSelect,
  });
}

async function postHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const parsed = authSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid login details", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.method === "password") {
    const email = normalizeEmail(parsed.data.email);
    let customer = await prisma.customer.findUnique({
      where: { email },
      select: passwordCustomerSelect,
    }).catch((error) => {
      console.error("Password login failed while reading customer password hash.", error);
      return null;
    });

    let validPassword = await verifyPassword(parsed.data.password, customer?.passwordHash);
    if (!validPassword) {
      customer = await upsertBootstrapAdmin(email, parsed.data.password).catch((error) => {
        console.error("Admin bootstrap login failed.", error);
        return null;
      });
      validPassword = Boolean(customer);
    }

    if (!customer || !validPassword) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    await logActivity({
      type: "CUSTOMER_LOGIN",
      actor: customer.mobile,
      entity: "Customer",
      entityId: customer.id,
      summary: `Customer ${customer.name} signed in with password`,
    });

    return NextResponse.json({ customer: toPublicCustomer(customer) });
  }

  const mobile = normalizeMobile(parsed.data.mobile);
  if (mobile.length !== 10) {
    return NextResponse.json({ error: "Please enter a valid 10 digit WhatsApp number." }, { status: 400 });
  }

  const otpResult = await verifyCustomerOtp(mobile, "signin", parsed.data.otp.trim());
  if (!otpResult.ok) {
    return NextResponse.json({ error: otpResult.message }, { status: 401 });
  }

  const customer = await prisma.customer.findUnique({
    where: { mobile },
    select: publicCustomerSelect,
  });

  if (!customer) {
    return NextResponse.json({ error: "No account found for this WhatsApp number. Please create an account." }, { status: 404 });
  }

  await logActivity({
    type: "CUSTOMER_LOGIN",
    actor: customer.mobile,
    entity: "Customer",
    entityId: customer.id,
    summary: `Customer ${customer.name} signed in with WhatsApp OTP`,
  });

  return NextResponse.json({ customer: toPublicCustomer(customer) });
}

export const POST = withApiErrorHandling(postHandler, "POST /api/customers/auth");
