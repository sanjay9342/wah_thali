"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Crown, History, MessageCircle, Phone, Plus, Search, Star, Tag, X } from "lucide-react";
import { useAdminAccess } from "@/components/admin-access-gate";
import { adminFetch } from "@/lib/admin-client-auth";
import type { AdminCustomer } from "@/lib/types";
import { formatRupees } from "@/lib/pricing";
import { formatIstDate } from "@/lib/time";

type Segment = "All customers" | "VIP" | "New" | "Repeat buyers" | "High value" | "Loyalty ready" | "At risk" | "No orders";

const segmentOptions: { id: Segment; helper: string }[] = [
  { id: "All customers", helper: "Every saved customer account." },
  { id: "VIP", helper: "Customers marked for private offers." },
  { id: "New", helper: "First order or newly created customers." },
  { id: "Repeat buyers", helper: "More than one completed checkout." },
  { id: "High value", helper: "Lifetime value above Rs 1,500." },
  { id: "Loyalty ready", helper: "Customers with 5 or more loyalty points." },
  { id: "At risk", helper: "Ordered before, but not in the last 30 days." },
  { id: "No orders", helper: "Signed up or saved, but never ordered." },
];

export function AdminCustomersClient({
  customers,
  supportPhone,
  initialTags,
}: {
  customers: AdminCustomer[];
  supportPhone: string;
  initialTags: string[];
}) {
  const [customerRows, setCustomerRows] = useState(customers);
  const [allTags, setAllTags] = useState(() => Array.from(new Set(["VIP", ...initialTags])).sort((a, b) => a.localeCompare(b)));
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("All customers");
  const [tagFilter, setTagFilter] = useState("");
  const [newTag, setNewTag] = useState("");
  const [showAddCustomer, setShowAddCustomer] = useState(() => typeof window !== "undefined" && window.location.hash === "#add-customer");
  const [draft, setDraft] = useState<CustomerDraft>(emptyCustomerDraft);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const adminAccess = useAdminAccess();

  useEffect(() => {
    function openFromHash() {
      if (window.location.hash === "#add-customer") setShowAddCustomer(true);
    }

    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  function run(task: () => Promise<void>) {
    setMessage("");
    startTransition(async () => {
      try {
        await task();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }
    });
  }

  function toggleVip(customer: AdminCustomer) {
    run(async () => {
      const nextTags = toggleName(customer.tags, "VIP");
      const response = await adminFetch(adminAccess?.session, `/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVip: !customer.isVip }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update VIP status.");
      setCustomerRows((current) => current.map((item) => item.id === customer.id ? { ...item, tags: nextTags, isVip: nextTags.includes("VIP") } : item));
      setMessage(!customer.isVip ? "Customer marked as VIP." : "Customer removed from VIP.");
    });
  }

  function toggleCustomerTag(customer: AdminCustomer, tagName: string) {
    const nextTags = toggleName(customer.tags, tagName);
    run(async () => {
      const response = await adminFetch(adminAccess?.session, `/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagNames: nextTags }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update customer tags.");
      setCustomerRows((current) => current.map((item) => item.id === customer.id ? { ...item, tags: nextTags, isVip: nextTags.includes("VIP") } : item));
      setMessage("Customer tags updated.");
    });
  }

  function createTag(nameInput = newTag) {
    const name = nameInput.trim();
    if (!name) return;
    run(async () => {
      const response = await adminFetch(adminAccess?.session, "/api/customer-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save tag.");
      setAllTags((current) => Array.from(new Set([...current, data.tag.name])).sort((a, b) => a.localeCompare(b)));
      setNewTag((current) => current === nameInput ? "" : current);
      setMessage("Customer tag saved.");
    });
  }

  function saveCustomer() {
    if (!draft.name.trim() || !draft.mobile.trim()) return;
    run(async () => {
      const response = await adminFetch(adminAccess?.session, "/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          mobile: draft.mobile,
          email: draft.email.trim() || undefined,
          birthday: draft.birthday,
          anniversary: draft.anniversary,
          tags: draft.tags,
          note: draft.note,
          address: {
            label: draft.addressLabel,
            line1: draft.addressLine,
            area: draft.area,
            city: draft.city,
            state: draft.state,
            pinCode: draft.pinCode,
            landmark: draft.landmark,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Customer save failed.");
      const saved = toAdminCustomer(data.customer, customerRows.find((customer) => customer.mobile === data.customer.mobile));
      setCustomerRows((current) => [saved, ...current.filter((customer) => customer.id !== saved.id && customer.mobile !== saved.mobile)]);
      closeAddCustomer();
      setDraft(emptyCustomerDraft);
      setMessage("Customer added to CRM.");
    });
  }

  function closeAddCustomer() {
    setShowAddCustomer(false);
    if (typeof window !== "undefined" && window.location.hash === "#add-customer") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return customerRows.filter((customer) => {
      const matchesQuery = normalizedQuery
        ? `${customer.name} ${customer.mobile} ${customer.email ?? ""} ${customer.tier} ${customer.tags.join(" ")}`.toLowerCase().includes(normalizedQuery)
        : true;
      const matchesTag = tagFilter ? customer.tags.includes(tagFilter) : true;
      const matchesSegment =
        segment === "All customers" ||
        (segment === "VIP" && customer.isVip) ||
        (segment === "New" && customer.orders <= 1) ||
        (segment === "Repeat buyers" && customer.orders > 1) ||
        (segment === "High value" && customer.ltv >= 1500) ||
        (segment === "Loyalty ready" && customer.points >= 5) ||
        (segment === "At risk" && customer.orders > 0 && isOlderThanDays(customer.lastOrder, 30)) ||
        (segment === "No orders" && customer.orders === 0);

      return matchesQuery && matchesTag && matchesSegment;
    });
  }, [customerRows, query, segment, tagFilter]);

  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-[280px_1fr]">
      <aside className="surface rounded-2xl p-5">
        <button
          type="button"
          id="add-customer"
          onClick={() => setShowAddCustomer(true)}
          className="mb-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-maroon px-4 text-sm font-black text-white"
        >
          <Plus size={18} /> Add customer
        </button>
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
          {segmentOptions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSegment(item.id)}
              title={item.helper}
              className={`rounded-lg px-3 py-2 text-left text-sm font-black ${segment === item.id ? "bg-maroon text-white" : "bg-cream text-charcoal"}`}
            >
              {item.id}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-cream p-4">
          <Crown className="text-red" size={20} />
          <p className="mt-2 text-sm font-black text-maroon">{segment}</p>
          <p className="mt-1 text-xs font-bold leading-5 text-muted">{segmentOptions.find((item) => item.id === segment)?.helper}</p>
        </div>
        <div className="mt-4 rounded-xl border border-border bg-white p-4">
          <p className="flex items-center gap-2 text-sm font-black text-maroon"><Tag size={16} /> Customer tags</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setTagFilter("")} className={`rounded-lg px-2.5 py-1.5 text-xs font-black ${!tagFilter ? "bg-maroon text-white" : "bg-cream text-charcoal"}`}>
              All tags
            </button>
            {allTags.map((tagName) => (
              <button key={tagName} type="button" onClick={() => setTagFilter(tagName)} className={`rounded-lg px-2.5 py-1.5 text-xs font-black ${tagFilter === tagName ? "bg-maroon text-white" : "bg-cream text-charcoal"}`}>
                {tagName}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-2">
            <input value={newTag} onChange={(event) => setNewTag(event.target.value)} className="h-10 rounded-lg border border-border bg-cream px-3 text-xs font-bold text-charcoal" placeholder="Create tag" />
            <button type="button" disabled={isPending || !newTag.trim()} onClick={() => createTag()} className="h-10 rounded-lg border border-border text-xs font-black text-maroon disabled:opacity-60">
              Add tag
            </button>
          </div>
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
                <div className="mt-3 flex flex-wrap gap-2">
                  {allTags.map((tagName) => (
                    <button
                      key={tagName}
                      type="button"
                      disabled={isPending}
                      onClick={() => toggleCustomerTag(customer, tagName)}
                      className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-black disabled:opacity-60 ${customer.tags.includes(tagName) ? "bg-maroon text-white" : "border border-border bg-white text-maroon"}`}
                    >
                      <Tag size={13} /> {tagName}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                <button type="button" disabled={isPending} onClick={() => toggleVip(customer)} className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-black disabled:opacity-60 ${customer.isVip ? "bg-maroon text-white" : "border border-border text-maroon"}`}>
                  <Star size={16} /> {customer.isVip ? "VIP customer" : "Mark VIP"}
                </button>
                <button type="button" onClick={() => setExpandedCustomerId((current) => current === customer.id ? null : customer.id)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black text-maroon">
                  <History size={16} /> Order history
                </button>
                <a href={`tel:${customer.mobile || supportPhone}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black">
                  <Phone size={16} /> Call
                </a>
                <a href={`https://wa.me/91${customer.mobile}?text=${encodeURIComponent(`Hi ${customer.name}, this is Wah Thali.`)}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-maroon px-3 text-sm font-black text-white">
                  <MessageCircle size={16} /> WhatsApp
                </a>
              </div>
            </div>
            {expandedCustomerId === customer.id ? (
              <div className="mt-4 rounded-xl border border-border bg-cream p-4">
                <h3 className="text-sm font-black text-maroon">Customer order history</h3>
                {customer.orderHistory?.length ? (
                  <div className="mt-3 grid gap-2">
                    {customer.orderHistory.map((order) => (
                      <div key={order.orderNumber} className="grid gap-2 rounded-lg bg-white p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                        <div className="min-w-0">
                          <p className="font-black text-charcoal">{order.orderNumber} - {order.status}</p>
                          <p className="mt-1 truncate text-xs font-bold text-muted">{order.itemSummary || "Items unavailable"} - {order.paymentSummary}</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-black text-maroon">{formatRupees(order.amount)}</p>
                          <p className="text-xs font-bold text-muted">{formatIstDate(order.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm font-bold text-muted">No order history for this customer yet.</p>
                )}
              </div>
            ) : null}
          </article>
        )) : (
          <div className="surface rounded-2xl p-8 text-center">
            <h2 className="text-xl font-black text-maroon">No customers match this view</h2>
            <p className="mt-2 text-sm font-semibold text-muted">Change the search or segment to see more customers.</p>
          </div>
        )}
      </div>
      {showAddCustomer ? (
        <CustomerModal
          draft={draft}
          tags={allTags}
          isPending={isPending}
          onChange={setDraft}
          onClose={closeAddCustomer}
          onCreateTag={(name) => {
            createTag(name);
          }}
          onSave={saveCustomer}
        />
      ) : null}
    </section>
  );
}

function isOlderThanDays(value: string | undefined, days: number) {
  if (!value) return false;
  return new Date(value).getTime() < Date.now() - days * 24 * 60 * 60 * 1000;
}

type CustomerDraft = {
  name: string;
  mobile: string;
  email: string;
  birthday: string;
  anniversary: string;
  addressLabel: string;
  addressLine: string;
  area: string;
  city: string;
  state: string;
  pinCode: string;
  landmark: string;
  note: string;
  tags: string[];
};

const emptyCustomerDraft: CustomerDraft = {
  name: "",
  mobile: "",
  email: "",
  birthday: "",
  anniversary: "",
  addressLabel: "Bulk order",
  addressLine: "",
  area: "",
  city: "Kolkata",
  state: "West Bengal",
  pinCode: "",
  landmark: "",
  note: "",
  tags: [],
};

function CustomerModal({
  draft,
  tags,
  isPending,
  onChange,
  onClose,
  onCreateTag,
  onSave,
}: {
  draft: CustomerDraft;
  tags: string[];
  isPending: boolean;
  onChange: (draft: CustomerDraft) => void;
  onClose: () => void;
  onCreateTag: (name: string) => void;
  onSave: () => void;
}) {
  const [tagDraft, setTagDraft] = useState("");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-charcoal/45 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h2 className="text-xl font-black text-maroon">Add customer</h2>
            <p className="text-sm font-semibold text-muted">Create outside, bulk order, and WhatsApp customers directly in CRM.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg border border-border" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <Input label="Name" value={draft.name} onChange={(name) => onChange({ ...draft, name })} />
          <Input label="Mobile number" value={draft.mobile} onChange={(mobile) => onChange({ ...draft, mobile: mobile.replace(/\D/g, "").slice(0, 10) })} />
          <Input label="Email" type="email" value={draft.email} onChange={(email) => onChange({ ...draft, email })} />
          <Input label="Birthday" type="date" value={draft.birthday} onChange={(birthday) => onChange({ ...draft, birthday })} />
          <Input label="Anniversary" type="date" value={draft.anniversary} onChange={(anniversary) => onChange({ ...draft, anniversary })} />
          <Input label="Address label" value={draft.addressLabel} onChange={(addressLabel) => onChange({ ...draft, addressLabel })} />
          <Input label="Address line" value={draft.addressLine} onChange={(addressLine) => onChange({ ...draft, addressLine })} />
          <Input label="Area" value={draft.area} onChange={(area) => onChange({ ...draft, area })} />
          <Input label="City" value={draft.city} onChange={(city) => onChange({ ...draft, city })} />
          <Input label="State" value={draft.state} onChange={(state) => onChange({ ...draft, state })} />
          <Input label="PIN code" value={draft.pinCode} onChange={(pinCode) => onChange({ ...draft, pinCode: pinCode.replace(/\D/g, "").slice(0, 6) })} />
          <Input label="Landmark / source" value={draft.landmark} onChange={(landmark) => onChange({ ...draft, landmark })} />
          <label className="grid gap-2 text-sm font-black text-maroon lg:col-span-2">
            Notes
            <textarea value={draft.note} onChange={(event) => onChange({ ...draft, note: event.target.value })} className="min-h-24 rounded-lg border border-border bg-cream px-3 py-2 text-sm font-bold text-charcoal" placeholder="Bulk order need, company name, preferred timing, food preference" />
          </label>
          <div className="rounded-xl border border-border bg-cream p-4 lg:col-span-2">
            <p className="flex items-center gap-2 text-sm font-black text-maroon"><Tag size={16} /> Tags</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((tagName) => (
                <button
                  key={tagName}
                  type="button"
                  onClick={() => onChange({ ...draft, tags: toggleName(draft.tags, tagName) })}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-black ${draft.tags.includes(tagName) ? "bg-maroon text-white" : "border border-border bg-white text-maroon"}`}
                >
                  <Tag size={14} /> {tagName}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} className="h-10 rounded-lg border border-border bg-white px-3 text-sm font-bold text-charcoal" placeholder="New customer tag" />
              <button
                type="button"
                disabled={!tagDraft.trim()}
                onClick={() => {
                  const name = tagDraft.trim();
                  onCreateTag(name);
                  onChange({ ...draft, tags: Array.from(new Set([...draft.tags, name])) });
                  setTagDraft("");
                }}
                className="h-10 rounded-lg border border-border bg-white px-4 text-sm font-black text-maroon disabled:opacity-60"
              >
                Create tag
              </button>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-5">
          <button type="button" onClick={onClose} className="h-11 rounded-lg border border-border px-4 font-black">Cancel</button>
          <button type="button" disabled={isPending || !draft.name.trim() || draft.mobile.length < 8} onClick={onSave} className="h-11 rounded-lg bg-red px-4 font-black text-white disabled:opacity-60">
            {isPending ? "Saving..." : "Save customer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="grid gap-2 text-sm font-black text-maroon">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg border border-border bg-cream px-3 text-sm font-bold text-charcoal" />
    </label>
  );
}

function toggleName(values: string[], name: string) {
  return values.includes(name) ? values.filter((value) => value !== name) : [...values, name];
}

function toAdminCustomer(customer: {
  id: string;
  name: string;
  mobile: string;
  email?: string | null;
  birthday?: string | null;
  anniversary?: string | null;
  tags?: Array<{ tag?: { name?: string } }> | string[];
}, existing?: AdminCustomer): AdminCustomer {
  const tags = (customer.tags ?? []).map((tag) => typeof tag === "string" ? tag : tag.tag?.name).filter((tag): tag is string => Boolean(tag));
  return {
    id: customer.id,
    name: customer.name,
    mobile: customer.mobile,
    email: customer.email ?? undefined,
    birthday: customer.birthday ?? undefined,
    anniversary: customer.anniversary ?? undefined,
    tags,
    isVip: tags.includes("VIP"),
    orders: existing?.orders ?? 0,
    ltv: existing?.ltv ?? 0,
    points: existing?.points ?? 0,
    tier: existing?.tier ?? "Starter",
    lastOrder: existing?.lastOrder,
    orderHistory: existing?.orderHistory ?? [],
  };
}
