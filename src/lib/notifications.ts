"use client";

import { useEffect, useMemo, useState } from "react";

export type WahNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  read?: boolean;
  kind?: "account" | "order" | "offer" | "system";
};

const baseKey = "wah-thali-notifications";
const eventName = "wah-thali-notifications-updated";

function storageKey(ownerId?: string | null) {
  return ownerId ? `${baseKey}:${ownerId}` : `${baseKey}:guest`;
}

function readNotifications(ownerId?: string | null): WahNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(ownerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeNotifications(ownerId: string | null | undefined, notifications: WahNotification[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(ownerId), JSON.stringify(notifications.slice(0, 25)));
  window.dispatchEvent(new CustomEvent(eventName));
}

export function addNotification(ownerId: string | null | undefined, notification: Omit<WahNotification, "id" | "createdAt" | "read">) {
  if (typeof window === "undefined") return;
  const next: WahNotification = {
    ...notification,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
    read: false,
  };
  writeNotifications(ownerId, [next, ...readNotifications(ownerId)]);
}

export function clearNotifications(ownerId?: string | null) {
  writeNotifications(ownerId, []);
}

export function markNotificationsRead(ownerId?: string | null) {
  const current = readNotifications(ownerId);
  if (!current.some((item) => !item.read)) return;
  writeNotifications(ownerId, current.map((item) => ({ ...item, read: true })));
}

export function useNotifications(ownerId?: string | null) {
  const [items, setItems] = useState<WahNotification[]>([]);

  useEffect(() => {
    function refresh() {
      setItems(readNotifications(ownerId));
    }

    refresh();
    window.addEventListener(eventName, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(eventName, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [ownerId]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  return { items, unreadCount };
}
