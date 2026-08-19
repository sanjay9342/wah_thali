"use client";

import { useEffect, useState } from "react";
import { getDeliveryCoverage, type DeliveryCoverageSettings } from "@/lib/delivery-radius";
import { readCustomerSession, subscribeCustomerSession } from "@/lib/customer-session";

export type DeliveryLocation = {
  label: string;
  address: string;
  pinCode?: string;
  latitude?: string;
  longitude?: string;
};

const deliveryLocationEvent = "wah-thali-delivery-location-change";

export const defaultDeliveryLocation: DeliveryLocation = {
  label: "Home",
  address: "Select delivery location",
};

let currentLocation = defaultDeliveryLocation;
let loadedForOwner: string | null = null;

function dispatchLocationChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(deliveryLocationEvent));
}

function normalizeLocation(value: unknown): DeliveryLocation | null {
  const location = value as Partial<DeliveryLocation> | null;
  if (!location?.address) return null;

  return {
    label: location.label || "Home",
    address: location.address,
    pinCode: location.pinCode,
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

async function loadDeliveryLocation() {
  if (typeof window === "undefined") return;
  const session = readCustomerSession();
  const owner = session?.mobile ?? null;
  if (loadedForOwner === owner) return;
  loadedForOwner = owner;

  if (!owner) {
    currentLocation = defaultDeliveryLocation;
    dispatchLocationChange();
    return;
  }

  try {
    const response = await fetch("/api/customers/selected-location", { cache: "no-store" });
    const data = await response.json();
    currentLocation = normalizeLocation(data.location) ?? defaultDeliveryLocation;
  } catch {
    currentLocation = defaultDeliveryLocation;
  }

  dispatchLocationChange();
}

export function readDeliveryLocation(): DeliveryLocation {
  return currentLocation;
}

export function saveDeliveryLocation(location: DeliveryLocation) {
  if (typeof window === "undefined") return;

  currentLocation = location;
  loadedForOwner = readCustomerSession()?.mobile ?? null;
  dispatchLocationChange();

  const session = readCustomerSession();
  if (!session?.mobile) return;

  void fetch("/api/customers/selected-location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile: session.mobile, ...location }),
  }).catch(() => undefined);
}

export function extractPinCode(value: string) {
  return value.match(/\b\d{6}\b/)?.[0] ?? "";
}

export function isServiceableLocation(location: DeliveryLocation, settingsOrPins: DeliveryCoverageSettings | string[]) {
  if (Array.isArray(settingsOrPins)) return true;
  return getDeliveryCoverage(location, settingsOrPins).serviceable;
}

export function getDeliveryLocationCoverage(location: DeliveryLocation, settings: DeliveryCoverageSettings) {
  return getDeliveryCoverage(location, settings);
}

export function useDeliveryLocation() {
  const [location, setLocation] = useState<DeliveryLocation>(currentLocation);

  useEffect(() => {
    function handleChange() {
      setLocation(currentLocation);
    }

    handleChange();
    void loadDeliveryLocation();
    const unsubscribeSession = subscribeCustomerSession(() => {
      loadedForOwner = null;
      void loadDeliveryLocation();
      handleChange();
    });
    window.addEventListener(deliveryLocationEvent, handleChange);

    return () => {
      unsubscribeSession();
      window.removeEventListener(deliveryLocationEvent, handleChange);
    };
  }, []);

  return location;
}
