import { BadgeIndianRupee, Gift, MessageCircle, Phone, Plus, Search, Star, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { getAdminCustomersFromDb, getBusinessSettingsFromDb } from "@/lib/db";
import { formatRupees } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  const [customers, settings] = await Promise.all([getAdminCustomersFromDb(), getBusinessSettingsFromDb()]);
  const activeCustomers = customers.filter((customer) => customer.orders > 0);
  const vipCustomers = customers.filter((customer) => customer.ltv >= 10000);
  const totalPoints = customers.reduce((total, customer) => total + customer.points, 0);
  const avgLtv = customers.length ? Math.round(customers.reduce((total, customer) => total + customer.ltv, 0) / customers.length) : 0;

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black uppercase tracking-widest text-red">Customer 360</p>
            <h1 className="text-3xl font-black text-maroon">CRM and loyalty</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Live customers from checkout, orders, points, LTV, and WhatsApp actions.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin" className="inline-flex h-11 items-center rounded-lg border border-border px-4 font-black">Dashboard</Link>
            <Link href="/checkout" className="inline-flex h-11 items-center gap-2 rounded-lg bg-red px-4 font-black text-white">
              <Plus size={18} /> Test checkout
            </Link>
          </div>
        </div>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [UserRoundCheck, "Active customers", String(activeCustomers.length), "Customers with orders"],
            [Star, "VIP customers", String(vipCustomers.length), "LTV above Rs 10k"],
            [Gift, "Loyalty points", totalPoints.toLocaleString("en-IN"), "Issued balance"],
            [BadgeIndianRupee, "Avg LTV", formatRupees(avgLtv), "All customers"],
          ].map(([Icon, label, value, detail]) => (
            <div key={String(label)} className="surface rounded-2xl p-5">
              <Icon className="text-red" size={24} />
              <p className="mt-4 text-sm font-bold text-muted">{String(label)}</p>
              <p className="text-2xl font-black text-maroon">{String(value)}</p>
              <p className="mt-1 text-xs font-bold text-muted">{String(detail)}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[280px_1fr]">
          <aside className="surface rounded-2xl p-5">
            <label className="flex h-11 items-center gap-2 rounded-lg border border-border bg-cream px-3">
              <Search size={17} className="text-muted" />
              <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold" placeholder="Search customer" />
            </label>
            <div className="mt-4 grid gap-2">
              {["All customers", "VIP", "New", "Repeat buyers"].map((segment, index) => (
                <button key={segment} className={`rounded-lg px-3 py-2 text-left text-sm font-black ${index === 0 ? "bg-maroon text-white" : "bg-cream text-charcoal"}`}>
                  {segment}
                </button>
              ))}
            </div>
          </aside>

          <div className="grid gap-4">
            {customers.length ? customers.map((customer) => (
              <article key={customer.id} className="surface rounded-2xl p-5">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                  <div>
                    <p className="text-sm font-bold text-muted">{customer.mobile}</p>
                    <h2 className="text-xl font-black text-maroon">{customer.name}</h2>
                    <p className="mt-2 text-sm font-bold text-muted">
                      {customer.tier} - {customer.orders} orders - LTV {formatRupees(customer.ltv)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                      <span className="rounded-lg bg-cream px-3 py-2">Points {customer.points}</span>
                      <span className="rounded-lg bg-cream px-3 py-2">Last order {customer.lastOrder ? new Date(customer.lastOrder).toLocaleDateString("en-IN") : "No orders"}</span>
                      {customer.email ? <span className="rounded-lg bg-cream px-3 py-2">{customer.email}</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                    <a href={`tel:${customer.mobile || settings.supportPhone}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black">
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
                <h2 className="text-xl font-black text-maroon">No live customers yet</h2>
                <p className="mt-2 text-sm font-semibold text-muted">Customers will appear after checkout creates real orders.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
