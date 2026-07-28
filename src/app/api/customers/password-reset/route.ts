import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeEmail } from "@/lib/customer-auth";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const resetSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const parsed = resetSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const customer = await prisma.customer.findUnique({ where: { email } });

  if (customer) {
    await logActivity({
      type: "CUSTOMER_PASSWORD_RESET_REQUESTED",
      actor: customer.mobile,
      entity: "Customer",
      entityId: customer.id,
      summary: `Password reset requested for ${customer.name}`,
      metadata: { email },
    });
  }

  return NextResponse.json({
    message: "If that email is registered, a password reset request has been recorded.",
  });
}

