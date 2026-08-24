import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreditCard, MessageCircle, PackageCheck, Phone, RefreshCcw, UserRound } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { business } from "@/lib/business";
import { getSupportTopic, supportTopics } from "@/lib/support-content";

const topicIcons = {
  "order-issues": PackageCheck,
  "returns-refunds": RefreshCcw,
  payments: CreditCard,
  account: UserRound,
};

export function generateStaticParams() {
  return supportTopics.map((topic) => ({ topic: topic.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>;
}): Promise<Metadata> {
  const { topic: slug } = await params;
  const topic = getSupportTopic(slug);
  return {
    title: topic ? `${topic.title} Support` : "Support",
    alternates: { canonical: topic ? `/support/${topic.slug}` : "/support" },
  };
}

export default async function SupportTopicPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic: slug } = await params;
  const topic = getSupportTopic(slug);
  if (!topic) notFound();

  const Icon = topicIcons[topic.slug as keyof typeof topicIcons];
  const tone = getTopicTone(topic.slug);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f7f8fc] pb-20 text-[#061129] lg:pb-0">
        <section className="mx-auto max-w-[1240px] px-5 py-8 lg:px-6 lg:py-10 xl:px-0">
          <div className="text-center">
            <span className={`mx-auto grid h-[120px] w-[120px] place-items-center rounded-full ${tone.iconBg} ${tone.iconText}`}>
              <Icon size={52} strokeWidth={2.4} />
            </span>
            <h1 className="mx-auto mt-7 max-w-[760px] text-[24px] font-bold leading-tight text-[#061129] lg:text-[27px]">
              How can we help with {topic.title}?
            </h1>
            <p className="mx-auto mt-7 max-w-[680px] text-[21px] font-semibold leading-9 text-[#061129]">
              Browse the common issues below or contact support<br className="hidden sm:block" /> if you need direct assistance.
            </p>
          </div>

          <div className="mx-auto mt-11 overflow-hidden rounded-[16px] bg-white shadow-[0_14px_34px_rgba(34,31,32,0.045)] ring-1 ring-[#eef1f6]">
            {topic.questions.map((question) => (
              <article key={question.title} className="border-b border-[#d9e2f0] px-6 py-6 last:border-b-0 lg:px-8">
                <h2 className="text-[24px] font-black text-[#061129]">{question.title}</h2>
                <p className="mt-4 text-[21px] font-semibold leading-8 text-[#061129]">{question.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Link href="/support" className="inline-flex h-[72px] min-w-[218px] items-center justify-center rounded-full bg-maroon px-8 text-[25px] font-bold text-white shadow-[0_14px_28px_rgba(141,0,33,0.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-red">
              Back to Help
            </Link>
            <a href={`tel:${business.phone}`} className="inline-flex h-[58px] items-center gap-2 rounded-full bg-white px-6 text-[16px] font-black text-[#061129] shadow-[0_12px_28px_rgba(34,31,32,0.05)] ring-1 ring-[#eef1f6] transition hover:text-maroon">
              <Phone size={20} /> Call
            </a>
            <a href={`https://wa.me/91${business.phone}`} className="inline-flex h-[58px] items-center gap-2 rounded-full bg-white px-6 text-[16px] font-black text-[#061129] shadow-[0_12px_28px_rgba(34,31,32,0.05)] ring-1 ring-[#eef1f6] transition hover:text-maroon">
              <MessageCircle size={20} /> Chat
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
      <MobileNav />
    </>
  );
}

function getTopicTone(slug: string) {
  if (slug === "returns-refunds") return { iconBg: "bg-[#fff4f5]", iconText: "text-maroon" };
  if (slug === "account") return { iconBg: "bg-[#f8f1f3]", iconText: "text-charcoal" };
  if (slug === "payments") return { iconBg: "bg-[#fff4f5]", iconText: "text-maroon" };
  return { iconBg: "bg-[#fff4f5]", iconText: "text-maroon" };
}
