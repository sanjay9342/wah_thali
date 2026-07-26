"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Minus,
  MoreVertical,
  PenLine,
  Plus,
  Store,
  Tag,
  Utensils,
} from "lucide-react";
import { calculateCartTotals, formatRupees, getPricableCartLines } from "@/lib/pricing";
import { writeStoredCart } from "@/lib/cart-storage";
import { useDeliveryLocation } from "@/lib/delivery-location";
import { useStoredCart } from "@/lib/use-stored-cart";
import type { CartLine, Coupon, Product, RestaurantSettings } from "@/lib/types";

function buildInitialCart(baseCart: CartLine[], addProductId?: string) {
  const base = baseCart;
  if (!addProductId) return base;

  const existing = base.find((line) => line.productId === addProductId);
  if (existing) {
    return base.map((line) =>
      line.productId === addProductId ? { ...line, quantity: line.quantity + 1 } : line,
    );
  }

  return [
    ...base,
    { productId: addProductId, variantId: "regular", addonIds: [], quantity: 1 },
  ];
}

export function CartClient({
  addProductId,
  initialProducts,
  initialCoupons,
  restaurantSettings,
}: {
  addProductId?: string;
  initialProducts: Product[];
  initialCoupons: Coupon[];
  restaurantSettings: RestaurantSettings;
}) {
  const [coupon, setCoupon] = useState<string | undefined>();
  const [message, setMessage] = useState("Review your order before checkout.");
  const [cookingRequest, setCookingRequest] = useState("");
  const [cutleryNeeded, setCutleryNeeded] = useState(false);
  const appliedAddRef = useRef(false);
  const lines = useStoredCart();
  const deliveryLocation = useDeliveryLocation();
  const validLines = useMemo(() => getPricableCartLines(lines, initialProducts), [initialProducts, lines]);

  const totals = useMemo(
    () => calculateCartTotals(validLines, coupon, initialProducts, initialCoupons, restaurantSettings),
    [initialCoupons, initialProducts, validLines, coupon, restaurantSettings],
  );
  const appliedCoupon = initialCoupons.find((item) => item.code === coupon);
  const featuredCoupon = initialCoupons[0];
  const totalSavings = totals.discount + (totals.delivery === 0 && validLines.length ? restaurantSettings.deliveryFee : 0);
  const suggestions = initialProducts.filter((product) => !validLines.some((line) => line.productId === product.id)).slice(0, 6);
  const orderingDisabled = restaurantSettings.storeMode === "CLOSED" || restaurantSettings.storeMode === "PAUSED";
  const statusMessage = getStoreStatusMessage(restaurantSettings);

  useEffect(() => {
    if (validLines.length !== lines.length) {
      writeStoredCart(validLines);
      return;
    }

    if (!addProductId) {
      return;
    }

    if (orderingDisabled) {
      return;
    }

    if (appliedAddRef.current) return;
    appliedAddRef.current = true;

    const next = buildInitialCart(validLines, addProductId);
    writeStoredCart(next);
  }, [addProductId, lines, orderingDisabled, validLines]);

  function updateQuantity(index: number, quantity: number) {
    const next = validLines
      .map((line, lineIndex) => (lineIndex === index ? { ...line, quantity } : line))
      .filter((line) => line.quantity > 0);
    writeStoredCart(next);
    setMessage(quantity > 0 ? "Cart updated." : "Item removed from cart.");
  }

  function addSuggestedProduct(product: Product) {
    if (orderingDisabled) return;

    writeStoredCart([
      ...validLines,
      {
        productId: product.id,
        variantId: product.variants[0]?.id ?? "regular",
        addonIds: [],
        quantity: 1,
      },
    ]);
    setMessage(`${product.name} added.`);
  }

  function applyCommonCoupon(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    const availableCoupon = initialCoupons.find((item) => item.code === normalizedCode);

    if (!availableCoupon) {
      setCoupon(undefined);
      setMessage("Coupon code is not valid.");
      return;
    }

    if (totals.subtotal < availableCoupon.minOrder) {
      setCoupon(undefined);
      setMessage(`Add ${formatRupees(availableCoupon.minOrder - totals.subtotal)} more to use ${availableCoupon.code}.`);
      return;
    }

    setCoupon(availableCoupon.code);
    setMessage(`${availableCoupon.code} applied to your full cart.`);
  }

  if (validLines.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] bg-white p-6 text-center shadow-sm ring-1 ring-border">
        <h1 className="text-2xl font-black text-maroon">Your cart is empty</h1>
        <p className="mt-3 text-sm text-muted">Add your favourite Wah Thali dishes to continue.</p>
        {restaurantSettings.storeMode !== "OPEN" ? (
          <div className="mt-4 rounded-2xl border border-red/20 bg-cream p-4 text-left text-sm text-maroon">
            <p className="flex items-center gap-2 font-black">
              <Store size={17} className="text-red" />
              {restaurantSettings.storeMode === "BUSY" ? "Kitchen busy" : restaurantSettings.storeMode === "PAUSED" ? "Ordering paused" : "Restaurant closed"}
            </p>
            <p className="mt-1 text-xs font-bold text-muted">{statusMessage}</p>
          </div>
        ) : null}
        <Link prefetch href="/menu" className="mt-6 inline-flex h-12 items-center rounded-2xl bg-red px-5 font-black text-white">
          Browse menu
        </Link>
      </div>
    );
  }

  return (
    <section className="relative mx-auto min-h-screen max-w-[430px] bg-white pb-32 text-charcoal shadow-[0_18px_60px_rgba(34,31,32,0.08)] sm:my-6 sm:min-h-0 sm:overflow-hidden sm:rounded-[28px] lg:max-w-5xl">
      <div className="bg-[#fff4f5] px-4 pb-5 pt-4 shadow-sm lg:px-6">
        <div className="flex items-start justify-between gap-3">
          <Link href="/menu" className="mt-1 grid h-10 w-10 place-items-center rounded-full text-charcoal" aria-label="Back to menu">
            <ChevronLeft size={31} strokeWidth={2.4} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-bold text-muted">Wah Thali</h1>
            <Link href="/address" className="mt-1 flex max-w-full items-center gap-1 text-left">
              <MapPin size={17} className="shrink-0 fill-charcoal text-charcoal" />
              <span className="truncate text-[18px] font-black leading-none text-charcoal">{deliveryLocation.label}</span>
              <span className="truncate text-[15px] font-semibold text-muted">| {deliveryLocation.address}</span>
              <ChevronDown size={17} className="shrink-0 text-charcoal" />
            </Link>
          </div>
          <button className="mt-1 grid h-9 w-9 place-items-center rounded-full text-charcoal" aria-label="More cart options">
            <MoreVertical size={24} />
          </button>
        </div>

        {totalSavings > 0 ? (
          <p className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-[15px] font-black text-red shadow-sm">
            {formatRupees(totalSavings)} Saved with Wah Thali
          </p>
        ) : null}
      </div>

      {restaurantSettings.storeMode !== "OPEN" ? (
        <div className="mx-4 mt-4 rounded-2xl border border-red/20 bg-white p-4 text-sm text-maroon">
          <p className="flex items-center gap-2 font-black">
            <Store size={17} className="text-red" />
            {restaurantSettings.storeMode === "BUSY" ? "Kitchen busy" : restaurantSettings.storeMode === "PAUSED" ? "Ordering paused" : "Restaurant closed"}
          </p>
          <p className="mt-1 text-xs font-bold text-muted">{statusMessage}</p>
        </div>
      ) : null}

      <div className="mx-4 mt-5 rounded-[24px] bg-white p-4 shadow-sm">
        {featuredCoupon ? (
          <div className="mb-5 rounded-2xl bg-red/8 p-4">
            <p className="text-[19px] font-black text-red">simple savings applied!</p>
            <div className="mt-2 grid grid-cols-[1fr_auto_auto] items-center gap-3">
              <p className="text-[15px] font-bold leading-5 text-charcoal">
                Use {featuredCoupon.code} for your Wah Thali order
              </p>
              <button
                onClick={() => applyCommonCoupon(featuredCoupon.code)}
                className="h-11 rounded-xl bg-white px-4 text-[15px] font-black text-maroon shadow-sm ring-1 ring-border"
              >
                Apply
              </button>
              <span className="text-[15px] font-semibold text-charcoal">
                {featuredCoupon.type === "FIXED" ? formatRupees(featuredCoupon.value) : `${featuredCoupon.value}%`}
              </span>
            </div>
          </div>
        ) : null}

        <div className="space-y-5 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
        {validLines.map((line, index) => {
          const product = initialProducts.find((item) => item.id === line.productId);
          if (!product) return null;
          const variant = product.variants.find((item) => item.id === line.variantId);
          const addons = line.addonIds
            .map((addonId) => product.addons.find((item) => item.id === addonId)?.name)
            .filter(Boolean);

          return (
            <article key={`${line.productId}-${index}`} className="grid grid-cols-[1fr_auto_auto] items-start gap-3">
              <div className="min-w-0">
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-[4px] border bg-white ${
                      product.dietaryType === "NON_VEG" ? "border-red" : "border-maroon"
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${product.dietaryType === "NON_VEG" ? "bg-red" : "bg-maroon"}`} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-[18px] font-bold leading-6 text-charcoal">{product.name}</h2>
                    <p className="mt-1 line-clamp-1 text-xs font-semibold text-muted">
                    {variant?.name}
                    {addons.length ? ` with ${addons.join(", ")}` : ""}
                  </p>
                  </div>
                </div>
              </div>
              <div className="grid h-11 w-[94px] grid-cols-3 overflow-hidden rounded-xl bg-white text-maroon shadow-sm ring-1 ring-border">
                  <button onClick={() => updateQuantity(index, line.quantity - 1)} className="grid place-items-center" aria-label={`Decrease ${product.name}`}>
                    <Minus size={15} />
                  </button>
                  <span className="grid place-items-center text-sm font-black">{line.quantity}</span>
                  <button onClick={() => updateQuantity(index, line.quantity + 1)} className="grid place-items-center" aria-label={`Increase ${product.name}`}>
                    <Plus size={15} />
                  </button>
              </div>
              <div className="min-w-12 text-right">
                {product.originalPrice ? <p className="text-[13px] font-bold text-muted line-through">{formatRupees(product.originalPrice)}</p> : null}
                <p className="text-[18px] font-bold text-charcoal">{formatRupees((product.price + (variant?.price ?? 0)) * line.quantity)}</p>
              </div>
            </article>
          );
        })}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2">
          <Link href="/menu" className="inline-flex h-12 items-center justify-center gap-1 rounded-xl border border-border bg-white px-2 text-[13px] font-bold text-muted">
            <Plus size={20} /> Add Items
          </Link>
          <button
            onClick={() => setMessage(cookingRequest ? "Cooking request saved." : "Add a cooking request below.")}
            className="inline-flex h-12 items-center justify-center gap-1 rounded-xl border border-border bg-white px-2 text-[13px] font-bold text-muted"
          >
            <PenLine size={17} /> Cooking
          </button>
          <button
            onClick={() => setCutleryNeeded((current) => !current)}
            className="inline-flex h-12 items-center justify-center gap-1 rounded-xl border border-border bg-white px-2 text-[13px] font-bold text-muted"
          >
            <span className={`grid h-5 w-5 place-items-center rounded border ${cutleryNeeded ? "border-maroon bg-maroon" : "border-muted/40 bg-white"}`}>
              {cutleryNeeded ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
            </span>
            Cutlery
          </button>
        </div>
        <input
          value={cookingRequest}
          onChange={(event) => setCookingRequest(event.target.value)}
          className="mt-3 h-11 w-full rounded-xl border border-border bg-cream px-3 text-sm font-semibold text-charcoal"
          placeholder="Cooking requests"
        />
      </div>

      {suggestions.length ? (
        <div className="mx-4 mt-5 rounded-[24px] bg-white p-4 shadow-sm">
          <h2 className="text-[15px] font-black uppercase tracking-[0.22em] text-muted">Complete your meal</h2>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {suggestions.map((product) => (
              <article key={product.id} className="w-24 shrink-0">
                <div className="relative h-20 w-24 overflow-hidden rounded-xl bg-cream ring-1 ring-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.image} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
                  <button
                    onClick={() => addSuggestedProduct(product)}
                    className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-lg bg-white text-maroon shadow ring-1 ring-border"
                    aria-label={`Add ${product.name}`}
                  >
                    <Plus size={19} strokeWidth={3} />
                  </button>
                </div>
                <div className="mt-2 flex items-start gap-1">
                  <span
                    className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-[3px] border bg-white ${
                      product.dietaryType === "NON_VEG" ? "border-red" : "border-maroon"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${product.dietaryType === "NON_VEG" ? "bg-red" : "bg-maroon"}`} />
                  </span>
                  <p className="line-clamp-2 text-[13px] font-semibold leading-4 text-charcoal">{product.name}</p>
                </div>
                <p className="mt-2 text-[15px] font-bold text-charcoal">{formatRupees(product.price)}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mx-4 mt-5 overflow-hidden rounded-[24px] bg-white shadow-sm">
        <h2 className="px-4 pb-3 pt-5 text-[15px] font-black uppercase tracking-[0.22em] text-muted">Savings corner</h2>
        <div className="divide-y divide-border">
          <button
            onClick={() => featuredCoupon ? applyCommonCoupon(featuredCoupon.code) : setMessage("No coupon is available right now.")}
            className="grid w-full grid-cols-[32px_1fr_auto] items-center gap-3 px-4 py-4 text-left"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-red text-white">
              <Tag size={17} />
            </span>
            <span className="text-[16px] font-bold text-charcoal">Apply Coupon</span>
            <ChevronRight size={24} />
          </button>
          {appliedCoupon ? (
            <div className="grid grid-cols-[32px_1fr_auto] items-center gap-3 px-4 py-4">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-red text-white">
                <Tag size={17} />
              </span>
              <span className="text-[15px] font-bold text-charcoal">
                {formatRupees(totals.discount)} saved with {appliedCoupon.code}
              </span>
              <button
                onClick={() => {
                  setCoupon(undefined);
                  setMessage("Coupon removed.");
                }}
                className="text-[14px] font-black text-maroon"
              >
                Remove
              </button>
            </div>
          ) : null}
          {totals.delivery === 0 && validLines.length ? (
            <div className="grid grid-cols-[32px_1fr_auto] items-center gap-3 px-4 py-4">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-red text-white">
                <Utensils size={17} />
              </span>
              <span className="text-[15px] font-bold text-charcoal">
                {formatRupees(restaurantSettings.deliveryFee)} saved with free delivery
              </span>
              <span className="text-[14px] font-black text-maroon">Applied</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-4 mt-5 rounded-[24px] bg-white p-4 shadow-sm">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="font-semibold text-muted">Sub total</dt>
            <dd className="font-black">{formatRupees(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-semibold text-muted">Delivery Fee</dt>
            <dd className="font-black">{formatRupees(totals.delivery)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-semibold text-muted">Packaging</dt>
            <dd className="font-black">{formatRupees(totals.packaging)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-semibold text-muted">Discount</dt>
            <dd className="font-black text-red">-{formatRupees(totals.discount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-semibold text-muted">GST</dt>
            <dd className="font-black">{formatRupees(totals.gst)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-4 text-base">
            <dt className="font-black text-charcoal">Total</dt>
            <dd className="font-black text-charcoal">{formatRupees(totals.grandTotal)}</dd>
          </div>
        </dl>
      </div>

      <p className="mx-4 mt-4 rounded-2xl bg-white px-4 py-3 text-xs font-bold text-maroon" aria-live="polite">
        {message}
      </p>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-[0_-12px_30px_rgba(34,31,32,0.12)] sm:absolute sm:left-1/2 sm:max-w-[430px] sm:-translate-x-1/2 sm:rounded-t-2xl lg:max-w-5xl">
        <div className="mx-auto grid max-w-[430px] grid-cols-[1fr_1.45fr] gap-3 lg:max-w-4xl">
          <div className="min-w-0">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-muted">Pay using</p>
            <p className="mt-1 truncate text-[17px] font-bold text-charcoal">Cash / UPI</p>
          </div>
          {orderingDisabled ? (
            <button disabled className="h-16 cursor-not-allowed rounded-2xl bg-muted/30 text-[18px] font-black text-muted">
              Closed
            </button>
          ) : (
            <Link href="/checkout" className="flex h-16 items-center justify-center rounded-2xl bg-maroon text-[20px] font-black text-white shadow-[0_10px_24px_rgba(141,0,33,0.28)]">
              Pay {formatRupees(totals.grandTotal)}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function getStoreStatusMessage(settings: RestaurantSettings) {
  if (settings.storeStatusReason.trim()) return settings.storeStatusReason;
  if (settings.storeMode === "BUSY") return settings.busyMessage;
  if (settings.storeMode === "PAUSED") return settings.pausedMessage;
  if (settings.storeMode === "CLOSED") return settings.closedMessage;
  return "Restaurant is accepting orders.";
}
