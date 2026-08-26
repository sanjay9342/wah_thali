import Link from "next/link";
import { ArrowLeft, Home, Search } from "lucide-react";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-[calc(100vh-74px)] w-full max-w-5xl items-center px-5 pb-28 pt-10 sm:px-6 lg:px-8 lg:pb-16">
        <section className="w-full overflow-hidden rounded-[24px] border border-[#eadfd5] bg-white p-6 text-center shadow-[0_18px_48px_rgba(34,31,32,0.07)] sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-maroon/70">404</p>
          <h1 className="mx-auto mt-3 max-w-2xl text-3xl font-black leading-tight text-charcoal sm:text-5xl">
            We could not find that page.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-6 text-muted sm:text-base">
            The link may be old, or the page may have moved. You can go back home or continue browsing the menu.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-maroon px-5 text-sm font-black text-white shadow-[0_12px_26px_rgba(141,0,33,0.16)]"
            >
              <Home size={18} strokeWidth={2.6} />
              Home
            </Link>
            <Link
              href="/menu"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#fff4f5] px-5 text-sm font-black text-maroon ring-1 ring-[#f1dce1]"
            >
              <Search size={18} strokeWidth={2.6} />
              Menu
            </Link>
            <Link
              href="/support"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-charcoal ring-1 ring-[#eadfd5]"
            >
              <ArrowLeft size={18} strokeWidth={2.6} />
              Help
            </Link>
          </div>
        </section>
      </main>
      <MobileNav />
    </>
  );
}
