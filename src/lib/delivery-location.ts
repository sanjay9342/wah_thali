"use client";

import { useEffect, useState } from "react";

export type DeliveryLocation = {
  label: string;
  address: string;
  latitude?: string;
  longitude?: string;
};

export const deliveryLocationStorageKey = "wah-thali-delivery-location";
const deliveryLocationEvent = "wah-thali-delivery-location-change";

export const defaultDeliveryLocation: DeliveryLocation = {
  label: "Home",
  address: "Select delivery location",
};

function readDeliveryLocation(): DeliveryLocation {
  if (typeof window === "undefined") return defaultDeliveryLocation;

  try {
    const raw = window.localStorage.getItem(deliveryLocationStorageKey);
    const parsed = raw ? JSON.parse(raw) as Partial<DeliveryLocation> : null;
    if (parsed?.address) {
      return {
        label: parsed.label || "Home",
        address: parsed.address,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
      };
    }
  } catch {
    return defaultDeliveryLocation;
  }

  return defaultDeliveryLocation;
}

export function saveDeliveryLocation(location: DeliveryLocation) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(deliveryLocationStorageKey, JSON.stringify(location));
  window.dispatchEvent(new Event(deliveryLocationEvent));
}

export function useDeliveryLocation() {
  const [location, setLocation] = useState<DeliveryLocation>(() => readDeliveryLocation());

  useEffect(() => {
    function handleChange() {
      setLocation(readDeliveryLocation());
    }

    window.addEventListener("storage", handleChange);
    window.addEventListener(deliveryLocationEvent, handleChange);

    return () => {
      window.removeEventListener("storage", handleChange);
      window.removeEventListener(deliveryLocationEvent, handleChange);
    };
  }, []);

  return location;
}
