"use client";

export type CustomerSession = {
  id?: string;
  name: string;
  mobile: string;
  email?: string;
};

const customerSessionEvent = "wah-thali-customer-session-change";
let cachedSession: CustomerSession | null = null;
let sessionLoaded = false;
let loadingSession: Promise<CustomerSession | null> | null = null;

function dispatchSessionChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(customerSessionEvent));
}

function normalizeSession(value: unknown): CustomerSession | null {
  const session = value as Partial<CustomerSession> | null;
  if (!session?.mobile || !session.name) return null;

  return {
    id: session.id,
    name: session.name,
    mobile: session.mobile,
    email: session.email || undefined,
  };
}

export function readCustomerSession(): CustomerSession | null {
  return cachedSession;
}

export async function loadCustomerSession() {
  if (typeof window === "undefined") return null;
  if (sessionLoaded) return cachedSession;
  if (loadingSession) return loadingSession;

  loadingSession = fetch("/api/customers/session", { cache: "no-store" })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      cachedSession = response.ok ? normalizeSession(data.customer) : null;
      sessionLoaded = true;
      dispatchSessionChange();
      return cachedSession;
    })
    .catch(() => {
      cachedSession = null;
      sessionLoaded = true;
      dispatchSessionChange();
      return null;
    })
    .finally(() => {
      loadingSession = null;
    });

  return loadingSession;
}

export function saveCustomerSession(session: CustomerSession) {
  if (typeof window === "undefined") return;
  cachedSession = session;
  sessionLoaded = true;
  dispatchSessionChange();

  void fetch("/api/customers/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile: session.mobile }),
  }).catch(() => undefined);
}

export function clearCustomerSession() {
  if (typeof window === "undefined") return;
  cachedSession = null;
  sessionLoaded = true;
  dispatchSessionChange();
  void fetch("/api/customers/session", { method: "DELETE" }).catch(() => undefined);
}

export function subscribeCustomerSession(callback: () => void) {
  window.addEventListener(customerSessionEvent, callback);
  void loadCustomerSession();

  return () => {
    window.removeEventListener(customerSessionEvent, callback);
  };
}
