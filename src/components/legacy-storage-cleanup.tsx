"use client";

import { useEffect } from "react";

const legacyExactKeys = [
  "adminAuth",
  "wah-thali-customer-session",
  "wah-thali-delivery-location",
  "wah-thali-addresses",
];

const legacyKeyPrefixes = [
  "wah-thali-cart",
  "wah-thali-notifications",
];

export function LegacyStorageCleanup() {
  useEffect(() => {
    for (const key of legacyExactKeys) {
      window.localStorage.removeItem(key);
    }

    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key && legacyKeyPrefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}:`))) {
        window.localStorage.removeItem(key);
      }
    }
  }, []);

  return null;
}
