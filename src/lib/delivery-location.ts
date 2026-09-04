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
const deliveryLocationStorageKey = "wah-thali-delivery-location-v1";

export const defaultDeliveryLocation: DeliveryLocation = {
  label: "Home",
  address: "Select delivery location",
};

let currentLocation = defaultDeliveryLocation;
let loadedForOwner: string | null = null;
let currentLocationReady = false;

function dispatchLocationChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(deliveryLocationEvent));
}

function normalizeLocation(value: unknown): DeliveryLocation | null {
  const location = value as Partial<DeliveryLocation> | null;
  if (!location?.address || location.address === defaultDeliveryLocation.address) return null;

  return {
    label: location.label || "Home",
    address: location.address,
    pinCode: location.pinCode,
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

function readStoredDeliveryLocation(): DeliveryLocation | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(deliveryLocationStorageKey);
    if (!raw) return null;
    return normalizeLocation(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeStoredDeliveryLocation(location: DeliveryLocation | null) {
  if (typeof window === "undefined") return;

  try {
    if (!location || location.address === defaultDeliveryLocation.address) {
      window.localStorage.removeItem(deliveryLocationStorageKey);
      return;
    }

    window.localStorage.setItem(deliveryLocationStorageKey, JSON.stringify(location));
  } catch {
    // Storage can be unavailable in private modes. The in-memory value still works for this visit.
  }
}

async function loadDeliveryLocation() {
  if (typeof window === "undefined") return;
  const session = readCustomerSession();
  const owner = session?.mobile ?? null;
  if (loadedForOwner === owner) {
    currentLocationReady = true;
    dispatchLocationChange();
    return;
  }
  loadedForOwner = owner;
  const storedLocation = readStoredDeliveryLocation();

  if (!owner) {
    currentLocation = storedLocation ?? defaultDeliveryLocation;
    currentLocationReady = true;
    dispatchLocationChange();
    return;
  }

  try {
    const response = await fetch("/api/customers/selected-location", { cache: "no-store" });
    const data = await response.json();
    currentLocation = normalizeLocation(data.location) ?? storedLocation ?? defaultDeliveryLocation;
    writeStoredDeliveryLocation(currentLocation);
  } catch {
    currentLocation = storedLocation ?? defaultDeliveryLocation;
  }

  currentLocationReady = true;
  dispatchLocationChange();
}

export function readDeliveryLocation(): DeliveryLocation {
  return currentLocation;
}

export function saveDeliveryLocation(location: DeliveryLocation) {
  if (typeof window === "undefined") return;

  currentLocation = location;
  currentLocationReady = true;
  writeStoredDeliveryLocation(location);
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
  return useDeliveryLocationState().location;
}

export function useDeliveryLocationState() {
  const [location, setLocation] = useState<DeliveryLocation>(currentLocation);
  const [ready, setReady] = useState(currentLocationReady);

  useEffect(() => {
    function handleChange() {
      setLocation(currentLocation);
      setReady(currentLocationReady);
    }

    const storedLocation = readStoredDeliveryLocation();
    if (storedLocation) {
      currentLocation = storedLocation;
      currentLocationReady = true;
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

  return { location, ready };
}
