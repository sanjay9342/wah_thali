import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Clock, HeartHandshake, MapPin, MessageCircle, Phone, ShieldCheck, Sparkles, Store, UtensilsCrossed } from "lucide-react";
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
  const stats = [
    ["Fresh", "Prepared after order confirmation"],
    ["Kolkata", "Local kitchen, familiar flavours"],
    [business.openingHours, "Daily ordering window"],
  ];

  return (
    <>
      <Header />
      <main className="bg-white pb-20 lg:pb-12">
        <section className="px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[12px] font-black text-maroon shadow-[0_10px_24px_rgba(34,31,32,0.05)] ring-1 ring-[#f1e7e4] transition-colors hover:bg-[#fff8f9]"
            >
              <ArrowLeft size={16} strokeWidth={2.7} />
              <span>Back to Wah Thali</span>
            </Link>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-center">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-maroon">About Wah Thali</p>
                <h1 className="mt-2 text-[30px] font-black leading-[1.05] text-charcoal sm:text-[42px] lg:text-[54px]">
                  Homestyle meals, made with everyday care.
                </h1>
                <p className="mt-4 max-w-2xl text-[14px] font-bold leading-6 text-muted lg:text-[16px] lg:leading-7">{aboutWahThali}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {stats.map(([title, body]) => (
                    <div key={title} className="rounded-[16px] bg-white p-4 shadow-[0_10px_26px_rgba(34,31,32,0.04)] ring-1 ring-[#f1e7e4]">
                      <p className="text-[14px] font-black text-charcoal">{title}</p>
                      <p className="mt-1 text-[11px] font-bold leading-4 text-muted">{body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative min-h-[280px] overflow-hidden rounded-[24px] bg-[#fff4f5] shadow-[0_18px_48px_rgba(34,31,32,0.08)] ring-1 ring-[#f1e7e4] lg:min-h-[420px]">
                <Image src="/wah-thali-meal-cutout-v2.png" alt="Fresh Wah Thali thali meal" fill priority sizes="(max-width: 1023px) 100vw, 560px" className="object-contain object-center p-5 sm:p-7" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#061129]/42 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 rounded-[18px] bg-white/92 p-4 shadow-[0_12px_28px_rgba(34,31,32,0.08)] backdrop-blur">
                  <p className="flex items-center gap-2 text-[13px] font-black text-charcoal">
                    <Sparkles size={16} className="text-maroon" />
                    Fresh daily, packed carefully
                  </p>
                  <p className="mt-1 text-[12px] font-bold leading-5 text-muted">Thalis, combos, biryani, and office meals for everyday comfort.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-[1120px] gap-5 px-4 pb-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
          <article className="space-y-6">
            <section className="rounded-[22px] border border-[#eee1e4] bg-white p-5 shadow-[0_10px_24px_rgba(34,31,32,0.04)] sm:p-6">
              <div className="grid gap-4 sm:grid-cols-[52px_1fr]">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-[#fff4f5] text-maroon">
                  <HeartHandshake size={23} strokeWidth={2.5} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[20px] font-black leading-tight text-charcoal lg:text-[24px]">Built around everyday comfort food</h2>
                  <p className="mt-3 text-[14px] font-bold leading-6 text-muted lg:text-[15px] lg:leading-7">
                    We serve freshly prepared thalis, combos, and meals from Kolkata with a focus on honest taste, clean preparation, and dependable service for daily ordering.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-3">
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-[18px] border border-[#eee1e4] bg-white p-5 shadow-[0_10px_24px_rgba(34,31,32,0.04)]">
                    <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#fff4f5] text-maroon">
                      <Icon size={22} strokeWidth={2.5} />
                    </span>
                    <h2 className="mt-4 text-[15px] font-black text-charcoal">{item.title}</h2>
                    <p className="mt-2 text-[13px] font-bold leading-5 text-muted">{item.body}</p>
                  </div>
                );
              })}
            </section>

            <section className="rounded-[22px] border border-[#eee1e4] bg-white p-5 shadow-[0_10px_24px_rgba(34,31,32,0.04)] sm:p-6">
              <h2 className="text-[20px] font-black text-charcoal lg:text-[24px]">What guides us</h2>
              <div className="mt-4 grid gap-3">
                {values.map((value) => (
                  <div key={value} className="flex items-start gap-3 rounded-[14px] bg-[#fbfbfc] p-3">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-maroon" />
                    <p className="text-[13px] font-bold leading-5 text-muted lg:text-[14px] lg:leading-6">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="relative min-h-[210px] overflow-hidden rounded-[22px] bg-[#eef3ef] shadow-[0_14px_34px_rgba(34,31,32,0.08)] ring-1 ring-[#eef1f6] lg:min-h-[260px]">
              <Image src="/wah-thali-support-agent.png" alt="Wah Thali customer support" fill sizes="(max-width: 1023px) 100vw, 760px" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#061129]/68 via-[#061129]/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 max-w-[380px] text-white">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/80">Support that listens</p>
                <h2 className="mt-2 text-[22px] font-black leading-tight lg:text-[28px]">Questions, refunds, or delivery help.</h2>
                <p className="mt-2 text-[13px] font-bold leading-5 text-white/86 lg:text-[14px] lg:leading-6">Our team is ready during store hours for order updates and customer care.</p>
              </div>
            </section>
          </article>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-[22px] border border-[#eee1e4] bg-white p-5 shadow-[0_10px_24px_rgba(34,31,32,0.04)]">
              <h2 className="text-[16px] font-black text-charcoal">Business details</h2>
              <div className="mt-4 grid gap-3 text-[13px] font-bold text-charcoal">
                <p className="flex items-start gap-3 leading-6">
                  <Store size={17} className="mt-1 shrink-0 text-maroon" />
                  <span>{business.legalName}</span>
                </p>
                <p className="flex items-start gap-3 leading-6">
                  <MapPin size={17} className="mt-1 shrink-0 text-maroon" />
                  <span>{business.address}</span>
                </p>
                <a href={`tel:${business.phone}`} className="flex items-center gap-3">
                  <Phone size={17} className="shrink-0 text-maroon" />
                  <span>{business.phone}</span>
                </a>
              </div>
            </section>

            <section className="rounded-[22px] border border-[#eee1e4] bg-white p-5 shadow-[0_10px_24px_rgba(34,31,32,0.04)]">
              <h2 className="text-[16px] font-black text-charcoal">Need help?</h2>
              <p className="mt-2 text-[13px] font-bold leading-5 text-muted">For order support, delivery questions, or feedback, our team is ready during store hours.</p>
              <Link href="/support" className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-maroon px-5 text-[13px] font-black text-white shadow-[0_8px_18px_rgba(141,0,33,0.16)]">
                <MessageCircle size={16} /> Contact support
              </Link>
            </section>
          </aside>
        </div>
      </main>
      <SiteFooter showLogo={false} />
      <MobileNav />
    </>
  );
}
