"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
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
  TimerReset,
  Store,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { categories as fallbackCategories, products as fallbackProducts } from "@/lib/data";
import { useDeliveryLocation } from "@/lib/delivery-location";
import { calculateCartTotals, formatRupees, getPricableCartLines } from "@/lib/pricing";
import { writeStoredCart } from "@/lib/cart-storage";
import { useStoredCart } from "@/lib/use-stored-cart";
import type { CartLine, HomeSlide, Product, RestaurantSettings } from "@/lib/types";

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
  onOpen,
  orderingDisabled,
}: {
  product: Product;
  quantity: number;
  saved: boolean;
  onAdd: () => void;
  onDecrease: () => void;
  onToggleSave: () => void;
  onOpen: () => void;
  orderingDisabled: boolean;
}) {
  return (
    <article className="grid grid-cols-[104px_1fr] gap-3 rounded-3xl bg-white p-3 shadow-[0_12px_32px_rgba(34,31,32,0.08)] ring-1 ring-border">
      <button className="relative text-left" onClick={onOpen} aria-label={`View details for ${product.name}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.image} alt={product.name} className="h-28 w-full rounded-2xl object-cover" loading="lazy" />
        <span
          className={`absolute left-2 top-2 grid h-5 w-5 place-items-center rounded-md border bg-white ${
            product.dietaryType === "NON_VEG" ? "border-red" : "border-maroon"
          }`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${product.dietaryType === "NON_VEG" ? "bg-red" : "bg-maroon"}`} />
        </span>
      </button>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <button className="min-w-0 text-left" onClick={onOpen}>
            <h3 className="truncate text-sm font-black text-charcoal">{product.name}</h3>
            <p className="mt-1 truncate text-xs font-semibold text-muted">{product.category}</p>
          </button>
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

        <div className="mt-6 flex items-center justify-between gap-2">
          <span className="font-black text-charcoal">{formatRupees(product.price)}</span>
          {orderingDisabled ? (
            <button disabled className="h-10 w-28 cursor-not-allowed rounded-xl bg-muted/20 text-xs font-black uppercase text-muted">
              Closed
            </button>
          ) : (
            <QuantityControl quantity={quantity} onAdd={onAdd} onDecrease={onDecrease} />
          )}
        </div>
      </div>
    </article>
  );
}

function DishDetailSheet({
  product,
  quantity,
  onAdd,
  onDecrease,
  onClose,
  orderingDisabled,
}: {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onDecrease: () => void;
  onClose: () => void;
  orderingDisabled: boolean;
}) {
  const hasChoices = product.variants.length > 1 || product.addons.length > 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-charcoal/62 backdrop-blur-[1px]" onClick={onClose}>
      <button
        className="absolute left-1/2 top-[calc(24vh-28px)] z-10 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full bg-charcoal/85 text-white shadow-2xl sm:top-[calc(50%-280px)]"
        onClick={onClose}
        aria-label="Close dish details"
      >
        <X size={30} strokeWidth={3} />
      </button>

      <section
        className="max-h-[76vh] w-full max-w-xl overflow-hidden rounded-t-[28px] bg-white shadow-[0_-18px_46px_rgba(34,31,32,0.28)] sm:mb-6 sm:rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
        aria-modal="true"
        role="dialog"
        aria-labelledby="dish-detail-title"
      >
        <div className="relative h-[45vh] min-h-[280px] max-h-[430px] w-full bg-border sm:h-[360px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        </div>

        <div className="relative px-6 pb-[calc(env(safe-area-inset-bottom)+26px)] pt-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
            <div className="min-w-0">
              <span
                className={`grid h-7 w-7 place-items-center rounded-md border bg-white ${
                  product.dietaryType === "NON_VEG" ? "border-red" : "border-maroon"
                }`}
              >
                <span className={`h-3.5 w-3.5 rounded-full ${product.dietaryType === "NON_VEG" ? "bg-red" : "bg-maroon"}`} />
              </span>
              <h2 id="dish-detail-title" className="mt-3 text-xl font-black leading-tight text-charcoal">
                {product.name}
              </h2>
              <p className="mt-3 text-xl font-black text-charcoal">{formatRupees(product.price)}</p>
            </div>

            <div className="pt-4">
              {orderingDisabled ? (
                <button disabled className="h-14 w-32 cursor-not-allowed rounded-xl bg-muted/15 text-sm font-black uppercase text-muted shadow-lg ring-1 ring-border">
                  Closed
                </button>
              ) : (
                <QuantityControl quantity={quantity} onAdd={onAdd} onDecrease={onDecrease} />
              )}
              {hasChoices ? <p className="mt-2 text-center text-sm font-bold text-muted">Customisable</p> : null}
            </div>
          </div>

          <div className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-maroon px-2.5 py-1.5 text-sm font-black text-white">
            <Star size={15} className="fill-white" />
            {product.rating} ({product.ratingCount})
          </div>

          <p className="mt-5 text-[15px] font-semibold leading-6 text-muted">{product.description}</p>

          {product.recentReviews?.length ? (
            <div className="mt-6 border-t border-border pt-4">
              <h3 className="text-sm font-black text-charcoal">Customer reviews</h3>
              <div className="mt-3 grid gap-3">
                {product.recentReviews.map((review) => (
                  <article key={review.id} className="rounded-2xl bg-cream p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-black text-charcoal">{review.customerName}</p>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-maroon px-2 py-1 text-xs font-black text-white">
                        <Star size={11} className="fill-white" />
                        {review.rating}
                      </span>
                    </div>
                    {review.comment ? <p className="mt-2 text-xs font-semibold leading-5 text-muted">{review.comment}</p> : null}
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export function MenuExperience({
  initialCategories = fallbackCategories,
  initialProducts = fallbackProducts,
  initialSlides,
  initialCategoryImages = {},
  restaurantSettings,
  initialActiveCategory,
}: {
  initialCategories?: string[];
  initialProducts?: Product[];
  initialSlides?: HomeSlide[];
  initialCategoryImages?: Record<string, string>;
  restaurantSettings?: RestaurantSettings;
  initialActiveCategory?: string;
}) {
  const categories = initialCategories;
  const products = initialProducts;
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(() => {
    if (!initialActiveCategory || initialActiveCategory === "All") return "All";
    return categories.includes(initialActiveCategory) ? initialActiveCategory : "All";
  });
  const deliveryLocation = useDeliveryLocation();
  const [activePopup, setActivePopup] = useState<"location" | "notifications" | null>(null);
  const [savedProductIds, setSavedProductIds] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const cart = useStoredCart();
  const validCart = useMemo(() => getPricableCartLines(cart, products), [cart, products]);
  const fallbackSlides: HomeSlide[] = [
    {
      id: "thali-deal",
      eyebrow: "Thali deal",
      title: "Flat 20% OFF",
      body: "on all Thalis Today!",
      code: "WAHTHALI20",
      image: "/wah-thali-meal-cutout-v2.png",
      targetCategory: "Exclusive Thali",
      active: true,
      sortOrder: 1,
    },
    {
      id: "family-feast",
      eyebrow: "Family feast",
      title: "Combo at Rs 499",
      body: "2 thalis, dessert, and drinks.",
      code: "FAMILY10",
      image: "/wah-thali-meal-cutout-v2.png",
      targetCategory: "Indian Combo",
      active: true,
      sortOrder: 2,
    },
    {
      id: "lunch-saver",
      eyebrow: "Lunch saver",
      title: "Mini meals from Rs 99",
      body: "Fast office lunch, fresh daily.",
      code: "MINI99",
      image: "/wah-thali-meal-cutout-v2.png",
      targetCategory: "Meal at 99",
      active: true,
      sortOrder: 3,
    },
  ];
  const promoSlides = initialSlides?.length ? initialSlides : fallbackSlides;

  useEffect(() => {
    if (promoSlides.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % promoSlides.length);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [promoSlides.length]);

  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      const categoryMatch = activeCategory === "All" || product.category === activeCategory;
      const textMatch =
        !needle ||
        `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(needle);
      return categoryMatch && textMatch;
    });
  }, [activeCategory, products, query]);

  const storeMode = restaurantSettings?.storeMode ?? "OPEN";
  const orderingDisabled = storeMode === "CLOSED" || storeMode === "PAUSED";
  const statusMessage = getStoreStatusMessage(restaurantSettings);
  const totals = calculateCartTotals(validCart, "WAH50", products, undefined, restaurantSettings);

  useEffect(() => {
    if (validCart.length !== cart.length) {
      writeStoredCart(validCart);
    }
  }, [cart, validCart]);

  useEffect(() => {
    if (!selectedProduct) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedProduct(null);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedProduct]);

  function persist(next: CartLine[]) {
    writeStoredCart(next);
  }

  function addProduct(product: Product) {
    if (orderingDisabled) return;

    const existingIndex = validCart.findIndex((line) => line.productId === product.id);
    if (existingIndex >= 0) {
      persist(
        validCart.map((line, index) =>
          index === existingIndex ? { ...line, quantity: line.quantity + 1 } : line,
        ),
      );
      return;
    }

    persist([
      ...validCart,
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
      validCart
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
          <div className="pointer-events-none absolute left-[calc(100vw-118px)] top-[66px] -z-10 h-[126px] w-[126px] min-[380px]:left-[calc(100vw-134px)] min-[380px]:top-[62px] min-[380px]:h-[144px] min-[380px]:w-[144px]">
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
            className="absolute right-3 top-2.5 z-30 grid h-8 w-8 place-items-center rounded-full bg-white/94 text-charcoal shadow-[0_8px_18px_rgba(34,31,32,0.14)] ring-1 ring-border/80 backdrop-blur"
            onClick={() => setActivePopup("notifications")}
            aria-label="Notifications"
          >
            <Bell size={15} />
            <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red" />
          </button>

          <button
            className="absolute left-3 top-[54px] z-10 grid max-w-[calc(100%-86px)] grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2 text-left"
            onClick={() => {
              window.location.href = "/address";
            }}
          >
            <span className="grid h-8 w-8 place-items-center rounded-2xl bg-white/88 text-red shadow-[0_8px_18px_rgba(34,31,32,0.10)] ring-1 ring-border/70 backdrop-blur">
              <MapPin size={15} className="fill-red/10" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold leading-none text-muted">Deliver to</span>
              <span className="mt-1 block truncate text-[11px] font-black text-charcoal min-[380px]:text-xs">{deliveryLocation.address}</span>
            </span>
            <ChevronDown size={13} className="text-charcoal" />
          </button>

          <label className="absolute left-3 top-[102px] z-10 flex h-8 w-[calc(100vw-154px)] max-w-[245px] items-center gap-2.5 rounded-2xl bg-white/95 px-3 shadow-[0_8px_18px_rgba(34,31,32,0.11)] ring-1 ring-border/80 backdrop-blur min-[380px]:w-[calc(100vw-178px)] min-[380px]:max-w-[258px]">
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
                onClick={() => {
                  window.location.href = "/address";
                }}
              >
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/80 text-red shadow-[0_8px_18px_rgba(34,31,32,0.08)] ring-1 ring-border/70 backdrop-blur sm:h-12 sm:w-12 lg:h-[52px] lg:w-[52px]">
                  <MapPin size={19} className="fill-red/10" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold leading-none text-muted sm:text-sm lg:text-base">Deliver to</span>
                  <span className="mt-1.5 block truncate text-sm font-black text-charcoal min-[380px]:text-base sm:text-xl lg:text-2xl">{deliveryLocation.address}</span>
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
        {storeMode !== "OPEN" ? (
          <div className={`mb-4 rounded-2xl border p-4 shadow-sm ${storeMode === "BUSY" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-red/20 bg-white text-maroon"}`}>
            <div className="flex items-start gap-3">
              {storeMode === "BUSY" ? <TimerReset className="mt-0.5 shrink-0" size={22} /> : <Store className="mt-0.5 shrink-0 text-red" size={22} />}
              <div>
                <p className="text-sm font-black uppercase tracking-wide">
                  {storeMode === "BUSY" ? "Kitchen busy" : storeMode === "PAUSED" ? "Ordering paused" : "Restaurant closed"}
                </p>
                <p className="mt-1 text-sm font-bold">{statusMessage}</p>
                <p className="mt-1 text-xs font-semibold opacity-80">Opening hours: {restaurantSettings?.openingHours ?? "11:30 AM - 10:00 PM"}</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="relative mb-4 h-32 overflow-hidden rounded-2xl bg-white shadow-[0_12px_28px_rgba(34,31,32,0.14)] ring-1 ring-border sm:mb-5 sm:h-40 sm:rounded-3xl">
          <Link
            href={getSlideHref(promoSlides[activeSlide], categories)}
            onClick={() => {
              const target = getSlideTargetCategory(promoSlides[activeSlide], categories);
              if (target) setActiveCategory(categories.includes(target) ? target : "All");
            }}
            className="absolute inset-0 block"
            aria-label={`View ${getSlideTargetCategory(promoSlides[activeSlide], categories) ?? "all food"} offers`}
          >
            <Image
              src={promoSlides[activeSlide].image}
              alt={promoSlides[activeSlide].title}
              fill
              sizes="(max-width: 639px) 100vw, 1152px"
              priority
              unoptimized
              className="object-cover object-center transition-opacity duration-500"
            />
          </Link>
          <button
            onClick={() => setActiveSlide((current) => (current + promoSlides.length - 1) % promoSlides.length)}
            className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-maroon shadow-lg backdrop-blur sm:grid"
            aria-label="Previous offer"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setActiveSlide((current) => (current + 1) % promoSlides.length)}
            className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-red shadow-lg backdrop-blur"
            aria-label="Next offer"
          >
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {promoSlides.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => setActiveSlide(index)}
                className={`h-1.5 rounded-full shadow ${activeSlide === index ? "w-5 bg-white" : "w-1.5 bg-white/60"}`}
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
                  src={initialCategoryImages[slugifyCategory(category)] ?? products[index % products.length]?.image ?? "/wah-thali-meal-cutout-v2.png"}
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

      <section id="menu-items" className="mx-auto max-w-6xl scroll-mt-5 px-4 pb-6 sm:px-6 lg:px-8">
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
                quantity={getQuantity(validCart, product.id)}
                saved={savedProductIds.includes(product.id)}
                onAdd={() => addProduct(product)}
                onDecrease={() => decreaseProduct(product)}
                onToggleSave={() => toggleSaved(product)}
                onOpen={() => setSelectedProduct(product)}
                orderingDisabled={orderingDisabled}
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

      {validCart.length ? (
        <div className="fixed bottom-[92px] left-0 right-0 z-40 px-4">
          <Link prefetch href="/cart" className="mx-auto flex max-w-xl items-center justify-between rounded-2xl bg-maroon px-5 py-4 font-black text-white shadow-2xl">
            <span>{validCart.reduce((total, line) => total + line.quantity, 0)} items</span>
            <span>{formatRupees(totals.grandTotal)} - View cart</span>
          </Link>
        </div>
      ) : null}

      <SiteFooter />
      <MobileNav />

      {selectedProduct ? (
        <DishDetailSheet
          product={selectedProduct}
          quantity={getQuantity(validCart, selectedProduct.id)}
          onAdd={() => addProduct(selectedProduct)}
          onDecrease={() => decreaseProduct(selectedProduct)}
          onClose={() => setSelectedProduct(null)}
          orderingDisabled={orderingDisabled}
        />
      ) : null}

      {activePopup ? (
        <div className="fixed inset-0 z-[70] bg-charcoal/40 px-4 py-5 backdrop-blur-sm" onClick={() => setActivePopup(null)}>
          <div
            className="mx-auto mt-16 max-w-md rounded-[28px] bg-white p-5 shadow-2xl ring-1 ring-border"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-maroon">
                {activePopup === "location" ? "Select a location" : "Notifications"}
              </h2>
              <button className="grid h-9 w-9 place-items-center rounded-full bg-cream text-maroon" onClick={() => setActivePopup(null)} aria-label="Close popup">
                <X size={18} />
              </button>
            </div>

            {activePopup === "location" ? (
              <div className="mt-4 space-y-3">
                <label className="flex h-12 items-center gap-3 rounded-2xl bg-cream px-4">
                  <Search size={17} className="text-muted" />
                  <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold" placeholder="Search for area, street name..." />
                </label>
                <Link href="/address" className="flex w-full items-center justify-between rounded-2xl border border-border bg-white p-4 text-left text-sm font-black text-red">
                  <span className="flex min-w-0 items-center gap-3">
                    <MapPin size={18} className="min-w-5 text-red" />
                    <span className="truncate">Use current location</span>
                  </span>
                  <ChevronRight size={18} />
                </Link>
                <Link href="/address" className="flex w-full items-center justify-between rounded-2xl border border-border bg-white p-4 text-left text-sm font-black text-red">
                  <span className="flex min-w-0 items-center gap-3">
                    <Plus size={18} className="min-w-5 text-red" />
                    <span className="truncate">Add Address</span>
                  </span>
                  <ChevronRight size={18} />
                </Link>
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

function slugifyCategory(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getSlideHref(slide: HomeSlide, categories: string[]) {
  const target = getSlideTargetCategory(slide, categories);
  if (!target || target === "All") return "/menu#menu-items";
  return `/menu?category=${encodeURIComponent(target)}#menu-items`;
}

function getSlideTargetCategory(slide: HomeSlide, categories: string[]) {
  const savedTarget = slide.targetCategory?.trim();
  if (savedTarget && (savedTarget === "All" || categories.includes(savedTarget))) return savedTarget;

  const text = `${slide.eyebrow} ${slide.title} ${slide.body} ${slide.code}`.toLowerCase();
  const inferred =
    text.includes("mini") || text.includes("99")
      ? "Meal at 99"
      : text.includes("family") || text.includes("combo")
        ? "Indian Combo"
        : text.includes("thali")
          ? "Exclusive Thali"
          : categories[0];

  return categories.includes(inferred) ? inferred : categories[0] ?? "All";
}

function getStoreStatusMessage(settings?: RestaurantSettings) {
  if (!settings) return "Ordering is controlled by the restaurant.";
  const customReason = settings.storeStatusReason.trim();
  if (customReason) return customReason;
  if (settings.storeMode === "BUSY") return settings.busyMessage;
  if (settings.storeMode === "PAUSED") return settings.pausedMessage;
  if (settings.storeMode === "CLOSED") return settings.closedMessage;
  return "Restaurant is accepting orders.";
}
