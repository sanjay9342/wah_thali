"use client";

import { Bell, ChevronDown, MapPin, ShoppingCart, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStoredCart } from "@/lib/use-stored-cart";
import { useDeliveryLocation } from "@/lib/delivery-location";
import { readCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";
import { clearNotifications, markNotificationsRead, useNotifications } from "@/lib/notifications";
import { useEffect, useState } from "react";

export function Header({ showContact = true, showLocation = false }: { showContact?: boolean; showLocation?: boolean; whatsappNumber?: string }) {
  const deliveryLocation = useDeliveryLocation();
  const pathname = usePathname();
  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const cart = useStoredCart(customerSession?.mobile);
  const cartCount = cart.reduce((total, line) => total + line.quantity, 0);
  const { items: notifications, unreadCount } = useNotifications(customerSession?.mobile);

  useEffect(() => {
    function refreshSession() {
      setCustomerSession(readCustomerSession());
    }

    refreshSession();
    return subscribeCustomerSession(refreshSession);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 w-[100dvw] overflow-x-clip border-b border-[#f1e7e4] bg-white/97 shadow-[0_6px_20px_rgba(34,31,32,0.045)] backdrop-blur"
      style={{ viewTransitionName: "site-header" }}
    >
      <div className="mx-auto hidden h-[74px] max-w-[1250px] items-center gap-5 px-6 lg:flex">
        <Link
          href="/"
          className="relative block h-[48px] w-[154px] shrink-0 overflow-hidden"
          aria-label="Wah Thali home"
        >
          <Image src="/wah-thali-logo-cutout.png" alt="Wah Thali" fill loading="eager" sizes="154px" className="object-contain object-left" />
        </Link>

        {showLocation ? (
          <Link href="/address" className="flex min-w-0 max-w-[300px] items-center gap-2 rounded-full border border-[#e7ebf2] bg-white px-3 py-2 text-[13px] font-black text-charcoal">
            <MapPin size={17} className="shrink-0 text-red" />
            <span className="truncate">{deliveryLocation.address}</span>
            <ChevronDown size={15} className="shrink-0 text-muted" />
          </Link>
        ) : null}

        <nav className="ml-auto flex items-center gap-8 text-[13px] font-black">
          {[
            ["/", "Home"],
            ["/menu", "Search"],
            ["/orders", "Orders"],
            ["/offers", "Offers"],
            ["/support", "Help"],
          ].map(([href, label]) => {
            const active = href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-full px-3 py-2 transition-colors ${active ? "bg-[#fff4f5] text-red" : "text-charcoal hover:bg-[#fff8f9] hover:text-red"}`}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <Link href="/cart" className="relative grid h-9 w-9 place-items-center text-charcoal" aria-label="Cart">
          <ShoppingCart size={26} />
          {cartCount ? <span className="absolute -right-1 top-0 rounded-full bg-red px-1.5 text-[10px] font-black text-white">{cartCount}</span> : null}
        </Link>
        {showContact ? (
          <Link href="/login" className="inline-flex h-10 items-center rounded-[10px] bg-red px-5 text-[12px] font-black text-white shadow-[0_8px_18px_rgba(141,0,33,0.16)]">
            Sign In
          </Link>
        ) : null}
      </div>

      <div className="w-screen px-4 pb-3 pt-2.5 lg:hidden">
        <div className="grid h-[48px] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5">
          <Link href="/" className="relative block h-[44px] w-[126px] overflow-hidden" aria-label="Wah Thali home">
            <Image src="/wah-thali-logo-cutout.png" alt="Wah Thali" fill loading="eager" sizes="126px" className="object-contain object-left" />
          </Link>

          <button
            type="button"
            className="relative grid h-10 w-10 place-items-center rounded-full bg-white text-[#374151] shadow-[0_8px_18px_rgba(34,31,32,0.06)] ring-1 ring-[#f1e7e4]"
            onClick={() => {
              setShowNotifications(true);
              markNotificationsRead(customerSession?.mobile);
            }}
            aria-label="Notifications"
          >
            <Bell size={20} strokeWidth={2.3} />
            {unreadCount ? (
              <span className="absolute -right-0.5 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-maroon px-1 text-[8px] font-black text-white ring-2 ring-white">
                {unreadCount}
              </span>
            ) : null}
          </button>
          <Link href="/cart" className="relative grid h-10 w-10 place-items-center rounded-full bg-white text-[#374151] shadow-[0_8px_18px_rgba(34,31,32,0.06)] ring-1 ring-[#f1e7e4]" aria-label="Cart">
            <ShoppingCart size={22} strokeWidth={2.4} />
            {cartCount ? <span className="absolute -right-0.5 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-maroon px-1 text-[8px] font-black text-white ring-2 ring-white">{cartCount}</span> : null}
          </Link>
        </div>

        {showLocation ? (
          <Link href="/address" className="mt-2 grid min-h-[46px] w-full grid-cols-[36px_minmax(0,1fr)_26px] items-center gap-2 rounded-2xl border border-[#e7ebf2] bg-white px-2.5 py-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-maroon ring-1 ring-[#e7ebf2]">
              <MapPin size={19} strokeWidth={2.6} />
            </span>
            <span className="min-w-0">
              <span className="block text-[9px] font-black uppercase tracking-wide text-maroon/75">Delivering to</span>
              <span className="mt-0.5 block truncate text-[13px] font-black leading-tight text-charcoal">{deliveryLocation.address}</span>
            </span>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#6b7280] ring-1 ring-[#e7ebf2]">
              <ChevronDown size={14} strokeWidth={2.6} />
            </span>
          </Link>
        ) : null}
      </div>

      {showNotifications ? (
        <div className="fixed inset-0 z-[70] bg-charcoal/30 px-4 py-5 backdrop-blur-[2px]" onClick={() => setShowNotifications(false)}>
          <div
            className="ml-auto mt-[70px] w-full max-w-[315px] rounded-[24px] bg-white p-4 shadow-2xl ring-1 ring-border"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-maroon">Notifications</h2>
              <div className="flex items-center gap-2">
                {notifications.length ? (
                  <button
                    type="button"
                    onClick={() => clearNotifications(customerSession?.mobile)}
                    className="rounded-full bg-[#fff4f5] px-3 py-2 text-[11px] font-black text-maroon"
                  >
                    Clear
                  </button>
                ) : null}
                <button className="grid h-9 w-9 place-items-center rounded-full bg-[#fff4f5] text-maroon" onClick={() => setShowNotifications(false)} aria-label="Close notifications">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {notifications.length ? (
                notifications.map((notification) => (
                  <div key={notification.id} className="rounded-2xl border border-[#f0e2e4] bg-[#fff8f9] p-3">
                    <div className="flex items-start gap-2">
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.read ? "bg-muted/35" : "bg-maroon"}`} />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-black leading-tight text-charcoal">{notification.title}</span>
                        <span className="mt-1 block text-[11px] font-bold leading-4 text-muted">{notification.body}</span>
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-[#fff8f9] p-5 text-center">
                  <p className="text-sm font-black text-charcoal">No notifications yet</p>
                  <p className="mt-1 text-[11px] font-bold leading-4 text-muted">Account and order updates will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
