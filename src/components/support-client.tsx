"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronRight, CreditCard, MapPin, MessageCircle, PackageCheck, Phone, RefreshCcw, Search, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { business } from "@/lib/business";
import { supportTopics } from "@/lib/support-content";

const topicIcons = {
  "order-issues": PackageCheck,
  "returns-refunds": RefreshCcw,
  payments: CreditCard,
  "delivery-pickup": MapPin,
  account: UserRound,
};

export function SupportClient() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const commonQuestions = useMemo(
    () => supportTopics.flatMap((topic) => topic.questions.slice(0, 1).map((question) => ({ ...question, topicSlug: topic.slug }))),
    [],
  );

  const searchResults = useMemo(() => {
    if (!normalizedQuery) return [];

    const topicMatches = supportTopics
      .filter((topic) => `${topic.title} ${topic.body}`.toLowerCase().includes(normalizedQuery))
      .map((topic) => ({
        href: `/support/${topic.slug}`,
        title: topic.title,
        body: topic.body,
        label: "Topic",
      }));

    const questionMatches = supportTopics.flatMap((topic) =>
      topic.questions
        .filter((question) => `${question.title} ${question.body} ${topic.title}`.toLowerCase().includes(normalizedQuery))
        .map((question) => ({
          href: `/support/${topic.slug}`,
          title: question.title,
          body: question.body,
          label: topic.title,
        })),
    );

    return [...topicMatches, ...questionMatches].slice(0, 6);
  }, [normalizedQuery]);

  function submitSearch() {
    if (searchResults[0]) {
      router.push(searchResults[0].href);
      return;
    }

    if (normalizedQuery.includes("order")) router.push("/orders");
  }

  return (
    <main className="min-h-screen bg-white pb-16 text-[#061129] lg:pb-0">
      <section className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-6 lg:py-10 xl:px-0">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-white text-maroon shadow-sm ring-1 ring-[#eadfe3] transition-colors hover:bg-[#fff8f9] lg:mb-5"
          aria-label="Go back"
        >
          <ArrowLeft size={21} strokeWidth={2.7} />
        </button>

        <div className="mx-auto max-w-[720px] text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-maroon">Help Center</p>
          <h1 className="mt-2 text-[22px] font-black leading-tight text-[#061129] lg:text-[32px]">How can we help?</h1>
          <p className="mx-auto mt-2 max-w-[480px] text-[13px] font-bold leading-5 text-[#5f6875] lg:text-[14px] lg:leading-6">
            Search FAQs, orders, refunds, payments, or delivery support.
          </p>

          <form
            className="relative mx-auto mt-5 max-w-[720px]"
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch();
            }}
          >
            <label className="grid h-12 grid-cols-[42px_1fr_40px] items-center rounded-full bg-[#fff8f9] px-2 shadow-[0_10px_26px_rgba(34,31,32,0.05)] ring-1 ring-[#eadfe3] lg:h-13">
              <Search className="mx-auto text-[#061129]" size={20} strokeWidth={2.5} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 bg-transparent text-left text-[13px] font-bold text-[#061129] outline-none placeholder:text-[#8b94a3] lg:text-[14px]"
                placeholder="Search FAQs, orders, or topics"
                aria-label="Search support"
              />
              <button type="submit" className="grid h-9 w-9 place-items-center rounded-full text-maroon transition-colors hover:bg-white" aria-label="Search support">
                <ArrowRight size={20} strokeWidth={2.7} />
              </button>
            </label>

            {normalizedQuery ? (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-[18px] bg-white text-left shadow-[0_18px_42px_rgba(34,31,32,0.12)] ring-1 ring-[#eef1f6]">
                {searchResults.length ? (
                  searchResults.map((result) => (
                    <Link key={`${result.href}-${result.title}`} href={result.href} className="grid grid-cols-[1fr_auto] gap-3 border-b border-[#eef1f6] px-4 py-3 last:border-b-0 hover:bg-[#fff8f9]">
                      <span className="min-w-0">
                        <span className="block text-[12px] font-black text-maroon">{result.label}</span>
                        <span className="mt-0.5 block truncate text-[13px] font-black text-[#061129]">{result.title}</span>
                        <span className="mt-0.5 block line-clamp-1 text-[12px] font-bold text-[#5f6875]">{result.body}</span>
                      </span>
                      <ChevronRight className="mt-4 text-[#8b94a3]" size={18} />
                    </Link>
                  ))
                ) : (
                  <div className="px-4 py-4">
                    <p className="text-[13px] font-black text-[#061129]">No exact match found</p>
                    <p className="mt-1 text-[12px] font-bold leading-5 text-[#5f6875]">Try refund, order, payment, address, or account.</p>
                  </div>
                )}
              </div>
            ) : null}
          </form>
        </div>

        <section className="mt-8">
          <h2 className="text-[18px] font-black text-[#061129] lg:text-[22px]">Quick Topics</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {supportTopics.map((topic) => {
              const Icon = topicIcons[topic.slug as keyof typeof topicIcons];
              return (
                <Link
                  key={topic.slug}
                  href={`/support/${topic.slug}`}
                  className="group grid min-h-[106px] place-items-center rounded-[16px] bg-white p-4 text-center shadow-[0_10px_26px_rgba(34,31,32,0.045)] ring-1 ring-[#f3f5f8] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(34,31,32,0.09)] hover:ring-maroon/20"
                >
                  <span>
                    <span className="mx-auto grid h-13 w-13 place-items-center rounded-full bg-[#fff4f5] text-maroon transition duration-200 group-hover:bg-maroon group-hover:text-white">
                      <Icon size={24} strokeWidth={2.4} />
                    </span>
                    <span className="mt-3 block text-[13px] font-black text-[#061129] lg:text-[14px]">
                      {topic.slug === "returns-refunds" ? "Returns" : topic.title}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[18px] font-black text-[#061129] lg:text-[22px]">Common Questions</h2>
            <Link href="/support/order-issues" className="text-[12px] font-black text-maroon transition-colors hover:text-red lg:text-[13px]">View all</Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-[16px] bg-white shadow-[0_10px_26px_rgba(34,31,32,0.045)] ring-1 ring-[#f3f5f8]">
            {commonQuestions.map((question) => (
              <Link
                key={`${question.topicSlug}-${question.title}`}
                href={`/support/${question.topicSlug}`}
                className="group grid min-h-[64px] grid-cols-[1fr_auto] items-center gap-3 border-b border-[#eef1f6] px-4 py-3 last:border-b-0 transition-colors hover:bg-[#fff8f9] lg:px-5"
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-black text-[#061129] lg:text-[14px]">{question.title}</span>
                  <span className="mt-1 line-clamp-1 block text-[12px] font-bold text-[#5f6875] lg:text-[13px]">{question.body}</span>
                </span>
                <ChevronRight className="text-[#8b94a3] transition-colors group-hover:text-maroon" size={19} />
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[18px] font-black text-[#061129] lg:text-[22px]">Still need help?</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <a href={`https://wa.me/91${business.phone}`} className="group grid min-h-[76px] grid-cols-[48px_1fr_auto] items-center gap-3 rounded-[16px] bg-white px-4 shadow-[0_10px_26px_rgba(34,31,32,0.045)] ring-1 ring-[#f3f5f8] transition duration-200 hover:-translate-y-0.5 hover:ring-maroon/20">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#fff4f5] text-maroon transition-colors group-hover:bg-maroon group-hover:text-white">
                <MessageCircle size={21} strokeWidth={2.4} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-black text-[#061129]">Chat with Us</span>
                <span className="mt-0.5 block text-[12px] font-bold leading-4 text-[#5f6875]">Instant answers during store hours</span>
              </span>
              <ChevronRight className="text-[#061129] transition-colors group-hover:text-maroon" size={22} strokeWidth={2.6} />
            </a>

            <a href={`tel:${business.phone}`} className="group grid min-h-[76px] grid-cols-[48px_1fr_auto] items-center gap-3 rounded-[16px] bg-white px-4 shadow-[0_10px_26px_rgba(34,31,32,0.045)] ring-1 ring-[#f3f5f8] transition duration-200 hover:-translate-y-0.5 hover:ring-maroon/20">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#fff4f5] text-maroon transition-colors group-hover:bg-maroon group-hover:text-white">
                <Phone size={21} strokeWidth={2.4} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-black text-[#061129]">Call Support</span>
                <span className="mt-0.5 block text-[12px] font-bold leading-4 text-[#5f6875]">Avg. wait time: 2 mins</span>
              </span>
              <ChevronRight className="text-[#061129] transition-colors group-hover:text-maroon" size={22} strokeWidth={2.6} />
            </a>
          </div>

          <div className="relative mt-5 min-h-[174px] overflow-hidden rounded-[16px] bg-[#eef3ef] shadow-[0_14px_34px_rgba(34,31,32,0.08)] lg:min-h-[250px]">
            <Image src="/wah-thali-support-agent.png" alt="Customer support representative" fill sizes="(max-width: 1023px) 100vw, 1180px" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#061129]/62 via-[#061129]/18 to-transparent" />
            <h3 className="absolute bottom-5 left-5 max-w-[300px] text-[20px] font-black leading-tight text-white lg:bottom-8 lg:left-8 lg:text-[28px]">
              Your freshness,<br />our responsibility.
            </h3>
          </div>
        </section>
      </section>
    </main>
  );
}
