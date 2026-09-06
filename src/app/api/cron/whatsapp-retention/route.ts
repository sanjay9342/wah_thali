import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/api-error";
import { readServerEnv } from "@/lib/server-env";
import { isDatabaseConfigured } from "@/lib/prisma";
import { processDueRetentionMessages, scheduleDormantRetention } from "@/lib/whatsapp-retention";

function isAuthorized(request: NextRequest) {
  const secret = readServerEnv("CRON_SECRET") || readServerEnv("N8N_SHARED_SECRET");
  if (!secret) return false;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const headerSecret = request.headers.get("x-cron-secret")?.trim();
  const querySecret = request.nextUrl.searchParams.get("secret")?.trim();
  return bearer === secret || headerSecret === secret || querySecret === secret;
}

async function runHandler(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Invalid cron secret" }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  const action = request.nextUrl.searchParams.get("action") ?? "process_due";

  if (action === "schedule_dormant") {
    const dormant = await scheduleDormantRetention();
    return NextResponse.json({ ok: true, action, dormant });
  }

  if (action === "all") {
    const dormant = await scheduleDormantRetention();
    const due = await processDueRetentionMessages();
    return NextResponse.json({ ok: true, action, dormant, due });
  }

  const due = await processDueRetentionMessages();
  return NextResponse.json({ ok: true, action: "process_due", due });
}

export const GET = withApiErrorHandling(runHandler, "GET /api/cron/whatsapp-retention");
export const POST = withApiErrorHandling(runHandler, "POST /api/cron/whatsapp-retention");
