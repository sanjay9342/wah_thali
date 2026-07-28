import {
  BarChart3,
  ClipboardList,
  IndianRupee,
  ListTree,
  Percent,
  Package,
  PackageCheck,
  Settings,
  ShoppingBag,
  Users,
} from "lucide-react";
import Link from "next/link";
import { AdminDashboardProductsClient } from "@/components/admin-dashboard-products-client";
import { getAdminDashboardMetrics, getAdminProductsFromDb } from "@/lib/db";
import { formatRupees } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [products, metrics] = await Promise.all([getAdminProductsFromDb(), getAdminDashboardMetrics()]);
  const operations = [
    ["Open orders", String(metrics.openOrders), "Need restaurant action"],
    ["Unavailable items", String(metrics.unavailableItems), "Hidden from menu"],
    ["Active coupons", String(metrics.activeCoupons), "Live coupon codes"],
    ["Low stock", String(metrics.lowStock.length), "Needs prep or purchase"],
  ];

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
              ["/admin/categories", ListTree, "Categories"],
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
            [IndianRupee, "Today's sales", formatRupees(metrics.salesToday), "Net " + formatRupees(metrics.netRevenue)],
            [ClipboardList, "Orders", String(metrics.totalOrders), `${metrics.openOrders} live now`],
            [Users, "Customers", String(metrics.repeatCustomers), "Customers with orders"],
            [Package, "Active products", String(metrics.activeProducts), `${metrics.totalProducts} total SKUs`],
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
                ["/admin/categories", "Menu categories"],
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
            <h2 className="text-xl font-black text-maroon">Action queue</h2>
            <div className="mt-4 space-y-3">
              {metrics.actionQueue.length ? metrics.actionQueue.map((alert) => (
                <div key={alert} className="rounded-xl bg-cream p-3 text-sm font-bold">{alert}</div>
              )) : <div className="rounded-xl bg-cream p-3 text-sm font-bold">No urgent actions right now.</div>}
              {metrics.lowStock.slice(0, 5).map((product) => (
                <div key={product.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black text-charcoal">{product.name}</p>
                    <span className="text-sm font-black text-red">{product.stock}</span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-muted">Reorder at {product.reorderAt}</p>
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
          <AdminDashboardProductsClient initialProducts={products} />
        </section>
      </div>
    </main>
  );
}
