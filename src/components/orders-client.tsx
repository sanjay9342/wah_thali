"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, LogIn, PackageCheck, Search } from "lucide-react";
import Link from "next/link";
import { OrderReorderButton } from "@/components/order-reorder-button";
import { readCustomerSession, subscribeCustomerSession, type CustomerSession } from "@/lib/customer-session";
import { formatRupees } from "@/lib/pricing";
import { formatIstDateTimeShort } from "@/lib/time";

type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: string;
  grandTotal: number;
  createdAt: string;
  items: { id: string; productId: string; name: string; quantity: number; price: number }[];
};

type CustomerProfile = {
  name: string;
  mobile: string;
  orders: CustomerOrder[];
};

export function OrdersClient() {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    function refreshSession() {
      setSession(readCustomerSession());
    }

    refreshSession();
    return subscribeCustomerSession(refreshSession);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(showLoading = true) {
      if (!session?.mobile) {
        setProfile(null);
        setLoading(false);
        return;
      }

      if (showLoading) setLoading(true);
      try {
        const response = await fetch(`/api/customers/profile?mobile=${encodeURIComponent(session.mobile)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) {
          if (!cancelled) setMessage(data.error || "Could not load your orders.");
          return;
        }
        if (!cancelled) setProfile(data.customer);
      } catch {
        if (!cancelled) setMessage("Could not load your orders. Please check your connection.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProfile();
    const timer = window.setInterval(() => {
      void loadProfile(false);
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [session]);

  const orders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const source = profile?.orders ?? [];
    if (!needle) return source;
    return source.filter((order) =>
      `${order.orderNumber} ${order.items.map((item) => item.name).join(" ")}`.toLowerCase().includes(needle),
    );
  }, [profile?.orders, query]);

  if (!session) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f6f7fb] px-5 pb-32 pt-8 text-charcoal sm:max-w-5xl">
        <section className="mt-20 rounded-[28px] bg-white p-6 text-center shadow-sm ring-1 ring-border">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#fff4f5] text-maroon">
            <PackageCheck size={35} />
          </div>
          <h1 className="mt-5 text-[26px] font-black text-charcoal">Login to view orders</h1>
          <p className="mt-3 text-[15px] font-bold leading-6 text-muted">
            Sign in or create an account to see your order history, tracking, invoices, and reorders.
          </p>
          <Link href="/login?next=/orders" className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-maroon text-[17px] font-black text-white">
            <LogIn size={19} /> Login or Sign Up
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-5 pb-40 pt-5 text-charcoal sm:max-w-5xl sm:px-6 lg:px-8">
      <div className="mb-5 rounded-[24px] bg-maroon p-6 text-white shadow-[0_16px_36px_rgba(141,0,33,0.16)]">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-white/75">Wah Thali</p>
        <h1 className="mt-2 text-4xl font-black leading-tight">My Orders</h1>
        <p className="mt-2 text-sm font-semibold text-white/80">{profile?.name || session.name}, track your live orders here.</p>
      </div>

      <label className="flex h-14 items-center gap-4 rounded-2xl bg-white px-4 shadow-[0_12px_34px_rgba(34,31,32,0.06)] ring-1 ring-border">
        <Search size={24} className="shrink-0 text-maroon" strokeWidth={3} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-charcoal outline-none placeholder:text-muted"
          placeholder="Search by order or dish..."
        />
      </label>

      {message ? <p className="mt-4 rounded-2xl bg-[#fff4f5] p-3 text-center text-xs font-black text-muted">{message}</p> : null}

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        {loading ? (
          <div className="rounded-[24px] bg-white p-6 text-center text-sm font-black text-muted shadow-sm ring-1 ring-border lg:col-span-2">Loading orders...</div>
        ) : orders.length ? orders.map((order) => (
          <article key={order.orderNumber} className="overflow-hidden rounded-[22px] bg-white shadow-[0_12px_34px_rgba(34,31,32,0.06)] ring-1 ring-border">
            <div className="grid grid-cols-[54px_1fr_auto] gap-3 p-4">
              <div className="grid h-[54px] w-[54px] place-items-center rounded-xl bg-[#fff4f5] text-maroon">
                <PackageCheck size={25} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-black leading-tight text-charcoal">Order #{order.orderNumber}</h2>
                <p className="mt-1 truncate text-[14px] font-semibold text-muted">{formatOrderDate(order.createdAt)}</p>
                <span className={`mt-2 inline-flex rounded-lg px-2.5 py-1 text-[11px] font-black ${getOrderStatusTone(order.status)}`}>
                  {formatStatus(order.status)}
                </span>
                <Link href={`/order/${order.orderNumber}/track`} className="mt-1 inline-flex text-[14px] font-black text-maroon">
                  Track order
                  <ChevronRight size={15} />
                </Link>
              </div>
            </div>

            <div className="border-t border-border px-4 py-4">
              <div className="grid gap-2">
                {order.items.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl bg-[#fff8f9] px-3 py-2 text-sm">
                    <span className="font-bold text-charcoal">{item.quantity} x {item.name}</span>
                    <span className="font-black text-maroon">{formatRupees(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <span className="text-[17px] font-black text-charcoal">{formatRupees(order.grandTotal)}</span>
                <OrderReorderButton items={order.items} />
              </div>
            </div>
          </article>
        )) : (
          <section className="rounded-[24px] bg-white p-6 text-center shadow-sm ring-1 ring-border lg:col-span-2">
            <PackageCheck className="mx-auto text-maroon" size={34} />
            <h2 className="mt-3 text-[20px] font-black text-charcoal">No orders yet</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-muted">Your orders will appear here after checkout.</p>
            <Link href="/menu" className="mt-5 inline-flex h-12 items-center rounded-2xl bg-maroon px-5 font-black text-white">
              Browse menu
            </Link>
          </section>
        )}
      </section>
    </main>
  );
}

function formatOrderDate(value: string) {
  return formatIstDateTimeShort(value);
}

function getOrderStatusTone(status: string) {
  if (status === "NEW") return "bg-[#fff4f5] text-maroon";
  if (status === "CONFIRMED") return "bg-[#e9efff] text-[#1e3a8a]";
  if (status === "PREPARING") return "bg-[#fff4df] text-[#8a4b00]";
  if (status === "PACKED" || status === "READY_FOR_PICKUP") return "bg-[#dffaf4] text-[#115e59]";
  if (status === "OUT_FOR_DELIVERY") return "bg-[#e7f5ff] text-[#1769c2]";
  if (status === "DELIVERED") return "bg-[#e8f8ee] text-[#0f7a45]";
  if (status === "CANCELLED") return "bg-[#eef2f7] text-[#475569]";
  return "bg-[#fff7e8] text-[#9a5b00]";
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
