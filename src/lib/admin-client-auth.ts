"use client";

import type { CustomerSession } from "@/lib/customer-session";

type ApiJsonPayload = Record<string, unknown>;

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

export async function readAdminApiJson(response: Response): Promise<ApiJsonPayload> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  if (!text.trim()) {
    return response.ok ? {} : { error: `Request failed with status ${response.status}.` };
  }

  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      error: response.ok
        ? "The server returned an unexpected response."
        : `Request failed with status ${response.status}. Please try again.`,
    };
  }

  try {
    const data = JSON.parse(text);
    return data && typeof data === "object" && !Array.isArray(data) ? data as ApiJsonPayload : {};
  } catch {
    return {
      error: response.ok
        ? "The server returned invalid JSON."
        : `Request failed with status ${response.status}. Please try again.`,
    };
  }
}
