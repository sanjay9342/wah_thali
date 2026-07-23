import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return NextResponse.json({ error: "Invalid verification token" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const payload = await request.json();

  return NextResponse.json({
    ok: true,
    received: true,
    message:
      "Meta event accepted in test mode. Production should persist WebhookEvent and WhatsAppMessage with idempotency.",
    eventId: payload.entry?.[0]?.id ?? "unknown",
  });
}
