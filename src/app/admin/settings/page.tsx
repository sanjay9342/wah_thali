import { BellRing, CreditCard, MapPinned, Save, Settings, Store, Truck } from "lucide-react";
import Link from "next/link";
import { categories, settings } from "@/lib/data";

const settingGroups = [
  {
    title: "Business",
    icon: Store,
    fields: [
      ["Restaurant name", "Wah Thali"],
      ["Opening hours", settings.openingHours],
      ["Support phone", settings.supportPhone],
      ["WhatsApp number", settings.whatsappNumber],
    ],
  },
  {
    title: "Delivery",
    icon: Truck,
    fields: [
      ["Minimum order", String(settings.minimumOrder)],
      ["Delivery fee", String(settings.deliveryFee)],
      ["Free delivery threshold", String(settings.freeDeliveryThreshold)],
      ["Packaging fee", String(settings.packagingFee)],
    ],
  },
  {
    title: "Payments",
    icon: CreditCard,
    fields: [
      ["GST rate", String(settings.gstRate)],
      ["COD enabled", "Yes"],
      ["Razorpay enabled", "No"],
      ["Refund SLA", "24 hours"],
    ],
  },
  {
    title: "Notifications",
    icon: BellRing,
    fields: [
      ["Order WhatsApp alerts", "Enabled"],
      ["Abandoned cart alerts", "Enabled"],
      ["Low stock alerts", "Enabled"],
      ["Admin daily digest", "9:00 PM"],
    ],
  },
];

export default function AdminSettingsPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black uppercase tracking-widest text-red">Configuration</p>
            <h1 className="text-3xl font-black text-maroon">Business settings</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Control storefront rules, fees, PIN codes, menu categories, payments, and notifications.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin" className="inline-flex h-11 items-center rounded-lg border border-border px-4 font-black">Dashboard</Link>
            <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-red px-4 font-black text-white">
              <Save size={18} /> Save changes
            </button>
          </div>
        </div>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-5 sm:grid-cols-2">
            {settingGroups.map((group) => (
              <section key={group.title} className="surface rounded-2xl p-5">
                <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
                  <group.icon className="text-red" size={22} /> {group.title}
                </h2>
                <div className="mt-4 grid gap-4">
                  {group.fields.map(([label, value]) => (
                    <label key={label} className="text-sm font-bold text-charcoal">
                      {label}
                      <input className="mt-2 h-11 w-full rounded-lg border border-border bg-cream px-3" defaultValue={value} />
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="grid gap-5">
            <section className="surface rounded-2xl p-5">
              <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
                <MapPinned className="text-red" /> Serviceable PINs
              </h2>
              <textarea className="mt-4 min-h-32 w-full rounded-lg border border-border bg-cream p-3 text-sm font-bold" defaultValue={settings.serviceablePins.join(", ")} />
              <button className="mt-3 h-10 rounded-lg bg-maroon px-4 text-sm font-black text-white">Validate PINs</button>
            </section>

            <section className="surface rounded-2xl p-5">
              <h2 className="flex items-center gap-2 text-xl font-black text-maroon">
                <Settings className="text-red" /> Menu categories
              </h2>
              <div className="mt-4 grid gap-2">
                {categories.map((category, index) => (
                  <div key={category} className="flex items-center gap-2">
                    <input className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-cream px-3 text-sm font-bold" defaultValue={category} />
                    <button className={`h-10 rounded-lg px-3 text-xs font-black ${index < 4 ? "bg-maroon text-white" : "border border-border text-maroon"}`}>
                      {index < 4 ? "Pinned" : "Pin"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
