"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gift,
  Home,
  LocateFixed,
  MapPin,
  Minus,
  PenLine,
  Plus,
  ReceiptText,
  Search,
  Store,
  Tag,
  Phone,
  X,
} from "lucide-react";
import { calculateCartTotals, formatRupees, getPricableCartLines } from "@/lib/pricing";
import { writeStoredCart } from "@/lib/cart-storage";
import { readCustomerSession, saveCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";
import { extractPinCode, isServiceableLocation, saveDeliveryLocation, useDeliveryLocation } from "@/lib/delivery-location";
import { addNotification } from "@/lib/notifications";
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
  const router = useRouter();
  const [coupon, setCoupon] = useState<string | undefined>();
  const [cookingRequest, setCookingRequest] = useState("");
  const [cutleryNeeded, setCutleryNeeded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showBillSummary, setShowBillSummary] = useState(false);
  const [showReceiverSheet, setShowReceiverSheet] = useState(false);
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [showCookingSheet, setShowCookingSheet] = useState(false);
  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  const supportMobile = restaurantSettings.supportPhone.replace(/\D/g, "").slice(-10);
  const [receiverDraft, setReceiverDraft] = useState(() => ({
    name: "Customer",
    mobile: supportMobile,
  }));
  const [locationDraft, setLocationDraft] = useState(() => ({
    area: "",
    details: "",
    pinCode: "",
    tag: "Home" as "Home" | "Work" | "Other",
  }));
  const appliedAddRef = useRef(false);
  const cartOwnerId = customerSession?.mobile;
  const lines = useStoredCart(cartOwnerId);
  const deliveryLocation = useDeliveryLocation();
  const validLines = useMemo(() => getPricableCartLines(lines, initialProducts), [initialProducts, lines]);

  const totals = useMemo(
    () => calculateCartTotals(validLines, coupon, initialProducts, initialCoupons, restaurantSettings),
    [initialCoupons, initialProducts, validLines, coupon, restaurantSettings],
  );
  const serviceable = isServiceableLocation(deliveryLocation, restaurantSettings.serviceablePins);
  const suggestions = initialProducts.filter((product) => !validLines.some((line) => line.productId === product.id)).slice(0, 6);
  const storeOrderingDisabled = restaurantSettings.storeMode === "CLOSED" || restaurantSettings.storeMode === "PAUSED";
  const statusMessage = getStoreStatusMessage(restaurantSettings);
  const appliedCoupon = initialCoupons.find((item) => item.code === coupon);
  const featuredCoupon = initialCoupons[0];
  const featuredCouponValue = featuredCoupon ? getCouponBenefitText(featuredCoupon) : "";
  const paymentLabel = restaurantSettings.codEnabled
    ? "Cash on Delivery"
    : restaurantSettings.onlinePaymentsEnabled
      ? "Online payment"
      : "Payment unavailable";
  const itemSavings = validLines.reduce((total, line) => {
    const product = initialProducts.find((item) => item.id === line.productId);
    if (!product?.originalPrice) return total;
    return total + Math.max(product.originalPrice - product.price, 0) * line.quantity;
  }, 0);
  const totalSavings = itemSavings + totals.discount;
  const receiverName = customerSession?.name || "Customer";
  const receiverMobile = customerSession?.mobile || supportMobile;

  useEffect(() => {
    if (validLines.length !== lines.length) {
      writeStoredCart(validLines, cartOwnerId);
      return;
    }

    if (!addProductId) {
      return;
    }

    if (storeOrderingDisabled) {
      return;
    }

    if (appliedAddRef.current) return;
    appliedAddRef.current = true;

    const next = buildInitialCart(validLines, addProductId);
    writeStoredCart(next, cartOwnerId);
  }, [addProductId, cartOwnerId, lines, storeOrderingDisabled, validLines]);

  useEffect(() => {
    function refreshSession() {
      setCustomerSession(readCustomerSession());
    }

    refreshSession();
    return subscribeCustomerSession(refreshSession);
  }, []);

  function updateQuantity(index: number, quantity: number) {
    const next = validLines
      .map((line, lineIndex) => (lineIndex === index ? { ...line, quantity } : line))
      .filter((line) => line.quantity > 0);
    writeStoredCart(next, cartOwnerId);
  }

  function addSuggestedProduct(product: Product) {
    if (storeOrderingDisabled) return;

    writeStoredCart([
      ...validLines,
      {
        productId: product.id,
        variantId: product.variants[0]?.id ?? "regular",
        addonIds: [],
        quantity: 1,
      },
    ], cartOwnerId);
  }

  function applyCommonCoupon(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    const availableCoupon = initialCoupons.find((item) => item.code === normalizedCode);

    if (!availableCoupon) {
      setCoupon(undefined);
      return;
    }

    if (totals.subtotal < availableCoupon.minOrder) {
      setCoupon(undefined);
      return;
    }

    setCoupon(availableCoupon.code);
  }

  function openReceiverSheet() {
    if (!customerSession?.mobile) {
      router.push("/login?next=/cart");
      return;
    }

    setReceiverDraft({
      name: receiverName,
      mobile: receiverMobile,
    });
    setShowReceiverSheet(true);
  }

  function saveReceiverDetails() {
    const name = receiverDraft.name.trim() || "Customer";
    const mobile = receiverDraft.mobile.replace(/\D/g, "").slice(-10);
    saveCustomerSession({
      id: customerSession?.id,
      name,
      mobile: mobile || supportMobile,
      email: customerSession?.email,
    });
    setCustomerSession(readCustomerSession());
    setShowReceiverSheet(false);
  }

  function openLocationSheet() {
    setLocationDraft({
      area: deliveryLocation.address === "Select delivery location" ? "" : deliveryLocation.address,
      details: "",
      pinCode: deliveryLocation.pinCode ?? extractPinCode(deliveryLocation.address),
      tag: deliveryLocation.label === "Work" || deliveryLocation.label === "Other" ? deliveryLocation.label : "Home",
    });
    setShowLocationSheet(true);
  }

  function saveLocationDetails() {
    const area = locationDraft.area.trim() || deliveryLocation.address;
    const details = locationDraft.details.trim();
    const pinCode = locationDraft.pinCode.trim() || extractPinCode(`${details}, ${area}`) || deliveryLocation.pinCode;
    saveDeliveryLocation({
      label: locationDraft.tag,
      address: details ? `${details}, ${area}` : area,
      pinCode,
      latitude: deliveryLocation.latitude,
      longitude: deliveryLocation.longitude,
    });
    setShowLocationSheet(false);
  }

  function saveCookingNote(note: string) {
    setCookingRequest(note.trim());
    setShowCookingSheet(false);
  }

  async function placeOrder() {
    if (storeOrderingDisabled || submitting) return;

    if (!validLines.length) {
      return;
    }
    if (!customerSession?.mobile) {
      router.push("/login?next=/cart");
      return;
    }
    if (!serviceable) {
      openLocationSheet();
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: receiverName,
          customerMobile: receiverMobile,
          couponCode: coupon,
          pinCode: deliveryLocation.pinCode,
          items: validLines,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        return;
      }

      writeStoredCart([], cartOwnerId);
      addNotification(cartOwnerId, {
        kind: "order",
        title: "Order placed",
        body: `Your order ${data.order.orderNumber} was placed successfully. We will update you as it moves ahead.`,
      });
      router.push(`/order/${data.order.orderNumber}/confirmed`);
    } catch {
    } finally {
      setSubmitting(false);
    }
  }

  if (!customerSession?.mobile) {
    return (
      <div className="mx-5 mt-10 rounded-[28px] bg-white p-6 text-center shadow-sm ring-1 ring-border">
        <h1 className="text-2xl font-black text-maroon">Login to view cart</h1>
        <p className="mt-3 text-sm font-bold leading-6 text-muted">Your cart is saved to your account, so every customer sees only their own dishes.</p>
        <Link href="/login?next=/cart" className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-maroon px-5 font-black text-white">
          Login or Sign Up
        </Link>
      </div>
    );
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
    <section className="relative mx-auto min-h-screen max-w-[430px] bg-[#f6f7fb] pb-32 text-charcoal shadow-[0_18px_60px_rgba(34,31,32,0.08)] sm:my-6 sm:min-h-0 sm:overflow-hidden sm:rounded-[28px] lg:max-w-5xl">
      <div className="flex items-center gap-3 px-5 pb-1 pt-4 lg:px-6">
        <Link href="/menu" className="grid h-10 w-10 place-items-center rounded-full bg-white text-maroon shadow-sm ring-1 ring-border" aria-label="Back to menu">
          <ChevronLeft size={25} strokeWidth={2.7} />
        </Link>
        <h1 className="text-[22px] font-black leading-tight text-maroon">My Cart</h1>
      </div>

      {totalSavings > 0 ? (
      <div className="mx-5 mt-3 flex items-center gap-2 rounded-[14px] bg-[#e9f2ff] px-3 py-2 text-[13px] font-black text-[#1769c2]">
        <BadgeCheck size={16} className="shrink-0" />
        <span>You saved {formatRupees(totalSavings)} on this order</span>
      </div>
      ) : null}

      {restaurantSettings.storeMode !== "OPEN" ? (
        <div className="mx-5 mt-4 rounded-2xl border border-red/20 bg-white p-4 text-sm text-maroon">
          <p className="flex items-center gap-2 font-black">
            <Store size={17} className="text-red" />
            {restaurantSettings.storeMode === "BUSY" ? "Kitchen busy" : restaurantSettings.storeMode === "PAUSED" ? "Ordering paused" : "Restaurant closed"}
          </p>
          <p className="mt-1 text-xs font-bold text-muted">{statusMessage}</p>
        </div>
      ) : null}
      {!serviceable ? (
        <div className="mx-5 mt-4 rounded-2xl border border-maroon/15 bg-white p-4 text-sm text-maroon">
          <p className="flex items-center gap-2 font-black">
            <MapPin size={17} />
            {deliveryLocation.pinCode ? "Service not available" : "Delivery PIN required"}
          </p>
          <p className="mt-1 text-xs font-bold text-muted">
            {deliveryLocation.pinCode
              ? "This PIN code is not added in Admin Settings. Choose another delivery location."
              : "Add your delivery PIN code to check if this order can be delivered."}
          </p>
          <button onClick={openLocationSheet} className="mt-3 h-10 rounded-xl bg-maroon px-4 text-xs font-black text-white">
            Choose Location
          </button>
        </div>
      ) : null}

      <div className="mx-5 mt-4 rounded-[18px] bg-white p-3 shadow-[0_8px_24px_rgba(17,24,39,0.05)] ring-1 ring-[#eef1f6]">
        <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
        {validLines.map((line, index) => {
          const product = initialProducts.find((item) => item.id === line.productId);
          if (!product) return null;
          const variant = product.variants.find((item) => item.id === line.variantId);
          const addons = line.addonIds
            .map((addonId) => product.addons.find((item) => item.id === addonId)?.name)
            .filter(Boolean);
          const lineTotal = (product.price + (variant?.price ?? 0)) * line.quantity;
          const originalTotal = product.originalPrice ? product.originalPrice * line.quantity : undefined;

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
                    <h2 className="line-clamp-2 text-[15px] font-black leading-5 text-charcoal">{product.name}</h2>
                    <p className="mt-1 line-clamp-1 text-[11px] font-bold text-muted">{variant?.name}</p>
                    <button className="mt-1 text-[11px] font-black text-maroon">Edit</button>
                    {addons.length ? <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-muted">With {addons.join(", ")}</p> : null}
                  </div>
                </div>
              </div>
              <div className="grid h-9 w-[82px] grid-cols-3 overflow-hidden rounded-[10px] bg-white text-maroon shadow-sm ring-1 ring-maroon/25">
                  <button onClick={() => updateQuantity(index, line.quantity - 1)} className="grid place-items-center" aria-label={`Decrease ${product.name}`}>
                    <Minus size={13} />
                  </button>
                  <span className="grid place-items-center text-[13px] font-black">{line.quantity}</span>
                  <button onClick={() => updateQuantity(index, line.quantity + 1)} className="grid place-items-center" aria-label={`Increase ${product.name}`}>
                    <Plus size={13} />
                  </button>
              </div>
              <div className="min-w-12 text-right">
                {originalTotal ? <p className="text-[12px] font-bold text-muted line-through">{formatRupees(originalTotal)}</p> : null}
                <p className="text-[15px] font-black text-charcoal">{formatRupees(lineTotal)}</p>
              </div>
            </article>
          );
        })}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#eef1f6] pt-3">
          <Link href="/menu" className="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-border bg-white px-2 text-[12px] font-black text-maroon">
            <Plus size={17} /> Add more
          </Link>
          <button
            onClick={() => setShowCookingSheet(true)}
            className="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-border bg-white px-2 text-[12px] font-black text-muted"
          >
            <PenLine size={15} /> Cooking
          </button>
          <button
            onClick={() => setCutleryNeeded((current) => !current)}
            className="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-border bg-white px-2 text-[12px] font-black text-muted"
          >
            <span className={`grid h-5 w-5 place-items-center rounded border ${cutleryNeeded ? "border-maroon bg-maroon" : "border-muted/40 bg-white"}`}>
              {cutleryNeeded ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
            </span>
            Cutlery
          </button>
        </div>
        {cookingRequest ? (
          <button
            type="button"
            onClick={() => setShowCookingSheet(true)}
            className="mt-3 w-full rounded-xl border border-[#f0d7dd] bg-[#fff4f5] px-3 py-3 text-left text-sm font-semibold text-charcoal"
          >
            {cookingRequest}
          </button>
        ) : null}
      </div>

      {suggestions.length ? (
        <div className="mx-5 mt-5 rounded-[24px] bg-white p-4 shadow-sm">
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

      <div className="mx-5 mt-5 overflow-hidden rounded-[24px] bg-white shadow-sm">
        <h2 className="px-4 pb-3 pt-5 text-[15px] font-black uppercase tracking-[0.22em] text-muted">Savings corner</h2>
        <div className="divide-y divide-border">
          <button
            onClick={() => featuredCoupon ? applyCommonCoupon(featuredCoupon.code) : undefined}
            className="grid w-full grid-cols-[32px_1fr_auto] items-center gap-3 px-4 py-4 text-left"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-maroon text-white">
              <Tag size={17} />
            </span>
            <span className="text-[16px] font-bold text-charcoal">Apply Coupon</span>
            <ChevronRight size={24} />
          </button>
          {appliedCoupon ? (
            <div className="grid grid-cols-[32px_1fr_auto] items-center gap-3 px-4 py-4">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-maroon text-white">
                <Tag size={17} />
              </span>
              <span className="text-[15px] font-bold text-charcoal">
                {formatRupees(totals.discount)} saved with {appliedCoupon.code}
              </span>
              <button
                onClick={() => {
                  setCoupon(undefined);
                }}
                className="text-[14px] font-black text-maroon"
              >
                Remove
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {featuredCoupon ? (
      <div className="mx-5 mt-5 rounded-[18px] bg-[#fff5ef] p-4 shadow-sm ring-1 ring-[#ffe1d1]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-black text-charcoal">Special offer from Wah Thali</p>
            <p className="mt-2 text-[12px] font-bold text-muted">
              Use {featuredCoupon.code} to save {featuredCouponValue}
            </p>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-maroon shadow-sm">
            <Gift size={22} />
          </span>
        </div>
      </div>
      ) : null}

      <div className="mx-5 mt-5 overflow-hidden rounded-[18px] bg-white shadow-sm ring-1 ring-[#eef1f6]">
        <div className="divide-y divide-[#eef1f6]">
          <CartInfoRow
            icon={<Clock3 size={18} />}
            title="Delivery in 30-35 mins"
            body="Want this later? Schedule it"
          />
          <CartInfoRow
            icon={<MapPin size={18} />}
            title={`Delivery at ${deliveryLocation.label}`}
            body={deliveryLocation.address}
            onClick={openLocationSheet}
          />
          <CartInfoRow
            icon={<Phone size={18} />}
            title={customerSession?.mobile ? `${receiverName}, +91-${receiverMobile}` : "Login required"}
            body={customerSession?.mobile ? "Update receiver details" : "Sign in to use your receiver details"}
            onClick={openReceiverSheet}
          />
          <CartInfoRow
            icon={<ReceiptText size={18} />}
            title={`Total Bill ${formatRupees(totals.grandTotal)}`}
            body="Incl. taxes and charges"
            badge={totalSavings > 0 ? `You saved ${formatRupees(totalSavings)}` : undefined}
            onClick={() => setShowBillSummary(true)}
          />
        </div>
      </div>

      <div className="mx-5 mt-5 rounded-[18px] bg-[#f6f7fb] px-1 pb-1">
        <h2 className="text-[13px] font-black uppercase tracking-[0.28em] text-muted">Cancellation Policy</h2>
        <p className="mt-2 text-[12px] font-semibold leading-5 text-muted">
          A 100% cancellation charge will apply. This helps us compensate the restaurant partner for food preparation.
        </p>
      </div>

      {showBillSummary ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-charcoal/60" onClick={() => setShowBillSummary(false)}>
          <div className="absolute bottom-[calc(min(76vh,620px)+18px)] left-1/2 grid h-12 w-12 -translate-x-1/2 place-items-center rounded-full bg-[#272b35] text-white shadow-2xl">
            <X size={25} strokeWidth={3} />
          </div>
          <section
            className="w-full rounded-t-[26px] bg-[#f6f7fb] px-4 pb-[calc(env(safe-area-inset-bottom)+22px)] pt-5 shadow-[0_-18px_48px_rgba(17,24,39,0.25)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bill-summary-title"
          >
            <h2 id="bill-summary-title" className="text-[24px] font-black text-charcoal">Bill Summary</h2>
            <div className="mt-10 overflow-hidden rounded-[18px] bg-white shadow-sm">
              <dl className="space-y-4 px-4 py-5 text-[17px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="font-black text-charcoal">Item total</dt>
                  <dd className="font-black text-charcoal">
                    {itemSavings > 0 ? <span className="mr-2 text-muted line-through">{formatRupees(totals.subtotal + itemSavings)}</span> : null}
                    {formatRupees(totals.subtotal)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="border-b border-dashed border-charcoal font-black text-charcoal">Delivery partner fee</dt>
                  <dd className="font-black text-charcoal">
                    {totals.delivery === 0 ? <span className="mr-2 text-muted line-through">{formatRupees(restaurantSettings.deliveryFee)}</span> : null}
                    {formatRupees(totals.delivery)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="border-b border-dashed border-charcoal font-black text-charcoal">Platform fee</dt>
                  <dd className="font-black text-charcoal">{formatRupees(totals.packaging)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="border-b border-dashed border-charcoal font-black text-charcoal">GST (govt. taxes)</dt>
                  <dd className="font-black text-charcoal">{formatRupees(totals.gst)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-[#eef1f6] pt-5">
                  <dt className="text-[19px] font-black text-charcoal">Grand Total</dt>
                  <dd className="text-[19px] font-black text-charcoal">{formatRupees(totals.subtotal + totals.delivery + totals.packaging + totals.gst)}</dd>
                </div>
                {totals.discount > 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[17px] font-black text-[#1769c2]">Limited Time Offer</dt>
                  <dd className="font-black text-[#1769c2]">-{formatRupees(totals.discount)}</dd>
                </div>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[19px] font-black text-charcoal">To pay</dt>
                  <dd className="text-[19px] font-black text-charcoal">{formatRupees(totals.grandTotal)}</dd>
                </div>
              </dl>
              <div className="bg-[#d8eaff] px-4 py-4 text-center text-[16px] font-black text-[#1769c2]">
                You saved {formatRupees(totalSavings)} on this order
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {showReceiverSheet ? (
        <BottomSheet onClose={() => setShowReceiverSheet(false)} title="Update receiver details">
          <p className="mt-1 text-[16px] font-bold leading-6 text-muted">
            {deliveryLocation.label} - {deliveryLocation.address}
          </p>
          <div className="mt-8 rounded-[20px] bg-white p-4 shadow-sm">
            <label className="block rounded-xl border border-border bg-white px-3 py-2">
              <span className="block text-[13px] font-bold text-muted">Receiver&apos;s name</span>
              <input
                value={receiverDraft.name}
                onChange={(event) => setReceiverDraft((current) => ({ ...current, name: event.target.value }))}
                className="mt-1 h-8 w-full bg-transparent text-[17px] font-black text-charcoal outline-none"
              />
            </label>
            <label className="mt-4 block rounded-xl border border-border bg-white px-3 py-2">
              <span className="block text-[13px] font-bold text-muted">Receiver&apos;s mobile number</span>
              <input
                value={receiverDraft.mobile}
                onChange={(event) => setReceiverDraft((current) => ({ ...current, mobile: event.target.value }))}
                className="mt-1 h-8 w-full bg-transparent text-[17px] font-black text-charcoal outline-none"
              />
            </label>
          </div>
          <button onClick={saveReceiverDetails} className="mt-8 h-14 w-full rounded-xl bg-maroon text-[20px] font-black text-white">
            Submit
          </button>
        </BottomSheet>
      ) : null}

      {showLocationSheet ? (
        <BottomSheet onClose={() => setShowLocationSheet(false)} title="Select delivery location">
          <label className="mt-6 flex h-14 items-center gap-3 rounded-2xl bg-white px-4 shadow-sm ring-1 ring-border">
            <Search size={24} className="text-maroon" strokeWidth={3} />
            <input
              value={locationDraft.area}
              onChange={(event) => setLocationDraft((current) => ({ ...current, area: event.target.value, pinCode: extractPinCode(event.target.value) || current.pinCode }))}
              className="min-w-0 flex-1 bg-transparent text-[16px] font-bold text-charcoal outline-none placeholder:text-muted"
              placeholder="Search for area, street name..."
            />
          </label>
          <div className="relative -mx-4 mt-5 h-[300px] overflow-hidden bg-[#eef1f6]">
            <div className="absolute inset-0 opacity-80" style={{ backgroundImage: "linear-gradient(90deg,#d9dee8 1px,transparent 1px),linear-gradient(#d9dee8 1px,transparent 1px)", backgroundSize: "54px 54px" }} />
            <div className="absolute left-1/2 top-[42%] -translate-x-1/2 rounded-xl bg-charcoal px-5 py-3 text-[14px] font-black text-white">
              Move pin to your exact delivery location
            </div>
            <span className="absolute left-1/2 top-[56%] grid h-16 w-16 -translate-x-1/2 place-items-center rounded-full bg-maroon text-white shadow-2xl">
              <MapPin size={34} fill="currentColor" />
            </span>
            <button className="absolute bottom-5 left-1/2 inline-flex h-11 -translate-x-1/2 items-center gap-2 rounded-xl bg-white px-4 text-[14px] font-black text-maroon shadow-lg">
              <LocateFixed size={17} /> Use current location
            </button>
          </div>
          <div className="mt-5">
            <p className="text-[14px] font-black text-muted">Delivery details</p>
            <label className="mt-3 flex h-14 items-center gap-3 rounded-xl border border-border bg-white px-4">
              <MapPin size={24} className="text-maroon" fill="currentColor" />
              <input
                value={locationDraft.area}
                onChange={(event) => setLocationDraft((current) => ({ ...current, area: event.target.value, pinCode: extractPinCode(event.target.value) || current.pinCode }))}
                className="min-w-0 flex-1 bg-transparent text-[16px] font-black text-charcoal outline-none"
                placeholder="Area or street"
              />
            </label>
            <input
              value={locationDraft.details}
              onChange={(event) => setLocationDraft((current) => ({ ...current, details: event.target.value, pinCode: extractPinCode(event.target.value) || current.pinCode }))}
              className="mt-4 h-16 w-full rounded-xl border border-border bg-white px-4 text-[15px] font-bold text-charcoal outline-none"
              placeholder="Address details*"
            />
            <p className="mt-2 text-[12px] font-bold text-muted">E.g. Floor, House no.</p>
            <input
              value={locationDraft.pinCode}
              onChange={(event) => setLocationDraft((current) => ({ ...current, pinCode: event.target.value.replace(/\D/g, "").slice(0, 6) }))}
              inputMode="numeric"
              className="mt-4 h-14 w-full rounded-xl border border-border bg-white px-4 text-[15px] font-black text-charcoal outline-none"
              placeholder="PIN code*"
            />
            <p className="mt-2 text-[12px] font-bold text-muted">Delivery is currently open for all locations.</p>
            <p className="mt-5 text-[14px] font-black text-muted">Save address as</p>
            <div className="mt-3 flex gap-2">
              {[
                ["Home", Home],
                ["Work", BriefcaseBusiness],
                ["Other", MapPin],
              ].map(([tag, Icon]) => (
                <button
                  key={tag as string}
                  onClick={() => setLocationDraft((current) => ({ ...current, tag: tag as "Home" | "Work" | "Other" }))}
                  className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-black ring-1 ${
                    locationDraft.tag === tag ? "bg-[#fff4f5] text-maroon ring-maroon" : "bg-white text-charcoal ring-border"
                  }`}
                >
                  <Icon size={16} /> {tag as string}
                </button>
              ))}
            </div>
          </div>
          <button onClick={saveLocationDetails} className="mt-6 h-14 w-full rounded-xl bg-maroon text-[20px] font-black text-white">
            Save address
          </button>
        </BottomSheet>
      ) : null}

      {showCookingSheet ? (
        <CookingNoteSheet
          initialNote={cookingRequest}
          onClose={() => setShowCookingSheet(false)}
          onSave={saveCookingNote}
        />
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-[0_-12px_30px_rgba(34,31,32,0.12)] sm:absolute sm:left-1/2 sm:max-w-[430px] sm:-translate-x-1/2 sm:rounded-t-2xl lg:max-w-5xl">
        <div className="mx-auto grid max-w-[430px] grid-cols-[1fr_1.45fr] gap-3 lg:max-w-4xl">
          <div className="min-w-0">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-muted">Pay using</p>
            <p className="mt-1 truncate text-[17px] font-bold text-charcoal">{paymentLabel}</p>
          </div>
          {storeOrderingDisabled ? (
            <button disabled className="h-16 cursor-not-allowed rounded-2xl bg-muted/30 text-[18px] font-black text-muted">
              Closed
            </button>
          ) : !serviceable ? (
            <button
              type="button"
              onClick={openLocationSheet}
              className="flex h-16 items-center justify-center rounded-2xl bg-maroon text-[18px] font-black text-white shadow-[0_10px_24px_rgba(141,0,33,0.28)]"
            >
              Choose Location
            </button>
          ) : !customerSession?.mobile ? (
            <button
              type="button"
              onClick={() => router.push("/login?next=/cart")}
              className="flex h-16 items-center justify-center rounded-2xl bg-maroon text-[18px] font-black text-white shadow-[0_10px_24px_rgba(141,0,33,0.28)]"
            >
              Login to Pay
            </button>
          ) : (
            <button
              type="button"
              onClick={placeOrder}
              disabled={submitting}
              className="flex h-16 items-center justify-center rounded-2xl bg-maroon text-[20px] font-black text-white shadow-[0_10px_24px_rgba(141,0,33,0.28)] disabled:opacity-60"
            >
              {submitting ? "Placing..." : `Place Order ${formatRupees(totals.grandTotal)}`}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[72] flex items-end bg-charcoal/60" onClick={onClose}>
      <button
        type="button"
        className="absolute bottom-[calc(min(72vh,580px)+18px)] left-1/2 grid h-12 w-12 -translate-x-1/2 place-items-center rounded-full bg-[#272b35] text-white shadow-2xl"
        onClick={onClose}
        aria-label="Close"
      >
        <X size={25} strokeWidth={3} />
      </button>
      <section
        className="max-h-[72vh] w-full overflow-y-auto rounded-t-[26px] bg-[#f6f7fb] px-4 pb-[calc(env(safe-area-inset-bottom)+22px)] pt-5 shadow-[0_-18px_48px_rgba(17,24,39,0.25)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-[24px] font-black leading-tight text-charcoal">{title}</h2>
        {children}
      </section>
    </div>
  );
}

function CookingNoteSheet({
  initialNote,
  onClose,
  onSave,
}: {
  initialNote: string;
  onClose: () => void;
  onSave: (note: string) => void;
}) {
  const [note, setNote] = useState(initialNote);

  return (
    <BottomSheet title="Add a note for the restaurant" onClose={onClose}>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        className="mt-8 h-28 w-full resize-none rounded-xl border border-border bg-white p-4 text-[18px] font-bold leading-6 text-charcoal outline-none placeholder:text-muted"
        placeholder="e.g. Note for the entire order"
      />
      <p className="mt-8 text-[15px] font-bold leading-6 text-muted">
        The restaurant will try its best to fulfil your requests. However, refunds or cancellations related to such requests won&apos;t be possible.
      </p>
      <div className="mt-8 grid grid-cols-[1fr_1.7fr] gap-3">
        <button type="button" onClick={() => setNote("")} className="h-14 rounded-xl bg-white text-[18px] font-black text-muted">
          Clear
        </button>
        <button type="button" onClick={() => onSave(note)} className="h-14 rounded-xl bg-maroon text-[18px] font-black text-white">
          Save
        </button>
      </div>
    </BottomSheet>
  );
}

function CartInfoRow({
  icon,
  title,
  body,
  href,
  badge,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  href?: string;
  badge?: string;
  onClick?: () => void;
}) {
  const content = (
    <div className="grid w-full grid-cols-[28px_minmax(0,1fr)_22px] items-start gap-3 px-4 py-4 text-left">
      <span className="grid h-7 w-7 place-items-center pt-0.5 text-[#374151]">{icon}</span>
      <span className="min-w-0">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[15px] font-black leading-5 text-charcoal">{title}</span>
          {badge ? <span className="shrink-0 rounded-md bg-[#e9f2ff] px-2 py-0.5 text-[11px] font-black text-[#1769c2]">{badge}</span> : null}
        </span>
        <span className="mt-1 line-clamp-2 text-[13px] font-semibold leading-5 text-muted">{body}</span>
      </span>
      {href || onClick ? <ChevronRight size={22} className="mt-3 text-muted" /> : <span />}
    </div>
  );

  if (onClick) {
    return <button type="button" onClick={onClick} className="block w-full">{content}</button>;
  }

  return href ? <Link href={href}>{content}</Link> : content;
}

function getStoreStatusMessage(settings: RestaurantSettings) {
  if (settings.storeStatusReason.trim()) return settings.storeStatusReason;
  if (settings.storeMode === "BUSY") return settings.busyMessage;
  if (settings.storeMode === "PAUSED") return settings.pausedMessage;
  if (settings.storeMode === "CLOSED") return settings.closedMessage;
  return "Restaurant is accepting orders.";
}

function getCouponBenefitText(coupon: Coupon) {
  if (coupon.type === "FIXED") return formatRupees(coupon.value);
  return coupon.maxDiscount ? `${coupon.value}% up to ${formatRupees(coupon.maxDiscount)}` : `${coupon.value}%`;
}
