"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  getServerWishlistSnapshot,
  getWishlistSnapshot,
  loadStoredWishlist,
  parseWishlistSnapshot,
  subscribeToWishlist,
} from "@/lib/wishlist-storage";

export function useStoredWishlist(ownerId?: string | null) {
  useEffect(() => {
    loadStoredWishlist(ownerId);
  }, [ownerId]);

  const snapshot = useSyncExternalStore(
    subscribeToWishlist,
    () => getWishlistSnapshot(ownerId),
    getServerWishlistSnapshot,
  );

  return useMemo(() => parseWishlistSnapshot(snapshot), [snapshot]);
}
