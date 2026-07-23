import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  ChevronRight,
  Clock,
  CookingPot,
  Download,
  MessageCircle,
  PackageCheck,
  Phone,
  ReceiptText,
  RotateCcw,
  Star,
} from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { products, settings } from "@/lib/data";
import { formatRupees } from "@/lib/pricing";

const activeOrder = {
  id: "WT-10021",
  status: "Preparing",
  eta: "32 min",
  placedAt: "5:12 PM",
  total: 488,
  rider: "Assigning soon",
  items: [
    { name: products[0].name, qty: 1, price: 229 },
    { name: products[2].name, qty: 1, price: 249 },
  ],
};

const timeline = [
  ["Placed", "5:12 PM", CheckCircle2, true],
  ["Confirmed", "5:14 PM", CheckCircle2, true],
  ["Preparing", "Now", CookingPot, true],
  ["Packed", "Expected 5:42 PM", PackageCheck, false],
  ["Out for delivery", "Expected 5:48 PM", Bike, false],
  ["Delivered", "Expected 6:10 PM", Clock, false],
] as const;

const pastOrders = [
  { id: "WT-10018", date: "Yesterday", item: "Veg Mini Thali + Gulab Jamun", total: 134, rating: 4.5, status: "Delivered" },
  { id: "WT-10011", date: "18 Jul", item: "Chinese Hakka Combo", total: 189, rating: 4.4, status: "Delivered" },
  { id: "WT-10002", date: "12 Jul", item: "Paneer Butter Masala Combo", total: 219, rating: 4.6, status: "Delivered" },
];

export default function OrdersPage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-[430px] px-4 pb-32 pt-5 sm:max-w-5xl sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="grid h-10 w-10 place-items-center rounded-full bg-white text-charcoal shadow-sm ring-1 ring-border" aria-label="Back home">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-black text-charcoal">Orders</h1>
          <Link href="/support" className="grid h-10 w-10 place-items-center rounded-full bg-red/10 text-red" aria-label="Support">
            <MessageCircle size={20} />
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-border">
          {["Active", "History", "Invoices"].map((tab, index) => (
            <button key={tab} className={`h-9 rounded-xl text-xs font-black ${index === 0 ? "bg-red text-white shadow-[0_8px_18px_rgba(214,0,50,0.22)]" : "text-muted"}`}>
              {tab}
            </button>
          ))}
        </div>

        <section className="mt-5 overflow-hidden rounded-[28px] bg-white shadow-[0_14px_34px_rgba(34,31,32,0.08)] ring-1 ring-border">
          <div className="bg-gradient-to-r from-maroon to-red p-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-white/70">Live order</p>
                <h2 className="mt-1 text-2xl font-black">{activeOrder.id}</h2>
                <p className="mt-1 text-sm font-bold text-white/80">{activeOrder.status} · ETA {activeOrder.eta}</p>
              </div>
              <span className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-maroon">{formatRupees(activeOrder.total)}</span>
            </div>
            <Link href="/order/WT-10021/track" className="mt-4 inline-flex h-10 items-center rounded-xl bg-white px-4 text-sm font-black text-maroon">
              Full tracking
            </Link>
          </div>

          <div className="p-5">
            <div className="space-y-4">
              {timeline.map(([label, time, Icon, done], index) => (
                <div key={label} className="grid grid-cols-[36px_1fr] gap-3">
                  <div className="relative grid justify-items-center">
                    <span className={`z-10 grid h-9 w-9 place-items-center rounded-xl ${done ? "bg-red text-white" : "bg-cream text-muted"}`}>
                      <Icon size={17} />
                    </span>
                    {index < timeline.length - 1 ? <span className="absolute top-9 h-full w-px bg-border" /> : null}
                  </div>
                  <div className="pb-1">
                    <p className="font-black text-charcoal">{label}</p>
                    <p className="text-sm font-semibold text-muted">{time}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl bg-cream p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black text-charcoal">Delivery partner</p>
                  <p className="mt-1 text-sm font-semibold text-muted">{activeOrder.rider}</p>
                </div>
                <div className="flex gap-2">
                  <a href={`tel:${settings.supportPhone}`} className="grid h-10 w-10 place-items-center rounded-xl bg-white text-red" aria-label="Call support">
                    <Phone size={18} />
                  </a>
                  <a href={`https://wa.me/${settings.whatsappNumber}`} className="grid h-10 w-10 place-items-center rounded-xl bg-white text-red" aria-label="Message support">
                    <MessageCircle size={18} />
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="font-black text-charcoal">Items</h3>
              <div className="mt-2 grid gap-2">
                {activeOrder.items.map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-xl bg-cream px-3 py-2 text-sm">
                    <span className="font-bold text-charcoal">{item.qty} x {item.name}</span>
                    <span className="font-black text-maroon">{formatRupees(item.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-charcoal">Order history</h2>
            <button className="text-xs font-black text-red">Filter</button>
          </div>
          <div className="mt-3 grid gap-3">
            {pastOrders.map((order) => (
              <article key={order.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-charcoal">{order.id} · {order.status}</p>
                    <p className="mt-1 truncate text-sm font-semibold text-muted">{order.item}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-black">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-maroon px-2 py-1 text-white">{order.rating} <Star size={11} className="fill-white" /></span>
                      <span className="text-muted">{order.date}</span>
                      <span className="text-maroon">{formatRupees(order.total)}</span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-muted" />
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href="/menu" className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-red px-3 text-sm font-black text-white">
                    <RotateCcw size={16} /> Reorder
                  </Link>
                  <button className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-black text-maroon">
                    <Download size={16} /> Invoice
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-border">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cream text-red">
              <ReceiptText size={22} />
            </span>
            <div>
              <h2 className="font-black text-charcoal">Need invoice or help?</h2>
              <p className="mt-1 text-sm font-semibold text-muted">Download bills, request refunds, or raise a ticket.</p>
            </div>
          </div>
          <Link href="/support" className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-maroon text-sm font-black text-white">
            Contact support
          </Link>
        </section>
      </main>
      <MobileNav />
    </>
  );
}
