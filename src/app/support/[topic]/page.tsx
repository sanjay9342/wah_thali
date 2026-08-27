import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreditCard, MapPin, MessageCircle, PackageCheck, Phone, RefreshCcw, UserRound } from "lucide-react";
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
  "delivery-pickup": MapPin,
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
      <main className="min-h-screen bg-white pb-16 text-[#061129] lg:pb-0">
        <section className="mx-auto max-w-[980px] px-4 py-6 sm:px-6 lg:px-6 lg:py-10 xl:px-0">
          <div className="text-center">
            <span className={`mx-auto grid h-16 w-16 place-items-center rounded-full lg:h-20 lg:w-20 ${tone.iconBg} ${tone.iconText}`}>
              <Icon className="h-8 w-8 lg:h-10 lg:w-10" strokeWidth={2.4} />
            </span>
            <h1 className="mx-auto mt-4 max-w-[640px] text-[20px] font-black leading-tight text-[#061129] lg:text-[26px]">
              How can we help with {topic.title}?
            </h1>
            <p className="mx-auto mt-2 max-w-[560px] text-[13px] font-bold leading-5 text-[#5f6875] lg:text-[15px] lg:leading-6">
              Browse the common issues below or contact support<br className="hidden sm:block" /> if you need direct assistance.
            </p>
          </div>

          <div className="mx-auto mt-6 overflow-hidden rounded-[16px] bg-white shadow-[0_10px_26px_rgba(34,31,32,0.045)] ring-1 ring-[#eef1f6] lg:mt-8">
            {topic.questions.map((question) => (
              <article key={question.title} className="border-b border-[#e9eef5] px-5 py-5 last:border-b-0 lg:px-7">
                <h2 className="text-[17px] font-black leading-snug text-[#061129] lg:text-[20px]">{question.title}</h2>
                <p className="mt-3 text-[14px] font-bold leading-6 text-[#061129] lg:text-[16px] lg:leading-7">{question.body}</p>
              </article>
            ))}
          </div>

          <div className="mx-auto mt-7 grid max-w-[360px] grid-cols-[1fr_auto_auto] items-center justify-center gap-2 lg:mt-8 lg:max-w-[460px] lg:gap-3">
            <Link href="/support" className="inline-flex h-12 min-w-0 items-center justify-center rounded-full bg-maroon px-5 text-[15px] font-black text-white shadow-[0_12px_24px_rgba(141,0,33,0.16)] transition duration-200 hover:-translate-y-0.5 hover:bg-red lg:h-13 lg:px-7 lg:text-[16px]">
              Back to Help
            </Link>
            <a href={`tel:${business.phone}`} className="inline-flex h-12 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-black text-[#061129] shadow-[0_10px_22px_rgba(34,31,32,0.05)] ring-1 ring-[#eef1f6] transition hover:text-maroon lg:h-13 lg:px-5 lg:text-[14px]">
              <Phone size={17} /> Call
            </a>
            <a href={`https://wa.me/91${business.phone}`} className="inline-flex h-12 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-black text-[#061129] shadow-[0_10px_22px_rgba(34,31,32,0.05)] ring-1 ring-[#eef1f6] transition hover:text-maroon lg:h-13 lg:px-5 lg:text-[14px]">
              <MessageCircle size={17} /> Chat
            </a>
          </div>
        </section>
      </main>
      <SiteFooter showLogo={false} />
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
