import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, normalizeEmail, normalizeMobile } from "@/lib/customer-auth";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const profileSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().min(8),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(6).optional().or(z.literal("")),
});

const customerInclude = {
  addresses: true,
  loyalty: true,
  orders: {
    orderBy: { createdAt: "desc" as const },
    take: 20,
    include: { items: true },
  },
};

function toPublicCustomer<Customer extends { passwordHash?: string | null }>(customer: Customer) {
  const publicCustomer = { ...customer };
  delete publicCustomer.passwordHash;
  return publicCustomer;
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
    include: customerInclude,
  });

  return NextResponse.json({ customer: customer ? toPublicCustomer(customer) : null, configured: true });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
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
    const existingEmailCustomer = await prisma.customer.findUnique({ where: { email } });
    if (existingEmailCustomer && existingEmailCustomer.mobile !== mobile) {
      return NextResponse.json({ error: "This email is already linked to another account." }, { status: 409 });
    }
  }

  const passwordHash = password ? await hashPassword(password) : undefined;
  const customer = await prisma.customer.upsert({
    where: { mobile },
    create: {
      name,
      mobile,
      email: email || undefined,
      passwordHash,
      loyalty: { create: { points: 0, tier: "Starter" } },
    },
    update: {
      name,
      email: email || null,
      ...(passwordHash ? { passwordHash } : {}),
    },
    include: customerInclude,
  });

  await logActivity({
    type: "CUSTOMER_PROFILE_SAVED",
    actor: customer.mobile,
    entity: "Customer",
    entityId: customer.id,
    summary: `Saved customer profile for ${customer.name}`,
  });

  return NextResponse.json({ customer: toPublicCustomer(customer) });
}
