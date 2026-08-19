import { BadgeIndianRupee, Gift, Plus, Star, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { AdminCustomersClient } from "@/components/admin-customers-client";
import { getAdminCustomersFromDb, getBusinessSettingsFromDb } from "@/lib/db";
import { formatRupees } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  const [customers, settings] = await Promise.all([getAdminCustomersFromDb(), getBusinessSettingsFromDb()]);
  const activeCustomers = customers.filter((customer) => customer.orders > 0);
  const vipCustomers = customers.filter((customer) => customer.isVip);
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
            <Link href="/login" className="inline-flex h-11 items-center gap-2 rounded-lg bg-maroon px-4 font-black text-white">
              <Plus size={18} /> Add customer
            </Link>
          </div>
        </div>
        <AdminSectionNav />

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [UserRoundCheck, "Active customers", String(activeCustomers.length), "Customers with orders"],
            [Star, "VIP customers", String(vipCustomers.length), "Marked for private offers"],
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

        {customers.length ? (
          <AdminCustomersClient customers={customers} supportPhone={settings.supportPhone} />
        ) : (
          <div className="surface mt-6 rounded-2xl p-8 text-center">
            <h2 className="text-xl font-black text-maroon">No live customers yet</h2>
            <p className="mt-2 text-sm font-semibold text-muted">Customers will appear after signup, saved addresses, or checkout orders.</p>
          </div>
        )}
      </div>
    </main>
  );
}
