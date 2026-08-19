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

const eventName = "wah-thali-notifications-updated";
const snapshots = new Map<string, WahNotification[]>();

function ownerKey(ownerId?: string | null) {
  return ownerId || "guest";
}

function dispatchNotificationsChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(eventName));
}

function getSnapshot(ownerId?: string | null) {
  return snapshots.get(ownerKey(ownerId)) ?? [];
}

function setSnapshot(ownerId: string | null | undefined, notifications: WahNotification[]) {
  snapshots.set(ownerKey(ownerId), notifications.slice(0, 25));
  dispatchNotificationsChange();
}

async function loadNotifications(ownerId?: string | null) {
  if (typeof window === "undefined" || !ownerId) {
    setSnapshot(ownerId, []);
    return;
  }

  try {
    const response = await fetch(`/api/customers/notifications?mobile=${encodeURIComponent(ownerId)}`, { cache: "no-store" });
    const data = await response.json();
    setSnapshot(ownerId, Array.isArray(data.notifications) ? data.notifications : []);
  } catch {
    setSnapshot(ownerId, []);
  }
}

export function addNotification(ownerId: string | null | undefined, notification: Omit<WahNotification, "id" | "createdAt" | "read">) {
  if (typeof window === "undefined" || !ownerId) return;

  const optimistic: WahNotification = {
    ...notification,
    id: `pending-${Date.now()}`,
    createdAt: Date.now(),
    read: false,
  };
  setSnapshot(ownerId, [optimistic, ...getSnapshot(ownerId)]);

  void fetch("/api/customers/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile: ownerId, ...notification }),
  })
    .then(() => loadNotifications(ownerId))
    .catch(() => undefined);
}

export function clearNotifications(ownerId?: string | null) {
  setSnapshot(ownerId, []);
  if (!ownerId) return;
  void fetch(`/api/customers/notifications?mobile=${encodeURIComponent(ownerId)}`, { method: "DELETE" }).catch(() => undefined);
}

export function markNotificationsRead(ownerId?: string | null) {
  const current = getSnapshot(ownerId);
  if (!current.some((item) => !item.read)) return;
  setSnapshot(ownerId, current.map((item) => ({ ...item, read: true })));
  if (!ownerId) return;
  void fetch("/api/customers/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile: ownerId }),
  }).catch(() => undefined);
}

export function useNotifications(ownerId?: string | null) {
  const [items, setItems] = useState<WahNotification[]>(() => getSnapshot(ownerId));

  useEffect(() => {
    function refresh() {
      setItems(getSnapshot(ownerId));
    }

    void loadNotifications(ownerId);
    refresh();
    window.addEventListener(eventName, refresh);
    return () => {
      window.removeEventListener(eventName, refresh);
    };
  }, [ownerId]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  return { items, unreadCount };
}
