import type { BusinessSettings } from "@/lib/types";

export type DeliveryCoverageSettings = Pick<
  BusinessSettings,
  "deliveryRadiusKm" | "kitchenLatitude" | "kitchenLongitude" | "locationRestrictionEnabled" | "serviceablePins"
>;

export type DeliveryPoint = {
  latitude?: string | number;
  longitude?: string | number;
  pinCode?: string;
};

export type DeliveryCoverageResult = {
  serviceable: boolean;
  needsLocation: boolean;
  distanceKm: number | null;
  message: string;
};

const EARTH_RADIUS_KM = 6371;

export function getDeliveryCoverage(location: DeliveryPoint, settings: DeliveryCoverageSettings): DeliveryCoverageResult {
  if (!settings.locationRestrictionEnabled) {
    return {
      serviceable: true,
      needsLocation: false,
      distanceKm: null,
      message: "Delivery is open for all locations.",
    };
  }

  const kitchenLatitude = parseCoordinate(settings.kitchenLatitude);
  const kitchenLongitude = parseCoordinate(settings.kitchenLongitude);
  const customerLatitude = parseCoordinate(location.latitude);
  const customerLongitude = parseCoordinate(location.longitude);
  const radiusKm = Number(settings.deliveryRadiusKm);

  if (kitchenLatitude === null || kitchenLongitude === null || !Number.isFinite(radiusKm) || radiusKm <= 0) {
    return {
      serviceable: false,
      needsLocation: false,
      distanceKm: null,
      message: "Delivery area is not configured yet. Please contact the restaurant before placing an order.",
    };
  }

  if (customerLatitude === null || customerLongitude === null) {
    return {
      serviceable: false,
      needsLocation: true,
      distanceKm: null,
      message: "Use current location so we can check if your address is inside our delivery radius.",
    };
  }

  const distanceKm = getDistanceKm(
    { latitude: kitchenLatitude, longitude: kitchenLongitude },
    { latitude: customerLatitude, longitude: customerLongitude },
  );

  if (distanceKm <= radiusKm) {
    return {
      serviceable: true,
      needsLocation: false,
      distanceKm,
      message: `Delivery available. Your location is ${formatDistanceKm(distanceKm)} from the kitchen.`,
    };
  }

  return {
    serviceable: false,
    needsLocation: false,
    distanceKm,
    message: `This location is not deliverable. Delivery is available within ${formatDistanceKm(radiusKm)} of the kitchen, and this location is ${formatDistanceKm(distanceKm)} away.`,
  };
}

export function getDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function formatDistanceKm(value: number) {
  if (value < 1) return `${Math.round(value * 1000)} m`;
  return `${value.toFixed(value < 10 ? 1 : 0)} km`;
}

function parseCoordinate(value: string | number | undefined) {
  if (value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
