import { NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/db";
import { normalizeEmail, normalizeMobile, verifyPassword } from "@/lib/customer-auth";
import { verifyCustomerOtp } from "@/lib/customer-otp";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

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

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const parsed = authSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid login details", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.method === "password") {
    const email = normalizeEmail(parsed.data.email);
    const customer = await prisma.customer.findUnique({
      where: { email },
      select: passwordCustomerSelect,
    }).catch((error) => {
      console.error("Password login failed while reading customer password hash.", error);
      return null;
    });

    const validPassword = await verifyPassword(parsed.data.password, customer?.passwordHash);
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
