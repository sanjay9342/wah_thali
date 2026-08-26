"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Bell, BellOff, CheckCheck, MessageCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { readCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";
import {
  clearNotifications,
  markNotificationsRead,
  saveNotificationPreferences,
  useNotifications,
  type WahNotificationPreferences,
} from "@/lib/notifications";

export function NotificationsClient() {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [message, setMessage] = useState("");
  const [notificationSaving, setNotificationSaving] = useState(false);
  const { items: notifications, preferences } = useNotifications(session?.mobile);

  useEffect(() => {
    function refreshSession() {
      setSession(readCustomerSession());
      setSessionReady(true);
    }

    refreshSession();
    return subscribeCustomerSession(refreshSession);
  }, []);

  useEffect(() => {
    if (sessionReady && !session?.mobile) router.replace("/login?next=/notifications");
  }, [router, session?.mobile, sessionReady]);

  function markRead() {
    if (!session?.mobile) return;
    markNotificationsRead(session.mobile);
  }

  function clearAll() {
    if (!session?.mobile) return;
    clearNotifications(session.mobile);
  }

  async function updateNotificationPreference(key: keyof WahNotificationPreferences, value: boolean) {
    if (!session?.mobile || notificationSaving) return;
    setNotificationSaving(true);
    setMessage("");
    try {
      await saveNotificationPreferences(session.mobile, {
        ...preferences,
        [key]: value,
      });
      setMessage(value ? "Notification mute setting saved." : "Notification alerts turned on.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save notification settings.");
    } finally {
      setNotificationSaving(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-5 pb-28 pt-5 text-charcoal sm:my-6 sm:rounded-[28px] lg:my-0 lg:max-w-none lg:rounded-none lg:px-0 lg:pb-14 lg:pt-8">
      <div className="mx-auto w-full lg:max-w-[1248px] lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-maroon shadow-sm ring-1 ring-border"
            aria-label="Go back"
          >
            <ArrowLeft size={21} />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red">Profile</p>
            <h1 className="truncate text-3xl font-black text-maroon">Notifications</h1>
          </div>
        </div>
        <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-maroon shadow-sm ring-1 ring-border">
          {preferences.appMuted ? <BellOff size={23} /> : <Bell size={23} />}
        </span>
      </div>

      <div className="lg:mt-6 lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-6">
      <aside className="lg:sticky lg:top-24">
      <div className="mt-5 grid grid-cols-2 gap-3 lg:mt-0">
        <button
          type="button"
          onClick={markRead}
          disabled={preferences.appMuted}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-black text-maroon shadow-sm ring-1 ring-border disabled:text-muted disabled:opacity-70"
        >
          <CheckCheck size={17} /> Mark read
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={preferences.appMuted}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-black text-red shadow-sm ring-1 ring-border disabled:text-muted disabled:opacity-70"
        >
          <Trash2 size={17} /> Clear
        </button>
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-border">
        <NotificationToggle
          icon={preferences.appMuted ? BellOff : Bell}
          title="Notification Icon"
          subtitle={preferences.appMuted ? "Muted for this profile" : "Active for this profile"}
          muted={preferences.appMuted}
          disabled={notificationSaving}
          onToggle={(muted) => updateNotificationPreference("appMuted", muted)}
        />
        <NotificationToggle
          icon={MessageCircle}
          title="WhatsApp Notifications"
          subtitle={preferences.whatsappMuted ? "Muted for this profile" : "Active for this profile"}
          muted={preferences.whatsappMuted}
          disabled={notificationSaving}
          onToggle={(muted) => updateNotificationPreference("whatsappMuted", muted)}
        />
      </section>
      {notificationSaving ? <p className="mt-2 text-xs font-black text-muted">Saving notification settings...</p> : null}
      {message ? <p className="mt-4 rounded-xl bg-white p-3 text-center text-xs font-black text-muted">{message}</p> : null}
      </aside>

      <section className="mt-5 grid gap-3 lg:mt-0 lg:grid-cols-2 lg:gap-4">
        {preferences.appMuted ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-border lg:col-span-2">
            <BellOff className="mx-auto text-muted" size={32} />
            <h2 className="mt-3 text-xl font-black text-charcoal">Notifications muted</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-muted">Turn on Notification Icon alerts to show profile updates here.</p>
          </div>
        ) : notifications.length ? notifications.map((notification) => (
          <article key={notification.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-border">
            <div className="flex items-start gap-3">
              <span className={`mt-1 h-2.5 w-2.5 rounded-full ${notification.read ? "bg-muted/30" : "bg-red"}`} />
              <div className="min-w-0 flex-1">
                <p className="font-black text-charcoal">{notification.title}</p>
                {notification.body ? <p className="mt-1 text-sm font-semibold leading-6 text-muted">{notification.body}</p> : null}
                <p className="mt-2 text-[11px] font-black uppercase tracking-wide text-muted">
                  {notification.kind} - {new Date(notification.createdAt).toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </article>
        )) : (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-border lg:col-span-2">
            <Bell className="mx-auto text-muted" size={32} />
            <h2 className="mt-3 text-xl font-black text-charcoal">No notifications</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-muted">Order updates and offer alerts will appear here.</p>
          </div>
        )}
      </section>
      </div>
      </div>
    </main>
  );
}

function NotificationToggle({
  disabled,
  icon: Icon,
  muted,
  onToggle,
  subtitle,
  title,
}: {
  disabled: boolean;
  icon: typeof Bell;
  muted: boolean;
  onToggle: (muted: boolean) => void;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border p-4 last:border-b-0">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${muted ? "bg-[#f7f8fb] text-muted" : "bg-[#fff4f5] text-maroon"}`}>
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-black text-charcoal">{title}</span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-muted">{subtitle}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={!muted}
        disabled={disabled}
        onClick={() => onToggle(!muted)}
        className={`relative h-8 w-[58px] shrink-0 rounded-full p-1 transition-colors disabled:opacity-60 ${muted ? "bg-[#d5d9e2]" : "bg-maroon"}`}
      >
        <span className={`block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${muted ? "translate-x-0" : "translate-x-6"}`} />
      </button>
    </div>
  );
}
