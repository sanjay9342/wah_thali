"use client";

import { ArrowRight, Heart, Minus, Plus, Search, ShoppingBag, Star, TimerReset, Utensils } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { writeStoredCart } from "@/lib/cart-storage";
import { readCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";
import { formatRupees, getPricableCartLines } from "@/lib/pricing";
import type { CartLine, Product } from "@/lib/types";
import { useStoredCart } from "@/lib/use-stored-cart";
import { useStoredWishlist } from "@/lib/use-stored-wishlist";
import { writeStoredWishlist } from "@/lib/wishlist-storage";

function fallbackDishImage(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.src = "/wah-thali-meal-cutout-v2.png";
}

function getDefaultVariantId(product: Product) {
  return product.variants[0]?.id ?? "regular";
}

function getQuantity(lines: CartLine[], productId: string) {
  return lines
    .filter((line) => line.productId === productId)
    .reduce((total, line) => total + line.quantity, 0);
}

function DietMark({ type }: { type: Product["dietaryType"] }) {
  const isNonVeg = type === "NON_VEG";
  return (
    <span
      className={`grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border-2 bg-white ${isNonVeg ? "border-[#c62828]" : "border-[#078b52]"}`}
      aria-label={isNonVeg ? "Non veg" : "Veg"}
      title={isNonVeg ? "Non veg" : "Veg"}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${isNonVeg ? "bg-[#c62828]" : "bg-[#078b52]"}`} />
    </span>
  );
}

export function WishlistClient({ products }: { products: Product[] }) {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const ownerId = session?.mobile;
  const savedProductIds = useStoredWishlist(ownerId);
  const cart = useStoredCart(ownerId);
  const validCart = useMemo(() => getPricableCartLines(cart, products), [cart, products]);
  const availableById = useMemo(() => new Map(products.filter((product) => product.available).map((product) => [product.id, product])), [products]);
  const savedProducts = useMemo(
    () => savedProductIds.map((id) => availableById.get(id)).filter((product): product is Product => Boolean(product)),
    [availableById, savedProductIds],
  );
  const featuredProducts = savedProducts.length ? savedProducts.slice(0, 3) : products.filter((product) => product.available).slice(0, 3);

  useEffect(() => {
    function refreshSession() {
      setSession(readCustomerSession());
      setSessionReady(true);
    }

    refreshSession();
    return subscribeCustomerSession(refreshSession);
  }, []);

  function removeSaved(productId: string) {
    writeStoredWishlist(savedProductIds.filter((id) => id !== productId), ownerId);
  }

  function addProduct(product: Product) {
    if (!ownerId) {
      router.push("/login?next=/wishlist");
      return;
    }

    const variantId = getDefaultVariantId(product);
    const existingIndex = validCart.findIndex((line) => line.productId === product.id && line.variantId === variantId && line.addonIds.length === 0);
    const nextCart = existingIndex >= 0
      ? validCart.map((line, index) => index === existingIndex ? { ...line, quantity: line.quantity + 1 } : line)
      : [...validCart, { productId: product.id, variantId, addonIds: [], quantity: 1 }];

    writeStoredCart(nextCart, ownerId);
  }

  function decreaseProduct(product: Product) {
    const variantId = getDefaultVariantId(product);
    const targetIndex = validCart.findIndex((line) => line.productId === product.id && line.variantId === variantId && line.addonIds.length === 0);
    if (targetIndex < 0) return;

    writeStoredCart(
      validCart
        .map((line, index) => index === targetIndex ? { ...line, quantity: line.quantity - 1 } : line)
        .filter((line) => line.quantity > 0),
      ownerId,
    );
  }

  return (
    <>
      <Header showLocation />
      <main className="min-h-screen bg-[#fffafa] px-4 pb-28 pt-5 text-charcoal sm:px-6 lg:px-8 lg:pb-14">
        <div className="mx-auto max-w-[1180px]">
          <section className="overflow-hidden rounded-[28px] border border-[#f1dce1] bg-[#fff4f5] shadow-[0_16px_42px_rgba(141,0,33,0.08)]">
            <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center lg:p-9">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-maroon">Saved dishes</p>
                <h1 className="mt-3 max-w-[560px] text-[34px] font-black leading-tight text-charcoal sm:text-[44px]">
                  Your Wah Thali wishlist
                </h1>
                <p className="mt-3 max-w-[560px] text-sm font-bold leading-6 text-muted sm:text-base">
                  {savedProducts.length
                    ? `${savedProducts.length} favourite ${savedProducts.length === 1 ? "dish is" : "dishes are"} ready for quick ordering.`
                    : "Tap the heart on any menu dish and it will appear here with live price, photo, and cart controls."}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/menu" className="inline-flex h-11 items-center gap-2 rounded-xl bg-maroon px-5 text-sm font-black text-white">
                    <Search size={17} /> Browse dishes
                  </Link>
                  {savedProducts.length ? (
                    <Link href="/cart" className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-maroon ring-1 ring-[#f1dce1]">
                      Open cart <ArrowRight size={17} />
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 lg:justify-self-end">
                {featuredProducts.map((product, index) => (
                  <div key={product.id} className={`overflow-hidden rounded-2xl bg-white shadow-[0_12px_28px_rgba(34,31,32,0.08)] ring-1 ring-white ${index === 1 ? "translate-y-4" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={product.image} alt="" className="aspect-[0.86/1] w-full object-cover" loading="lazy" decoding="async" onError={fallbackDishImage} />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {!sessionReady ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-[330px] animate-pulse rounded-[24px] bg-white shadow-sm ring-1 ring-[#f1e7e4]" />
              ))}
            </div>
          ) : !session ? (
            <section className="mt-6 rounded-[26px] bg-white p-7 text-center shadow-sm ring-1 ring-[#eadfe3]">
              <Heart className="mx-auto text-maroon" size={34} />
              <h2 className="mt-4 text-2xl font-black text-charcoal">Sign in to see your wishlist</h2>
              <p className="mx-auto mt-2 max-w-[440px] text-sm font-bold leading-6 text-muted">
                Favourites are saved to your Wah Thali account so your dishes stay correct across pages.
              </p>
              <Link href="/login?next=/wishlist" className="mt-5 inline-flex h-12 items-center rounded-xl bg-maroon px-6 font-black text-white">
                Sign In
              </Link>
            </section>
          ) : savedProducts.length ? (
            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {savedProducts.map((product) => {
                const quantity = getQuantity(validCart, product.id);

                return (
                  <article key={product.id} className="group overflow-hidden rounded-[24px] bg-white shadow-[0_14px_34px_rgba(34,31,32,0.07)] ring-1 ring-[#f1e7e4]">
                    <div className="relative aspect-[1.35/1] overflow-hidden bg-[#f8edf0]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" decoding="async" onError={fallbackDishImage} />
                      <button
                        type="button"
                        onClick={() => removeSaved(product.id)}
                        className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white text-maroon shadow-[0_10px_22px_rgba(34,31,32,0.14)]"
                        aria-label={`Remove ${product.name} from wishlist`}
                      >
                        <Heart size={19} className="fill-maroon" />
                      </button>
                      {product.offer ? (
                        <span className="absolute bottom-3 left-3 rounded-full bg-maroon px-3 py-1 text-xs font-black text-white">
                          {product.offer}
                        </span>
                      ) : null}
                    </div>

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-wide text-muted">{product.category}</p>
                          <h2 className="mt-1 line-clamp-1 text-xl font-black text-charcoal">{product.name}</h2>
                        </div>
                        <DietMark type={product.dietaryType} />
                      </div>
                      <p className="mt-2 line-clamp-2 min-h-11 text-sm font-semibold leading-6 text-muted">{product.description}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black text-muted">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[#fff4f5] px-2 py-1 text-maroon">
                          <Star size={13} className="fill-maroon" /> {product.rating}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[#f7f8fb] px-2 py-1">
                          <TimerReset size={13} /> {product.prepTimeMinutes}-{product.prepTimeMinutes + 8} min
                        </span>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span>
                          <span className="block text-xl font-black text-charcoal">{formatRupees(product.price)}</span>
                          {product.originalPrice ? <span className="text-xs font-bold text-muted line-through">{formatRupees(product.originalPrice)}</span> : null}
                        </span>
                        {quantity ? (
                          <div className="inline-grid h-11 grid-cols-[38px_36px_38px] overflow-hidden rounded-xl bg-maroon text-white">
                            <button type="button" onClick={() => decreaseProduct(product)} className="grid place-items-center" aria-label={`Remove one ${product.name}`}>
                              <Minus size={16} />
                            </button>
                            <span className="grid place-items-center text-sm font-black">{quantity}</span>
                            <button type="button" onClick={() => addProduct(product)} className="grid place-items-center" aria-label={`Add one ${product.name}`}>
                              <Plus size={16} />
                            </button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => addProduct(product)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-maroon px-4 text-sm font-black text-white">
                            <ShoppingBag size={16} /> Add
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          ) : (
            <section className="mt-6 overflow-hidden rounded-[26px] bg-white shadow-sm ring-1 ring-[#eadfe3]">
              <div className="grid gap-6 p-6 text-center sm:p-8 lg:grid-cols-[0.85fr_1fr] lg:items-center lg:text-left">
                <div className="grid grid-cols-3 gap-3">
                  {featuredProducts.map((product, index) => (
                    <div key={product.id} className={`overflow-hidden rounded-2xl bg-[#fff4f5] shadow-sm ${index === 1 ? "translate-y-4" : ""}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={product.image} alt="" className="aspect-[0.9/1] w-full object-cover" loading="lazy" decoding="async" onError={fallbackDishImage} />
                    </div>
                  ))}
                </div>
                <div>
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#fff4f5] text-maroon lg:mx-0">
                    <Utensils size={27} />
                  </span>
                  <h2 className="mt-5 text-2xl font-black text-charcoal">No favourites yet</h2>
                  <p className="mt-2 max-w-[480px] text-sm font-bold leading-6 text-muted">
                    Go to the menu and tap the heart on any dish. Your selected favourites will appear here instantly.
                  </p>
                  <Link href="/menu" className="mt-5 inline-flex h-12 items-center gap-2 rounded-xl bg-maroon px-6 font-black text-white">
                    Find dishes <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
      <MobileNav />
    </>
  );
}
