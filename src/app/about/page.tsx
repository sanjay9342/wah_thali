import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock, HeartHandshake, MapPin, Phone, ShieldCheck, Store, UtensilsCrossed } from "lucide-react";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { aboutWahThali, business } from "@/lib/business";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about Wah Thali, a Kolkata kitchen serving fresh homestyle thalis, biryani, combos, and everyday meals with care and hygiene.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  const highlights = [
    { title: "Kitchen", body: "Fresh, homestyle thalis prepared daily with dependable ingredients.", icon: UtensilsCrossed },
    { title: "Promise", body: "Care, hygiene, honest pricing, and warm hospitality in every order.", icon: ShieldCheck },
    { title: "Service", body: `${business.openingHours}, with support on ${business.phone}.`, icon: Clock },
  ];
  const values = [
    "Food that feels familiar, filling, and carefully prepared.",
    "Simple ordering for everyday meals, family dinners, and office lunches.",
    "Customer support that treats every concern with patience and clarity.",
  ];

  return (
    <>
      <Header />
      <main className="bg-[#fbfbfc] pb-28 lg:pb-12">
        <section className="bg-red px-4 py-8 text-white sm:px-6 sm:py-10 lg:px-8 lg:py-12">
          <div className="mx-auto max-w-[1120px]">
            <Link
              href="/"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white/12 px-4 text-sm font-black text-white ring-1 ring-white/22 transition-colors hover:bg-white/18"
            >
              <ArrowLeft size={18} strokeWidth={2.7} />
              <span>Back to Wah Thali</span>
            </Link>

            <div className="mt-8 max-w-4xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/75">About Wah Thali</p>
              <h1 className="mt-3 text-[36px] font-black leading-[1.05] text-white sm:text-5xl lg:text-[58px]">{business.brandName}</h1>
              <p className="mt-5 max-w-3xl text-base font-semibold leading-7 text-white/85 sm:text-lg">{aboutWahThali}</p>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-[1120px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
          <article className="space-y-6">
            <section className="rounded-lg border border-[#eee1e4] bg-white p-5 shadow-[0_10px_24px_rgba(34,31,32,0.04)] sm:p-6">
              <div className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#fff4f5] text-red">
                  <HeartHandshake size={23} strokeWidth={2.5} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-2xl font-black leading-tight text-charcoal">Built around everyday comfort food</h2>
                  <p className="mt-4 text-[15px] font-semibold leading-7 text-muted">
                    We serve freshly prepared thalis, combos, and meals from Kolkata with a focus on honest taste, clean preparation, and dependable service for daily ordering.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-3">
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-lg border border-[#eee1e4] bg-white p-5 shadow-[0_10px_24px_rgba(34,31,32,0.04)]">
                    <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#fff4f5] text-red">
                      <Icon size={22} strokeWidth={2.5} />
                    </span>
                    <h2 className="mt-4 text-lg font-black text-charcoal">{item.title}</h2>
                    <p className="mt-2 text-sm font-semibold leading-6 text-muted">{item.body}</p>
                  </div>
                );
              })}
            </section>

            <section className="rounded-lg border border-[#eee1e4] bg-white p-5 shadow-[0_10px_24px_rgba(34,31,32,0.04)] sm:p-6">
              <h2 className="text-2xl font-black text-charcoal">What guides us</h2>
              <div className="mt-4 grid gap-3">
                {values.map((value) => (
                  <div key={value} className="flex items-start gap-3 rounded-lg bg-[#fbfbfc] p-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-red" />
                    <p className="text-sm font-semibold leading-6 text-muted">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          </article>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-lg border border-[#eee1e4] bg-white p-5 shadow-[0_10px_24px_rgba(34,31,32,0.04)]">
              <h2 className="text-base font-black text-charcoal">Business details</h2>
              <div className="mt-4 grid gap-3 text-sm font-bold text-charcoal">
                <p className="flex items-start gap-3 leading-6">
                  <Store size={17} className="mt-1 shrink-0 text-red" />
                  <span>{business.legalName}</span>
                </p>
                <p className="flex items-start gap-3 leading-6">
                  <MapPin size={17} className="mt-1 shrink-0 text-red" />
                  <span>{business.address}</span>
                </p>
                <a href={`tel:${business.phone}`} className="flex items-center gap-3">
                  <Phone size={17} className="shrink-0 text-red" />
                  <span>{business.phone}</span>
                </a>
              </div>
            </section>

            <section className="rounded-lg border border-[#eee1e4] bg-[#fff4f5] p-5">
              <h2 className="text-base font-black text-red">Need help?</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">For order support, delivery questions, or feedback, our team is ready during store hours.</p>
              <Link href="/support" className="mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-red px-5 text-sm font-black text-white shadow-[0_8px_18px_rgba(141,0,33,0.16)]">
                Contact support
              </Link>
            </section>
          </aside>
        </div>
      </main>
      <SiteFooter />
      <MobileNav />
    </>
  );
}
