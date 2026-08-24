import type { Metadata } from "next";
import { ArrowRight, ChevronRight, CreditCard, MessageCircle, PackageCheck, Phone, RefreshCcw, Search, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { business } from "@/lib/business";
import { supportTopics } from "@/lib/support-content";

export const metadata: Metadata = {
  title: "Support",
  description: "Contact Wah Thali support for order help, refunds, cancellations, delivery issues, complaints, and WhatsApp assistance.",
  alternates: { canonical: "/support" },
};

const topicIcons = {
  "order-issues": PackageCheck,
  "returns-refunds": RefreshCcw,
  payments: CreditCard,
  account: UserRound,
};

export default function SupportPage() {
  const commonQuestions = supportTopics.flatMap((topic) =>
    topic.questions.slice(0, 1).map((question) => ({ ...question, topicSlug: topic.slug }))
  );

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white pb-20 text-[#061129] lg:pb-0">
        <section className="mx-auto max-w-[1180px] px-5 py-7 lg:px-6 lg:py-10 xl:px-0">
          <div className="mx-auto max-w-[860px] text-center">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-maroon">Help Center</p>
            <h1 className="mt-2 text-[28px] font-black leading-tight text-[#061129] lg:text-[38px]">How can we help?</h1>
            <p className="mx-auto mt-2 max-w-[560px] text-[15px] font-bold leading-6 text-[#5f6875]">
              Search FAQs, orders, refunds, payments, or delivery support.
            </p>
            <div className="mx-auto mt-6 grid h-14 max-w-[820px] grid-cols-[48px_1fr_auto] items-center rounded-full bg-[#fff4f5] px-2 shadow-[0_10px_26px_rgba(34,31,32,0.05)] ring-1 ring-[#eadfe3]">
              <Search className="mx-auto text-[#061129]" size={22} strokeWidth={2.5} />
              <span className="truncate text-left text-[15px] font-bold text-[#8b94a3]">Search FAQs, orders, or topics</span>
              <Link href="/orders" className="grid h-10 w-10 place-items-center rounded-full text-maroon transition-colors hover:bg-white" aria-label="Open orders">
                <ArrowRight size={21} strokeWidth={2.7} />
              </Link>
            </div>
          </div>

          <section className="mt-9">
            <h2 className="text-[24px] font-black text-[#061129]">Quick Topics</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
            {supportTopics.map((topic) => {
              const Icon = topicIcons[topic.slug as keyof typeof topicIcons];
              return (
                <Link
                  key={topic.slug}
                  href={`/support/${topic.slug}`}
                  className="group grid min-h-[132px] place-items-center rounded-[18px] bg-white p-6 text-center shadow-[0_14px_34px_rgba(34,31,32,0.055)] ring-1 ring-[#f3f5f8] transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_46px_rgba(34,31,32,0.1)] hover:ring-maroon/20"
                >
                  <span>
                    <span className="mx-auto grid h-[72px] w-[72px] place-items-center rounded-full bg-[#fff4f5] text-maroon transition duration-200 group-hover:bg-maroon group-hover:text-white">
                      <Icon size={31} strokeWidth={2.4} />
                    </span>
                    <span className="mt-4 block text-[18px] font-black text-[#061129]">
                      {topic.slug === "returns-refunds" ? "Returns" : topic.title}
                    </span>
                  </span>
                </Link>
              );
            })}
            </div>
          </section>

          <section className="mt-9">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-[24px] font-black text-[#061129]">Common Questions</h2>
              <Link href="/support/order-issues" className="text-[15px] font-black text-maroon transition-colors hover:text-red">View all</Link>
            </div>
            <div className="mt-5 overflow-hidden rounded-[16px] bg-white shadow-[0_14px_34px_rgba(34,31,32,0.045)] ring-1 ring-[#f3f5f8]">
              {commonQuestions.map((question) => (
                <Link
                  key={`${question.topicSlug}-${question.title}`}
                  href={`/support/${question.topicSlug}`}
                  className="group grid min-h-[70px] grid-cols-[1fr_auto] items-center gap-4 border-b border-[#eef1f6] px-5 py-4 last:border-b-0 transition-colors hover:bg-[#fff4f5]"
                >
                  <span>
                    <span className="block text-[16px] font-black text-[#061129]">{question.title}</span>
                    <span className="mt-1 line-clamp-1 block text-[14px] font-bold text-[#5f6875]">{question.body}</span>
                  </span>
                  <ChevronRight className="text-[#8b94a3] transition-colors group-hover:text-maroon" size={22} />
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-9">
            <h2 className="text-[24px] font-black text-[#061129]">Still need help?</h2>
            <div className="mt-5 overflow-hidden rounded-[18px] bg-maroon p-6 text-white shadow-[0_16px_34px_rgba(141,0,33,0.18)]">
              <div className="grid gap-5 lg:grid-cols-[1fr_180px] lg:items-center">
                <div>
                  <h3 className="text-[24px] font-black">Chat with Us</h3>
                  <p className="mt-2 text-[17px] font-bold leading-6 text-white/82">Get instant answers from our support experts. We are online during store hours.</p>
                  <a href={`https://wa.me/91${business.phone}`} className="mt-5 inline-flex h-12 items-center justify-center rounded-full bg-white px-8 text-[16px] font-black text-maroon shadow-[0_10px_24px_rgba(34,31,32,0.08)] transition-colors hover:bg-[#fff4f5]">
                    Start Chat
                  </a>
                </div>
                <MessageCircle className="hidden h-28 w-28 justify-self-end text-white/20 lg:block" strokeWidth={1.8} />
              </div>
            </div>

            <a href={`tel:${business.phone}`} className="group mt-5 grid min-h-[92px] grid-cols-[58px_1fr_auto] items-center gap-4 rounded-[16px] bg-white px-5 shadow-[0_14px_34px_rgba(34,31,32,0.045)] ring-1 ring-[#f3f5f8] transition duration-200 hover:-translate-y-0.5 hover:ring-maroon/20">
              <span className="grid h-[58px] w-[58px] place-items-center rounded-full bg-[#fff4f5] text-maroon transition-colors group-hover:bg-maroon group-hover:text-white">
                <Phone size={25} strokeWidth={2.4} />
              </span>
              <span>
                <span className="block text-[18px] font-black text-[#061129]">Call Support</span>
                <span className="block text-[15px] font-black text-[#061129]">Avg. wait time: 2 mins</span>
              </span>
              <ChevronRight className="text-[#061129] transition-colors group-hover:text-maroon" size={29} strokeWidth={2.6} />
            </a>

            <div className="relative mt-7 min-h-[210px] overflow-hidden rounded-[18px] bg-maroon shadow-[0_16px_34px_rgba(34,31,32,0.1)]">
              <Image src="/wah-thali-footer-bg.png" alt="" fill sizes="(max-width: 1023px) 100vw, 1180px" className="object-cover opacity-45" />
              <div className="absolute inset-0 bg-gradient-to-r from-maroon/90 via-maroon/45 to-transparent" />
              <h3 className="absolute bottom-7 left-6 max-w-[340px] text-[26px] font-black leading-tight text-white">
                Your freshness,<br />our responsibility.
              </h3>
            </div>
          </section>
        </section>
      </main>
      <SiteFooter />
      <MobileNav />
    </>
  );
}
