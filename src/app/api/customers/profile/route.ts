import { NextResponse } from "next/server";
import { z } from "zod";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const profileSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().min(8),
  email: z.string().email().optional().or(z.literal("")),
});

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ customer: null, configured: false }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const mobile = searchParams.get("mobile")?.trim();
  if (!mobile) {
    return NextResponse.json({ error: "Mobile number is required." }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({
    where: { mobile },
    include: {
      addresses: true,
      loyalty: true,
      orders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { items: true },
      },
    },
  });

  return NextResponse.json({ customer, configured: true });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const parsed = profileSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid customer profile", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { name, mobile, email } = parsed.data;
  const customer = await prisma.customer.upsert({
    where: { mobile },
    create: {
      name,
      mobile,
      email: email || undefined,
      loyalty: { create: { points: 0, tier: "Starter" } },
    },
    update: {
      name,
      email: email || null,
    },
    include: {
      addresses: true,
      loyalty: true,
      orders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { items: true },
      },
    },
  });

  return NextResponse.json({ customer });
}
