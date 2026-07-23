import { ArrowLeft, Bike, CheckCircle2, Clock, CookingPot, MapPin, MessageCircle, Navigation, PackageCheck, Phone } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { products, settings } from "@/lib/data";
import { formatRupees } from "@/lib/pricing";

const timeline = [
  ["Placed", "5:12 PM", CheckCircle2, true],
  ["Confirmed", "5:14 PM", CheckCircle2, true],
  ["Preparing", "Now", CookingPot, true],
  ["Packed", "Expected 5:42 PM", PackageCheck, false],
  ["Out for delivery", "Expected 5:48 PM", Bike, false],
  ["Delivered", "Expected 6:10 PM", Clock, false],
] as const;

export default function TrackPage() {
  return (
    <>
      <Header />
      <main className="w-full max-w-[390px] px-3 pb-32 pt-5 sm:mx-auto sm:max-w-4xl sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/orders" className="grid h-10 w-10 place-items-center rounded-full bg-white text-charcoal shadow-sm ring-1 ring-border" aria-label="Back to orders">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-black text-charcoal">Track order</h1>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-red/10 text-red">
            <Navigation size={20} />
          </span>
        </div>

        <section className="mt-5 overflow-hidden rounded-[28px] bg-white shadow-[0_14px_34px_rgba(34,31,32,0.08)] ring-1 ring-border">
          <div className="relative min-h-44 overflow-hidden bg-gradient-to-br from-maroon to-red p-5 text-white">
            <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/12" />
            <div className="absolute bottom-4 right-4 grid h-16 w-16 place-items-center rounded-full bg-white/15">
              <Bike size={34} />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-white/70">WT-10021</p>
            <h2 className="mt-2 text-3xl font-black">Arrives in 32 min</h2>
            <p className="mt-2 max-w-56 text-sm font-bold text-white/80">Your thali is being prepared fresh in the kitchen.</p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/20">
              <div className="h-full w-[48%] rounded-full bg-white" />
            </div>
          </div>

          <div className="p-5">
            <div className="rounded-2xl bg-cream p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-red">
                  <MapPin size={20} />
                </span>
                <div>
                  <p className="font-black text-charcoal">Delivering to</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-muted">221B Baker Street, Salt Lake, Kolkata</p>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
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
          </div>
        </section>

        <section className="mt-5 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-border">
          <h2 className="text-lg font-black text-charcoal">Order summary</h2>
          <div className="mt-3 grid gap-2">
            {[
              [products[0].name, 1, 229],
              [products[2].name, 1, 249],
            ].map(([name, qty, price]) => (
              <div key={String(name)} className="flex items-center justify-between rounded-xl bg-cream px-3 py-2 text-sm">
                <span className="font-bold text-charcoal">{qty} x {String(name)}</span>
                <span className="font-black text-maroon">{formatRupees(Number(price))}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <a href={`tel:${settings.supportPhone}`} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border font-black text-maroon">
              <Phone size={17} /> Call
            </a>
            <a href={`https://wa.me/${settings.whatsappNumber}`} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red font-black text-white">
              <MessageCircle size={17} /> Chat
            </a>
          </div>
        </section>
      </main>
      <MobileNav />
    </>
  );
}
