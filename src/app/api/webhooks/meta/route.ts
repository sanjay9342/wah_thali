import { withApiErrorHandling } from "@/lib/api-error";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { handleInboundRetentionReply } from "@/lib/whatsapp-retention";

async function getHandler(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return NextResponse.json({ error: "Invalid verification token" }, { status: 403 });
}

async function postHandler(request: NextRequest) {
  const payload = await request.json();
  const eventId = getMetaEventId(payload);

  if (isDatabaseConfigured()) {
    await prisma.webhookEvent.upsert({
      where: { provider_eventId: { provider: "meta", eventId } },
      create: { provider: "meta", eventId, payload },
      update: { payload },
    });

    const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (message?.id && message?.from) {
      const messageBody = getInboundMessageText(message);
      await prisma.whatsAppMessage.upsert({
        where: { messageId: message.id },
        create: {
          messageId: message.id,
          phone: message.from,
          direction: "INBOUND",
          body: messageBody,
          status: "RECEIVED",
        },
        update: {
          body: messageBody,
          status: "RECEIVED",
        },
      });
      if (messageBody) {
        const handled = await handleInboundRetentionReply(message.from, messageBody).catch((error) => {
          console.error("WhatsApp retention inbound reply handling failed.", error);
          return { handled: false, error: error instanceof Error ? error.message : "Inbound reply handling failed." };
        });
        await logActivity({
          type: "META_WEBHOOK_MESSAGE_HANDLED",
          actor: message.from,
          entity: "WhatsAppMessage",
          entityId: message.id,
          summary: `Inbound WhatsApp message ${handled.handled ? "handled" : "stored"}`,
          metadata: { body: messageBody, handled } as never,
        });
      }
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

export const GET = withApiErrorHandling(getHandler, "GET /api/webhooks/meta");
export const POST = withApiErrorHandling(postHandler, "POST /api/webhooks/meta");

function getInboundMessageText(message: Record<string, unknown>) {
  const text = getRecord(message.text);
  const button = getRecord(message.button);
  const interactive = getRecord(message.interactive);
  const buttonReply = getRecord(interactive?.button_reply);
  const listReply = getRecord(interactive?.list_reply);

  return (
    getString(text?.body) ||
    getString(button?.text) ||
    getString(button?.payload) ||
    getString(buttonReply?.title) ||
    getString(buttonReply?.id) ||
    getString(listReply?.title) ||
    getString(listReply?.id) ||
    ""
  );
}

function getMetaEventId(payload: Record<string, unknown>) {
  const entry = getFirstRecord(payload.entry);
  const change = getFirstRecord(entry?.changes);
  const value = getRecord(change?.value);
  const message = getFirstRecord(value?.messages);
  const status = getFirstRecord(value?.statuses);
  return getString(message?.id) || getString(status?.id) || getString(entry?.id) || randomUUID();
}

function getRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function getFirstRecord(value: unknown) {
  return Array.isArray(value) ? getRecord(value[0]) : null;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}
