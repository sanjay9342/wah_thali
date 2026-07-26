"use client";

export type CustomerSession = {
  id?: string;
  name: string;
  mobile: string;
  email?: string;
};

const customerSessionKey = "wah-thali-customer-session";
const customerSessionEvent = "wah-thali-customer-session-change";

export function readCustomerSession(): CustomerSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(customerSessionKey);
    const parsed = raw ? JSON.parse(raw) as Partial<CustomerSession> : null;
    if (parsed?.mobile && parsed?.name) {
      return {
        id: parsed.id,
        name: parsed.name,
        mobile: parsed.mobile,
        email: parsed.email,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function saveCustomerSession(session: CustomerSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(customerSessionKey, JSON.stringify(session));
  window.dispatchEvent(new Event(customerSessionEvent));
}

export function clearCustomerSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(customerSessionKey);
  window.dispatchEvent(new Event(customerSessionEvent));
}

export function subscribeCustomerSession(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(customerSessionEvent, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(customerSessionEvent, callback);
  };
}
