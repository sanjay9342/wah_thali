import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeMobile } from "@/lib/customer-auth";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const sessionCookie = "wah_thali_customer_mobile";

const sessionSchema = z.object({
  mobile: z.string().min(8),
});

const customerSelect = {
  id: true,
  name: true,
  mobile: true,
  email: true,
};

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ customer: null, configured: false }, { status: 503 });
  }

  const cookie = request.headers.get("cookie") ?? "";
  const mobile = normalizeMobile(
    cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${sessionCookie}=`))
      ?.split("=")[1] ?? "",
  );

  if (!mobile) {
    return NextResponse.json({ customer: null, configured: true });
  }

  const customer = await prisma.customer.findUnique({
    where: { mobile },
    select: customerSelect,
  });

  return NextResponse.json({ customer, configured: true });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const parsed = sessionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid session payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const mobile = normalizeMobile(parsed.data.mobile);
  const customer = await prisma.customer.findUnique({
    where: { mobile },
    select: customerSelect,
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer was not found." }, { status: 404 });
  }

  const response = NextResponse.json({ customer });
  response.cookies.set(sessionCookie, customer.mobile, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
