"use client";

import type { CustomerSession } from "@/lib/customer-session";

export function getAdminAuthHeaders(session?: CustomerSession | null): HeadersInit {
  if (!session) return {};

  return {
    "x-wah-admin-id": session.id ?? "",
    "x-wah-admin-name": session.name,
    "x-wah-admin-mobile": session.mobile,
    "x-wah-admin-email": session.email ?? "",
  };
}

export function adminFetch(session: CustomerSession | null | undefined, input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, {
    ...init,
    headers: {
      ...getAdminAuthHeaders(session),
      ...(init.headers ?? {}),
    },
  });
}
