export const emptyWishlistSnapshot = "[]";

const wishlistChangeEvent = "wah-wishlist-change";
const wishlistStoragePrefix = "wah-thali-wishlist-v1";
const snapshots = new Map<string, string>();
const loadedOwners = new Set<string>();

function ownerKey(ownerId?: string | null) {
  const key = ownerId?.trim();
  return key || "guest";
}

function storageKey(ownerId?: string | null) {
  return `${wishlistStoragePrefix}:${ownerKey(ownerId)}`;
}

function uniqueProductIds(productIds: string[]) {
  return Array.from(new Set(productIds.filter(Boolean)));
}

function dispatchWishlistChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(wishlistChangeEvent));
}

function setSnapshot(ownerId: string | null | undefined, productIds: string[]) {
  snapshots.set(ownerKey(ownerId), JSON.stringify(uniqueProductIds(productIds)));
  dispatchWishlistChange();
}

function readStorageSnapshot(ownerId?: string | null) {
  if (typeof window === "undefined") return emptyWishlistSnapshot;

  try {
    const raw = window.localStorage.getItem(storageKey(ownerId));
    if (!raw) return emptyWishlistSnapshot;
    return JSON.stringify(parseWishlistSnapshot(raw));
  } catch {
    return emptyWishlistSnapshot;
  }
}

export function loadStoredWishlist(ownerId?: string | null) {
  if (typeof window === "undefined") return [];

  const key = ownerKey(ownerId);
  if (loadedOwners.has(key)) return parseWishlistSnapshot(getWishlistSnapshot(ownerId));
  loadedOwners.add(key);

  const productIds = parseWishlistSnapshot(readStorageSnapshot(ownerId));
  if (ownerId) {
    const guestProductIds = parseWishlistSnapshot(readStorageSnapshot());
    const mergedProductIds = uniqueProductIds([...productIds, ...guestProductIds]);
    setSnapshot(ownerId, mergedProductIds);
    try {
      window.localStorage.setItem(storageKey(ownerId), JSON.stringify(mergedProductIds));
    } catch {
      // Wishlist still updates in memory when storage is unavailable.
    }
    return mergedProductIds;
  }

  setSnapshot(ownerId, productIds);
  return productIds;
}

export function readStoredWishlist(ownerId?: string | null) {
  return parseWishlistSnapshot(getWishlistSnapshot(ownerId));
}

export function writeStoredWishlist(productIds: string[], ownerId?: string | null) {
  const next = uniqueProductIds(productIds);
  setSnapshot(ownerId, next);

  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey(ownerId), JSON.stringify(next));
  } catch {
    // Wishlist still updates in memory when storage is unavailable.
  }
}

export function getWishlistSnapshot(ownerId?: string | null): string {
  const key = ownerKey(ownerId);
  if (snapshots.has(key)) return snapshots.get(key) ?? emptyWishlistSnapshot;
  return readStorageSnapshot(ownerId);
}

export function getServerWishlistSnapshot(): string {
  return emptyWishlistSnapshot;
}

export function subscribeToWishlist(callback: () => void) {
  window.addEventListener(wishlistChangeEvent, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(wishlistChangeEvent, callback);
    window.removeEventListener("storage", callback);
  };
}

export function parseWishlistSnapshot(snapshot: string): string[] {
  try {
    const parsed = JSON.parse(snapshot);
    return Array.isArray(parsed) ? uniqueProductIds(parsed.filter((item): item is string => typeof item === "string")) : [];
  } catch {
    return [];
  }
}
