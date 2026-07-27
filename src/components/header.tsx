"use client";

import { Bell, ChevronDown, MapPin, ShoppingCart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useStoredCart } from "@/lib/use-stored-cart";
import { useDeliveryLocation } from "@/lib/delivery-location";
import { readCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";
import { useEffect, useState } from "react";

export function Header({ showContact = true }: { showContact?: boolean; whatsappNumber?: string }) {
  const deliveryLocation = useDeliveryLocation();
  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  const cart = useStoredCart(customerSession?.mobile);
  const cartCount = cart.reduce((total, line) => total + line.quantity, 0);

  useEffect(() => {
    function refreshSession() {
      setCustomerSession(readCustomerSession());
    }

    refreshSession();
    return subscribeCustomerSession(refreshSession);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-[#f1e7e4] bg-white/96 backdrop-blur">
      <div className="mx-auto hidden h-[104px] max-w-[1250px] items-center gap-6 px-0 lg:flex">
        <Link href="/" className="relative h-16 w-[164px] overflow-hidden border-r border-[#f1e7e4] pr-6" aria-label="Wah Thali home">
          <Image src="/wah-thali-logo-cutout.png" alt="Wah Thali" fill priority sizes="164px" className="object-contain object-left" />
        </Link>

        <Link href="/address" className="flex min-w-0 max-w-[300px] items-center gap-3 text-sm font-black">
          <MapPin size={18} className="text-red" />
          <span className="truncate">{deliveryLocation.address}</span>
          <ChevronDown size={16} className="text-muted" />
        </Link>

        <nav className="ml-auto flex items-center gap-8 text-sm font-black">
          {[
            ["/", "Home"],
            ["/menu", "Search"],
            ["/orders", "Orders"],
            ["/offers", "Offers"],
            ["/support", "Help"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="text-charcoal hover:text-red">
              {label}
            </Link>
          ))}
        </nav>

        <Link href="/cart" className="relative grid h-11 w-11 place-items-center text-charcoal" aria-label="Cart">
          <ShoppingCart size={30} />
          {cartCount ? <span className="absolute -right-1 top-0 rounded-full bg-red px-1.5 text-[10px] font-black text-white">{cartCount}</span> : null}
        </Link>
        {showContact ? (
          <Link href="/login" className="rounded-xl bg-red px-6 py-3 text-sm font-black text-white shadow-[0_9px_20px_rgba(141,0,33,0.18)]">
            Sign In
          </Link>
        ) : null}
      </div>

      <div className="grid h-[66px] grid-cols-[1fr_auto_auto] items-center gap-2.5 px-4 lg:hidden">
        <Link href="/address" className="flex min-w-0 items-center gap-2">
          <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[15px] bg-[#f5f6f8] text-[#374151]">
            <MapPin size={21} strokeWidth={2.5} />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-wide text-[#a0a6b0]">Delivering to</span>
            <span className="block truncate text-[14px] font-black leading-tight text-charcoal">{deliveryLocation.address}</span>
          </span>
          <ChevronDown size={14} className="text-[#6b7280]" />
        </Link>

        <button className="relative grid h-9 w-9 place-items-center text-[#374151]" aria-label="Notifications">
          <Bell size={25} strokeWidth={2.2} />
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[#ff2446]" />
        </button>
        <Link href="/cart" className="relative grid h-9 w-9 place-items-center text-[#374151]" aria-label="Cart">
          <ShoppingCart size={29} strokeWidth={2.3} />
          {cartCount ? <span className="absolute -right-0.5 top-0 rounded-full bg-maroon px-1.5 text-[10px] font-black text-white">{cartCount}</span> : null}
        </Link>
      </div>
    </header>
  );
}
