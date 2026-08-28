import { withApiErrorHandling } from "@/lib/api-error";
import { readServerEnv } from "@/lib/server-env";
import { NextResponse } from "next/server";

async function getHandler() {
  const apiKey = readServerEnv("GOOGLE_MAPS_API_KEY", ["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"]);

  return NextResponse.json({
    configured: Boolean(apiKey),
    apiKey,
  });
}

export const GET = withApiErrorHandling(getHandler, "GET /api/maps/config");
