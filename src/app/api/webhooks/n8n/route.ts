import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

function isValidSignature(body: string, signature: string | null) {
  const secret = process.env.N8N_SHARED_SECRET;
  if (!secret || !signature) return false;

  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-wah-signature");

  if (!isValidSignature(body, signature)) {
    return NextResponse.json({ error: "Invalid n8n signature" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    message:
      "Signed n8n webhook accepted. Production handler should enforce idempotency key and audit log writes.",
  });
}
