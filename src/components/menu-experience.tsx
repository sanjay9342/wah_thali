"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BadgePercent,
  Bell,
  Bike,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Grid3X3,
  Heart,
  LockKeyhole,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  Store,
  TimerReset,
  Truck,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileNav } from "@/components/mobile-nav";
import { categories as fallbackCategories, products as fallbackProducts } from "@/lib/data";
import { writeStoredCart } from "@/lib/cart-storage";
import { useDeliveryLocation } from "@/lib/delivery-location";
import { formatRupees, getPricableCartLines, getProductPrice } from "@/lib/pricing";
import { useStoredCart } from "@/lib/use-stored-cart";
import type { CartLine, HomeSlide, Product, RestaurantSettings } from "@/lib/types";

function getQuantity(lines: CartLine[], productId: string) {
  return lines
    .filter((line) => line.productId === productId)
    .reduce((total, line) => total + line.quantity, 0);
}

function cleanDisplayText(value: string) {
  return value
    .replaceAll("\u00e2\u201a\u00b9", "\u20b9")
    .replaceAll("\u00e2\u20ac\u00a2", "\u2022");
}

function QuantityControl({
  quantity,
  onAdd,
  onDecrease,
  disabled,
  wide = false,
}: {
  quantity: number;
  onAdd: () => void;
  onDecrease: () => void;
  disabled: boolean;
  wide?: boolean;
}) {
  if (disabled) {
    return (
      <button disabled className={`${wide ? "min-w-[132px] shrink-0" : ""} h-8 rounded-[8px] bg-[#f2eef0] px-3 text-[10px] font-black text-muted sm:h-9 sm:px-4 sm:text-xs`}>
        Closed
      </button>
    );
  }

  if (quantity > 0) {
    return (
      <div className={`${wide ? "w-[132px] shrink-0 sm:w-[144px]" : "w-[72px] sm:w-[86px]"} grid h-8 grid-cols-3 overflow-hidden rounded-[8px] bg-red text-white shadow-[0_9px_20px_rgba(141,0,33,0.18)] sm:h-9`}>
        <button className="grid place-items-center" onClick={onDecrease} aria-label="Decrease quantity">
          <Minus size={wide ? 13 : 11} strokeWidth={3} />
        </button>
        <span className="grid place-items-center text-[12px] font-black sm:text-sm">{quantity}</span>
        <button className="grid place-items-center" onClick={onAdd} aria-label="Increase quantity">
          <Plus size={wide ? 13 : 11} strokeWidth={3} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onAdd}
      className={`${wide ? "min-w-[132px] shrink-0 px-7" : "px-4"} h-8 rounded-[8px] bg-red text-[11px] font-black text-white shadow-[0_9px_20px_rgba(141,0,33,0.18)] sm:h-9 sm:px-5 sm:text-sm`}
    >
      Add
    </button>
  );
}

function DetailQuantityControl({
  quantity,
  onAdd,
  onDecrease,
  disabled,
}: {
  quantity: number;
  onAdd: () => void;
  onDecrease: () => void;
  disabled: boolean;
}) {
  if (disabled) {
    return (
      <button disabled className="h-9 w-[112px] shrink-0 rounded-[9px] bg-[#f2eef0] text-[12px] font-black text-muted">
        Closed
      </button>
    );
  }

  if (quantity > 0) {
    return (
      <div className="grid h-9 w-[112px] shrink-0 grid-cols-3 overflow-hidden rounded-[9px] bg-red text-white shadow-[0_10px_22px_rgba(141,0,33,0.22)]">
        <button className="grid place-items-center" onClick={onDecrease} aria-label="Decrease quantity">
          <Minus size={14} strokeWidth={3} />
        </button>
        <span className="grid place-items-center text-[13px] font-black">{quantity}</span>
        <button className="grid place-items-center" onClick={onAdd} aria-label="Increase quantity">
          <Plus size={14} strokeWidth={3} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onAdd}
      className="h-9 w-[112px] shrink-0 rounded-[9px] bg-red text-[12px] font-black text-white shadow-[0_10px_22px_rgba(141,0,33,0.22)]"
    >
      Add
    </button>
  );
}

function DietMark({ type }: { type: Product["dietaryType"] }) {
  const isNonVeg = type === "NON_VEG";
  return (
    <span className={`grid h-5 w-5 place-items-center rounded-[4px] border-2 bg-white ${isNonVeg ? "border-red" : "border-maroon"}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${isNonVeg ? "bg-red" : "bg-maroon"}`} />
    </span>
  );
}

function ProductCard({
  product,
  quantity,
  saved,
  onAdd,
  onDecrease,
  onOpen,
  onToggleSave,
  orderingDisabled,
}: {
  product: Product;
  quantity: number;
  saved: boolean;
  onAdd: () => void;
  onDecrease: () => void;
  onOpen: () => void;
  onToggleSave: () => void;
  orderingDisabled: boolean;
}) {
  return (
    <article className="min-w-[104px] overflow-hidden rounded-[14px] border border-[#f0e8e2] bg-white shadow-[0_10px_22px_rgba(34,31,32,0.055)] sm:min-w-0 sm:rounded-[22px] sm:shadow-[0_14px_34px_rgba(34,31,32,0.07)]">
      <div className="relative aspect-[1.42/1] w-full overflow-hidden bg-[#f6f1ed] sm:aspect-[1.23/1]">
        <button className="block h-full w-full text-left" onClick={onOpen} aria-label={`View details for ${product.name}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" loading="eager" />
        </button>
        <button
          className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white text-red shadow-[0_8px_18px_rgba(34,31,32,0.12)] sm:right-3 sm:top-3 sm:h-9 sm:w-9"
          onClick={onToggleSave}
          aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name}`}
        >
          <Heart size={12} className={saved ? "fill-red" : "sm:h-[17px] sm:w-[17px]"} />
        </button>
      </div>

      <div className="p-2 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <button className="min-w-0 text-left" onClick={onOpen}>
            <h3 className="line-clamp-1 text-[10px] font-black leading-tight text-charcoal sm:text-base">{product.name}</h3>
            <p className="mt-1 line-clamp-1 text-[8px] font-black uppercase tracking-wide text-muted sm:text-[11px]">{product.category}</p>
          </button>
          <span className="hidden sm:inline-flex"><DietMark type={product.dietaryType} /></span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1 text-[8px] font-bold text-muted sm:mt-3 sm:gap-2 sm:text-[11px]">
          <span className="inline-flex items-center gap-0.5 rounded-[5px] bg-[#fff3f5] px-1 py-0.5 font-black text-red sm:gap-1 sm:px-2 sm:py-1">
            <Star size={8} className="fill-red sm:h-[11px] sm:w-[11px]" />
            {product.rating}
          </span>
          <span>{product.prepTimeMinutes}-{product.prepTimeMinutes + 8} min</span>
        </div>

        {product.offer ? (
          <p className="mt-2 line-clamp-1 text-[8px] font-black text-maroon sm:mt-3 sm:text-[11px]">{product.offer}</p>
        ) : (
          <p className="mt-2 line-clamp-1 text-[8px] font-black text-maroon sm:mt-3 sm:text-[11px]">Fresh homely meal</p>
        )}

        <div className="mt-3 flex items-center justify-between gap-1.5 sm:mt-4 sm:gap-3">
          <span className="text-[10px] font-black text-charcoal sm:text-base">{formatRupees(product.price)}</span>
          <QuantityControl quantity={quantity} onAdd={onAdd} onDecrease={onDecrease} disabled={orderingDisabled} />
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
  onAdd: (addonIds?: string[]) => void;
  onDecrease: () => void;
  onClose: () => void;
  orderingDisabled: boolean;
}) {
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});
  const selectedAddonIds = useMemo(
    () =>
      product.addons.flatMap((addon) =>
        Array.from({ length: addonQuantities[addon.id] ?? 0 }, () => addon.id),
      ),
    [addonQuantities, product.addons],
  );
  const addonTotal = product.addons.reduce((total, addon) => total + addon.price * (addonQuantities[addon.id] ?? 0), 0);

  function addAddon(addonId: string) {
    setAddonQuantities((current) => ({
      ...current,
      [addonId]: (current[addonId] ?? 0) + 1,
    }));
  }

  function decreaseAddon(addonId: string) {
    setAddonQuantities((current) => {
      const nextQuantity = Math.max((current[addonId] ?? 0) - 1, 0);
      if (nextQuantity === 0) {
        const next = { ...current };
        delete next[addonId];
        return next;
      }
      return { ...current, [addonId]: nextQuantity };
    });
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-charcoal/55 backdrop-blur-[2px]" onClick={onClose}>
      <section
        className="max-h-[86vh] w-full max-w-xl overflow-hidden rounded-t-[30px] bg-white shadow-[0_-18px_46px_rgba(34,31,32,0.28)] sm:mb-6 sm:rounded-[30px]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dish-detail-title"
      >
        <div className="relative h-[34vh] min-h-[240px] bg-[#f6f1ed]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
          <button
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white text-charcoal shadow-lg"
            onClick={onClose}
            aria-label="Close dish details"
          >
            <X size={20} strokeWidth={3} />
          </button>
        </div>

        <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DietMark type={product.dietaryType} />
              <h2 id="dish-detail-title" className="mt-3 text-2xl font-black leading-tight text-charcoal">
                {product.name}
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">{product.description}</p>
              <p className="mt-4 text-xl font-black text-charcoal">{formatRupees(product.price + addonTotal)}</p>
            </div>
            <DetailQuantityControl quantity={quantity} onAdd={() => onAdd(selectedAddonIds)} onDecrease={onDecrease} disabled={orderingDisabled} />
          </div>

          {product.addons.length ? (
            <div className="mt-5 rounded-2xl bg-[#fff8f9] p-4">
              <h3 className="text-[13px] font-black text-charcoal">Add-ons</h3>
              <p className="mt-1 text-[11px] font-semibold leading-4 text-muted">Add extras to this meal before adding it to cart.</p>
              <div className="mt-3 grid gap-2">
                {product.addons.map((addon) => {
                  const addonQuantity = addonQuantities[addon.id] ?? 0;
                  return (
                    <div
                      key={addon.id}
                      className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-[#eee6e2] bg-white px-3 py-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-black text-charcoal">{addon.name}</span>
                        <span className="mt-0.5 block text-[11px] font-black text-charcoal">{formatRupees(addon.price)}</span>
                      </span>
                      {addonQuantity > 0 ? (
                        <span className="grid h-8 w-[74px] grid-cols-3 overflow-hidden rounded-[8px] bg-red text-white shadow-[0_9px_20px_rgba(141,0,33,0.16)]">
                          <button type="button" className="grid place-items-center" onClick={() => decreaseAddon(addon.id)} aria-label={`Remove ${addon.name}`}>
                            <Minus size={11} strokeWidth={3} />
                          </button>
                          <span className="grid place-items-center text-[11px] font-black">{addonQuantity}</span>
                          <button type="button" className="grid place-items-center" onClick={() => addAddon(addon.id)} aria-label={`Add more ${addon.name}`}>
                            <Plus size={11} strokeWidth={3} />
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="h-8 rounded-[8px] bg-red px-4 text-[11px] font-black text-white shadow-[0_9px_20px_rgba(141,0,33,0.16)]"
                          onClick={() => addAddon(addon.id)}
                        >
                          Add
                        </button>
                      )}
                    </div>
                  );
                })}
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
  const pathname = usePathname();
  const deliveryLocation = useDeliveryLocation();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(() => {
    if (!initialActiveCategory || initialActiveCategory === "All") return "All";
    return categories.includes(initialActiveCategory) ? initialActiveCategory : "All";
  });
  const [activePopup, setActivePopup] = useState<"menu" | "notifications" | "filters" | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [savedProductIds, setSavedProductIds] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [hiddenCartCount, setHiddenCartCount] = useState(0);
  const [cartBarClosing, setCartBarClosing] = useState(false);
  const cart = useStoredCart();
  const validCart = useMemo(() => getPricableCartLines(cart, products), [cart, products]);
  const storeMode = restaurantSettings?.storeMode ?? "OPEN";
  const orderingDisabled = storeMode === "CLOSED" || storeMode === "PAUSED";
  const statusMessage = getStoreStatusMessage(restaurantSettings);

  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      const categoryMatch = activeCategory === "All" || product.category === activeCategory;
      const textMatch = !needle || `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(needle);
      return product.available && categoryMatch && textMatch;
    });
  }, [activeCategory, products, query]);

  const popularProducts = useMemo(() => {
    const bestsellers = visibleProducts.filter((product) => product.bestseller);
    const otherProducts = visibleProducts.filter((product) => !bestsellers.some((item) => item.id === product.id));
    return [...bestsellers, ...otherProducts];
  }, [visibleProducts]);

  const promoSlides = useMemo(() => {
    const slides = initialSlides?.length ? initialSlides : [
      {
        id: "wah-thali-default",
        eyebrow: "Wah Thali",
        title: "Delicious food at your doorstep",
        body: "Meals from Rs 99",
        code: "WAH99",
        image: "/wah-thali-meal-cutout-v2.png",
        active: true,
        sortOrder: 1,
      },
    ];
    return slides;
  }, [initialSlides]);

  useEffect(() => {
    if (promoSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % promoSlides.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [promoSlides.length]);

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

  function addProduct(product: Product, addonIds: string[] = []) {
    if (orderingDisabled) return;
    const variantId = product.variants[0]?.id ?? "regular";
    const sortedAddonIds = [...addonIds].sort();
    const existingIndex = validCart.findIndex((line) =>
      line.productId === product.id &&
      line.variantId === variantId &&
      [...line.addonIds].sort().join("|") === sortedAddonIds.join("|"),
    );

    if (existingIndex >= 0) {
      persist(validCart.map((line, index) => index === existingIndex ? { ...line, quantity: line.quantity + 1 } : line));
      return;
    }

    persist([...validCart, { productId: product.id, variantId, addonIds: sortedAddonIds, quantity: 1 }]);
  }

  function decreaseProduct(product: Product) {
    persist(
      validCart
        .map((line) => line.productId === product.id ? { ...line, quantity: line.quantity - 1 } : line)
        .filter((line) => line.quantity > 0),
    );
  }

  function toggleSaved(product: Product) {
    setSavedProductIds((current) =>
      current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id],
    );
  }

  function closeCartBarWithFlyout() {
    if (cartCount === 0 || cartBarClosing) return;
    setCartBarClosing(true);
    window.setTimeout(() => {
      setHiddenCartCount(cartCount);
      setCartBarClosing(false);
    }, 520);
  }

  const categoryItems = ["All", ...categories];
  const cartCount = validCart.reduce((total, line) => total + line.quantity, 0);
  const cartSubtotal = useMemo(
    () => validCart.reduce((total, line) => total + getProductPrice(line, products), 0),
    [products, validCart],
  );
  const isHomePage = pathname === "/";
  const showCartBar = cartCount > 0 && hiddenCartCount !== cartCount;

  return (
    <main className="min-h-screen bg-white pb-24 text-charcoal lg:pb-0">
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
              <Link key={href} href={href} className={label === "Home" ? "text-red" : "text-charcoal hover:text-red"}>
                {label}
              </Link>
            ))}
          </nav>

          <Link href="/cart" className="relative grid h-11 w-11 place-items-center text-charcoal" aria-label="Cart">
            <ShoppingCart size={30} />
            {cartCount ? <span className="absolute -right-1 top-0 rounded-full bg-red px-1.5 text-[10px] font-black text-white">{cartCount}</span> : null}
          </Link>
          <Link href="/login" className="rounded-xl bg-red px-6 py-3 text-sm font-black text-white shadow-[0_9px_20px_rgba(141,0,33,0.18)]">
            Sign In
          </Link>
        </div>

        <div className="grid h-[58px] grid-cols-[1fr_auto_auto] items-center gap-2 px-3 lg:hidden">
          <Link href="/address" className="flex min-w-0 items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#fff4f5] text-red">
              <MapPin size={16} />
            </span>
            <span className="min-w-0">
              <span className="block text-[8px] font-black uppercase tracking-wide text-muted">Delivering to</span>
              <span className="block truncate text-[11px] font-black leading-tight text-charcoal">{deliveryLocation.address}</span>
            </span>
            <ChevronDown size={12} />
          </Link>

          <button className="relative grid h-9 w-9 place-items-center" onClick={() => setActivePopup("notifications")} aria-label="Notifications">
            <Bell size={21} />
            <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-red" />
          </button>
          <Link href="/cart" className={`relative grid h-9 w-9 place-items-center ${cartBarClosing ? "cart-catch-pulse" : ""}`} aria-label="Cart">
            <ShoppingCart size={23} />
            {cartCount ? <span className="absolute right-0 top-0 rounded-full bg-red px-1.5 text-[9px] font-black text-white">{cartCount}</span> : null}
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1250px] gap-6 px-3 pt-3 sm:px-6 lg:grid-cols-[224px_minmax(0,1fr)] lg:px-0 lg:pt-6">
        <aside className="sticky top-[128px] hidden h-[520px] overflow-hidden rounded-2xl border border-[#f1e7e4] bg-white p-4 shadow-[0_14px_40px_rgba(34,31,32,0.04)] lg:block">
          <div className="mb-4 flex items-center gap-2 border-b border-[#f1e7e4] pb-4 text-sm font-black uppercase tracking-wide text-muted">
            <BookOpen size={18} />
            Categories
          </div>
          <div className="grid gap-2">
            {categoryItems.slice(0, 9).map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`grid h-14 grid-cols-[38px_1fr] items-center gap-3 rounded-2xl px-3 text-left text-sm font-black ${
                  activeCategory === category ? "bg-[#fff4f5] text-red shadow-sm" : "text-charcoal hover:bg-[#fff8f9]"
                }`}
              >
                <span className={`grid h-8 w-8 place-items-center overflow-hidden rounded-full ${activeCategory === category ? "bg-red text-white" : "bg-[#fff4f5]"}`}>
                  {category === "All" ? (
                    <Grid3X3 size={17} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getCategoryImage(category, initialCategoryImages, products)} alt="" className="h-full w-full object-cover" loading="eager" />
                  )}
                </span>
                <span className="truncate">{shortCategoryName(category)}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0">
          {isHomePage ? (
            <section className="relative mb-4 h-[156px] overflow-hidden rounded-[14px] bg-red shadow-[0_10px_24px_rgba(34,31,32,0.08)] lg:hidden">
              <Image
                src={promoSlides[activeSlide]?.image || "/wah-thali-meal-cutout-v2.png"}
                alt={promoSlides[activeSlide]?.title || "Wah Thali offer"}
                fill
                priority
                unoptimized
                sizes="366px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-red via-red/80 to-red/15" />
              <div className="grid h-full grid-cols-[52%_48%] items-center">
                <div className="relative z-10 px-4 text-white">
                  <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/80">Wah Thali offer</p>
                  <h1 className="mt-1 line-clamp-3 max-w-[172px] text-[20px] font-black leading-[1.02]">
                    {promoSlides[activeSlide]?.title || "Delicious food at your doorstep"}
                  </h1>
                  <p className="mt-1 text-[11px] font-black text-white/90">
                    {promoSlides[activeSlide]?.body || `Meals from ${formatRupees(99)}`}
                  </p>
                </div>
                <div className="relative h-full" />
              </div>
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                {promoSlides.map((slide, index) => (
                  <button
                    key={slide.id}
                    onClick={() => setActiveSlide(index)}
                    className={`h-1.5 rounded-full ${index === activeSlide ? "w-4 bg-red" : "w-1.5 bg-white/80"}`}
                    aria-label={`Show ${slide.title}`}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="relative isolate hidden overflow-hidden rounded-[24px] bg-red shadow-[0_16px_36px_rgba(141,0,33,0.18)] lg:block lg:rounded-[22px]">
            <div className="grid min-h-[172px] grid-cols-[1fr_42%] items-center gap-1 px-5 py-5 sm:min-h-[230px] sm:px-8 lg:h-[286px] lg:grid-cols-[44%_56%] lg:px-11 lg:py-0">
              <div className="relative z-10 text-white">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-white/75">Wah Thali offer</p>
                <h1 className="mt-2 max-w-[500px] text-[34px] font-black leading-[1.12] sm:text-6xl lg:text-[48px]">
                  Delicious food
                  <span className="block">at your doorstep</span>
                </h1>
                <p className="mt-4 text-lg font-semibold text-white/85 lg:text-2xl">Meals from {formatRupees(99)}</p>
                <div className="mt-5 inline-flex h-12 items-center rounded-xl bg-white px-6 text-sm font-black text-red sm:text-base">
                  Order now
                </div>
              </div>
              <div className="relative h-full min-h-[138px] sm:min-h-[210px] lg:min-h-0">
                <Image
                  src="/wah-thali-meal-cutout-v2.png"
                  alt="Wah Thali meal offer"
                  fill
                  priority
                  sizes="(max-width: 1023px) 42vw, 560px"
                  className="scale-110 object-contain object-center drop-shadow-[0_24px_28px_rgba(34,31,32,0.32)]"
                />
              </div>
            </div>
          </section>

          <section className={`${isHomePage ? "hidden lg:block" : "block"} mt-5 rounded-2xl border border-[#f1e7e4] bg-white p-3 shadow-[0_12px_34px_rgba(34,31,32,0.06)] lg:mt-8`}>
            <label className="grid h-12 grid-cols-[42px_1fr_72px] items-center sm:h-14">
              <Search size={22} className="mx-auto text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 bg-transparent text-sm font-semibold text-charcoal placeholder:text-muted"
                placeholder="Search for restaurants, cuisines or dishes..."
              />
              <button type="button" onClick={() => setActivePopup("filters")} className="flex h-full items-center justify-center gap-2 border-l border-[#f1e7e4] text-xs font-black text-charcoal">
                <SlidersHorizontal size={18} />
                <span className="hidden sm:inline">Filters</span>
              </button>
            </label>
          </section>

          {storeMode !== "OPEN" ? (
            <section className="mt-5 rounded-2xl border border-red/20 bg-[#fff8f9] p-4 text-maroon">
              <div className="flex items-start gap-3">
                {storeMode === "BUSY" ? <TimerReset className="mt-0.5 shrink-0" size={22} /> : <Store className="mt-0.5 shrink-0 text-red" size={22} />}
                <div>
                  <p className="text-sm font-black uppercase tracking-wide">
                    {storeMode === "BUSY" ? "Kitchen busy" : storeMode === "PAUSED" ? "Ordering paused" : "Restaurant closed"}
                  </p>
                  <p className="mt-1 text-sm font-bold">{statusMessage}</p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="mt-5 lg:mt-8">
            <div className="flex gap-4 overflow-x-auto pb-3 lg:justify-between lg:overflow-visible">
              {categoryItems.slice(0, 6).map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className="grid min-w-[60px] place-items-center gap-1.5 text-center"
                >
                  <span className={`grid h-14 w-14 place-items-center overflow-hidden rounded-full border shadow-[0_8px_22px_rgba(34,31,32,0.06)] sm:h-20 sm:w-20 lg:h-24 lg:w-24 ${
                    activeCategory === category ? "border-red bg-red text-white" : "border-[#f1e7e4] bg-white text-charcoal"
                  }`}>
                    {category === "All" ? (
                      <Grid3X3 size={21} />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getCategoryImage(category, initialCategoryImages, products)} alt="" className="h-[72%] w-[72%] rounded-full object-cover" loading="eager" />
                    )}
                  </span>
                  <span className={`max-w-[62px] truncate text-[11px] font-black sm:max-w-20 sm:text-sm ${activeCategory === category ? "text-red" : "text-charcoal"}`}>
                    {shortCategoryName(category)}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section id="menu-items" className="mt-8 pb-8">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-black text-charcoal lg:text-3xl">Popular Dishes</h2>
              <button onClick={() => setActiveCategory("All")} className="inline-flex items-center gap-1 text-sm font-black text-red">
                View all <ChevronRight size={16} />
              </button>
            </div>

            {popularProducts.length ? (
              <>
              <div className="grid grid-cols-2 gap-3 pb-3 lg:hidden">
                {popularProducts.slice(0, 6).map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={getQuantity(validCart, product.id)}
                    saved={savedProductIds.includes(product.id)}
                    onAdd={() => product.addons.length ? setSelectedProduct(product) : addProduct(product)}
                    onDecrease={() => decreaseProduct(product)}
                    onOpen={() => setSelectedProduct(product)}
                    onToggleSave={() => toggleSaved(product)}
                    orderingDisabled={orderingDisabled}
                  />
                ))}
              </div>
              <div className="hidden gap-4 pb-3 lg:grid lg:grid-cols-3">
                {popularProducts.slice(0, 9).map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={getQuantity(validCart, product.id)}
                    saved={savedProductIds.includes(product.id)}
                    onAdd={() => product.addons.length ? setSelectedProduct(product) : addProduct(product)}
                    onDecrease={() => decreaseProduct(product)}
                    onOpen={() => setSelectedProduct(product)}
                    onToggleSave={() => toggleSaved(product)}
                    orderingDisabled={orderingDisabled}
                  />
                ))}
              </div>
              </>
            ) : (
              <div className="rounded-2xl border border-[#f1e7e4] bg-white p-8 text-center">
                <Store className="mx-auto text-muted" />
                <h3 className="mt-3 text-lg font-black text-charcoal">No items found</h3>
                <p className="mt-1 text-sm text-muted">Try thali, biryani, chicken, paneer, or dessert.</p>
              </div>
            )}
          </section>

          <section className="mt-2 pb-8 lg:mt-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[20px] font-black text-charcoal lg:text-3xl">Best Offers for You</h2>
              <Link href="/offers" className="inline-flex items-center gap-1 text-[11px] font-black text-red lg:text-sm">
                View all <ChevronRight size={14} />
              </Link>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {[
                ["FLAT 50% OFF", "up to ₹120", "Use Code: PARTY", "bg-[#e8f7ed] text-[#16833d]"],
                ["FREE DELIVERY", "on orders above ₹199", "Use Code: FREEDEL", "bg-[#fff0e8] text-[#c95000]"],
                ["30% OFF", "up to ₹80", "Use Code: YUMMY", "bg-[#f3ecff] text-[#6c35d5]"],
              ].map(([title, subtitle, code, classes]) => (
                <article key={title} className={`min-h-[96px] rounded-[12px] p-5 lg:min-h-[112px] ${classes}`}>
                  <div className="flex h-full items-center justify-between gap-4">
                    <div>
                      <h3 className="text-[15px] font-black leading-tight">{cleanDisplayText(title)} <span className="text-[10px]">{cleanDisplayText(subtitle)}</span></h3>
                      <p className="mt-4 inline-flex rounded-lg bg-white/55 px-3 py-2 text-[9px] font-black">{cleanDisplayText(code)}</p>
                    </div>
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/35">
                      {cleanDisplayText(title).startsWith("FLAT") ? (
                        <Truck size={29} strokeWidth={2.6} />
                      ) : cleanDisplayText(title).startsWith("FREE") ? (
                        <Bike size={29} strokeWidth={2.6} />
                      ) : (
                        <BadgePercent size={29} strokeWidth={2.6} />
                      )}
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[#f1e7e4] pt-5">
              {[
                ["No Minimum Order", "Order in for yourself"],
                ["Lightning Delivery", "On selected locations"],
                ["Best Quality", "Satisfaction guaranteed"],
                ["Safe & Secure", "100% secure payments"],
              ].map(([title, body]) => (
                <div key={title} className="grid grid-cols-[22px_1fr] gap-2">
                  <span className="grid h-5 w-5 place-items-center text-[#ff6b00]">
                    {title === "No Minimum Order" ? (
                      <ShoppingBag size={18} strokeWidth={2.7} />
                    ) : title === "Lightning Delivery" ? (
                      <Zap size={18} strokeWidth={2.7} />
                    ) : title === "Best Quality" ? (
                      <BadgeCheck size={18} strokeWidth={2.7} />
                    ) : (
                      <LockKeyhole size={18} strokeWidth={2.7} />
                    )}
                  </span>
                  <span>
                    <span className="block text-[10px] font-black text-charcoal">{title}</span>
                    <span className="mt-0.5 block text-[8px] font-semibold text-muted">{body}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {isHomePage ? (
            <section className="pb-20 pt-4 text-center lg:pb-14 lg:pt-8">
              <h2 className="text-[32px] font-black leading-[0.92] text-[#9aa1ad] lg:text-[42px]">
                Live
                <span className="block">it up!</span>
              </h2>
              <p className="mt-3 flex items-center justify-center gap-1 text-[9px] font-black text-[#a7adba] lg:text-xs">
                <span>Crafted with</span>
                <Heart size={11} className="fill-red text-red" />
                <span>in Asansol, India</span>
              </p>
            </section>
          ) : null}
        </div>
      </div>

      <div
        className={`fixed bottom-[72px] left-0 right-0 z-[60] px-5 transition-all duration-300 ease-out lg:bottom-6 ${
          cartBarClosing
            ? "pointer-events-none translate-y-0 opacity-100"
            : showCartBar
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-6 opacity-0"
        }`}
        aria-live="polite"
      >
        <div className={`mx-auto grid h-14 max-w-[320px] grid-cols-[1fr_auto_34px] items-center gap-3 rounded-[16px] bg-charcoal px-4 text-white shadow-[0_16px_34px_rgba(34,31,32,0.28)] lg:max-w-[380px] ${cartBarClosing ? "cart-fly-to-header" : ""}`}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red text-white">
              <ShoppingCart size={16} strokeWidth={3} />
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[9px] font-black text-red">
                {cartCount}
              </span>
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-black leading-none">{cartCount} {cartCount === 1 ? "Item" : "Items"}</span>
              <span className="mt-1 block text-[11px] font-black leading-none">{formatRupees(cartSubtotal)}</span>
            </span>
          </div>
          <Link href="/cart" className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-5 text-[12px] font-black text-red">
            View Cart <ChevronRight size={15} strokeWidth={3} />
          </Link>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full text-white/85 hover:bg-white/10"
            onClick={closeCartBarWithFlyout}
            aria-label="Hide cart bar"
          >
            <X size={17} strokeWidth={3} />
          </button>
        </div>
      </div>

      <MobileNav />

      {selectedProduct ? (
        <DishDetailSheet
          product={selectedProduct}
          quantity={getQuantity(validCart, selectedProduct.id)}
          onAdd={(addonIds) => addProduct(selectedProduct, addonIds)}
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
                {activePopup === "notifications" ? "Notifications" : activePopup === "filters" ? "Filters" : "Wah Thali"}
              </h2>
              <button className="grid h-9 w-9 place-items-center rounded-full bg-[#fff4f5] text-maroon" onClick={() => setActivePopup(null)} aria-label="Close popup">
                <X size={18} />
              </button>
            </div>

            {activePopup === "notifications" ? (
              <div className="mt-4 space-y-3">
                {[
                  ["Order updates", "Preparing, packed, out for delivery, and delivered alerts."],
                  ["Coupons", "Personal offers and recovery coupons."],
                  ["Loyalty", "Points earned, expiring points, and tier changes."],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-2xl border border-border bg-[#fff8f9] p-4">
                    <p className="font-black text-charcoal">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{body}</p>
                  </div>
                ))}
              </div>
            ) : activePopup === "filters" ? (
              <div className="mt-4 grid gap-3">
                {["All", "VEG", "NON_VEG"].map((item) => (
                  <button key={item} className="rounded-2xl border border-border bg-white p-4 text-left text-sm font-black text-charcoal">
                    {item === "All" ? "All dishes" : item === "VEG" ? "Veg only" : "Non-veg only"}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                {[
                  ["/menu", "Menu"],
                  ["/offers", "Offers"],
                  ["/orders", "Orders"],
                  ["/login", "Sign In"],
                  ["/cart", "Cart"],
                ].map(([href, label]) => (
                  <Link key={href} href={href} className="flex items-center justify-between rounded-2xl border border-border bg-white p-4 text-sm font-black text-charcoal">
                    <span>{label}</span>
                    <ChevronRight size={18} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function getCategoryImage(category: string, images: Record<string, string>, products: Product[]) {
  const direct = images[slugifyCategory(category)];
  if (direct) return direct;
  const matchingProduct = products.find((product) => product.category === category);
  return matchingProduct?.image ?? "/wah-thali-meal-cutout-v2.png";
}

function shortCategoryName(category: string) {
  const compact = category
    .replace("Chef's Recommendations", "Chef")
    .replace("Exclusive ", "")
    .replace("Kolkata ", "")
    .replace(" Combo", "");

  return compact.length > 14 ? compact.split(" ")[0] : compact;
}

function slugifyCategory(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
