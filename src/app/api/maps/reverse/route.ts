import { withApiErrorHandling } from "@/lib/api-error";
import { reverseGeocodeGoogleCoordinates } from "@/lib/google-geocoding";
import { NextResponse } from "next/server";

async function getHandler(request: Request) {
  const url = new URL(request.url);
  const latitude = url.searchParams.get("lat")?.trim() ?? "";
  const longitude = url.searchParams.get("lng")?.trim() ?? "";

  if (!latitude || !longitude) {
    return NextResponse.json({ error: "Latitude and longitude are required." }, { status: 400 });
  }
  const numericLatitude = Number(latitude);
  const numericLongitude = Number(longitude);
  if (
    !Number.isFinite(numericLatitude) ||
    !Number.isFinite(numericLongitude) ||
    Math.abs(numericLatitude) > 90 ||
    Math.abs(numericLongitude) > 180
  ) {
    return NextResponse.json({ error: "Latitude or longitude is invalid." }, { status: 400 });
  }

  const results = await reverseGeocodeGoogleCoordinates(latitude, longitude);
  return NextResponse.json({ result: results[0] ?? null, results });
}

export const GET = withApiErrorHandling(getHandler, "GET /api/maps/reverse");
