import "server-only";

import { readServerEnv } from "@/lib/server-env";

type GoogleGeocodeApiResult = {
  place_id?: string;
  formatted_address?: string;
  address_components?: { long_name: string; types: string[] }[];
  geometry?: {
    location?: { lat: number; lng: number };
  };
};

type GoogleGeocodeApiResponse = {
  results?: GoogleGeocodeApiResult[];
  status?: string;
  error_message?: string;
};

export type GoogleGeocodeResult = {
  placeId: string;
  formattedAddress: string;
  area: string;
  pinCode: string;
  latitude: string;
  longitude: string;
};

export async function geocodeGoogleAddress(address: string) {
  return fetchGoogleGeocode(new URLSearchParams({
    address,
    components: "country:IN",
    region: "in",
  }));
}

export async function geocodeGooglePlaceId(placeId: string) {
  return fetchGoogleGeocode(new URLSearchParams({
    place_id: placeId,
    region: "in",
  }));
}

export async function reverseGeocodeGoogleCoordinates(latitude: string, longitude: string) {
  return fetchGoogleGeocode(new URLSearchParams({
    latlng: `${latitude},${longitude}`,
    region: "in",
  }));
}

async function fetchGoogleGeocode(params: URLSearchParams) {
  const apiKey = readServerEnv("GOOGLE_MAPS_API_KEY", ["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"]);
  if (!apiKey) throw new Error("Google Maps API key is missing.");

  params.set("key", apiKey);
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`, {
    cache: "no-store",
  });
  const data = (await response.json()) as GoogleGeocodeApiResponse;
  if (!response.ok || (data.status && !["OK", "ZERO_RESULTS"].includes(data.status))) {
    throw new Error(data.error_message || "Google Maps geocoding request failed.");
  }

  return (data.results ?? []).map(toGoogleGeocodeResult).filter((item): item is GoogleGeocodeResult => Boolean(item));
}

function toGoogleGeocodeResult(result: GoogleGeocodeApiResult) {
  const latitude = result.geometry?.location?.lat;
  const longitude = result.geometry?.location?.lng;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const formattedAddress = result.formatted_address ?? "";
  return {
    placeId: result.place_id ?? formattedAddress,
    formattedAddress,
    area: getArea(result, formattedAddress || "Selected location"),
    pinCode: getAddressComponent(result, ["postal_code"]),
    latitude: Number(latitude).toFixed(6),
    longitude: Number(longitude).toFixed(6),
  };
}

function getAddressComponent(result: GoogleGeocodeApiResult, types: string[]) {
  return result.address_components?.find((component) => types.some((type) => component.types.includes(type)))?.long_name ?? "";
}

function getArea(result: GoogleGeocodeApiResult, fallback: string) {
  return [
    getAddressComponent(result, ["sublocality_level_1", "sublocality", "neighborhood"]),
    getAddressComponent(result, ["locality", "postal_town"]),
    getAddressComponent(result, ["administrative_area_level_1"]),
  ].filter(Boolean).slice(0, 3).join(", ") || fallback;
}
