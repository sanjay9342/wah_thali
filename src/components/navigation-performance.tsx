/// <reference types="react/canary" />

"use client";

import { ViewTransition, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

const priorityRoutes = ["/", "/menu", "/cart", "/orders", "/offers", "/account"];

export function NavigationPerformance({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <RoutePrefetcher />
      <ViewTransition
        key={pathname}
        name="site-page"
        enter="wt-page-enter"
        exit="wt-page-exit"
        share="wt-page-share"
        default="none"
      >
        <div className="min-h-dvh">{children}</div>
      </ViewTransition>
    </>
  );
}

function RoutePrefetcher() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const browserWindow = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
        cancelIdleCallback?: (handle: number) => void;
      };
    const prefetch = () => {
      for (const route of priorityRoutes) {
        if (route !== pathname) {
          router.prefetch(route);
        }
      }
    };

    if (typeof browserWindow.requestIdleCallback === "function") {
      const idleId = browserWindow.requestIdleCallback(prefetch, { timeout: 1800 });
      return () => browserWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = browserWindow.setTimeout(prefetch, 900);
    return () => browserWindow.clearTimeout(timeoutId);
  }, [pathname, router]);

  return null;
}
