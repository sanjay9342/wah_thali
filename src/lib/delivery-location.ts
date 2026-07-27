"use client";

import { useEffect, useState } from "react";

export type DeliveryLocation = {
  label: string;
  address: string;
  pinCode?: string;
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
        pinCode: parsed.pinCode,
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

export function extractPinCode(value: string) {
  return value.match(/\b\d{6}\b/)?.[0] ?? "";
}

export function isServiceableLocation(location: DeliveryLocation, serviceablePins: string[]) {
  void location;
  void serviceablePins;
  return true;
}

export function useDeliveryLocation() {
  const [location, setLocation] = useState<DeliveryLocation>(defaultDeliveryLocation);

  useEffect(() => {
    function handleChange() {
      setLocation(readDeliveryLocation());
    }

    handleChange();
    window.addEventListener("storage", handleChange);
    window.addEventListener(deliveryLocationEvent, handleChange);

    return () => {
      window.removeEventListener("storage", handleChange);
      window.removeEventListener(deliveryLocationEvent, handleChange);
    };
  }, []);

  return location;
}
