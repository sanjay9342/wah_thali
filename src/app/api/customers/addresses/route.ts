import { withApiErrorHandling } from "@/lib/api-error";
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

function normalizeAddressText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function getAddressGps(landmark?: string | null) {
  const gps = landmark?.match(/GPS:\s*([^,]+),\s*([^|]+)/i);
  return gps ? { latitude: gps[1].trim(), longitude: gps[2].trim() } : null;
}

function sameCoordinates(first?: string | null, second?: string | null) {
  if (!first || !second) return false;
  return Math.abs(Number(first) - Number(second)) < 0.00015;
}

function getAddressScore(address: { line1: string; area: string; pinCode?: string; landmark?: string | null }) {
  return [
    address.area ? 4 : 0,
    address.pinCode ? 2 : 0,
    getAddressGps(address.landmark) ? 2 : 0,
    address.landmark?.includes("Receiver:") ? 2 : 0,
    address.line1.length > address.area.length ? 1 : 0,
  ].reduce((total, score) => total + score, 0);
}

function dedupeAddresses<T extends { line1: string; area: string; pinCode?: string; landmark?: string | null }>(addresses: T[]) {
  return addresses.reduce<T[]>((unique, item) => {
    const itemGps = getAddressGps(item.landmark);
    const itemLine = normalizeAddressText(item.line1);
    const itemArea = normalizeAddressText(item.area);
    const duplicateIndex = unique.findIndex((existing) => {
      const existingGps = getAddressGps(existing.landmark);
      const gpsMatch = itemGps && existingGps
        ? sameCoordinates(itemGps.latitude, existingGps.latitude) && sameCoordinates(itemGps.longitude, existingGps.longitude)
        : false;
      const existingLine = normalizeAddressText(existing.line1);
      const existingArea = normalizeAddressText(existing.area);
      const textMatch =
        itemLine === existingLine && itemArea === existingArea ||
        Boolean(itemArea && existingArea && itemArea === existingArea) ||
        Boolean(itemLine && existingLine && (itemLine.includes(existingLine) || existingLine.includes(itemLine))) ||
        Boolean(itemArea && existingLine.includes(itemArea)) ||
        Boolean(existingArea && itemLine.includes(existingArea));
      return gpsMatch || textMatch;
    });

    if (duplicateIndex === -1) {
      unique.push(item);
    } else if (getAddressScore(item) > getAddressScore(unique[duplicateIndex])) {
      unique[duplicateIndex] = item;
    }
    return unique;
  }, []);
}

async function getHandler(request: Request) {
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

  return NextResponse.json({ addresses: dedupeAddresses(customer?.addresses ?? []), configured: true });
}

async function postHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const parsed = addressSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid address payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { mobile, ...address } = parsed.data;
  const customer = await prisma.customer.findUnique({
    where: { mobile },
    select: {
      id: true,
      addresses: true,
    },
  });
  if (!customer) {
    return NextResponse.json({ error: "Login first to save this address to your profile." }, { status: 404 });
  }

  if (address.isDefault) {
    await prisma.customerAddress.updateMany({
      where: { customerId: customer.id },
      data: { isDefault: false },
    });
  }

  const incomingGps = getAddressGps(address.landmark);
  const incomingLine = normalizeAddressText(address.line1);
  const incomingArea = normalizeAddressText(address.area);
  const existing = customer.addresses.find((item) => {
    const existingGps = getAddressGps(item.landmark);
    const gpsMatch = incomingGps && existingGps
      ? sameCoordinates(incomingGps.latitude, existingGps.latitude) && sameCoordinates(incomingGps.longitude, existingGps.longitude)
      : false;
    const existingLine = normalizeAddressText(item.line1);
    const existingArea = normalizeAddressText(item.area);
    const textMatch =
      existingLine === incomingLine && existingArea === incomingArea ||
      Boolean(incomingArea && existingArea && incomingArea === existingArea) ||
      Boolean(incomingLine && existingLine && (incomingLine.includes(existingLine) || existingLine.includes(incomingLine)));
    return gpsMatch || textMatch;
  });

  const saved = existing
    ? await prisma.customerAddress.update({
        where: { id: existing.id },
        data: address,
      })
    : await prisma.customerAddress.create({
        data: {
          ...address,
          customerId: customer.id,
        },
      });

  return NextResponse.json({ address: saved }, { status: existing ? 200 : 201 });
}

async function deleteHandler(request: Request) {
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

export const GET = withApiErrorHandling(getHandler, "GET /api/customers/addresses");
export const POST = withApiErrorHandling(postHandler, "POST /api/customers/addresses");
export const DELETE = withApiErrorHandling(deleteHandler, "DELETE /api/customers/addresses");
