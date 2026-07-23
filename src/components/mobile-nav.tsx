"use client";

import { Gift, Home, PackageCheck, Search, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", icon: Home, label: "Home", match: (path: string) => path === "/" },
  { href: "/menu", icon: Search, label: "Explore", match: (path: string) => path === "/menu" },
  { href: "/orders", icon: PackageCheck, label: "Orders", match: (path: string) => path.startsWith("/orders") || path.startsWith("/order/") },
  { href: "/offers", icon: Gift, label: "Offers", match: (path: string) => path === "/offers" },
  { href: "/account", icon: User, label: "Profile", match: (path: string) => path === "/account" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-3" aria-label="Primary navigation">
      <div className="ml-3 grid h-[74px] w-[calc(100%-24px)] max-w-[360px] grid-cols-5 items-center rounded-[28px] border-[3px] border-[#f1dcc7] bg-white/96 px-3 shadow-[0_-8px_24px_rgba(34,31,32,0.10)] backdrop-blur sm:mx-auto">
        {items.map(({ href, icon: Icon, label, match }) => {
          const active = match(pathname);

          return (
            <Link
              key={href}
              href={href}
              className={`grid min-w-0 place-items-center gap-1 text-[11px] font-black ${active ? "text-red" : "text-muted"}`}
              aria-current={active ? "page" : undefined}
            >
              <span
                className={`grid h-10 w-10 place-items-center rounded-2xl transition-colors ${
                  active ? "bg-red text-white shadow-[0_8px_18px_rgba(214,0,50,0.28)]" : "text-muted"
                }`}
              >
                <Icon size={active ? 22 : 21} strokeWidth={active ? 3 : 2.4} className={active && label === "Home" ? "fill-white" : ""} />
              </span>
              <span className="leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
