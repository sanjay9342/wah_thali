import { CalendarDays, Copy, Edit3, Plus, TicketPercent, Trash2 } from "lucide-react";
import Link from "next/link";
import { coupons, products } from "@/lib/data";
import { formatRupees } from "@/lib/pricing";

const campaignRows = [
  { code: "WAHTHALI20", title: "Flat 20% off all thalis", audience: "Homepage slider", used: 142, cap: 500, status: "Live" },
  { code: "MINI99", title: "Mini meal discovery", audience: "Lunch users", used: 87, cap: 300, status: "Scheduled" },
  { code: "WINBACK75", title: "Rs 75 off for churn risk", audience: "Inactive 30 days", used: 31, cap: 120, status: "Live" },
];

export default function AdminCouponsPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black uppercase tracking-widest text-red">Promotions</p>
            <h1 className="text-3xl font-black text-maroon">Coupons and sliders</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Manage home slider offers, cart recovery, customer segments, and product discounts.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin" className="inline-flex h-11 items-center rounded-lg border border-border px-4 font-black">Dashboard</Link>
            <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-red px-4 font-black text-white">
              <Plus size={18} /> New coupon
            </button>
          </div>
        </div>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          {[
            ["Active coupon codes", String(coupons.length + campaignRows.filter((coupon) => coupon.status === "Live").length), "Homepage and CRM"],
            ["Discounted products", String(products.filter((product) => product.offer).length), "Offer label visible"],
            ["Revenue protected", formatRupees(18240), "From abandoned cart recovery"],
          ].map(([label, value, detail]) => (
            <div key={label} className="surface rounded-2xl p-5">
              <TicketPercent className="text-red" />
              <p className="mt-4 text-sm font-bold text-muted">{label}</p>
              <p className="text-3xl font-black text-maroon">{value}</p>
              <p className="mt-1 text-xs font-bold text-muted">{detail}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="surface overflow-hidden rounded-2xl">
            <div className="border-b border-border p-5">
              <h2 className="text-xl font-black text-maroon">Coupon campaigns</h2>
              <p className="text-sm font-semibold text-muted">Codes can be shown on homepage slider, cart, WhatsApp, or customer CRM.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] text-left text-sm">
                <thead className="bg-cream text-maroon">
                  <tr>
                    {["Code", "Campaign", "Audience", "Usage", "Status", "Actions"].map((head) => (
                      <th key={head} className="p-4">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...campaignRows, ...coupons.map((coupon) => ({
                    code: coupon.code,
                    title: coupon.label,
                    audience: `Min order ${formatRupees(coupon.minOrder)}`,
                    used: coupon.code === "WAH50" ? 204 : 66,
                    cap: coupon.code === "WAH50" ? 600 : 180,
                    status: "Live",
                  }))].map((coupon) => (
                    <tr key={coupon.code} className="border-t border-border">
                      <td className="p-4">
                        <span className="rounded-lg bg-maroon px-3 py-2 font-black text-white">{coupon.code}</span>
                      </td>
                      <td className="p-4 font-black">{coupon.title}</td>
                      <td className="p-4 text-muted">{coupon.audience}</td>
                      <td className="p-4">
                        <div className="h-2 w-36 overflow-hidden rounded-full bg-cream">
                          <div className="h-full rounded-full bg-red" style={{ width: `${Math.min(100, Math.round((coupon.used / coupon.cap) * 100))}%` }} />
                        </div>
                        <p className="mt-1 text-xs font-bold text-muted">{coupon.used}/{coupon.cap}</p>
                      </td>
                      <td className="p-4">
                        <span className="rounded-lg bg-cream px-3 py-1 font-black text-success">{coupon.status}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button className="grid h-9 w-9 place-items-center rounded-lg border border-border text-maroon" aria-label={`Copy ${coupon.code}`}>
                            <Copy size={16} />
                          </button>
                          <button className="grid h-9 w-9 place-items-center rounded-lg border border-border text-maroon" aria-label={`Edit ${coupon.code}`}>
                            <Edit3 size={16} />
                          </button>
                          <button className="grid h-9 w-9 place-items-center rounded-lg border border-border text-red" aria-label={`Delete ${coupon.code}`}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="surface rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
              <CalendarDays className="text-red" /> Create campaign
            </h2>
            <div className="mt-4 grid gap-3">
              {["Campaign name", "Coupon code", "Discount value", "Minimum order", "Max discount", "Start date", "End date"].map((label) => (
                <label key={label} className="text-sm font-bold text-charcoal">
                  {label}
                  <input className="mt-2 h-11 w-full rounded-lg border border-border bg-cream px-3" placeholder={label} />
                </label>
              ))}
              <label className="text-sm font-bold text-charcoal">
                Audience
                <select className="mt-2 h-11 w-full rounded-lg border border-border bg-cream px-3">
                  <option>All customers</option>
                  <option>Cart abandoners</option>
                  <option>VIP customers</option>
                  <option>Inactive customers</option>
                </select>
              </label>
              <button className="mt-2 h-11 rounded-lg bg-maroon font-black text-white">Save coupon</button>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
