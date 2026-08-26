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

export type WahNotificationPreferences = {
  appMuted: boolean;
  whatsappMuted: boolean;
};

export const defaultWahNotificationPreferences: WahNotificationPreferences = {
  appMuted: false,
  whatsappMuted: false,
};

const eventName = "wah-thali-notifications-updated";
const preferencesEventName = "wah-thali-notification-preferences-updated";
const snapshots = new Map<string, WahNotification[]>();
const preferenceSnapshots = new Map<string, WahNotificationPreferences>();

function ownerKey(ownerId?: string | null) {
  return ownerId || "guest";
}

function dispatchNotificationsChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(eventName));
}

function dispatchPreferencesChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(preferencesEventName));
}

function getSnapshot(ownerId?: string | null) {
  return snapshots.get(ownerKey(ownerId)) ?? [];
}

function getPreferenceSnapshot(ownerId?: string | null) {
  return preferenceSnapshots.get(ownerKey(ownerId)) ?? defaultWahNotificationPreferences;
}

function setSnapshot(ownerId: string | null | undefined, notifications: WahNotification[]) {
  snapshots.set(ownerKey(ownerId), notifications.slice(0, 25));
  dispatchNotificationsChange();
}

function setPreferenceSnapshot(ownerId: string | null | undefined, preferences: WahNotificationPreferences) {
  preferenceSnapshots.set(ownerKey(ownerId), preferences);
  dispatchPreferencesChange();
  if (preferences.appMuted) setSnapshot(ownerId, []);
}

function readPreferences(value: unknown): WahNotificationPreferences {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return {
    appMuted: typeof source.appMuted === "boolean" ? source.appMuted : defaultWahNotificationPreferences.appMuted,
    whatsappMuted: typeof source.whatsappMuted === "boolean" ? source.whatsappMuted : defaultWahNotificationPreferences.whatsappMuted,
  };
}

async function loadNotificationPreferences(ownerId?: string | null) {
  if (typeof window === "undefined" || !ownerId) {
    setPreferenceSnapshot(ownerId, defaultWahNotificationPreferences);
    return defaultWahNotificationPreferences;
  }

  try {
    const response = await fetch(`/api/customers/notification-preferences?mobile=${encodeURIComponent(ownerId)}`, { cache: "no-store" });
    const data = await response.json();
    const preferences = readPreferences(data.preferences);
    setPreferenceSnapshot(ownerId, preferences);
    return preferences;
  } catch {
    setPreferenceSnapshot(ownerId, defaultWahNotificationPreferences);
    return defaultWahNotificationPreferences;
  }
}

async function loadNotifications(ownerId?: string | null) {
  if (typeof window === "undefined" || !ownerId) {
    setSnapshot(ownerId, []);
    return;
  }

  try {
    const response = await fetch(`/api/customers/notifications?mobile=${encodeURIComponent(ownerId)}`, { cache: "no-store" });
    const data = await response.json();
    if (data.preferences) setPreferenceSnapshot(ownerId, readPreferences(data.preferences));
    setSnapshot(ownerId, Array.isArray(data.notifications) ? data.notifications : []);
  } catch {
    setSnapshot(ownerId, []);
  }
}

export function addNotification(ownerId: string | null | undefined, notification: Omit<WahNotification, "id" | "createdAt" | "read">) {
  if (typeof window === "undefined" || !ownerId) return;

  void loadNotificationPreferences(ownerId).then((preferences) => {
    if (preferences.appMuted) return;

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
  });
}

export async function saveNotificationPreferences(ownerId: string, preferences: WahNotificationPreferences) {
  setPreferenceSnapshot(ownerId, preferences);
  const response = await fetch("/api/customers/notification-preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile: ownerId, ...preferences }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Could not save notification preferences.");
  const savedPreferences = readPreferences(data.preferences);
  setPreferenceSnapshot(ownerId, savedPreferences);
  return savedPreferences;
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
  const [preferences, setPreferences] = useState<WahNotificationPreferences>(() => getPreferenceSnapshot(ownerId));

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

  useEffect(() => {
    function refreshPreferences() {
      setPreferences(getPreferenceSnapshot(ownerId));
      setItems(getSnapshot(ownerId));
    }

    void loadNotificationPreferences(ownerId);
    refreshPreferences();
    window.addEventListener(preferencesEventName, refreshPreferences);
    return () => {
      window.removeEventListener(preferencesEventName, refreshPreferences);
    };
  }, [ownerId]);

  const unreadCount = useMemo(() => preferences.appMuted ? 0 : items.filter((item) => !item.read).length, [items, preferences.appMuted]);

  return { items: preferences.appMuted ? [] : items, preferences, unreadCount };
}

export function useNotificationPreferences(ownerId?: string | null) {
  const [preferences, setPreferences] = useState<WahNotificationPreferences>(() => getPreferenceSnapshot(ownerId));

  useEffect(() => {
    function refresh() {
      setPreferences(getPreferenceSnapshot(ownerId));
    }

    void loadNotificationPreferences(ownerId);
    refresh();
    window.addEventListener(preferencesEventName, refresh);
    return () => {
      window.removeEventListener(preferencesEventName, refresh);
    };
  }, [ownerId]);

  return preferences;
}
