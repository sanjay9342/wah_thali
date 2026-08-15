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

export function Header({ showContact = true }: { showContact?: boolean; whatsappNumber?: string }) {
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
    <header className="sticky top-0 z-50 border-b border-[#f1e7e4] bg-white/96 backdrop-blur">
      <div className="mx-auto hidden h-[68px] max-w-[1248px] items-center gap-5 px-6 lg:flex">
        <Link href="/" className="relative h-10 w-[138px] overflow-hidden border-r border-[#f1e7e4] pr-5" aria-label="Wah Thali home">
          <Image src="/wah-thali-logo-cutout.png" alt="Wah Thali" fill priority sizes="164px" className="object-contain object-left" />
        </Link>

        <Link href="/address" className="flex min-w-0 max-w-[280px] items-center gap-2 text-[13px] font-black">
          <MapPin size={17} className="text-red" />
          <span className="truncate">{deliveryLocation.address}</span>
          <ChevronDown size={15} className="text-muted" />
        </Link>

        <nav className="ml-auto flex items-center gap-11 text-[13px] font-black">
          {[
            ["/", "Home"],
            ["/menu", "Search"],
            ["/orders", "Orders"],
            ["/offers", "Offers"],
            ["/support", "Help"],
          ].map(([href, label]) => {
            const active = href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={href} href={href} className={active ? "text-red" : "text-charcoal hover:text-red"} aria-current={active ? "page" : undefined}>
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
          <Link href="/login" className="inline-flex h-9 items-center rounded-[10px] bg-red px-4 text-[12px] font-black text-white shadow-[0_8px_18px_rgba(141,0,33,0.16)]">
            Sign In
          </Link>
        ) : null}
      </div>

      <div className="grid min-h-[78px] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-5 pt-1 lg:hidden">
        <Link href="/address" className="inline-flex min-w-0 max-w-[190px] justify-self-start items-center gap-1">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[15px] bg-[#f5f6f8] text-[#68707c]">
            <MapPin size={18} strokeWidth={2.5} />
          </span>
          <span className="min-w-0">
            <span className="block text-[8px] font-black uppercase tracking-wide text-[#a0a6b0]">Delivering to</span>
            <span className="inline-flex max-w-[122px] items-center gap-0.5 align-top">
              <span className="min-w-0 truncate text-[12px] font-black leading-tight text-charcoal">{deliveryLocation.address}</span>
              <ChevronDown size={11} className="shrink-0 translate-y-[1px] text-[#6b7280]" />
            </span>
          </span>
        </Link>

        <button
          type="button"
          className="relative grid h-8 w-8 place-items-center text-[#374151]"
          onClick={() => {
            setShowNotifications(true);
            markNotificationsRead(customerSession?.mobile);
          }}
          aria-label="Notifications"
        >
          <Bell size={21} strokeWidth={2.3} />
          {unreadCount ? (
            <span className="absolute -right-0.5 top-0 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-maroon px-1 text-[8px] font-black text-white">
              {unreadCount}
            </span>
          ) : null}
        </button>
        <Link href="/cart" className="relative grid h-8 w-8 place-items-center text-[#374151]" aria-label="Cart">
          <ShoppingCart size={24} strokeWidth={2.4} />
          {cartCount ? <span className="absolute -right-0.5 top-0 rounded-full bg-maroon px-1.5 text-[8px] font-black text-white">{cartCount}</span> : null}
        </Link>
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
