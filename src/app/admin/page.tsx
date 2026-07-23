import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  IndianRupee,
  Percent,
  Package,
  PackageCheck,
  Settings,
  ShoppingBag,
  Users,
} from "lucide-react";
import Link from "next/link";
import { coupons, dashboard, products } from "@/lib/data";
import { formatRupees } from "@/lib/pricing";

const lowStock = [
  ["Rice", "18 kg", "Order by 6 PM"],
  ["Chicken curry base", "7 portions", "Prep required"],
  ["Packaging bowls", "42 pcs", "Vendor follow-up"],
];

const operations = [
  ["Open orders", "18", "6 preparing, 4 packed"],
  ["Unavailable items", String(products.filter((product) => !product.available).length), "Auto-hidden from menu"],
  ["Active coupons", String(coupons.length), "2 recover abandoned carts"],
  ["Kitchen capacity", "78%", "Lunch rush active"],
];

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black uppercase tracking-widest text-red">Wah Thali Admin</p>
            <h1 className="text-3xl font-black text-maroon">Operations dashboard</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Products, inventory, coupons, orders, customers, and settings.</p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {[
              ["/admin/orders", ClipboardList, "Orders"],
              ["/admin/inventory", PackageCheck, "Inventory"],
              ["/admin/coupons", Percent, "Coupons"],
              ["/admin/customers", Users, "Customers"],
              ["/admin/settings", Settings, "Settings"],
            ].map(([href, Icon, label]) => (
              <Link key={String(label)} href={String(href)} className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-4 font-black">
                <Icon size={18} /> {String(label)}
              </Link>
            ))}
          </nav>
        </div>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [IndianRupee, "Today's sales", formatRupees(dashboard.salesToday), "Net " + formatRupees(dashboard.netRevenue)],
            [ClipboardList, "Orders", String(dashboard.orders), "18 live now"],
            [Users, "Repeat customers", String(dashboard.repeatCustomers), "VIP retention 74%"],
            [Package, "Active products", String(products.filter((product) => product.available).length), `${products.length} total SKUs`],
          ].map(([Icon, label, value, detail]) => (
            <div key={String(label)} className="surface rounded-2xl p-5">
              <Icon className="text-red" size={24} />
              <p className="mt-4 text-sm font-bold text-muted">{String(label)}</p>
              <p className="text-2xl font-black text-maroon">{String(value)}</p>
              <p className="mt-1 text-xs font-bold text-muted">{String(detail)}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_380px]">
          <div className="surface rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
              <BarChart3 className="text-red" /> Live controls
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {operations.map(([title, value, detail]) => (
                <div key={title} className="rounded-xl border border-border bg-cream p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-charcoal">{title}</p>
                    <span className="rounded-lg bg-white px-3 py-1 text-sm font-black text-maroon">{value}</span>
                  </div>
                  <p className="mt-2 text-xs font-bold text-muted">{detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                ["/admin/inventory", "Manage products"],
                ["/admin/orders", "Kitchen board"],
                ["/admin/coupons", "Create coupon"],
              ].map(([href, label]) => (
                <Link key={label} href={href} className="inline-flex h-11 items-center rounded-lg bg-maroon px-4 text-sm font-black text-white">
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <aside className="surface rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
              <AlertTriangle className="text-red" /> Action queue
            </h2>
            <div className="mt-4 space-y-3">
              {dashboard.leakageAlerts.map((alert) => (
                <div key={alert} className="rounded-xl bg-cream p-3 text-sm font-bold">{alert}</div>
              ))}
              {lowStock.map(([item, count, action]) => (
                <div key={item} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black text-charcoal">{item}</p>
                    <span className="text-sm font-black text-red">{count}</span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-muted">{action}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="mt-6 surface overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between gap-4 border-b border-border p-5">
            <div>
              <h2 className="text-xl font-black text-maroon">Product availability</h2>
              <p className="text-sm font-semibold text-muted">Quick status for customer-facing menu.</p>
            </div>
            <Link href="/admin/inventory" className="inline-flex h-10 items-center gap-2 rounded-lg bg-red px-4 text-sm font-black text-white">
              <ShoppingBag size={17} /> Inventory
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-cream text-maroon">
                <tr>
                  {["Product", "Category", "Price", "Status", "Prep", "Action"].map((head) => (
                    <th key={head} className="p-4">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-t border-border">
                    <td className="p-4 font-black">{product.name}</td>
                    <td className="p-4 text-muted">{product.category}</td>
                    <td className="p-4 font-black">{formatRupees(product.price)}</td>
                    <td className="p-4">
                      <span className={`rounded-lg px-3 py-1 font-black ${product.available ? "bg-cream text-success" : "bg-red/10 text-red"}`}>
                        {product.available ? "Available" : "Hidden"}
                      </span>
                    </td>
                    <td className="p-4">{product.prepTimeMinutes} min</td>
                    <td className="p-4">
                      <button className="rounded-lg border border-border px-3 py-2 font-black text-maroon">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
