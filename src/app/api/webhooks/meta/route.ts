import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

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
  const eventId = payload.entry?.[0]?.id ?? randomUUID();

  if (isDatabaseConfigured()) {
    await prisma.webhookEvent.upsert({
      where: { provider_eventId: { provider: "meta", eventId } },
      create: { provider: "meta", eventId, payload },
      update: { payload },
    });

    const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (message?.id && message?.from) {
      await prisma.whatsAppMessage.upsert({
        where: { messageId: message.id },
        create: {
          messageId: message.id,
          phone: message.from,
          direction: "INBOUND",
          body: message.text?.body,
          status: "RECEIVED",
        },
        update: {
          body: message.text?.body,
          status: "RECEIVED",
        },
      });
    }
  }

  await logActivity({
    type: "META_WEBHOOK_RECEIVED",
    entity: "WebhookEvent",
    entityId: eventId,
    summary: "Meta WhatsApp webhook received",
  });

  return NextResponse.json({
    ok: true,
    received: true,
    eventId,
  });
}
