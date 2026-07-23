import { Bell, Heart, History, MapPin, Search, ShoppingCart, User, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { settings } from "@/lib/data";

export function Header({ showContact = true }: { showContact?: boolean }) {
  const whatsappText = encodeURIComponent("Hi Wah Thali, I want to order food.");

  return (
    <header className="sticky top-0 z-50 overflow-hidden border-b border-border bg-white/95 backdrop-blur">
      <div className="grid min-h-[72px] w-full max-w-[390px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 py-3 sm:mx-auto sm:max-w-7xl sm:px-6 md:min-h-20 md:grid-cols-[auto_1fr_auto] md:gap-3 lg:px-8">
        <Link href="/account" className="flex min-w-0 items-center gap-1.5 md:hidden">
          <MapPin size={16} className="shrink-0 text-red" />
          <span className="min-w-0">
            <span className="block text-[10px] font-bold leading-none text-muted">Deliver to</span>
            <span className="block max-w-24 truncate text-xs font-black text-charcoal">Salt Lake</span>
          </span>
        </Link>

        <Link href="/" className="flex min-w-fit -translate-x-2 items-center justify-self-center md:translate-x-0 md:justify-self-start" aria-label="Wah Thali home">
          <span className="relative block h-12 w-36 overflow-hidden sm:h-[54px] sm:w-44 md:h-14 md:w-52">
            <Image
              src="/wah-thali-logo-cutout.png"
              alt="Wah Thali"
              fill
              priority
              sizes="(max-width: 767px) 144px, 208px"
              className="object-contain"
            />
          </span>
        </Link>

        <div className="hidden min-w-0 items-center gap-3 md:flex">
          <Link href="/account" className="flex h-11 max-w-56 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-charcoal">
            <MapPin size={18} className="min-w-4 text-red" />
            <span className="truncate">Salt Lake, Kolkata</span>
          </Link>

          <label className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              className="h-11 w-full rounded-lg border border-border bg-cream pl-10 pr-3 text-sm"
              placeholder="Search thali, biryani, momos, dessert"
            />
          </label>
        </div>

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {[
            ["/account", User, "Account"],
            ["/orders", History, "Orders"],
            ["/offers", Bell, "Offers"],
            ["/wishlist", Heart, "Wishlist"],
            ["/cart", ShoppingCart, "Cart"],
          ].map(([href, Icon, label]) => (
            <Link
              key={String(label)}
              href={String(href)}
              className="grid h-11 min-w-11 place-items-center rounded-lg text-muted hover:bg-cream hover:text-maroon"
              aria-label={String(label)}
              title={String(label)}
            >
              <Icon size={19} />
            </Link>
          ))}
        </nav>

        {showContact ? (
          <a
            href={`https://wa.me/${settings.whatsappNumber}?text=${whatsappText}`}
            className="grid h-10 w-10 min-w-10 place-items-center justify-self-end rounded-full bg-maroon text-white sm:h-11 sm:w-11 sm:min-w-11 lg:ml-1 lg:rounded-lg"
            aria-label="Chat on WhatsApp"
            title="Chat on WhatsApp"
          >
            <MessageCircle size={19} />
          </a>
        ) : (
          <span className="h-10 w-10 justify-self-end sm:h-11 sm:w-11 lg:ml-1" aria-hidden="true" />
        )}
      </div>
      <div className="w-full max-w-[390px] border-t border-border px-4 py-3 sm:mx-auto md:hidden">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <input
            className="h-11 w-full rounded-lg border border-border bg-cream pl-10 pr-3 text-sm"
            placeholder="Search Wah Thali"
          />
        </label>
      </div>
    </header>
  );
}
