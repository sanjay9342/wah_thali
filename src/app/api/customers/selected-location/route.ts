import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeMobile } from "@/lib/customer-auth";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const sessionCookie = "wah_thali_customer_mobile";

const locationSchema = z.object({
  mobile: z.string().min(8).optional(),
  label: z.string().min(1).default("Home"),
  address: z.string().min(1),
  pinCode: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});

function mobileFromRequest(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryMobile = normalizeMobile(searchParams.get("mobile") ?? "");
  if (queryMobile) return queryMobile;

  const cookie = request.headers.get("cookie") ?? "";
  return normalizeMobile(
    cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${sessionCookie}=`))
      ?.split("=")[1] ?? "",
  );
}

function toDeliveryLocation(address?: {
  label: string;
  line1: string;
  area: string;
  pinCode: string;
  landmark?: string | null;
} | null) {
  if (!address) return null;
  const gps = address.landmark?.match(/GPS:\s*([^,]+),\s*([^|]+)/i);
  const parts = address.area && address.area !== address.line1 ? [address.line1, address.area] : [address.line1 || address.area];

  return {
    label: address.label,
    address: parts.filter(Boolean).join(", "),
    pinCode: address.pinCode || undefined,
    latitude: gps?.[1]?.trim(),
    longitude: gps?.[2]?.trim(),
  };
}

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ location: null, configured: false }, { status: 503 });
  }

  const mobile = mobileFromRequest(request);
  if (!mobile) return NextResponse.json({ location: null, configured: true });

  const customer = await prisma.customer.findUnique({
    where: { mobile },
    select: {
      addresses: {
        orderBy: [{ isDefault: "desc" }],
        take: 1,
      },
    },
  });

  return NextResponse.json({ location: toDeliveryLocation(customer?.addresses[0]), configured: true });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const parsed = locationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid delivery location", issues: parsed.error.flatten() }, { status: 400 });
  }

  const mobile = normalizeMobile(parsed.data.mobile ?? mobileFromRequest(request));
  if (!mobile) return NextResponse.json({ saved: false });

  const customer = await prisma.customer.findUnique({ where: { mobile }, select: { id: true } });
  if (!customer) return NextResponse.json({ saved: false });

  await prisma.customerAddress.updateMany({
    where: { customerId: customer.id },
    data: { isDefault: false },
  });

  const saved = await prisma.customerAddress.create({
    data: {
      customerId: customer.id,
      label: parsed.data.label,
      line1: parsed.data.address,
      area: "",
      city: "",
      state: "",
      pinCode: parsed.data.pinCode ?? "",
      landmark: [
        parsed.data.latitude && parsed.data.longitude ? `GPS: ${parsed.data.latitude}, ${parsed.data.longitude}` : "",
      ].filter(Boolean).join(" | ") || undefined,
      isDefault: true,
    },
  });

  return NextResponse.json({ saved: true, location: toDeliveryLocation(saved) });
}
