import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, normalizeEmail, normalizeMobile } from "@/lib/customer-auth";
import { verifyCustomerOtp } from "@/lib/customer-otp";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const profileSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().min(8),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(6).optional().or(z.literal("")),
  otp: z.string().min(4).optional(),
});

const publicCustomerSelect = {
  id: true,
  name: true,
  mobile: true,
  email: true,
  birthday: true,
  anniversary: true,
  createdAt: true,
  updatedAt: true,
  addresses: true,
  loyalty: true,
  orders: {
    orderBy: { createdAt: "desc" as const },
    take: 20,
    include: { items: true },
  },
};

function toPublicCustomer<Customer extends object>(customer: Customer) {
  const publicCustomer = { ...customer } as Customer & { passwordHash?: string | null };
  delete publicCustomer.passwordHash;
  return publicCustomer;
}

function isMissingPasswordHashColumn(error: unknown) {
  return error instanceof Error && error.message.includes("Customer.passwordHash");
}

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ customer: null, configured: false }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const mobile = normalizeMobile(searchParams.get("mobile") ?? "");
  if (!mobile) {
    return NextResponse.json({ error: "Mobile number is required." }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({
    where: { mobile },
    select: publicCustomerSelect,
  });

  return NextResponse.json({ customer: customer ? toPublicCustomer(customer) : null, configured: true });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const parsed = profileSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid customer profile", issues: parsed.error.flatten() }, { status: 400 });
  }

  const name = parsed.data.name.trim();
  const mobile = normalizeMobile(parsed.data.mobile);
  const email = parsed.data.email ? normalizeEmail(parsed.data.email) : "";
  const password = parsed.data.password?.trim();

  if (mobile.length !== 10) {
    return NextResponse.json({ error: "Please enter a valid 10 digit phone number." }, { status: 400 });
  }

  if (email) {
    const existingEmailCustomer = await prisma.customer.findUnique({
      where: { email },
      select: { mobile: true },
    });
    if (existingEmailCustomer && existingEmailCustomer.mobile !== mobile) {
      return NextResponse.json({ error: "This email is already linked to another account." }, { status: 409 });
    }
  }

  const otp = parsed.data.otp?.trim();
  if (!otp) {
    return NextResponse.json({ error: "Please verify your WhatsApp OTP before saving your profile." }, { status: 401 });
  }

  const otpResult = await verifyCustomerOtp(mobile, "signup", otp);
  if (!otpResult.ok) {
    return NextResponse.json({ error: otpResult.message }, { status: 401 });
  }

  const passwordHash = password ? await hashPassword(password) : undefined;
  const upsertCustomer = (includePassword: boolean) => prisma.customer.upsert({
    where: { mobile },
    create: {
      name,
      mobile,
      email: email || undefined,
      ...(includePassword && passwordHash ? { passwordHash } : {}),
      loyalty: { create: { points: 0, tier: "Starter" } },
    },
    update: {
      name,
      email: email || null,
      ...(includePassword && passwordHash ? { passwordHash } : {}),
    },
    select: publicCustomerSelect,
  });

  let customer: Awaited<ReturnType<typeof upsertCustomer>>;
  try {
    customer = await upsertCustomer(true);
  } catch (error) {
    if (!isMissingPasswordHashColumn(error)) throw error;
    console.error("Customer.passwordHash is missing in the database. Saving profile without password hash.", error);
    customer = await upsertCustomer(false);
  }

  await logActivity({
    type: "CUSTOMER_PROFILE_SAVED",
    actor: customer.mobile,
    entity: "Customer",
    entityId: customer.id,
    summary: `Saved customer profile for ${customer.name}`,
  });

  return NextResponse.json({ customer: toPublicCustomer(customer) });
}
