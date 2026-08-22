"use client";

import { useMemo, useState, useTransition } from "react";
import { Crown, MessageCircle, Phone, Search, Star } from "lucide-react";
import type { AdminCustomer } from "@/lib/types";
import { formatRupees } from "@/lib/pricing";
import { formatIstDate } from "@/lib/time";

type Segment = "All customers" | "VIP" | "New" | "Repeat buyers";

export function AdminCustomersClient({
  customers,
  supportPhone,
}: {
  customers: AdminCustomer[];
  supportPhone: string;
}) {
  const [customerRows, setCustomerRows] = useState(customers);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("All customers");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function toggleVip(customer: AdminCustomer) {
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch(`/api/customers/${customer.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isVip: !customer.isVip }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not update VIP status.");
        setCustomerRows((current) => current.map((item) => item.id === customer.id ? { ...item, isVip: !customer.isVip } : item));
        setMessage(!customer.isVip ? "Customer marked as VIP." : "Customer removed from VIP.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not update VIP status.");
      }
    });
  }

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return customerRows.filter((customer) => {
      const matchesQuery = normalizedQuery
        ? `${customer.name} ${customer.mobile} ${customer.email ?? ""} ${customer.tier}`.toLowerCase().includes(normalizedQuery)
        : true;
      const matchesSegment =
        segment === "All customers" ||
        (segment === "VIP" && customer.isVip) ||
        (segment === "New" && customer.orders <= 1) ||
        (segment === "Repeat buyers" && customer.orders > 1);

      return matchesQuery && matchesSegment;
    });
  }, [customerRows, query, segment]);

  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-[280px_1fr]">
      <aside className="surface rounded-2xl p-5">
        <label className="flex h-11 items-center gap-2 rounded-lg border border-border bg-cream px-3">
          <Search size={17} className="text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold"
            placeholder="Search customer"
          />
        </label>
        <div className="mt-4 grid gap-2">
          {(["All customers", "VIP", "New", "Repeat buyers"] as Segment[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSegment(item)}
              className={`rounded-lg px-3 py-2 text-left text-sm font-black ${segment === item ? "bg-maroon text-white" : "bg-cream text-charcoal"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-cream p-4">
          <Crown className="text-red" size={20} />
          <p className="mt-2 text-sm font-black text-maroon">VIP customers</p>
          <p className="mt-1 text-xs font-bold leading-5 text-muted">Use VIP tags for private coupons and special WhatsApp offers.</p>
        </div>
      </aside>

      <div className="grid gap-4">
        {message ? <p className="rounded-lg border border-border bg-cream px-4 py-3 text-sm font-black text-maroon">{message}</p> : null}
        {filteredCustomers.length ? filteredCustomers.map((customer) => (
          <article key={customer.id} className="surface rounded-2xl p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-muted">{customer.mobile}</p>
                  {customer.isVip ? <span className="inline-flex items-center gap-1 rounded-lg bg-[#fff4f5] px-2.5 py-1 text-xs font-black text-maroon"><Crown size={14} /> VIP</span> : null}
                </div>
                <h2 className="mt-1 truncate text-xl font-black text-maroon">{customer.name}</h2>
                <p className="mt-2 text-sm font-bold text-muted">
                  {customer.tier} - {customer.orders} orders - LTV {formatRupees(customer.ltv)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                  <span className="rounded-lg bg-cream px-3 py-2">Points {customer.points}</span>
                  <span className="rounded-lg bg-cream px-3 py-2">Last order {customer.lastOrder ? formatIstDate(customer.lastOrder) : "No orders"}</span>
                  {customer.email ? <span className="max-w-full truncate rounded-lg bg-cream px-3 py-2">{customer.email}</span> : null}
                </div>
              </div>
              <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                <button type="button" disabled={isPending} onClick={() => toggleVip(customer)} className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-black disabled:opacity-60 ${customer.isVip ? "bg-maroon text-white" : "border border-border text-maroon"}`}>
                  <Star size={16} /> {customer.isVip ? "VIP customer" : "Mark VIP"}
                </button>
                <a href={`tel:${customer.mobile || supportPhone}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black">
                  <Phone size={16} /> Call
                </a>
                <a href={`https://wa.me/91${customer.mobile}?text=${encodeURIComponent(`Hi ${customer.name}, this is Wah Thali.`)}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-maroon px-3 text-sm font-black text-white">
                  <MessageCircle size={16} /> WhatsApp
                </a>
              </div>
            </div>
          </article>
        )) : (
          <div className="surface rounded-2xl p-8 text-center">
            <h2 className="text-xl font-black text-maroon">No customers match this view</h2>
            <p className="mt-2 text-sm font-semibold text-muted">Change the search or segment to see more customers.</p>
          </div>
        )}
      </div>
    </section>
  );
}
