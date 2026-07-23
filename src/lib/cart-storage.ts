import type { CartLine } from "./types";

export const cartStorageKey = "wah-thali-cart";
export const emptyCartSnapshot = "[]";

export function readStoredCart(): CartLine[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(cartStorageKey);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

export function writeStoredCart(lines: CartLine[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(cartStorageKey, JSON.stringify(lines));
  window.dispatchEvent(new Event("wah-cart-change"));
}

export function getCartSnapshot(): string {
  if (typeof window === "undefined") return emptyCartSnapshot;
  return window.localStorage.getItem(cartStorageKey) ?? emptyCartSnapshot;
}

export function getServerCartSnapshot(): string {
  return emptyCartSnapshot;
}

export function subscribeToCart(callback: () => void) {
  window.addEventListener("wah-cart-change", callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener("wah-cart-change", callback);
    window.removeEventListener("storage", callback);
  };
}

export function parseCartSnapshot(snapshot: string): CartLine[] {
  try {
    return JSON.parse(snapshot) as CartLine[];
  } catch {
    return [];
  }
}
