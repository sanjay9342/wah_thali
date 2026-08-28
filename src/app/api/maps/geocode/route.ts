import { withApiErrorHandling } from "@/lib/api-error";
import { geocodeGoogleAddress } from "@/lib/google-geocoding";
import { NextResponse } from "next/server";

async function getHandler(request: Request) {
  const address = new URL(request.url).searchParams.get("address")?.trim() ?? "";

  if (!address) {
    return NextResponse.json({ error: "Address is required." }, { status: 400 });
  }

  const results = await geocodeGoogleAddress(address);
  return NextResponse.json({ result: results[0] ?? null, results });
}

export const GET = withApiErrorHandling(getHandler, "GET /api/maps/geocode");
