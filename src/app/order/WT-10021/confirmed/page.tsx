import { CheckCircle2, MessageCircle, ReceiptText, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { settings } from "@/lib/data";

export default function ConfirmedPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <section className="surface rounded-2xl p-6 text-center">
          <CheckCircle2 className="mx-auto text-maroon" size={56} />
          <h1 className="mt-4 text-3xl font-black text-maroon">Order confirmed</h1>
          <p className="mt-2 text-muted">Order WT-10021 is accepted for Cash on Delivery.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-cream p-4">
              <p className="text-sm text-muted">ETA</p>
              <p className="text-xl font-black">32 min</p>
            </div>
            <div className="rounded-xl bg-cream p-4">
              <p className="text-sm text-muted">Payment</p>
              <p className="text-xl font-black">COD pending</p>
            </div>
            <div className="rounded-xl bg-cream p-4">
              <p className="text-sm text-muted">Reward</p>
              <p className="text-xl font-black">+24 points</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/order/WT-10021/track" className="inline-flex h-12 items-center gap-2 rounded-lg bg-red px-5 font-black text-white">
              <ReceiptText size={18} /> Track order
            </Link>
            <Link href="/menu" className="inline-flex h-12 items-center gap-2 rounded-lg border border-border bg-white px-5 font-black">
              <RotateCcw size={18} /> Order again
            </Link>
            <a
              href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent("I need help with order WT-10021")}`}
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-maroon px-5 font-black text-white"
            >
              <MessageCircle size={18} /> WhatsApp support
            </a>
          </div>
        </section>
      </main>
      <MobileNav />
    </>
  );
}
