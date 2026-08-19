import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeMobile } from "@/lib/customer-auth";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const notificationSchema = z.object({
  mobile: z.string().min(8),
  title: z.string().min(1),
  body: z.string().min(1),
  kind: z.enum(["account", "order", "offer", "system"]).default("system"),
});

const mobileSchema = z.object({
  mobile: z.string().min(8),
});

function toNotification(event: {
  id: string;
  summary: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}) {
  const metadata = event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
    ? event.metadata as Record<string, unknown>
    : {};

  return {
    id: event.id,
    title: event.summary,
    body: typeof metadata.body === "string" ? metadata.body : "",
    kind: typeof metadata.kind === "string" ? metadata.kind : "system",
    read: Boolean(metadata.read),
    createdAt: event.createdAt.getTime(),
  };
}

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ notifications: [], configured: false }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const mobile = normalizeMobile(searchParams.get("mobile") ?? "");
  if (!mobile) return NextResponse.json({ notifications: [], configured: true });

  const notifications = await prisma.activityEvent.findMany({
    where: {
      type: "CUSTOMER_NOTIFICATION",
      actor: mobile,
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return NextResponse.json({ notifications: notifications.map(toNotification), configured: true });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const parsed = notificationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notification payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const mobile = normalizeMobile(parsed.data.mobile);
  const event = await prisma.activityEvent.create({
    data: {
      type: "CUSTOMER_NOTIFICATION",
      actor: mobile,
      entity: "Customer",
      entityId: mobile,
      summary: parsed.data.title,
      metadata: {
        body: parsed.data.body,
        kind: parsed.data.kind,
        read: false,
      },
    },
  });

  return NextResponse.json({ notification: toNotification(event) }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const parsed = mobileSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notification update", issues: parsed.error.flatten() }, { status: 400 });
  }

  const mobile = normalizeMobile(parsed.data.mobile);
  const notifications = await prisma.activityEvent.findMany({
    where: { type: "CUSTOMER_NOTIFICATION", actor: mobile },
    select: { id: true, metadata: true },
  });

  await prisma.$transaction(
    notifications.map((notification) => {
      const metadata = notification.metadata && typeof notification.metadata === "object" && !Array.isArray(notification.metadata)
        ? notification.metadata as Record<string, unknown>
        : {};

      return prisma.activityEvent.update({
        where: { id: notification.id },
        data: { metadata: { ...metadata, read: true } },
      });
    }),
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const mobile = normalizeMobile(searchParams.get("mobile") ?? "");
  if (!mobile) return NextResponse.json({ ok: true });

  await prisma.activityEvent.deleteMany({
    where: { type: "CUSTOMER_NOTIFICATION", actor: mobile },
  });

  return NextResponse.json({ ok: true });
}
