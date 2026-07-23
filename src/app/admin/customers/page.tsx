import { BadgeIndianRupee, Gift, MessageCircle, Phone, Plus, Search, Star, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { settings } from "@/lib/data";

const customers = [
  { id: "CUST-001", name: "Rahul Sharma", tag: "VIP", orders: 36, ltv: "Rs 18,420", health: "Active", points: 1240, lastOrder: "Today" },
  { id: "CUST-002", name: "Priya Sen", tag: "Coupon lover", orders: 11, ltv: "Rs 4,880", health: "Churn risk", points: 320, lastOrder: "22 days ago" },
  { id: "CUST-003", name: "Kolkata Foods Pvt Ltd", tag: "Corporate", orders: 8, ltv: "Rs 74,500", health: "Proposal", points: 0, lastOrder: "Yesterday" },
  { id: "CUST-004", name: "Amit Das", tag: "High spice", orders: 19, ltv: "Rs 9,920", health: "Active", points: 710, lastOrder: "3 days ago" },
];

export default function AdminCustomersPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black uppercase tracking-widest text-red">Customer 360</p>
            <h1 className="text-3xl font-black text-maroon">CRM and loyalty</h1>
            <p className="mt-1 text-sm font-semibold text-muted">View customer health, orders, points, notes, coupons, and WhatsApp actions.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin" className="inline-flex h-11 items-center rounded-lg border border-border px-4 font-black">Dashboard</Link>
            <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-red px-4 font-black text-white">
              <Plus size={18} /> Add lead
            </button>
          </div>
        </div>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [UserRoundCheck, "Active customers", "1,284", "Last 90 days"],
            [Star, "VIP customers", "68", "LTV above Rs 10k"],
            [Gift, "Loyalty points", "84,210", "Issued balance"],
            [BadgeIndianRupee, "Avg LTV", "Rs 4,820", "Repeat buyers"],
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
              {["All customers", "VIP", "Churn risk", "Corporate leads", "Coupon lovers", "Complaint open", "Birthday this week"].map((segment, index) => (
                <button key={segment} className={`rounded-lg px-3 py-2 text-left text-sm font-black ${index === 0 ? "bg-maroon text-white" : "bg-cream text-charcoal"}`}>
                  {segment}
                </button>
              ))}
            </div>
            <div className="mt-5 rounded-xl bg-red/10 p-4">
              <p className="text-sm font-black text-maroon">Suggested campaign</p>
              <p className="mt-1 text-xs font-bold text-muted">Send WINBACK75 to 31 inactive customers with cart value above Rs 299.</p>
              <button className="mt-3 h-10 w-full rounded-lg bg-red text-sm font-black text-white">Send coupon</button>
            </div>
          </aside>

          <div className="grid gap-4">
            {customers.map((customer) => (
              <article key={customer.id} className="surface rounded-2xl p-5">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                  <div>
                    <p className="text-sm font-bold text-muted">{customer.id}</p>
                    <h2 className="text-xl font-black text-maroon">{customer.name}</h2>
                    <p className="mt-2 text-sm font-bold text-muted">
                      {customer.tag} · {customer.orders} orders · LTV {customer.ltv} · {customer.health}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                      <span className="rounded-lg bg-cream px-3 py-2">Points {customer.points}</span>
                      <span className="rounded-lg bg-cream px-3 py-2">Last order {customer.lastOrder}</span>
                      <span className="rounded-lg bg-cream px-3 py-2">Preferred: thali and biryani</span>
                    </div>
                    <p className="mt-3 text-sm text-muted">Timeline: orders, tickets, refunds, notes, reviews, loyalty, referrals, and WhatsApp messages.</p>
                  </div>
                  <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                    <a href={`tel:${settings.supportPhone}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black">
                      <Phone size={16} /> Call
                    </a>
                    <a href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(`Hi ${customer.name}, this is Wah Thali.`)}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-maroon px-3 text-sm font-black text-white">
                      <MessageCircle size={16} /> WhatsApp
                    </a>
                    <button className="inline-flex h-10 items-center rounded-lg bg-red px-3 text-sm font-black text-white">Add note</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
