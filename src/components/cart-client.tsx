"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gift,
  Grid2X2,
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
  Trash2,
  X,
} from "lucide-react";
import { calculateCartTotals, formatRupees, getPricableCartLines, isCouponEligibleForCustomer } from "@/lib/pricing";
import { writeStoredCart } from "@/lib/cart-storage";
import { readCustomerSession, saveCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";
import { extractPinCode, getDeliveryLocationCoverage, saveDeliveryLocation, useDeliveryLocation } from "@/lib/delivery-location";
import { addNotification } from "@/lib/notifications";
import { useStoredCart } from "@/lib/use-stored-cart";
import { getStoreOrderingStatus } from "@/lib/store-hours";
import { OrderPlacingOverlay } from "@/components/order-placing-overlay";
import type { CartLine, Coupon, Product, RestaurantSettings } from "@/lib/types";

type PaymentMethod = "COD" | "RAZORPAY";
type CouponCustomer = { isVip: boolean; points: number };

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => { open: () => void };
  }
}

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; contact: string };
  notes: { orderNumber: string };
  theme: { color: string };
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal: { ondismiss: () => void };
};

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

function wait(durationMs: number) {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
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
  const [placingStage, setPlacingStage] = useState<string | null>(null);
  const [showBillSummary, setShowBillSummary] = useState(false);
  const [showReceiverSheet, setShowReceiverSheet] = useState(false);
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [showCookingSheet, setShowCookingSheet] = useState(false);
  const [showCouponSheet, setShowCouponSheet] = useState(false);
  const [showOrderConfirmSheet, setShowOrderConfirmSheet] = useState(false);
  const [locating, setLocating] = useState(false);
  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  const [couponCustomer, setCouponCustomer] = useState<CouponCustomer>({ isVip: false, points: 0 });
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    restaurantSettings.onlinePaymentsEnabled ? "RAZORPAY" : "COD",
  );
  const supportMobile = restaurantSettings.supportPhone.replace(/\D/g, "").slice(-10);
  const [receiverDraft, setReceiverDraft] = useState(() => ({
    name: "Customer",
    mobile: supportMobile,
  }));
  const [locationDraft, setLocationDraft] = useState(() => ({
    area: "",
    details: "",
    pinCode: "",
    latitude: "",
    longitude: "",
    tag: "Home" as "Home" | "Work" | "Other",
  }));
  const appliedAddRef = useRef(false);
  const cartOwnerId = customerSession?.mobile;
  const lines = useStoredCart(cartOwnerId);
  const deliveryLocation = useDeliveryLocation();
  const validLines = useMemo(() => getPricableCartLines(lines, initialProducts), [initialProducts, lines]);
  const selectedCoupon = initialCoupons.find((item) => item.code === coupon);
  const couponEligible = selectedCoupon ? isCouponEligibleForCustomer(selectedCoupon, couponCustomer) : true;

  const totals = useMemo(
    () => calculateCartTotals(validLines, couponEligible ? coupon : undefined, initialProducts, initialCoupons, restaurantSettings, couponCustomer),
    [couponCustomer, couponEligible, initialCoupons, initialProducts, validLines, coupon, restaurantSettings],
  );
  const deliveryCoverage = getDeliveryLocationCoverage(deliveryLocation, restaurantSettings);
  const serviceable = deliveryCoverage.serviceable;
  const suggestions = initialProducts.filter((product) => !validLines.some((line) => line.productId === product.id)).slice(0, 6);
  const orderingStatus = getStoreOrderingStatus(restaurantSettings);
  const storeOrderingDisabled = orderingStatus.unavailable;
  const statusMessage = orderingStatus.message;
  const showStoreStatus = restaurantSettings.storeMode !== "OPEN" || orderingStatus.outsideOrderingHours;
  const appliedCoupon = couponEligible ? selectedCoupon : undefined;
  const availableCoupons = useMemo(
    () =>
      initialCoupons.filter((item) => (
        totals.subtotal >= item.minOrder &&
        isCouponEligibleForCustomer(item, couponCustomer) &&
        calculateCartTotals(validLines, item.code, initialProducts, initialCoupons, restaurantSettings, couponCustomer).discount > 0
      )),
    [couponCustomer, initialCoupons, initialProducts, restaurantSettings, totals.subtotal, validLines],
  );
  const featuredCoupon = availableCoupons[0];
  const featuredCouponValue = featuredCoupon ? getCouponBenefitText(featuredCoupon) : "";
  const paymentOptions: PaymentMethod[] = [
    ...(restaurantSettings.onlinePaymentsEnabled ? ["RAZORPAY" as const] : []),
    ...(restaurantSettings.codEnabled ? ["COD" as const] : []),
  ];
  const selectedPaymentMethod = paymentOptions.includes(paymentMethod) ? paymentMethod : paymentOptions[0];
  const paymentLabel = getPaymentLabel(selectedPaymentMethod);
  const itemSavings = validLines.reduce((total, line) => {
    const product = initialProducts.find((item) => item.id === line.productId);
    if (!product?.originalPrice) return total;
    return total + Math.max(product.originalPrice - product.price, 0) * line.quantity;
  }, 0);
  const totalSavings = itemSavings + totals.discount;
  const cartItemCount = validLines.reduce((total, line) => total + line.quantity, 0);
  const categoryItems = useMemo(() => {
    const categories = Array.from(new Set(initialProducts.map((product) => product.category).filter(Boolean))).slice(0, 8);
    return [
      {
        name: "All",
        count: initialProducts.length,
        image: "",
      },
      ...categories.map((category) => {
        const products = initialProducts.filter((product) => product.category === category);
        return {
          name: category,
          count: products.length,
          image: products[0]?.image ?? "",
        };
      }),
    ];
  }, [initialProducts]);
  const receiverName = customerSession?.name || "Customer";
  const receiverMobile = customerSession?.mobile || supportMobile;
  const hasDeliveryAddress = deliveryLocation.address.trim() !== "" && deliveryLocation.address !== "Select delivery location";

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

  useEffect(() => {
    let cancelled = false;

    async function loadCouponCustomer() {
      if (!customerSession?.mobile) {
        setCouponCustomer({ isVip: false, points: 0 });
        return;
      }

      try {
        const response = await fetch(`/api/customers/profile?mobile=${encodeURIComponent(customerSession.mobile)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.customer || cancelled) return;
        setCouponCustomer({
          isVip: Boolean(data.customer.isVip),
          points: Number(data.customer.rewardOrderCount ?? data.customer.loyalty?.points ?? 0),
        });
      } catch {
        if (!cancelled) setCouponCustomer({ isVip: false, points: 0 });
      }
    }

    void loadCouponCustomer();
    return () => {
      cancelled = true;
    };
  }, [customerSession?.mobile]);

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
      setCheckoutMessage("This coupon is not available right now.");
      return false;
    }

    if (totals.subtotal < availableCoupon.minOrder) {
      setCoupon(undefined);
      setCheckoutMessage(`Add ${formatRupees(availableCoupon.minOrder - totals.subtotal)} more to use ${availableCoupon.code}.`);
      return false;
    }

    if (!isCouponEligibleForCustomer(availableCoupon, couponCustomer)) {
      setCoupon(undefined);
      setCheckoutMessage(getCouponEligibilityMessage(availableCoupon));
      return false;
    }

    setCoupon(availableCoupon.code);
    setCheckoutMessage("");
    return true;
  }

  function selectCoupon(code: string) {
    if (applyCommonCoupon(code)) {
      setShowCouponSheet(false);
    }
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
      latitude: deliveryLocation.latitude ?? "",
      longitude: deliveryLocation.longitude ?? "",
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
      latitude: locationDraft.latitude || deliveryLocation.latitude,
      longitude: locationDraft.longitude || deliveryLocation.longitude,
    });
    setShowLocationSheet(false);
  }

  function detectDeliveryLocation() {
    if (!("geolocation" in navigator)) {
      setCheckoutMessage("Location detection is not supported on this browser.");
      return;
    }

    setLocating(true);
    setCheckoutMessage("Detecting your current location...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude.toFixed(6);
        const longitude = position.coords.longitude.toFixed(6);
        let area = locationDraft.area;
        let pinCode = locationDraft.pinCode;

        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          area = data.display_name || area || "Detected location";
          pinCode = extractPinCode(area) || pinCode;
        } catch {
          area = area || "Detected location";
        }

        setLocationDraft((current) => ({
          ...current,
          area,
          pinCode,
          latitude,
          longitude,
        }));
        saveDeliveryLocation({
          label: locationDraft.tag,
          address: area,
          pinCode,
          latitude,
          longitude,
        });
        setCheckoutMessage("Current location saved for delivery check.");
        setLocating(false);
      },
      (error) => {
        setCheckoutMessage(error.message || "Location permission was denied.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  function saveCookingNote(note: string) {
    setCookingRequest(note.trim());
    setShowCookingSheet(false);
  }

  async function loadRazorpayCheckout() {
    if (window.Razorpay) return true;

    return new Promise<boolean>((resolve) => {
      const existing = document.querySelector<HTMLScriptElement>("script[src='https://checkout.razorpay.com/v1/checkout.js']");
      if (existing) {
        existing.addEventListener("load", () => resolve(true), { once: true });
        existing.addEventListener("error", () => resolve(false), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function verifyRazorpayPayment(input: {
    orderNumber: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) {
    const response = await fetch("/api/payments/razorpay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok || !data.verified) {
      throw new Error(data.error || "Payment verification failed.");
    }
  }

  async function cancelUnpaidOrder(orderNumber: string) {
    await fetch(`/api/orders/${orderNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "CANCELLED",
        note: "Online payment was not completed. Checkout attempt cancelled before sending to kitchen.",
      }),
    }).catch(() => undefined);
  }

  async function openRazorpayCheckout(input: {
    keyId: string;
    orderId: string;
    amount: number;
    currency: string;
    orderNumber: string;
  }) {
    const loaded = await loadRazorpayCheckout();
    if (!loaded || !window.Razorpay) {
      await cancelUnpaidOrder(input.orderNumber);
      throw new Error("Online payment could not be loaded.");
    }

    const checkout = new window.Razorpay({
      key: input.keyId,
      amount: input.amount,
      currency: input.currency,
      name: "Wah Thali",
      description: `Order ${input.orderNumber}`,
      order_id: input.orderId,
      prefill: {
        name: receiverName,
        contact: receiverMobile,
      },
      notes: {
        orderNumber: input.orderNumber,
      },
      theme: {
        color: "#8d0021",
      },
      handler: async (response) => {
        setSubmitting(true);
        setPlacingStage("Verifying your payment and saving the kitchen ticket.");
        setCheckoutMessage("Verifying payment...");
        let keepOverlay = false;
        try {
          await verifyRazorpayPayment({
            orderNumber: input.orderNumber,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          writeStoredCart([], cartOwnerId);
          addNotification(cartOwnerId, {
            kind: "order",
            title: "Payment received",
            body: `Your order ${input.orderNumber} is confirmed. We will update you as it moves ahead.`,
          });
          setPlacingStage("Payment received. Opening your live order tracker.");
          await wait(850);
          keepOverlay = true;
          router.push(`/order/${input.orderNumber}/track`);
        } catch (error) {
          setCheckoutMessage(error instanceof Error ? error.message : "Payment verification failed.");
        } finally {
          if (!keepOverlay) {
            setSubmitting(false);
            setPlacingStage(null);
          }
        }
      },
      modal: {
        ondismiss: () => {
          void cancelUnpaidOrder(input.orderNumber);
          setSubmitting(false);
          setPlacingStage(null);
          setCheckoutMessage("Payment was not completed. The order was not sent to the kitchen.");
        },
      },
    });

    checkout.open();
    setPlacingStage(null);
  }

  async function placeOrder() {
    if (storeOrderingDisabled || submitting) return;

    setCheckoutMessage("");
    if (!validLines.length) {
      return;
    }
    if (!customerSession?.mobile) {
      router.push("/login?next=/cart");
      return;
    }
    if (!hasDeliveryAddress) {
      openLocationSheet();
      return;
    }
    if (!serviceable) {
      openLocationSheet();
      return;
    }
    if (!selectedPaymentMethod) {
      setCheckoutMessage("No payment method is available right now.");
      return;
    }

    setShowOrderConfirmSheet(false);
    setSubmitting(true);
    setPlacingStage(selectedPaymentMethod === "RAZORPAY" ? "Starting secure payment for your order." : "Creating your order and sending it to the kitchen.");
    setCheckoutMessage(selectedPaymentMethod === "RAZORPAY" ? "Starting secure payment..." : "Creating your order...");
    let keepOverlay = false;
    let keepRazorpaySubmitting = false;

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: receiverName,
          customerMobile: receiverMobile,
          customerEmail: customerSession.email,
          receiverName,
          receiverMobile,
          deliveryAddress: deliveryLocation.address,
          deliveryLabel: deliveryLocation.label,
          restaurantNote: cookingRequest,
          couponCode: appliedCoupon?.code,
          pinCode: deliveryLocation.pinCode,
          latitude: deliveryLocation.latitude,
          longitude: deliveryLocation.longitude,
          paymentMethod: selectedPaymentMethod,
          items: validLines,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setCheckoutMessage(data.error || "Order could not be created.");
        return;
      }

      if (selectedPaymentMethod === "RAZORPAY") {
        if (!data.razorpay) {
          setCheckoutMessage("Online payment could not be started for this order.");
          return;
        }

        await openRazorpayCheckout({
          keyId: data.razorpay.keyId,
          orderId: data.razorpay.orderId,
          amount: data.razorpay.amount,
          currency: data.razorpay.currency,
          orderNumber: data.order.orderNumber,
        });
        keepRazorpaySubmitting = true;
        return;
      }

      writeStoredCart([], cartOwnerId);
      addNotification(cartOwnerId, {
        kind: "order",
        title: "Order placed",
        body: `Your order ${data.order.orderNumber} was placed successfully. We will update you as it moves ahead.`,
      });
      setPlacingStage("Order placed successfully. Opening your live tracker.");
      await wait(850);
      keepOverlay = true;
      router.push(`/order/${data.order.orderNumber}/track`);
    } catch (error) {
      setCheckoutMessage(error instanceof Error ? error.message : "Checkout could not be completed.");
    } finally {
      if (!keepOverlay && !keepRazorpaySubmitting) {
        setSubmitting(false);
        setPlacingStage(null);
      }
    }
  }

  function requestPlaceOrderConfirmation() {
    if (storeOrderingDisabled || submitting) return;

    setCheckoutMessage("");
    if (!validLines.length) {
      return;
    }
    if (!customerSession?.mobile) {
      router.push("/login?next=/cart");
      return;
    }
    if (!hasDeliveryAddress || !serviceable) {
      openLocationSheet();
      return;
    }
    if (!selectedPaymentMethod) {
      setCheckoutMessage("No payment method is available right now.");
      return;
    }

    setShowOrderConfirmSheet(true);
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
      <>
        {placingStage ? <OrderPlacingOverlay message={placingStage} /> : null}
        <div className="mx-auto max-w-md rounded-[28px] bg-white p-6 text-center shadow-sm ring-1 ring-border">
          <h1 className="text-2xl font-black text-maroon">Your cart is empty</h1>
          <p className="mt-3 text-sm text-muted">Add your favourite Wah Thali dishes to continue.</p>
          {showStoreStatus ? (
            <div className="mt-4 rounded-2xl border border-red/20 bg-cream p-4 text-left text-sm text-maroon">
              <p className="flex items-center gap-2 font-black">
                <Store size={17} className="text-red" />
                {orderingStatus.title}
              </p>
              <p className="mt-1 text-xs font-bold text-muted">{statusMessage}</p>
            </div>
          ) : null}
          <Link prefetch href="/menu" className="mt-6 inline-flex h-12 items-center rounded-2xl bg-red px-5 font-black text-white">
            Browse menu
          </Link>
        </div>
      </>
    );
  }

  return (
    <section className="relative mx-auto min-h-screen max-w-[430px] bg-[#f6f7fb] pb-32 text-charcoal shadow-[0_18px_60px_rgba(34,31,32,0.08)] sm:my-6 sm:min-h-0 sm:overflow-hidden sm:rounded-[28px] lg:max-w-none lg:overflow-visible lg:rounded-none lg:bg-white lg:pb-0 lg:shadow-none">
      {placingStage ? <OrderPlacingOverlay message={placingStage} /> : null}
      <div className="mx-auto hidden max-w-[1248px] grid-cols-[230px_minmax(0,1fr)_360px] gap-8 px-6 py-9 lg:grid">
        <aside className="sticky top-[88px] h-[calc(100vh-108px)] overflow-hidden rounded-[22px] border border-[#f1e7e4] bg-white shadow-[0_18px_44px_rgba(34,31,32,0.06)]">
          <div className="border-b border-[#f1e7e4] px-5 py-5">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-muted">
              <BookOpen size={17} className="text-maroon" /> Categories
            </p>
          </div>
          <div className="h-full space-y-2 overflow-y-auto px-3 py-4">
            {categoryItems.map((category, index) => (
              <Link
                key={category.name}
                href={category.name === "All" ? "/menu" : `/?category=${encodeURIComponent(category.name)}`}
                className={`grid grid-cols-[42px_1fr] items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                  index === 0 ? "bg-maroon text-white shadow-[0_10px_22px_rgba(141,0,33,0.18)]" : "text-charcoal hover:bg-[#fff4f5] hover:text-maroon"
                }`}
              >
                <span className={`grid h-10 w-10 place-items-center overflow-hidden rounded-full ${index === 0 ? "bg-white/15" : "bg-[#fff4f5] ring-1 ring-[#f1e7e4]"}`}>
                  {index === 0 ? (
                    <Grid2X2 size={19} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={category.image || "/wah-thali-meal-cutout-v2.png"}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.src = "/wah-thali-meal-cutout-v2.png";
                      }}
                    />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black">{category.name}</span>
                  <span className={`mt-0.5 block text-[11px] font-bold ${index === 0 ? "text-white/75" : "text-muted"}`}>{category.count} items</span>
                </span>
              </Link>
            ))}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-maroon">Wah Thali Cart</p>
              <h1 className="mt-2 text-[32px] font-black leading-none text-charcoal">Your Basket</h1>
            </div>
            <span className="rounded-full bg-[#fff4f5] px-4 py-2 text-sm font-black text-maroon">
              {cartItemCount} {cartItemCount === 1 ? "Item" : "Items"}
            </span>
          </div>

          <div className="space-y-4">
            {validLines.map((line, index) => {
              const product = initialProducts.find((item) => item.id === line.productId);
              if (!product) return null;
              const variant = product.variants.find((item) => item.id === line.variantId);
              const addons = line.addonIds
                .map((addonId) => product.addons.find((item) => item.id === addonId)?.name)
                .filter(Boolean);
              const unitPrice = product.price + (variant?.price ?? 0);
              const lineTotal = unitPrice * line.quantity;
              const originalTotal = product.originalPrice ? product.originalPrice * line.quantity : undefined;

              return (
                <article key={`${line.productId}-${index}`} className="grid grid-cols-[132px_minmax(0,1fr)_150px] items-center gap-6 rounded-[18px] border border-[#f1e7e4] bg-white p-5 shadow-[0_14px_34px_rgba(34,31,32,0.05)]">
                  <div className="relative h-[108px] overflow-hidden rounded-[14px] bg-cream">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.image || "/wah-thali-meal-cutout-v2.png"}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.src = "/wah-thali-meal-cutout-v2.png";
                      }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border bg-white ${
                          product.dietaryType === "NON_VEG" ? "border-red" : "border-maroon"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${product.dietaryType === "NON_VEG" ? "bg-red" : "bg-maroon"}`} />
                      </span>
                      <p className="truncate text-[12px] font-black uppercase tracking-[0.14em] text-muted">{product.category}</p>
                    </div>
                    <h2 className="mt-2 line-clamp-1 text-[22px] font-black text-charcoal">{product.name}</h2>
                    <p className="mt-1 text-sm font-black text-muted">{variant?.name || "Regular"}</p>
                    {addons.length ? <p className="mt-1 line-clamp-1 text-xs font-bold text-muted">With {addons.join(", ")}</p> : null}
                    <div className="mt-5 flex items-center gap-2">
                      {originalTotal ? <span className="text-sm font-bold text-muted line-through">{formatRupees(originalTotal)}</span> : null}
                      <span className="text-lg font-black text-maroon">{formatRupees(lineTotal)}</span>
                    </div>
                  </div>
                  <div className="grid justify-items-end gap-5">
                    <button onClick={() => updateQuantity(index, 0)} className="grid h-9 w-9 place-items-center rounded-xl bg-[#fff4f5] text-red" aria-label={`Remove ${product.name}`}>
                      <Trash2 size={17} />
                    </button>
                    <div className="grid h-11 w-[132px] grid-cols-3 overflow-hidden rounded-full bg-white text-maroon shadow-sm ring-1 ring-maroon/20">
                      <button onClick={() => updateQuantity(index, line.quantity - 1)} className="grid place-items-center" aria-label={`Decrease ${product.name}`}>
                        <Minus size={15} />
                      </button>
                      <span className="grid place-items-center text-base font-black">{line.quantity}</span>
                      <button onClick={() => updateQuantity(index, line.quantity + 1)} className="grid place-items-center bg-[#fff4f5]" aria-label={`Increase ${product.name}`}>
                        <Plus size={17} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {suggestions.length ? (
            <section className="mt-8">
              <h2 className="text-2xl font-black text-charcoal">Before you checkout</h2>
              <div className="mt-4 grid grid-cols-3 gap-4">
                {suggestions.slice(0, 3).map((product) => (
                  <article key={product.id} className="rounded-[18px] border border-[#f1e7e4] bg-[#fff8f9] p-4 shadow-sm">
                    <div className="h-[116px] overflow-hidden rounded-[14px] bg-cream">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={product.image || "/wah-thali-meal-cutout-v2.png"}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.src = "/wah-thali-meal-cutout-v2.png";
                        }}
                      />
                    </div>
                    <h3 className="mt-3 line-clamp-1 text-base font-black text-charcoal">{product.name}</h3>
                    <p className="mt-2 text-lg font-black text-maroon">{formatRupees(product.price)}</p>
                    <button
                      onClick={() => addSuggestedProduct(product)}
                      className="mt-4 h-10 w-full rounded-xl bg-maroon text-sm font-black text-white shadow-[0_10px_22px_rgba(141,0,33,0.16)]"
                    >
                      Add
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="sticky top-[88px] h-max">
          <div className="rounded-[22px] bg-[#f5f6fb] p-6 shadow-[0_18px_44px_rgba(34,31,32,0.08)] ring-1 ring-[#edf0f5]">
            <h2 className="text-[24px] font-black text-charcoal">Bill Summary</h2>
            <dl className="mt-6 space-y-5 text-[17px]">
              <div className="flex items-center justify-between gap-4">
                <dt className="font-bold text-[#1f2937]">Item Total</dt>
                <dd className="font-black text-charcoal">{formatRupees(totals.subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="font-bold text-[#1f2937]">Delivery Fee</dt>
                <dd className="font-black text-charcoal">{formatRupees(totals.delivery)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="font-bold text-[#1f2937]">GST</dt>
                <dd className="font-black text-charcoal">{formatRupees(totals.gst)}</dd>
              </div>
              {totals.discount > 0 ? (
                <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#e7f6ee] px-4 py-3 text-maroon">
                  <dt className="flex items-center gap-2 font-black"><Tag size={18} /> {appliedCoupon ? `Coupon ${appliedCoupon.code}` : "Discount Applied"}</dt>
                  <dd className="font-black">-{formatRupees(totals.discount)}</dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-4 border-t border-[#dfe3ea] pt-5">
                <dt className="text-xl font-black text-charcoal">To Pay</dt>
                <dd className="text-[30px] font-black text-charcoal">{formatRupees(totals.grandTotal)}</dd>
              </div>
            </dl>
            {totalSavings > 0 ? (
              <div className="mt-5 rounded-2xl border border-maroon/20 bg-white px-4 py-3 text-center text-sm font-black text-maroon shadow-sm">
                Your Savings {formatRupees(totalSavings)}
              </div>
            ) : null}
            {paymentOptions.length ? (
              <div className="mt-5 grid grid-cols-2 gap-2">
                {paymentOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPaymentMethod(option)}
                    className={`h-11 rounded-xl text-sm font-black ring-1 ${
                      selectedPaymentMethod === option
                        ? "bg-maroon text-white ring-maroon"
                        : "bg-white text-charcoal ring-border"
                    }`}
                  >
                    {getPaymentLabel(option)}
                  </button>
                ))}
              </div>
            ) : null}
            {checkoutMessage ? (
              <p className="mt-4 rounded-xl bg-white px-3 py-2 text-center text-xs font-black leading-5 text-muted" aria-live="polite">
                {checkoutMessage}
              </p>
            ) : null}
          </div>

          <div className="mt-4 rounded-[22px] bg-white p-6 shadow-[0_18px_44px_rgba(34,31,32,0.08)] ring-1 ring-[#edf0f5]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">Total Payable</p>
              <p className="text-[30px] font-black text-maroon">{formatRupees(totals.grandTotal)}</p>
            </div>
            {storeOrderingDisabled ? (
              <button disabled className="mt-6 h-14 w-full cursor-not-allowed rounded-2xl bg-muted/30 text-lg font-black text-muted">
                Closed
              </button>
            ) : !serviceable ? (
              <button type="button" onClick={openLocationSheet} className="mt-6 h-14 w-full rounded-2xl bg-maroon text-lg font-black text-white">
                Choose Location
              </button>
            ) : paymentOptions.length ? (
              <button
                type="button"
                onClick={requestPlaceOrderConfirmation}
                disabled={submitting}
                className="mt-6 inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-maroon text-lg font-black text-white shadow-[0_12px_24px_rgba(141,0,33,0.22)] disabled:opacity-60"
              >
                {submitting ? "Placing..." : "Place Order"} <ArrowRight size={22} />
              </button>
            ) : (
              <button disabled className="mt-6 h-14 w-full cursor-not-allowed rounded-2xl bg-muted/30 text-lg font-black text-muted">
                Payment unavailable
              </button>
            )}
          </div>
        </aside>
      </div>

      <div className="lg:hidden">
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

      {showStoreStatus ? (
        <div className="mx-5 mt-4 rounded-2xl border border-red/20 bg-white p-4 text-sm text-maroon">
          <p className="flex items-center gap-2 font-black">
            <Store size={17} className="text-red" />
            {orderingStatus.title}
          </p>
          <p className="mt-1 text-xs font-bold text-muted">{statusMessage}</p>
        </div>
      ) : null}
      {!serviceable ? (
        <div className="mx-5 mt-4 rounded-2xl border border-maroon/15 bg-white p-4 text-sm text-maroon">
          <p className="flex items-center gap-2 font-black">
            <MapPin size={17} />
            {deliveryCoverage.needsLocation ? "Current location required" : "Service not available"}
          </p>
          <p className="mt-1 text-xs font-bold text-muted">
            {deliveryCoverage.message}
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
            onClick={() => initialCoupons.length ? setShowCouponSheet(true) : setCheckoutMessage("No coupons are available right now.")}
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
      <div className="mx-5 mt-5">
        <button
          type="button"
          onClick={() => selectCoupon(featuredCoupon.code)}
          className="block w-full rounded-[18px] bg-[#fff5ef] p-4 text-left shadow-sm ring-1 ring-[#ffe1d1]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-black text-charcoal">Special offer from Wah Thali</p>
              <p className="mt-2 text-[12px] font-bold text-muted">
                Use {featuredCoupon.code} to save {featuredCouponValue}
              </p>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-maroon shadow-sm">
              <Gift size={22} />
            </span>
          </div>
        </button>
      </div>
      ) : null}

      <div className="mx-5 mt-5 overflow-hidden rounded-[18px] bg-white shadow-sm ring-1 ring-[#eef1f6]">
        <div className="divide-y divide-[#eef1f6]">
          <CartInfoRow
            icon={<Clock3 size={18} />}
            title="Delivery in 30-35 mins"
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
      {paymentOptions.length > 1 ? (
        <div className="mx-5 mt-5 grid grid-cols-2 gap-2 rounded-[18px] bg-white p-2 shadow-sm ring-1 ring-[#eef1f6]">
          {paymentOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPaymentMethod(option)}
              className={`h-11 rounded-xl text-[14px] font-black ${
                selectedPaymentMethod === option ? "bg-maroon text-white" : "bg-[#f6f7fb] text-charcoal"
              }`}
            >
              {getPaymentLabel(option)}
            </button>
          ))}
        </div>
      ) : null}
      {checkoutMessage ? (
        <p className="mx-5 mt-4 rounded-2xl bg-white p-3 text-center text-xs font-black leading-5 text-muted shadow-sm ring-1 ring-border" aria-live="polite">
          {checkoutMessage}
        </p>
      ) : null}
      </div>

      {showBillSummary ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-charcoal/60" onClick={() => setShowBillSummary(false)}>
          <section
            className="w-full rounded-t-[26px] bg-[#f6f7fb] px-4 pb-[calc(env(safe-area-inset-bottom)+22px)] pt-5 shadow-[0_-18px_48px_rgba(17,24,39,0.25)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bill-summary-title"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_40px] items-start gap-3">
              <h2 id="bill-summary-title" className="min-w-0 text-[22px] font-black text-charcoal">Bill Summary</h2>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full bg-white text-charcoal shadow-sm ring-1 ring-border"
                onClick={() => setShowBillSummary(false)}
                aria-label="Close bill summary"
              >
                <X size={22} strokeWidth={3} />
              </button>
            </div>
            <div className="mt-5 overflow-hidden rounded-[18px] bg-white shadow-sm">
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
                  <dt className="text-[17px] font-black text-[#1769c2]">{appliedCoupon ? `Coupon ${appliedCoupon.code}` : "Limited Time Offer"}</dt>
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
          <p className="mt-1 text-[13px] font-bold leading-5 text-muted">
            {deliveryLocation.label} - {deliveryLocation.address}
          </p>
          <div className="mt-5 rounded-[18px] bg-white p-4 shadow-sm">
            <label className="block rounded-xl border border-border bg-white px-3 py-2">
              <span className="block text-[12px] font-bold text-muted">Receiver&apos;s name</span>
              <input
                value={receiverDraft.name}
                onChange={(event) => setReceiverDraft((current) => ({ ...current, name: event.target.value }))}
                className="mt-1 h-8 w-full bg-transparent text-[15px] font-black text-charcoal outline-none"
              />
            </label>
            <label className="mt-4 block rounded-xl border border-border bg-white px-3 py-2">
              <span className="block text-[12px] font-bold text-muted">Receiver&apos;s mobile number</span>
              <input
                value={receiverDraft.mobile}
                onChange={(event) => setReceiverDraft((current) => ({ ...current, mobile: event.target.value }))}
                className="mt-1 h-8 w-full bg-transparent text-[15px] font-black text-charcoal outline-none"
              />
            </label>
          </div>
          <button onClick={saveReceiverDetails} className="mt-6 h-13 w-full rounded-xl bg-maroon text-[17px] font-black text-white">
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
            <button
              type="button"
              onClick={detectDeliveryLocation}
              disabled={locating}
              className="absolute bottom-5 left-1/2 inline-flex h-11 -translate-x-1/2 items-center gap-2 rounded-xl bg-white px-4 text-[14px] font-black text-maroon shadow-lg disabled:cursor-wait disabled:opacity-70"
            >
              <LocateFixed size={17} /> {locating ? "Detecting..." : "Use current location"}
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
            <p className="mt-2 text-[12px] font-bold text-muted">{deliveryCoverage.message}</p>
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

      {showCouponSheet ? (
        <CouponSheet
          coupons={initialCoupons}
          selectedCode={appliedCoupon?.code}
          subtotal={totals.subtotal}
          customer={couponCustomer}
          products={initialProducts}
          lines={validLines}
          restaurantSettings={restaurantSettings}
          onClose={() => setShowCouponSheet(false)}
          onSelect={selectCoupon}
        />
      ) : null}

      {showOrderConfirmSheet ? (
        <OrderConfirmationSheet
          addressLabel={deliveryLocation.label}
          address={deliveryLocation.address}
          receiverName={receiverName}
          receiverMobile={receiverMobile}
          paymentLabel={paymentLabel}
          total={totals.grandTotal}
          submitting={submitting}
          onClose={() => setShowOrderConfirmSheet(false)}
          onEditLocation={() => {
            setShowOrderConfirmSheet(false);
            openLocationSheet();
          }}
          onEditReceiver={() => {
            setShowOrderConfirmSheet(false);
            openReceiverSheet();
          }}
          onConfirm={placeOrder}
        />
      ) : null}

      {showCookingSheet ? (
        <CookingNoteSheet
          initialNote={cookingRequest}
          onClose={() => setShowCookingSheet(false)}
          onSave={saveCookingNote}
        />
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-[0_-12px_30px_rgba(34,31,32,0.12)] sm:absolute sm:left-1/2 sm:max-w-[430px] sm:-translate-x-1/2 sm:rounded-t-2xl lg:hidden">
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
          ) : paymentOptions.length ? (
            <button
              type="button"
              onClick={requestPlaceOrderConfirmation}
              disabled={submitting}
              className="flex h-16 items-center justify-center rounded-2xl bg-maroon text-[20px] font-black text-white shadow-[0_10px_24px_rgba(141,0,33,0.28)] disabled:opacity-60"
            >
              {submitting ? "Placing..." : `Place Order ${formatRupees(totals.grandTotal)}`}
            </button>
          ) : (
            <button disabled className="h-16 cursor-not-allowed rounded-2xl bg-muted/30 text-[16px] font-black text-muted">
              Payment unavailable
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
      <section
        className="max-h-[72vh] w-full overflow-y-auto rounded-t-[26px] bg-[#f6f7fb] px-4 pb-[calc(env(safe-area-inset-bottom)+22px)] pt-5 shadow-[0_-18px_48px_rgba(17,24,39,0.25)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_40px] items-start gap-3">
          <h2 className="min-w-0 text-[22px] font-black leading-tight text-charcoal">{title}</h2>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-charcoal shadow-sm ring-1 ring-border"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={22} strokeWidth={3} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function OrderConfirmationSheet({
  addressLabel,
  address,
  receiverName,
  receiverMobile,
  paymentLabel,
  total,
  submitting,
  onClose,
  onEditLocation,
  onEditReceiver,
  onConfirm,
}: {
  addressLabel: string;
  address: string;
  receiverName: string;
  receiverMobile: string;
  paymentLabel: string;
  total: number;
  submitting: boolean;
  onClose: () => void;
  onEditLocation: () => void;
  onEditReceiver: () => void;
  onConfirm: () => void;
}) {
  return (
    <BottomSheet title="Confirm order details" onClose={onClose}>
      <p className="mt-2 text-[14px] font-bold leading-5 text-muted">
        Please check your delivery address and receiver details before we place your order.
      </p>

      <div className="mt-6 overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-border">
        <ConfirmDetailRow
          icon={<MapPin size={20} />}
          title={`Delivery at ${addressLabel}`}
          body={address}
          action="Change"
          onAction={onEditLocation}
        />
        <ConfirmDetailRow
          icon={<Phone size={19} />}
          title={receiverName}
          body={`+91-${receiverMobile}`}
          action="Edit"
          onAction={onEditReceiver}
        />
        <ConfirmDetailRow
          icon={<ReceiptText size={19} />}
          title="Payment"
          body={paymentLabel}
        />
      </div>

      <div className="mt-5 rounded-[18px] bg-[#fff4f5] px-4 py-4 text-maroon ring-1 ring-[#f0d7dd]">
        <div className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-[12px] font-black uppercase tracking-[0.18em]">To pay</span>
            <span className="mt-1 block text-[13px] font-bold text-maroon/75">Final bill after offers and charges</span>
          </span>
          <span className="text-[24px] font-black text-maroon">{formatRupees(total)}</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-[1fr_1.5fr] gap-3">
        <button
          type="button"
          onClick={onClose}
          className="h-13 rounded-xl bg-white text-[15px] font-black text-muted ring-1 ring-border"
        >
          Review
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          className="h-13 rounded-xl bg-maroon text-[15px] font-black text-white shadow-[0_12px_24px_rgba(141,0,33,0.22)] disabled:opacity-60"
        >
          {submitting ? "Placing..." : "Confirm & Place Order"}
        </button>
      </div>
    </BottomSheet>
  );
}

function ConfirmDetailRow({
  icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#eef1f6] px-4 py-4 last:border-b-0">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-[#fff4f5] text-maroon">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-black leading-5 text-charcoal">{title}</span>
        <span className="mt-1 block line-clamp-2 text-[13px] font-bold leading-5 text-muted">{body}</span>
      </span>
      {action && onAction ? (
        <button type="button" onClick={onAction} className="rounded-lg bg-[#fff4f5] px-3 py-2 text-[12px] font-black text-maroon">
          {action}
        </button>
      ) : <span />}
    </div>
  );
}

function CouponSheet({
  coupons,
  selectedCode,
  subtotal,
  customer,
  products,
  lines,
  restaurantSettings,
  onClose,
  onSelect,
}: {
  coupons: Coupon[];
  selectedCode?: string;
  subtotal: number;
  customer: CouponCustomer;
  products: Product[];
  lines: CartLine[];
  restaurantSettings: RestaurantSettings;
  onClose: () => void;
  onSelect: (code: string) => void;
}) {
  return (
    <BottomSheet title="Available coupons" onClose={onClose}>
      <div className="mt-6 grid gap-3">
        {coupons.length ? coupons.map((coupon) => {
          const eligibleForCustomer = isCouponEligibleForCustomer(coupon, customer);
          const minOrderGap = Math.max(coupon.minOrder - subtotal, 0);
          const available = eligibleForCustomer && minOrderGap === 0;
          const estimatedDiscount = calculateCartTotals(lines, coupon.code, products, coupons, restaurantSettings, customer).discount;
          const selected = selectedCode === coupon.code;

          return (
            <article
              key={coupon.code}
              className={`rounded-[18px] bg-white p-4 shadow-sm ring-1 ${selected ? "ring-maroon" : "ring-border"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="inline-flex max-w-full rounded-lg bg-[#fff4f5] px-3 py-1.5 text-[12px] font-black uppercase tracking-wide text-maroon">
                    {coupon.code}
                  </span>
                  <span className="mt-3 block text-[15px] font-black leading-5 text-charcoal">{coupon.label}</span>
                  <span className="mt-1.5 block text-[12px] font-bold leading-5 text-muted">{getCouponDescription(coupon)}</span>
                </span>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fff4f5] text-maroon">
                  <Gift size={20} />
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-black text-muted">
                <span className="rounded-md bg-[#f6f7fb] px-2 py-1">
                  {coupon.minOrder > 0 ? `Min ${formatRupees(coupon.minOrder)}` : "No minimum"}
                </span>
                {estimatedDiscount > 0 ? (
                  <span className="rounded-md bg-[#e9f2ff] px-2 py-1 text-[#1769c2]">
                    Saves {formatRupees(estimatedDiscount)}
                  </span>
                ) : null}
              </div>

              {!eligibleForCustomer ? (
                <p className="mt-3 text-[12px] font-black leading-5 text-maroon">{getCouponEligibilityMessage(coupon)}</p>
              ) : minOrderGap > 0 ? (
                <p className="mt-3 text-[12px] font-black leading-5 text-maroon">Add {formatRupees(minOrderGap)} more to apply this coupon.</p>
              ) : null}

              <button
                type="button"
                disabled={!available}
                onClick={() => onSelect(coupon.code)}
                className={`mt-4 h-11 w-full rounded-xl text-[14px] font-black ${
                  selected
                    ? "bg-[#e9f2ff] text-[#1769c2]"
                    : available
                      ? "bg-maroon text-white"
                      : "bg-muted/20 text-muted"
                }`}
              >
                {selected ? "Applied" : available ? "Apply Coupon" : "Unavailable"}
              </button>
            </article>
          );
        }) : (
          <div className="rounded-[18px] bg-white p-6 text-center shadow-sm ring-1 ring-border">
            <Gift className="mx-auto text-maroon" size={30} />
            <p className="mt-3 text-[17px] font-black text-charcoal">No coupons available</p>
            <p className="mt-2 text-[13px] font-bold leading-5 text-muted">Please check back later for new Wah Thali offers.</p>
          </div>
        )}
      </div>
    </BottomSheet>
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
  body?: string;
  href?: string;
  badge?: string;
  onClick?: () => void;
}) {
  const content = (
    <div className="grid w-full grid-cols-[28px_minmax(0,1fr)_22px] items-start gap-3 px-4 py-4 text-left">
      <span className="grid h-7 w-7 place-items-center pt-0.5 text-[#374151]">{icon}</span>
      <span className="min-w-0">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[14px] font-black leading-5 text-charcoal">{title}</span>
          {badge ? <span className="shrink-0 rounded-md bg-[#e9f2ff] px-2 py-0.5 text-[11px] font-black text-[#1769c2]">{badge}</span> : null}
        </span>
        {body ? <span className="mt-1 line-clamp-2 text-[12px] font-semibold leading-5 text-muted">{body}</span> : null}
      </span>
      {href || onClick ? <ChevronRight size={22} className="mt-3 text-muted" /> : <span />}
    </div>
  );

  if (onClick) {
    return <button type="button" onClick={onClick} className="block w-full">{content}</button>;
  }

  return href ? <Link href={href}>{content}</Link> : content;
}

function getCouponBenefitText(coupon: Coupon) {
  if (coupon.type === "FIXED") return formatRupees(coupon.value);
  return coupon.maxDiscount ? `${coupon.value}% up to ${formatRupees(coupon.maxDiscount)}` : `${coupon.value}%`;
}

function getCouponDescription(coupon: Coupon) {
  if (coupon.type === "FIXED") {
    return `Use above ${formatRupees(coupon.minOrder)} and save ${formatRupees(coupon.value)}.`;
  }

  return coupon.maxDiscount
    ? `Get ${coupon.value}% OFF up to ${formatRupees(coupon.maxDiscount)}.`
    : `Get ${coupon.value}% OFF.`;
}

function getCouponEligibilityMessage(coupon: Coupon) {
  if (coupon.audience === "VIP") return "This coupon is only for VIP customers.";
  if (coupon.audience === "POINTS") return `This reward unlocks after ${coupon.minPoints ?? 0} placed orders.`;
  return "This coupon is not eligible for this account.";
}

function getPaymentLabel(method?: PaymentMethod) {
  if (method === "RAZORPAY") return "Online Pay";
  if (method === "COD") return "Cash on Delivery";
  return "Payment unavailable";
}
