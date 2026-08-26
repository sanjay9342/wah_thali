import { withApiErrorHandling } from "@/lib/api-error";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

function isValidSignature(body: string, signature: string | null) {
  const secret = process.env.N8N_SHARED_SECRET;
  if (!secret || !signature) return false;

  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

async function postHandler(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-wah-signature");
  const idempotencyKey = request.headers.get("x-idempotency-key") ?? randomUUID();

  if (!isValidSignature(body, signature)) {
    return NextResponse.json({ error: "Invalid n8n signature" }, { status: 401 });
  }

  if (isDatabaseConfigured()) {
    await prisma.idempotencyKey.upsert({
      where: { key: idempotencyKey },
      create: { key: idempotencyKey, scope: "n8n-webhook", response: { accepted: true } },
      update: { response: { accepted: true } },
    });
  }

  await logActivity({
    type: "N8N_WEBHOOK_RECEIVED",
    entity: "WebhookEvent",
    entityId: idempotencyKey,
    summary: "Signed n8n webhook accepted",
  });

  return NextResponse.json({
    ok: true,
    idempotencyKey,
  });
}

export const POST = withApiErrorHandling(postHandler, "POST /api/webhooks/n8n");
