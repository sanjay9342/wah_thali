import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeMobile } from "@/lib/customer-auth";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const addressSchema = z.object({
  mobile: z.string().min(8),
  label: z.string().min(1).default("Home"),
  line1: z.string().min(1),
  area: z.string().min(1),
  city: z.string().default(""),
  state: z.string().default(""),
  pinCode: z.string().default(""),
  landmark: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ addresses: [], configured: false }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const mobile = normalizeMobile(searchParams.get("mobile") ?? "");
  if (!mobile) return NextResponse.json({ addresses: [], configured: true });

  const customer = await prisma.customer.findUnique({
    where: { mobile },
    select: {
      addresses: {
        orderBy: [{ isDefault: "desc" }],
      },
    },
  });

  return NextResponse.json({ addresses: customer?.addresses ?? [], configured: true });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const parsed = addressSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid address payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { mobile, ...address } = parsed.data;
  const customer = await prisma.customer.findUnique({ where: { mobile }, select: { id: true } });
  if (!customer) {
    return NextResponse.json({ error: "Login first to save this address to your profile." }, { status: 404 });
  }

  if (address.isDefault) {
    await prisma.customerAddress.updateMany({
      where: { customerId: customer.id },
      data: { isDefault: false },
    });
  }

  const saved = await prisma.customerAddress.create({
    data: {
      ...address,
      customerId: customer.id,
    },
  });

  return NextResponse.json({ address: saved }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const mobile = normalizeMobile(searchParams.get("mobile") ?? "");
  const id = searchParams.get("id") ?? "";
  if (!mobile || !id) return NextResponse.json({ error: "Mobile and address id are required." }, { status: 400 });

  const customer = await prisma.customer.findUnique({ where: { mobile }, select: { id: true } });
  if (!customer) return NextResponse.json({ error: "Customer was not found." }, { status: 404 });

  await prisma.customerAddress.deleteMany({
    where: { id, customerId: customer.id },
  });

  return NextResponse.json({ ok: true });
}
