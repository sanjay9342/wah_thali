/// <reference types="react/canary" />

"use client";

import { ViewTransition, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

const priorityRoutes = ["/", "/menu", "/cart", "/orders", "/offers", "/account", "/support"];

export function NavigationPerformance({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!isNavigating) return;

    const elapsed = performance.now() - startedAt.current;
    const timeoutId = window.setTimeout(() => setIsNavigating(false), Math.max(140 - elapsed, 0));
    return () => window.clearTimeout(timeoutId);
  }, [isNavigating, pathname]);

  return (
    <>
      <RouteProgress active={isNavigating} />
      <NavigationClickTracker
        onNavigate={() => {
          startedAt.current = performance.now();
          setIsNavigating(true);
        }}
      />
      <RoutePrefetcher />
      <ViewTransition
        key={pathname}
        name="site-page"
        enter="wt-page-enter"
        exit="wt-page-exit"
        share="wt-page-share"
        default="none"
      >
        <div className="min-h-dvh pb-24 lg:pb-0">{children}</div>
      </ViewTransition>
    </>
  );
}

function RouteProgress({ active }: { active: boolean }) {
  return (
    <div
      className={`wt-route-progress fixed left-0 right-0 top-0 z-[90] h-0.5 origin-left bg-maroon ${active ? "wt-route-progress-active" : ""}`}
      aria-hidden="true"
    />
  );
}

function NavigationClickTracker({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      if (target.target || target.hasAttribute("download")) return;

      const href = target.href;
      if (!href) return;

      const nextUrl = new URL(href);
      if (nextUrl.origin !== window.location.origin) return;
      if (nextUrl.pathname === pathname && nextUrl.search === window.location.search) return;

      onNavigate();
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [onNavigate, pathname]);

  return null;
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
