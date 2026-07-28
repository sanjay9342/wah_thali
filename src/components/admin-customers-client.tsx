"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Phone, Search } from "lucide-react";
import type { AdminCustomer } from "@/lib/types";
import { formatRupees } from "@/lib/pricing";

type Segment = "All customers" | "VIP" | "New" | "Repeat buyers";

export function AdminCustomersClient({
  customers,
  supportPhone,
}: {
  customers: AdminCustomer[];
  supportPhone: string;
}) {
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("All customers");

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesQuery = normalizedQuery
        ? `${customer.name} ${customer.mobile} ${customer.email ?? ""} ${customer.tier}`.toLowerCase().includes(normalizedQuery)
        : true;
      const matchesSegment =
        segment === "All customers" ||
        (segment === "VIP" && customer.ltv >= 10000) ||
        (segment === "New" && customer.orders <= 1) ||
        (segment === "Repeat buyers" && customer.orders > 1);

      return matchesQuery && matchesSegment;
    });
  }, [customers, query, segment]);

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
      </aside>

      <div className="grid gap-4">
        {filteredCustomers.length ? filteredCustomers.map((customer) => (
          <article key={customer.id} className="surface rounded-2xl p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <p className="text-sm font-bold text-muted">{customer.mobile}</p>
                <h2 className="truncate text-xl font-black text-maroon">{customer.name}</h2>
                <p className="mt-2 text-sm font-bold text-muted">
                  {customer.tier} - {customer.orders} orders - LTV {formatRupees(customer.ltv)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                  <span className="rounded-lg bg-cream px-3 py-2">Points {customer.points}</span>
                  <span className="rounded-lg bg-cream px-3 py-2">Last order {customer.lastOrder ? new Date(customer.lastOrder).toLocaleDateString("en-IN") : "No orders"}</span>
                  {customer.email ? <span className="max-w-full truncate rounded-lg bg-cream px-3 py-2">{customer.email}</span> : null}
                </div>
              </div>
              <div className="flex flex-wrap items-start gap-2 lg:justify-end">
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
