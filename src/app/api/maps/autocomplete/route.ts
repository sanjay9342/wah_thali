import { withApiErrorHandling } from "@/lib/api-error";
import { geocodeGoogleAddress, geocodeGooglePlaceId } from "@/lib/google-geocoding";
import { readServerEnv } from "@/lib/server-env";
import { NextResponse } from "next/server";

type PlacesAutocompleteResponse = {
  suggestions?: {
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }[];
  error?: {
    message?: string;
  };
};

function toAutocompleteResult(place: Awaited<ReturnType<typeof geocodeGoogleAddress>>[number], index: number) {
  return {
    id: place.placeId || `${place.formattedAddress}-${index}`,
    title: place.area || place.formattedAddress || "Selected location",
    subtitle: place.formattedAddress,
    pinCode: place.pinCode,
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

async function geocodeFallbackResults(input: string) {
  const results = await geocodeGoogleAddress(input);
  return results.slice(0, 5).map(toAutocompleteResult);
}

async function getHandler(request: Request) {
  const input = new URL(request.url).searchParams.get("input")?.trim() ?? "";
  const apiKey = readServerEnv("GOOGLE_MAPS_API_KEY", ["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"]);

  if (!input || input.length < 3) {
    return NextResponse.json({ results: [] });
  }
  if (!apiKey) {
    return NextResponse.json({ error: "Google Maps API key is missing." }, { status: 503 });
  }

  let response: Response;
  let data: PlacesAutocompleteResponse;
  try {
    response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text",
      },
      body: JSON.stringify({
        input,
        includedRegionCodes: ["in"],
      }),
      cache: "no-store",
    });
    data = (await response.json()) as PlacesAutocompleteResponse;
  } catch {
    return NextResponse.json({
      results: await geocodeFallbackResults(input),
      warning: "Google Places search failed. Showing geocoding results instead.",
    });
  }
  if (!response.ok) {
    return NextResponse.json({
      results: await geocodeFallbackResults(input),
      warning: data.error?.message || "Google Places search failed. Showing geocoding results instead.",
    });
  }

  const predictions = (data.suggestions ?? [])
    .map((suggestion) => suggestion.placePrediction)
    .filter((prediction): prediction is NonNullable<typeof prediction> => Boolean(prediction?.placeId))
    .slice(0, 6);
  if (!predictions.length) {
    return NextResponse.json({
      results: await geocodeFallbackResults(input),
      warning: "No Google Places suggestions found. Showing geocoding results instead.",
    });
  }

  const geocoded = await Promise.all(
    predictions.map(async (prediction, index) => {
      const place = (await geocodeGooglePlaceId(prediction.placeId ?? ""))[0];
      if (!place) return null;

      return {
        id: prediction.placeId || place.placeId || `${place.formattedAddress}-${index}`,
        title: prediction.structuredFormat?.mainText?.text || place.area || prediction.text?.text || "Selected location",
        subtitle: prediction.structuredFormat?.secondaryText?.text || place.formattedAddress || prediction.text?.text || "",
        pinCode: place.pinCode,
        latitude: place.latitude,
        longitude: place.longitude,
      };
    }),
  );

  const results = geocoded.filter(Boolean);
  if (!results.length) {
    return NextResponse.json({
      results: await geocodeFallbackResults(input),
      warning: "Google Places details were unavailable. Showing geocoding results instead.",
    });
  }

  return NextResponse.json({ results });
}

export const GET = withApiErrorHandling(getHandler, "GET /api/maps/autocomplete");
