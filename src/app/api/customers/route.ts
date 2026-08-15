import { NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const customerSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().min(8),
  email: z.string().email().optional(),
});

function toPublicCustomer<Customer extends object>(customer: Customer) {
  const publicCustomer = { ...customer } as Customer & { passwordHash?: string | null };
  delete publicCustomer.passwordHash;
  return publicCustomer;
}

const publicCustomerSelect = {
  id: true,
  name: true,
  mobile: true,
  email: true,
  birthday: true,
  anniversary: true,
  createdAt: true,
  updatedAt: true,
  loyalty: true,
  orders: { orderBy: { createdAt: "desc" as const }, take: 5 },
};

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ customers: [], configured: false });
  }

  const customers = await prisma.customer.findMany({
    orderBy: { updatedAt: "desc" },
    select: publicCustomerSelect,
  });

  return NextResponse.json({ customers: customers.map(toPublicCustomer), configured: true });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const parsed = customerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid customer payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const customer = await prisma.customer.upsert({
    where: { mobile: parsed.data.mobile },
    create: {
      ...parsed.data,
      loyalty: { create: { points: 0, tier: "Starter" } },
    },
    update: parsed.data,
    select: publicCustomerSelect,
  });

  await logActivity({
    type: "CUSTOMER_SAVED",
    entity: "Customer",
    entityId: customer.id,
    summary: `Saved customer ${customer.name}`,
  });

  return NextResponse.json({ customer: toPublicCustomer(customer) }, { status: 201 });
}
