"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  getCartSnapshot,
  getServerCartSnapshot,
  parseCartSnapshot,
  subscribeToCart,
} from "./cart-storage";

export function useStoredCart() {
  const snapshot = useSyncExternalStore(
    subscribeToCart,
    getCartSnapshot,
    getServerCartSnapshot,
  );

  return useMemo(() => parseCartSnapshot(snapshot), [snapshot]);
}
