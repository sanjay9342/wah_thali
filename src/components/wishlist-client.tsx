"use client";

import { ArrowLeft, ArrowRight, Heart, Minus, Plus, Search, ShoppingBag, Star, Utensils } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { writeStoredCart } from "@/lib/cart-storage";
import { readCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";
import { formatRupees, getPricableCartLines, getProductUnitPricing } from "@/lib/pricing";
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
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const savedProducts = useMemo(
    () => savedProductIds.map((id) => productById.get(id)).filter((product): product is Product => Boolean(product)),
    [productById, savedProductIds],
  );

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
    if (!product.available) return;

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
      <main className="min-h-screen bg-white px-4 pb-28 pt-4 text-charcoal sm:px-6 lg:px-8 lg:pb-14 lg:pt-8">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-4 flex items-start gap-3 rounded-[18px] bg-white p-3 shadow-sm ring-1 ring-[#eef1f6] sm:items-center sm:p-4">
            <Link href="/menu" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#fff4f5] text-maroon ring-1 ring-[#f1dce1]" aria-label="Back to menu">
              <ArrowLeft size={18} strokeWidth={2.8} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-maroon">Saved dishes</p>
              <h1 className="mt-1 text-[24px] font-black leading-tight text-charcoal sm:text-[32px]">Wishlist</h1>
              <p className="mt-1 text-[12px] font-bold leading-5 text-muted sm:text-[13px]">
                {savedProducts.length ? `${savedProducts.length} saved ${savedProducts.length === 1 ? "dish" : "dishes"}.` : "Tap a heart on any dish to save it here."}
              </p>
            </div>
            {savedProducts.length ? (
              <Link href="/cart" className="hidden h-9 shrink-0 items-center gap-1.5 rounded-full bg-maroon px-4 text-[12px] font-black text-white sm:inline-flex">
                Cart <ArrowRight size={15} />
              </Link>
            ) : null}
          </div>

          {!sessionReady ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-[330px] animate-pulse rounded-[24px] bg-white shadow-sm ring-1 ring-[#f1e7e4]" />
              ))}
            </div>
          ) : savedProducts.length ? (
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {savedProducts.map((product) => {
                const quantity = getQuantity(validCart, product.id);
                const pricing = getProductUnitPricing(product);
                const unavailable = !product.available;

                return (
                  <article key={product.id} className={`group overflow-hidden rounded-[24px] bg-white shadow-[0_14px_34px_rgba(34,31,32,0.07)] ring-1 ring-[#f1e7e4] ${unavailable ? "grayscale" : ""}`}>
                    <div className="relative aspect-[1.35/1] overflow-hidden bg-[#f8edf0]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={product.image} alt={product.name} className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${unavailable ? "opacity-70" : ""}`} loading="lazy" decoding="async" onError={fallbackDishImage} />
                      <button
                        type="button"
                        onClick={() => removeSaved(product.id)}
                        className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white text-maroon shadow-[0_10px_22px_rgba(34,31,32,0.14)]"
                        aria-label={`Remove ${product.name} from wishlist`}
                      >
                        <Heart size={19} className="fill-maroon" />
                      </button>
                      {unavailable ? (
                        <span className="absolute inset-x-3 bottom-3 rounded-lg bg-charcoal/82 px-2 py-1 text-center text-[10px] font-black uppercase tracking-wide text-white">
                          Unavailable
                        </span>
                      ) : product.offer ? (
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
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span>
                          <span className="block text-xl font-black text-charcoal">{formatRupees(pricing.unitPrice)}</span>
                          {pricing.discountPerUnit > 0 ? <span className="text-xs font-bold text-muted line-through">{formatRupees(pricing.originalUnitPrice)}</span> : null}
                        </span>
                        {unavailable ? (
                          <button type="button" disabled className="h-11 rounded-xl bg-[#f2eef0] px-4 text-sm font-black text-muted">
                            Unavailable
                          </button>
                        ) : quantity ? (
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
            <section className="rounded-[18px] bg-white px-5 py-9 text-center shadow-sm ring-1 ring-[#eef1f6]">
              <span className="mx-auto grid h-13 w-13 place-items-center rounded-full bg-[#fff4f5] text-maroon">
                <Utensils size={25} />
              </span>
              <h2 className="mt-4 text-[22px] font-black text-charcoal">No favourites yet</h2>
              <p className="mx-auto mt-2 max-w-[360px] text-[13px] font-bold leading-6 text-muted">
                Save dishes with the heart button, then come back here to order them quickly.
              </p>
              <Link href="/menu" className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-maroon px-5 text-[13px] font-black text-white">
                <Search size={16} /> Browse dishes
              </Link>
            </section>
          )}
        </div>
      </main>
      <MobileNav />
    </>
  );
}
