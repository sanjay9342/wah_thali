"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Heart,
  MapPin,
  Minus,
  Plus,
  Search,
  Star,
  Store,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { MobileNav } from "@/components/mobile-nav";
import { categories, products } from "@/lib/data";
import { calculateCartTotals, formatRupees } from "@/lib/pricing";
import { writeStoredCart } from "@/lib/cart-storage";
import { useStoredCart } from "@/lib/use-stored-cart";
import type { CartLine, Product } from "@/lib/types";

function getQuantity(lines: CartLine[], productId: string) {
  return lines
    .filter((line) => line.productId === productId)
    .reduce((total, line) => total + line.quantity, 0);
}

function QuantityControl({
  quantity,
  onAdd,
  onDecrease,
}: {
  quantity: number;
  onAdd: () => void;
  onDecrease: () => void;
}) {
  if (quantity > 0) {
    return (
      <div className="grid h-10 w-28 grid-cols-3 overflow-hidden rounded-xl bg-white text-red shadow-[0_8px_20px_rgba(214,0,50,0.22)] ring-1 ring-red/25">
        <button className="grid place-items-center" onClick={onDecrease} aria-label="Decrease quantity">
          <Minus size={15} />
        </button>
        <span className="grid place-items-center text-sm font-black">{quantity}</span>
        <button className="grid place-items-center" onClick={onAdd} aria-label="Increase quantity">
          <Plus size={15} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onAdd}
      className="h-10 w-28 rounded-xl bg-red text-xs font-black uppercase text-white shadow-[0_8px_20px_rgba(214,0,50,0.28)]"
    >
      Add
    </button>
  );
}

function ProductCard({
  product,
  quantity,
  saved,
  onAdd,
  onDecrease,
  onToggleSave,
}: {
  product: Product;
  quantity: number;
  saved: boolean;
  onAdd: () => void;
  onDecrease: () => void;
  onToggleSave: () => void;
}) {
  return (
    <article className="grid grid-cols-[104px_1fr] gap-3 rounded-3xl bg-white p-3 shadow-[0_12px_32px_rgba(34,31,32,0.08)] ring-1 ring-border">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.image} alt={product.name} className="h-28 w-full rounded-2xl object-cover" loading="lazy" />
        <span
          className={`absolute left-2 top-2 grid h-5 w-5 place-items-center rounded-md border bg-white ${
            product.dietaryType === "NON_VEG" ? "border-red" : "border-maroon"
          }`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${product.dietaryType === "NON_VEG" ? "bg-red" : "bg-maroon"}`} />
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-charcoal">{product.name}</h3>
            <p className="mt-1 truncate text-xs font-semibold text-muted">{product.category}</p>
          </div>
          <button
            className={`grid h-8 w-8 place-items-center rounded-full ${
              saved ? "bg-red text-white" : "bg-cream text-red"
            }`}
            onClick={onToggleSave}
            aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name}`}
          >
            <Heart size={15} className={saved ? "fill-white" : ""} />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-muted">
          <span className="inline-flex items-center gap-1 rounded-lg bg-maroon px-2 py-1 text-white">
            {product.rating} <Star size={11} className="fill-white" />
          </span>
          <span>{product.prepTimeMinutes}-{product.prepTimeMinutes + 8} min</span>
          {product.offer ? <span className="text-red">{product.offer}</span> : null}
        </div>

        <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted">{product.description}</p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="font-black text-charcoal">{formatRupees(product.price)}</span>
          <QuantityControl quantity={quantity} onAdd={onAdd} onDecrease={onDecrease} />
        </div>
      </div>
    </article>
  );
}

export function MenuExperience() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [location, setLocation] = useState("221B Baker Street, Salt Lake");
  const [activePopup, setActivePopup] = useState<"location" | "notifications" | null>(null);
  const [savedProductIds, setSavedProductIds] = useState<string[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const cart = useStoredCart();
  const promoSlides = [
    {
      eyebrow: "Thali deal",
      title: "Flat 20% OFF",
      body: "on all Thalis Today!",
      code: "WAHTHALI20",
      image: "/wah-thali-meal-cutout-v2.png",
    },
    {
      eyebrow: "Family feast",
      title: "Combo at Rs 499",
      body: "2 thalis, dessert, and drinks.",
      code: "FAMILY10",
      image: "/wah-thali-meal-cutout-v2.png",
    },
    {
      eyebrow: "Lunch saver",
      title: "Mini meals from Rs 99",
      body: "Fast office lunch, fresh daily.",
      code: "MINI99",
      image: "/wah-thali-meal-cutout-v2.png",
    },
  ];

  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      const categoryMatch = activeCategory === "All" || product.category === activeCategory;
      const textMatch =
        !needle ||
        `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(needle);
      return categoryMatch && textMatch;
    });
  }, [activeCategory, query]);

  const totals = calculateCartTotals(cart, "WAH50");

  function persist(next: CartLine[]) {
    writeStoredCart(next);
  }

  function addProduct(product: Product) {
    const existingIndex = cart.findIndex((line) => line.productId === product.id);
    if (existingIndex >= 0) {
      persist(
        cart.map((line, index) =>
          index === existingIndex ? { ...line, quantity: line.quantity + 1 } : line,
        ),
      );
      return;
    }

    persist([
      ...cart,
      {
        productId: product.id,
        variantId: product.variants[0]?.id ?? "regular",
        addonIds: [],
        quantity: 1,
      },
    ]);
  }

  function decreaseProduct(product: Product) {
    persist(
      cart
        .map((line) =>
          line.productId === product.id ? { ...line, quantity: line.quantity - 1 } : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function toggleSaved(product: Product) {
    const alreadySaved = savedProductIds.includes(product.id);
    setSavedProductIds((current) =>
      alreadySaved ? current.filter((id) => id !== product.id) : [...current, product.id],
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fff7ef] pb-28">
      <section className="mx-auto max-w-6xl px-0 pt-3 sm:px-5 sm:pt-5 lg:px-8">
        <div className="relative isolate h-[170px] w-screen max-w-[100vw] overflow-hidden bg-[#fffaf2] shadow-[0_12px_30px_rgba(34,31,32,0.10)] ring-1 ring-border sm:hidden">
          <Image
            src="/wah-thali-hero-bg.png"
            alt=""
            fill
            priority
            sizes="(max-width: 639px) 390px, 100vw"
            className="-z-20 object-cover object-[56%_center]"
          />
          <div className="pointer-events-none absolute left-[min(calc(100vw-120px),270px)] top-[56px] -z-10 h-[138px] w-[138px] min-[380px]:left-[min(calc(100vw-132px),258px)] min-[380px]:top-[52px] min-[380px]:h-[150px] min-[380px]:w-[150px]">
            <Image
              src="/wah-thali-meal-cutout-v2.png"
              alt=""
              fill
              priority
              sizes="138px"
              className="object-contain drop-shadow-[0_14px_18px_rgba(34,31,32,0.22)]"
            />
          </div>

          <Link href="/" className="absolute left-[47%] top-2.5 block h-10 w-32 -translate-x-1/2 overflow-hidden" aria-label="Wah Thali home">
            <Image
              src="/wah-thali-logo-cutout.png"
              alt="Wah Thali"
              fill
              priority
              sizes="128px"
              className="object-contain"
            />
          </Link>

          <button
            className="absolute left-[min(calc(100vw-44px),346px)] top-2.5 z-30 grid h-8 w-8 place-items-center rounded-full bg-white/94 text-charcoal shadow-[0_8px_18px_rgba(34,31,32,0.14)] ring-1 ring-border/80 backdrop-blur"
            onClick={() => setActivePopup("notifications")}
            aria-label="Notifications"
          >
            <Bell size={15} />
            <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red" />
          </button>

          <button
            className="absolute left-3 top-[54px] z-10 grid max-w-[calc(100%-86px)] grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2 text-left"
            onClick={() => setActivePopup("location")}
          >
            <span className="grid h-8 w-8 place-items-center rounded-2xl bg-white/88 text-red shadow-[0_8px_18px_rgba(34,31,32,0.10)] ring-1 ring-border/70 backdrop-blur">
              <MapPin size={15} className="fill-red/10" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold leading-none text-muted">Deliver to</span>
              <span className="mt-1 block truncate text-[11px] font-black text-charcoal min-[380px]:text-xs">{location}</span>
            </span>
            <ChevronDown size={13} className="text-charcoal" />
          </button>

          <label className="absolute left-3 top-[102px] z-10 flex h-8 w-[calc(100vw-126px)] max-w-[260px] items-center gap-2.5 rounded-2xl bg-white/95 px-3 shadow-[0_8px_18px_rgba(34,31,32,0.11)] ring-1 ring-border/80 backdrop-blur min-[380px]:w-[calc(100vw-136px)]">
            <Search size={15} className="shrink-0 text-charcoal/80" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-charcoal placeholder:text-muted"
              placeholder="Search for food, cuisines..."
            />
          </label>
        </div>

        <div className="relative isolate hidden min-h-[300px] w-full overflow-hidden rounded-[30px] bg-[#fffaf2] px-6 pb-6 pt-5 shadow-[0_14px_36px_rgba(34,31,32,0.10)] ring-1 ring-border sm:block lg:px-10 lg:py-7">
          <Image
            src="/wah-thali-hero-bg.png"
            alt=""
            fill
            priority
            sizes="(max-width: 1023px) 100vw, 1152px"
            className="-z-20 object-cover object-center"
          />
          <div className="absolute inset-y-0 right-0 -z-10 hidden w-[42%] bg-gradient-to-r from-transparent via-transparent to-maroon/10 lg:block" />
          <div className="pointer-events-none absolute -right-3 bottom-0 top-7 -z-10 hidden w-[39%] lg:block xl:right-2">
            <Image
              src="/wah-thali-meal-cutout-v2.png"
              alt=""
              fill
              priority
              sizes="520px"
              className="object-contain object-right-bottom drop-shadow-[0_26px_34px_rgba(34,31,32,0.28)]"
            />
          </div>
          <div className="pointer-events-none absolute -right-16 top-[78px] -z-10 h-[152px] w-[152px] opacity-95 min-[380px]:-right-14 min-[380px]:h-[168px] min-[380px]:w-[168px] sm:right-0 sm:top-12 sm:h-56 sm:w-56 md:h-64 md:w-64 lg:hidden">
            <Image
              src="/wah-thali-meal-cutout-v2.png"
              alt=""
              fill
              priority
              sizes="(max-width: 639px) 224px, 288px"
              className="object-contain drop-shadow-[0_18px_24px_rgba(34,31,32,0.24)]"
            />
          </div>

          <button
            className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-2xl bg-white/90 text-charcoal shadow-[0_10px_24px_rgba(34,31,32,0.12)] ring-1 ring-border/80 backdrop-blur sm:right-5 sm:top-5 sm:h-12 sm:w-12 lg:right-8 lg:top-7"
            onClick={() => setActivePopup("notifications")}
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red" />
          </button>

          <div className="relative z-10 max-w-[calc(100%-18px)] sm:max-w-2xl lg:max-w-[68%]">
            <div className="flex justify-center pr-8 sm:justify-start sm:pl-[32%] sm:pr-0 lg:pl-36 xl:pl-40">
              <Link href="/" className="relative block h-12 w-40 overflow-hidden sm:h-14 sm:w-48 lg:h-16 lg:w-56" aria-label="Wah Thali home">
                <Image
                  src="/wah-thali-logo-cutout.png"
                  alt="Wah Thali"
                  fill
                  priority
                  sizes="(max-width: 639px) 160px, (max-width: 1023px) 192px, 224px"
                  className="object-contain"
                />
              </Link>
            </div>

            <div className="mt-5 max-w-[620px] pr-9 sm:mt-8 sm:pr-0 lg:mt-9">
              <button
                className="grid min-w-0 max-w-full grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-2 text-left sm:grid-cols-[50px_minmax(0,1fr)_auto] sm:gap-3 lg:grid-cols-[54px_minmax(0,1fr)_auto]"
                onClick={() => setActivePopup("location")}
              >
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/80 text-red shadow-[0_8px_18px_rgba(34,31,32,0.08)] ring-1 ring-border/70 backdrop-blur sm:h-12 sm:w-12 lg:h-[52px] lg:w-[52px]">
                  <MapPin size={19} className="fill-red/10" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold leading-none text-muted sm:text-sm lg:text-base">Deliver to</span>
                  <span className="mt-1.5 block truncate text-sm font-black text-charcoal min-[380px]:text-base sm:text-xl lg:text-2xl">{location}</span>
                </span>
                <ChevronDown size={17} className="text-charcoal" />
              </button>
            </div>

            <label className="mt-5 flex h-11 max-w-[calc(100vw-58px)] items-center gap-3 rounded-[18px] bg-white/90 px-4 shadow-[0_10px_24px_rgba(34,31,32,0.10)] ring-1 ring-border/80 backdrop-blur sm:h-14 sm:max-w-[520px] sm:px-5 lg:mt-7">
              <Search size={20} className="shrink-0 text-charcoal/80" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-charcoal placeholder:text-muted sm:text-base lg:text-lg"
                placeholder="Search for food, cuisines..."
              />
            </label>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <div className="relative mb-4 overflow-hidden rounded-2xl bg-gradient-to-r from-maroon to-red p-4 text-white shadow-[0_12px_28px_rgba(214,0,50,0.22)] sm:mb-5 sm:rounded-3xl sm:p-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.16),transparent_24%)]" />
          <div className="relative z-10 grid min-h-24 grid-cols-[1fr_94px] items-center gap-3 sm:min-h-32 sm:grid-cols-[1fr_160px]">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/75 sm:text-xs">{promoSlides[activeSlide].eyebrow}</p>
              <h2 className="mt-1 text-lg font-black leading-tight sm:text-3xl">{promoSlides[activeSlide].title}</h2>
              <p className="mt-1 text-xs font-bold text-white/85 sm:text-base">{promoSlides[activeSlide].body}</p>
              <span className="mt-3 inline-flex h-8 items-center rounded-full border border-white/35 px-3 text-[10px] font-black sm:text-xs">
                Use code: {promoSlides[activeSlide].code}
              </span>
            </div>
            <div className="relative h-24 sm:h-32">
              <Image
                src={promoSlides[activeSlide].image}
                alt=""
                fill
                sizes="(max-width: 639px) 94px, 160px"
                className="object-contain drop-shadow-[0_16px_22px_rgba(34,31,32,0.28)]"
              />
            </div>
          </div>
          <button
            onClick={() => setActiveSlide((current) => (current + promoSlides.length - 1) % promoSlides.length)}
            className="absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/18 text-white backdrop-blur sm:grid"
            aria-label="Previous offer"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setActiveSlide((current) => (current + 1) % promoSlides.length)}
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white text-red shadow-lg"
            aria-label="Next offer"
          >
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {promoSlides.map((slide, index) => (
              <button
                key={slide.code}
                onClick={() => setActiveSlide(index)}
                className={`h-1.5 rounded-full ${activeSlide === index ? "w-5 bg-white" : "w-1.5 bg-white/45"}`}
                aria-label={`Show ${slide.title}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-charcoal">Categories</h2>
          <button
            onClick={() => {
              setActiveCategory("All");
            }}
            className="text-xs font-black text-red"
          >
            See all
          </button>
        </div>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-2 sm:mt-4">
          {["All", ...categories.slice(0, 8)].map((category, index) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`grid min-w-20 gap-2 rounded-2xl p-2 text-center text-xs font-black ${
                activeCategory === category ? "bg-red text-white" : "bg-white text-charcoal ring-1 ring-border"
              }`}
            >
              <span className="mx-auto h-14 w-14 overflow-hidden rounded-full bg-cream">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={products[index % products.length].image}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </span>
              <span className="truncate">{category.replace("Chef's Recommendations", "Chef")}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-charcoal">Popular Dishes</h2>
            <p className="text-xs font-semibold text-muted">Wah Thali kitchen - single restaurant menu</p>
          </div>
          <button
            onClick={() => {
              setQuery("");
              setActiveCategory("All");
            }}
            className="text-xs font-black text-red"
          >
            See all
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {visibleProducts.length ? (
            visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                quantity={getQuantity(cart, product.id)}
                saved={savedProductIds.includes(product.id)}
                onAdd={() => addProduct(product)}
                onDecrease={() => decreaseProduct(product)}
                onToggleSave={() => toggleSaved(product)}
              />
            ))
          ) : (
            <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-border">
              <Store className="mx-auto text-muted" />
              <h3 className="mt-3 text-lg font-black text-charcoal">No items found</h3>
              <p className="mt-1 text-sm text-muted">Try thali, biryani, chicken, paneer, or dessert.</p>
            </div>
          )}
        </div>
      </section>

      {cart.length ? (
        <div className="fixed bottom-[92px] left-0 right-0 z-40 px-4">
          <Link prefetch href="/cart" className="mx-auto flex max-w-xl items-center justify-between rounded-2xl bg-maroon px-5 py-4 font-black text-white shadow-2xl">
            <span>{cart.reduce((total, line) => total + line.quantity, 0)} items</span>
            <span>{formatRupees(totals.grandTotal)} - View cart</span>
          </Link>
        </div>
      ) : null}

      <MobileNav />

      {activePopup ? (
        <div className="fixed inset-0 z-[70] bg-charcoal/40 px-4 py-5 backdrop-blur-sm" onClick={() => setActivePopup(null)}>
          <div
            className="mx-auto mt-16 max-w-md rounded-[28px] bg-white p-5 shadow-2xl ring-1 ring-border"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-maroon">
                {activePopup === "location" ? "Choose delivery location" : "Notifications"}
              </h2>
              <button className="grid h-9 w-9 place-items-center rounded-full bg-cream text-maroon" onClick={() => setActivePopup(null)} aria-label="Close popup">
                <X size={18} />
              </button>
            </div>

            {activePopup === "location" ? (
              <div className="mt-4 space-y-3">
                <label className="flex h-12 items-center gap-3 rounded-2xl bg-cream px-4">
                  <Search size={17} className="text-muted" />
                  <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold" placeholder="Search area or PIN code" />
                </label>
                {[
                  "221B Baker Street, Salt Lake",
                  "Sector V, Kolkata 700091",
                  "Park Circus, Kolkata 700017",
                ].map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setLocation(item);
                      setActivePopup(null);
                    }}
                    className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left text-sm font-black ${
                      location === item ? "border-red bg-red/5 text-maroon" : "border-border bg-white text-charcoal"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <MapPin size={18} className="min-w-5 text-red" />
                      <span className="truncate">{item}</span>
                    </span>
                    {location === item ? <Check size={18} className="text-red" /> : null}
                  </button>
                ))}
                <p className="rounded-2xl bg-cream p-3 text-xs font-bold text-muted">
                  Serviceable PINs: 700001, 700016, 700019, 700029, 700091.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {[
                  ["Order updates", "Preparing, packed, out for delivery, and delivered alerts."],
                  ["Coupons", "Personal offers and recovery coupons."],
                  ["Loyalty", "Points earned, expiring points, and tier changes."],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-2xl border border-border bg-cream p-4">
                    <p className="font-black text-charcoal">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{body}</p>
                  </div>
                ))}
                <Link href="/account" className="flex h-12 items-center justify-center rounded-2xl bg-red text-sm font-black text-white">
                  Manage preferences
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
