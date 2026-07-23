"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Moon, Plus, Minus, Trash2 } from "lucide-react";
import { coupons, products } from "@/lib/data";
import { calculateCartTotals, formatRupees } from "@/lib/pricing";
import { writeStoredCart } from "@/lib/cart-storage";
import { useStoredCart } from "@/lib/use-stored-cart";
import type { CartLine } from "@/lib/types";

const starterCart: CartLine[] = [
  { productId: "p1", variantId: "regular", addonIds: ["raita"], quantity: 1 },
  { productId: "p3", variantId: "regular", addonIds: ["cold-drink"], quantity: 1 },
];

function buildInitialCart(baseCart: CartLine[], addProductId?: string) {
  const base = baseCart.length ? baseCart : starterCart;
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

export function CartClient({ addProductId }: { addProductId?: string }) {
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<string | undefined>();
  const [message, setMessage] = useState("Review your order before checkout.");
  const appliedAddRef = useRef(false);
  const seededRef = useRef(false);
  const lines = useStoredCart();

  const totals = useMemo(() => calculateCartTotals(lines, coupon), [lines, coupon]);
  const appliedCoupon = coupons.find((item) => item.code === coupon);

  useEffect(() => {
    if (!addProductId) {
      if (!seededRef.current && lines.length === 0) {
        seededRef.current = true;
        writeStoredCart(starterCart);
      }
      return;
    }

    if (appliedAddRef.current) return;
    appliedAddRef.current = true;

    const next = buildInitialCart(lines, addProductId);
    writeStoredCart(next);
  }, [addProductId, lines]);

  function updateQuantity(index: number, quantity: number) {
    const next = lines
      .map((line, lineIndex) => (lineIndex === index ? { ...line, quantity } : line))
      .filter((line) => line.quantity > 0);
    writeStoredCart(next);
    setMessage(quantity > 0 ? "Cart updated." : "Item removed from cart.");
  }

  function applyCommonCoupon(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    const availableCoupon = coupons.find((item) => item.code === normalizedCode);

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
    setCouponInput(availableCoupon.code);
    setMessage(`${availableCoupon.code} applied to your full cart.`);
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] bg-white p-6 text-center shadow-sm ring-1 ring-border">
        <h1 className="text-2xl font-black text-maroon">Your cart is empty</h1>
        <p className="mt-3 text-sm text-muted">Add your favourite Wah Thali dishes to continue.</p>
        <Link prefetch href="/menu" className="mt-6 inline-flex h-12 items-center rounded-2xl bg-red px-5 font-black text-white">
          Browse menu
        </Link>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-md rounded-[30px] bg-[#f5f5f5] p-4 shadow-[0_20px_60px_rgba(34,31,32,0.12)] ring-1 ring-border">
      <div className="flex h-12 items-center justify-between">
        <Link href="/menu" className="grid h-9 w-9 place-items-center rounded-full bg-white text-maroon" aria-label="Back to menu">
          <ChevronLeft size={18} />
        </Link>
        <h1 className="text-base font-black text-charcoal">My Cart</h1>
        <button
          onClick={() => setMessage("Dark mode is a design preview. Theme stays Wah Thali branded.")}
          className="grid h-9 w-9 place-items-center rounded-full bg-white text-charcoal"
          aria-label="Theme preview"
        >
          <Moon size={17} />
        </button>
      </div>

      <p className="mt-2 rounded-2xl bg-white px-4 py-3 text-xs font-bold text-maroon" aria-live="polite">
        {message}
      </p>

      <div className="mt-4 space-y-3">
        {lines.map((line, index) => {
          const product = products.find((item) => item.id === line.productId);
          if (!product) return null;
          const variant = product.variants.find((item) => item.id === line.variantId);
          const addons = line.addonIds
            .map((addonId) => product.addons.find((item) => item.id === addonId)?.name)
            .filter(Boolean);

          return (
            <article key={`${line.productId}-${index}`} className="rounded-3xl bg-white p-3 shadow-sm">
              <div className="grid grid-cols-[82px_1fr_auto] gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-20 w-20 rounded-full object-cover ring-4 ring-cream"
                />
                <div className="min-w-0 py-1">
                  <h2 className="truncate text-sm font-black text-charcoal">{product.name}</h2>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted">
                    {variant?.name}
                    {addons.length ? ` with ${addons.join(", ")}` : ""}
                  </p>
                  <p className="mt-2 text-sm font-black text-charcoal">
                    {formatRupees(product.price + (variant?.price ?? 0))}
                  </p>
                </div>
                <button
                  className="grid h-8 w-8 place-items-center rounded-full bg-cream text-red"
                  onClick={() => updateQuantity(index, 0)}
                  aria-label={`Remove ${product.name}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="mt-3 flex items-center justify-end">
                <div className="grid h-9 w-24 grid-cols-3 overflow-hidden rounded-full bg-cream text-maroon">
                  <button onClick={() => updateQuantity(index, line.quantity - 1)} className="grid place-items-center" aria-label="Decrease quantity">
                    <Minus size={14} />
                  </button>
                  <span className="grid place-items-center text-sm font-black">{line.quantity}</span>
                  <button onClick={() => updateQuantity(index, line.quantity + 1)} className="grid place-items-center" aria-label="Increase quantity">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Link href="/menu" className="mt-4 inline-flex h-10 items-center rounded-2xl px-2 text-sm font-black text-red">
        + Add more items
      </Link>

      <div className="mt-3 rounded-[26px] bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-charcoal">Apply coupon</h2>
            <p className="mt-1 text-xs font-semibold text-muted">One coupon applies to the full cart total.</p>
          </div>
          {appliedCoupon ? (
            <button
              onClick={() => {
                setCoupon(undefined);
                setCouponInput("");
                setMessage("Coupon removed.");
              }}
              className="text-xs font-black text-red"
            >
              Remove
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={couponInput}
            onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
            className="h-11 min-w-0 flex-1 rounded-2xl border border-border bg-cream px-4 text-sm font-bold text-charcoal outline-none focus:border-red"
            placeholder="Enter coupon code"
            aria-label="Coupon code"
          />
          <button
            onClick={() => applyCommonCoupon(couponInput)}
            className="h-11 rounded-2xl bg-red px-4 text-sm font-black text-white"
          >
            Apply
          </button>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {coupons.map((item) => (
            <button
              key={item.code}
              onClick={() => applyCommonCoupon(item.code)}
              className={`min-w-fit rounded-2xl border px-3 py-2 text-left text-xs font-black ${
                appliedCoupon?.code === item.code
                  ? "border-red bg-red text-white"
                  : "border-border bg-cream text-maroon"
              }`}
            >
              {item.code}
              <span className="block text-[10px] font-semibold opacity-80">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-[26px] bg-white p-4 shadow-sm">
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

      <Link href="/checkout" className="mt-4 flex h-13 min-h-13 items-center justify-center rounded-full bg-red px-5 py-4 text-sm font-black text-white shadow-[0_12px_28px_rgba(214,0,50,0.28)]">
        Select address at next step
      </Link>
    </section>
  );
}
