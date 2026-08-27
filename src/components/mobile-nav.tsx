"use client";

import { Gift, Home, PackageCheck, Search, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";

const items = [
  { href: "/", icon: Home, label: "Home", match: (path: string) => path === "/" },
  { href: "/menu", icon: Search, label: "Search", match: (path: string) => path === "/menu" },
  { href: "/orders", icon: PackageCheck, label: "Orders", match: (path: string) => path.startsWith("/orders") || path.startsWith("/order/") },
  { href: "/offers", icon: Gift, label: "Offers", match: (path: string) => path === "/offers" },
  { href: "/account", icon: User, label: "Profile", match: (path: string) => path === "/account" },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(null);

  useEffect(() => {
    function refreshSession() {
      setSession(readCustomerSession());
    }

    refreshSession();
    return subscribeCustomerSession(refreshSession);
  }, []);

  useEffect(() => {
    ["/", "/menu", "/orders", "/offers", "/account"].forEach((href) => {
      router.prefetch(href);
    });
  }, [router]);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[#eadfd7] bg-white/98 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(34,31,32,0.08)] backdrop-blur lg:hidden"
      style={{ viewTransitionName: "site-mobile-nav" }}
      aria-label="Primary navigation"
    >
      <div className="grid h-[72px] w-full grid-cols-5 items-center px-2">
        {items.map(({ href, icon: Icon, label, match }) => {
          const active = match(pathname);
          const resolvedHref = label === "Profile" && !session ? "/login?next=/account" : href;

          return (
            <Link
              key={href}
              href={resolvedHref}
              onMouseEnter={() => router.prefetch(resolvedHref)}
              onTouchStart={() => router.prefetch(resolvedHref)}
              className={`grid min-w-0 place-items-center gap-1.5 text-[10px] font-semibold ${active ? "text-red" : "text-muted"}`}
              aria-current={active ? "page" : undefined}
            >
              <span
                className="grid h-7 w-7 place-items-center transition-colors"
              >
                <Icon size={active ? 20 : 19} strokeWidth={active ? 3 : 2.4} className={active && label === "Home" ? "fill-red" : ""} />
              </span>
              <span className="leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
