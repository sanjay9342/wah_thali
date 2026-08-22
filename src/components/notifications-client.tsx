"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { readCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";

type CustomerNotification = {
  id: string;
  title: string;
  body: string;
  kind: string;
  read: boolean;
  createdAt: number;
};

export function NotificationsClient() {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const mobile = session?.mobile ?? "";
    if (!mobile) return;
    let cancelled = false;

    async function loadNotifications() {
      setLoading(true);
      try {
        const response = await fetch(`/api/customers/notifications?mobile=${encodeURIComponent(mobile)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load notifications.");
        if (!cancelled) setNotifications(data.notifications ?? []);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Could not load notifications.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadNotifications();
    return () => {
      cancelled = true;
    };
  }, [session?.mobile]);

  async function markRead() {
    if (!session?.mobile) return;
    await fetch("/api/customers/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile: session.mobile }),
    });
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }

  async function clearAll() {
    if (!session?.mobile) return;
    await fetch(`/api/customers/notifications?mobile=${encodeURIComponent(session.mobile)}`, { method: "DELETE" });
    setNotifications([]);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f6f7fb] px-5 pb-28 pt-5 text-charcoal sm:my-6 sm:rounded-[28px] lg:max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red">Profile</p>
          <h1 className="text-3xl font-black text-maroon">Notifications</h1>
        </div>
        <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-maroon shadow-sm ring-1 ring-border">
          <Bell size={23} />
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button onClick={markRead} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-black text-maroon shadow-sm ring-1 ring-border">
          <CheckCheck size={17} /> Mark read
        </button>
        <button onClick={clearAll} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-black text-red shadow-sm ring-1 ring-border">
          <Trash2 size={17} /> Clear
        </button>
      </div>

      <section className="mt-5 grid gap-3">
        {loading ? (
          <div className="rounded-2xl bg-white p-5 text-sm font-black text-muted shadow-sm ring-1 ring-border">Loading notifications...</div>
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
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-border">
            <Bell className="mx-auto text-muted" size={32} />
            <h2 className="mt-3 text-xl font-black text-charcoal">No notifications</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-muted">Order updates and offer alerts will appear here.</p>
          </div>
        )}
      </section>

      {message ? <p className="mt-4 rounded-xl bg-white p-3 text-center text-xs font-black text-muted">{message}</p> : null}
    </main>
  );
}
