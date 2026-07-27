"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  getCartSnapshot,
  getServerCartSnapshot,
  parseCartSnapshot,
  subscribeToCart,
} from "./cart-storage";

export function useStoredCart(ownerId?: string | null) {
  const snapshot = useSyncExternalStore(
    subscribeToCart,
    () => getCartSnapshot(ownerId),
    getServerCartSnapshot,
  );

  return useMemo(() => parseCartSnapshot(snapshot), [snapshot]);
}
