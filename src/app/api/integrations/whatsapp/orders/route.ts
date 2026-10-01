import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrorHandling } from "@/lib/api-error";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { readServerEnv } from "@/lib/server-env";

const querySchema = z.object({
  since: z.string().datetime({ offset: true }).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

function hasValidApiKey(request: Request, apiKey: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) return false;

  const provided = Buffer.from(match[1]);
  const expected = Buffer.from(apiKey);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

async function getHandler(request: Request) {
  const apiKey = readServerEnv("WHATSAPP_ORDERS_API_KEY");
  if (!apiKey) {
    return NextResponse.json({ error: "WhatsApp orders API is not configured." }, { status: 503 });
  }
  if (!hasValidApiKey(request, apiKey)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Order data is temporarily unavailable." }, { status: 503 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    since: url.searchParams.get("since") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { since, cursor, limit } = parsed.data;
  const serverTime = new Date();
  const sinceDate = since ? new Date(since) : undefined;
  const where = sinceDate
    ? {
        OR: [
          { createdAt: { gt: sinceDate } },
          { timeline: { some: { createdAt: { gt: sinceDate } } } },
        ],
      }
    : undefined;

  if (cursor) {
    const cursorExists = await prisma.order.findUnique({ where: { id: cursor }, select: { id: true } });
    if (!cursorExists) {
      return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
    }
  }

  const matches = await prisma.order.findMany({
    where,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit + 1,
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          mobile: true,
          email: true,
          birthday: true,
          anniversary: true,
          whatsappMarketingOptIn: true,
          whatsappMarketingOptOut: true,
          completedOrderCount: true,
          lastCompletedOrderAt: true,
          createdAt: true,
          updatedAt: true,
          addresses: true,
          tags: { include: { tag: { select: { name: true } } } },
        },
      },
      items: true,
      payments: {
        select: {
          id: true,
          provider: true,
          status: true,
          amount: true,
          createdAt: true,
        },
      },
      timeline: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
  });

  const hasMore = matches.length > limit;
  const orders = hasMore ? matches.slice(0, limit) : matches;

  return NextResponse.json({
    orders,
    hasMore,
    nextCursor: hasMore ? orders.at(-1)?.id ?? null : null,
    serverTime: serverTime.toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = withApiErrorHandling(getHandler, "GET /api/integrations/whatsapp/orders");