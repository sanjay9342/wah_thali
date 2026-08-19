import type { CartLine } from "./types";

export const emptyCartSnapshot = "[]";

const cartChangeEvent = "wah-cart-change";
const snapshots = new Map<string, string>();
const loadedOwners = new Set<string>();

function ownerKey(ownerId?: string | null) {
  return ownerId || "guest";
}

function dispatchCartChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(cartChangeEvent));
}

function setSnapshot(ownerId: string | null | undefined, lines: CartLine[]) {
  snapshots.set(ownerKey(ownerId), JSON.stringify(lines));
  dispatchCartChange();
}

export async function loadStoredCart(ownerId?: string | null) {
  if (typeof window === "undefined" || !ownerId) {
    setSnapshot(ownerId, []);
    return [];
  }

  const key = ownerKey(ownerId);
  if (loadedOwners.has(key)) return parseCartSnapshot(getCartSnapshot(ownerId));
  loadedOwners.add(key);

  try {
    const response = await fetch(`/api/cart?mobile=${encodeURIComponent(ownerId)}`, { cache: "no-store" });
    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items as CartLine[] : [];
    setSnapshot(ownerId, items);
    return items;
  } catch {
    setSnapshot(ownerId, []);
    return [];
  }
}

export function readStoredCart(ownerId?: string | null): CartLine[] {
  return parseCartSnapshot(getCartSnapshot(ownerId));
}

export function writeStoredCart(lines: CartLine[], ownerId?: string | null) {
  setSnapshot(ownerId, lines);

  if (typeof window === "undefined" || !ownerId) return;

  void fetch("/api/cart", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile: ownerId, items: lines }),
  }).catch(() => undefined);
}

export function getCartSnapshot(ownerId?: string | null): string {
  if (!ownerId) return snapshots.get(ownerKey(ownerId)) ?? emptyCartSnapshot;
  return snapshots.get(ownerKey(ownerId)) ?? emptyCartSnapshot;
}

export function getServerCartSnapshot(): string {
  return emptyCartSnapshot;
}

export function subscribeToCart(callback: () => void) {
  window.addEventListener(cartChangeEvent, callback);

  return () => {
    window.removeEventListener(cartChangeEvent, callback);
  };
}

export function parseCartSnapshot(snapshot: string): CartLine[] {
  try {
    const parsed = JSON.parse(snapshot);
    return Array.isArray(parsed) ? parsed as CartLine[] : [];
  } catch {
    return [];
  }
}
