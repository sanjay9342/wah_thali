import type { CartLine } from "./types";

export const cartStorageKey = "wah-thali-cart";
export const emptyCartSnapshot = "[]";

function getScopedCartStorageKey(ownerId?: string | null) {
  return ownerId ? `${cartStorageKey}:${ownerId}` : cartStorageKey;
}

export function readStoredCart(ownerId?: string | null): CartLine[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(getScopedCartStorageKey(ownerId));
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

export function writeStoredCart(lines: CartLine[], ownerId?: string | null) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getScopedCartStorageKey(ownerId), JSON.stringify(lines));
  window.dispatchEvent(new Event("wah-cart-change"));
}

export function getCartSnapshot(ownerId?: string | null): string {
  if (typeof window === "undefined") return emptyCartSnapshot;
  if (!ownerId) return emptyCartSnapshot;
  return window.localStorage.getItem(getScopedCartStorageKey(ownerId)) ?? emptyCartSnapshot;
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
