"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellOff, CheckCircle2, LoaderCircle, Send, Smartphone, XCircle } from "lucide-react";
import { useAdminAccess } from "@/components/admin-access-gate";
import { adminFetch } from "@/lib/admin-client-auth";

type Recipient = {
  staffMobile: string;
  staffName: string;
  role: string;
  active: boolean;
  enabled: boolean;
  deviceCount: number;
};

type PushSettingsResponse = {
  pushConfigured?: boolean;
  vapidPublicKey?: string;
  currentStaff?: {
    staffMobile?: string;
    staffName?: string;
    role?: string;
  };
  canManageRecipients?: boolean;
  recipients?: Recipient[];
  error?: string;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }
  return outputArray;
}

function getSupportStatus() {
  if (typeof window === "undefined") return "checking";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export function AdminPushNotificationSettings({ onMessage }: { onMessage: (message: string) => void }) {
  const adminAccess = useAdminAccess();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(getSupportStatus);
  const [deviceRegistered, setDeviceRegistered] = useState(false);
  const [data, setData] = useState<PushSettingsResponse>({});

  const currentRecipient = useMemo(() => {
    const staffMobile = data.currentStaff?.staffMobile;
    return data.recipients?.find((item) => item.staffMobile === staffMobile);
  }, [data.currentStaff?.staffMobile, data.recipients]);

  const supported = permissionStatus !== "unsupported" && permissionStatus !== "checking";
  const canRegister = supported && data.pushConfigured && permissionStatus !== "denied";

  const getSubscription = useCallback(async () => {
    if (!supported) return null;
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    return registration.pushManager.getSubscription();
  }, [supported]);

  const refreshCurrentDeviceStatus = useCallback(async () => {
    if (!adminAccess?.session || !supported) return;
    const subscription = await getSubscription().catch(() => null);
    if (!subscription) {
      setDeviceRegistered(false);
      return;
    }
    const response = await adminFetch(adminAccess.session, "/api/admin/push-notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "device-status", endpoint: subscription.endpoint }),
    }).catch(() => null);
    if (!response) return;
    const payload = await response.json().catch(() => ({}));
    setDeviceRegistered(Boolean(payload.registered));
  }, [adminAccess, getSubscription, supported]);

  const loadSettings = useCallback(async () => {
    if (!adminAccess?.session) return;
    setLoading(true);
    try {
      const response = await adminFetch(adminAccess.session, "/api/admin/push-notifications", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Notification settings could not be loaded.");
      setData(payload);
      await refreshCurrentDeviceStatus();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Notification settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [adminAccess, onMessage, refreshCurrentDeviceStatus]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSettings();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSettings]);

  async function enableCurrentDevice() {
    if (!adminAccess?.session || !canRegister || saving) return;
    setSaving(true);
    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      if (permission !== "granted") {
        onMessage(permission === "denied" ? "Notification permission is blocked for this browser." : "Notification permission was not granted.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.vapidPublicKey ?? ""),
      });

      const response = await adminFetch(adminAccess.session, "/api/admin/push-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register-device",
          subscription: JSON.parse(JSON.stringify(subscription)),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not enable notifications for this device.");

      setDeviceRegistered(true);
      setData((current) => ({ ...current, recipients: payload.recipients ?? current.recipients }));
      onMessage("Push notifications enabled for this device.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not enable push notifications.");
    } finally {
      setSaving(false);
    }
  }

  async function disableCurrentDevice() {
    if (!adminAccess?.session || !supported || saving) return;
    setSaving(true);
    try {
      const subscription = await getSubscription();
      if (subscription) {
        await adminFetch(adminAccess.session, "/api/admin/push-notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "disable-device", endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe().catch(() => undefined);
      }
      setDeviceRegistered(false);
      await loadSettings();
      onMessage("Push notifications disabled for this device.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not disable this device.");
    } finally {
      setSaving(false);
    }
  }

  async function updateRecipient(recipient: Recipient, enabled: boolean) {
    if (!adminAccess?.session || saving) return;
    setSaving(true);
    try {
      const response = await adminFetch(adminAccess.session, "/api/admin/push-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-recipient", staffMobile: recipient.staffMobile, enabled }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not update staff notification setting.");
      setData((current) => ({ ...current, recipients: payload.recipients ?? current.recipients }));
      onMessage(`${recipient.staffName} ${enabled ? "will receive" : "will not receive"} new-order push notifications.`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not update staff notification setting.");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!adminAccess?.session || testing) return;
    setTesting(true);
    try {
      const response = await adminFetch(adminAccess.session, "/api/admin/push-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send-test" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Test notification failed.");
      onMessage(payload.sent ? "Test notification sent to this staff account." : "No registered device was found for your staff account.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Test notification failed.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-xl border border-[#eadfe3] bg-white p-3">
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${deviceRegistered ? "bg-[#effaf4] text-[#0f7a45]" : "bg-[#fff4f5] text-maroon"}`}>
          <Smartphone size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-charcoal">Web push notifications</p>
          <p className="mt-1 text-xs font-bold leading-5 text-muted">
            {loading
              ? "Checking browser and device status..."
              : !data.pushConfigured
                ? "Add VAPID keys before enabling background push."
                : permissionStatus === "denied"
                  ? "Permission is blocked in this browser. Change site settings to allow notifications."
                  : deviceRegistered
                    ? "This browser is registered for background order alerts."
                    : "Enable this browser after signing in as the staff account that should receive alerts."}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <StatusPill label="Browser" value={supported ? permissionStatus : "unsupported"} good={permissionStatus === "granted"} />
        <StatusPill label="Device" value={deviceRegistered ? "registered" : "not registered"} good={deviceRegistered} />
        <StatusPill label="Staff" value={currentRecipient?.enabled ? "enabled" : "off"} good={Boolean(currentRecipient?.enabled)} />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <button type="button" onClick={enableCurrentDevice} disabled={!canRegister || saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-maroon px-3 text-xs font-black text-white disabled:opacity-50">
          {saving ? <LoaderCircle size={15} className="motion-safe:animate-spin" /> : <Bell size={15} />} Enable
        </button>
        <button type="button" onClick={disableCurrentDevice} disabled={!supported || !deviceRegistered || saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-black text-maroon disabled:opacity-50">
          <BellOff size={15} /> Disable device
        </button>
        <button type="button" onClick={sendTest} disabled={!deviceRegistered || testing} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red px-3 text-xs font-black text-white disabled:opacity-50">
          {testing ? <LoaderCircle size={15} className="motion-safe:animate-spin" /> : <Send size={15} />} Send test
        </button>
      </div>

      <p className="text-[11px] font-bold leading-5 text-muted">
        Background notifications use the operating system notification sound. The selected Wah Thali order sound still plays inside the open admin page when the browser permits audio.
      </p>

      <div className="grid gap-2">
        <p className="text-sm font-black text-charcoal">Staff recipients</p>
        {(data.recipients ?? []).length ? (data.recipients ?? []).map((recipient) => (
          <div key={recipient.staffMobile} className="grid gap-2 rounded-lg border border-[#edf0f5] bg-[#fffdfb] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-charcoal">{recipient.staffName}</p>
              <p className="text-xs font-bold text-muted">{recipient.role} | {recipient.deviceCount} device{recipient.deviceCount === 1 ? "" : "s"} | {recipient.active ? "Active" : "Inactive"}</p>
            </div>
            <button
              type="button"
              disabled={!data.canManageRecipients || saving || !recipient.active}
              onClick={() => updateRecipient(recipient, !recipient.enabled)}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black disabled:opacity-50 ${
                recipient.enabled ? "bg-[#effaf4] text-[#0f7a45]" : "border border-border bg-white text-maroon"
              }`}
            >
              {recipient.enabled ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
              {recipient.enabled ? "Enabled" : "Disabled"}
            </button>
          </div>
        )) : (
          <p className="rounded-lg border border-border bg-cream px-3 py-2 text-xs font-bold text-muted">
            No staff assignments found yet. Add staff from Staff Access first.
          </p>
        )}
      </div>
    </div>
  );
}

function StatusPill({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${good ? "bg-[#effaf4] text-[#0f7a45]" : "bg-cream text-muted"}`}>
      <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
      <p className="mt-0.5 truncate text-xs font-black">{value}</p>
    </div>
  );
}
