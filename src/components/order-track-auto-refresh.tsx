"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const terminalStatuses = new Set(["DELIVERED", "CANCELLED"]);

export function OrderTrackAutoRefresh({ status }: { status: string }) {
  const router = useRouter();

  useEffect(() => {
    if (terminalStatuses.has(status)) return;

    const timer = window.setInterval(() => {
      router.refresh();
    }, 3500);

    return () => window.clearInterval(timer);
  }, [router, status]);

  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") router.refresh();
    }

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [router]);

  return null;
}
