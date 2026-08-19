"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  getCartSnapshot,
  getServerCartSnapshot,
  loadStoredCart,
  parseCartSnapshot,
  subscribeToCart,
} from "./cart-storage";

export function useStoredCart(ownerId?: string | null) {
  useEffect(() => {
    void loadStoredCart(ownerId);
  }, [ownerId]);

  const snapshot = useSyncExternalStore(
    subscribeToCart,
    () => getCartSnapshot(ownerId),
    getServerCartSnapshot,
  );

  return useMemo(() => parseCartSnapshot(snapshot), [snapshot]);
}
