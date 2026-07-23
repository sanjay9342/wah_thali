import { Clock, MapPin, MessageCircle, PackageCheck, Printer, RefreshCw, Truck } from "lucide-react";
import Link from "next/link";
import { products } from "@/lib/data";
import { formatRupees } from "@/lib/pricing";
import { canTransitionOrder } from "@/lib/state-machines";

const orders = [
  { id: "WT-10021", customer: "Rahul Sharma", item: products[0], status: "NEW", eta: "28 min", amount: 550, address: "Salt Lake" },
  { id: "WT-10022", customer: "Priya Sen", item: products[1], status: "CONFIRMED", eta: "18 min", amount: 198, address: "Sector V" },
  { id: "WT-10023", customer: "Kolkata Foods Pvt Ltd", item: products[5], status: "PREPARING", eta: "42 min", amount: 2999, address: "Park Street" },
  { id: "WT-10024", customer: "Amit Das", item: products[2], status: "OUT_FOR_DELIVERY", eta: "12 min", amount: 338, address: "Park Circus" },
];

export default function AdminOrdersPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black uppercase tracking-widest text-red">Kitchen board</p>
            <h1 className="text-3xl font-black text-maroon">Orders</h1>
            <p className="mt-1 text-sm font-semibold text-muted">Accept, prepare, pack, assign rider, print KOT, and message customers.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin" className="inline-flex h-11 items-center rounded-lg border border-border px-4 font-black">Dashboard</Link>
            <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-maroon px-4 font-black text-white">
              <RefreshCw size={18} /> Refresh
            </button>
          </div>
        </div>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["NEW", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY"].map((status) => (
            <div key={status} className="surface rounded-2xl p-5">
              <p className="text-sm font-bold text-muted">{status.replaceAll("_", " ")}</p>
              <p className="mt-2 text-3xl font-black text-maroon">{orders.filter((order) => order.status === status).length}</p>
              <p className="mt-1 text-xs font-bold text-muted">Live queue</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-4">
          {orders.map((order) => (
            <article key={order.id} className="surface rounded-2xl p-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                <div className="grid gap-4 sm:grid-cols-[88px_1fr]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={order.item.image} alt="" className="h-[88px] w-[88px] rounded-2xl object-cover" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-black text-maroon">{order.id}</h2>
                      <span className="rounded-lg bg-cream px-3 py-1 text-xs font-black text-charcoal">{order.status.replaceAll("_", " ")}</span>
                    </div>
                    <p className="mt-1 font-black text-charcoal">{order.customer}</p>
                    <p className="mt-1 text-sm font-semibold text-muted">{order.item.name} · {formatRupees(order.amount)}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold text-muted">
                      <span className="inline-flex items-center gap-1"><Clock size={16} /> ETA {order.eta}</span>
                      <span className="inline-flex items-center gap-1"><MapPin size={16} /> {order.address}</span>
                      <span className="inline-flex items-center gap-1"><PackageCheck size={16} /> Paid COD pending</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black">
                    <Printer size={16} /> KOT
                  </button>
                  <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-black">
                    <MessageCircle size={16} /> Message
                  </button>
                  <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-red px-3 text-sm font-black text-white">
                    <Truck size={16} /> Assign rider
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {["CONFIRMED", "PREPARING", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"].map((next) => (
                  <button
                    key={next}
                    className={`rounded-lg px-3 py-2 text-xs font-black ${canTransitionOrder(order.status as never, next as never) ? "bg-maroon text-white" : "bg-cream text-muted"}`}
                  >
                    {next.replaceAll("_", " ")}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
