import Link from "next/link";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { aboutWahThali, business } from "@/lib/business";

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="bg-white px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-[0_12px_34px_rgba(34,31,32,0.06)] ring-1 ring-border">
          <section className="bg-red p-6 text-white sm:p-8 lg:p-10">
            <Link href="/" className="text-sm font-black text-white">
              Back to Wah Thali
            </Link>
            <p className="mt-6 text-xs font-black uppercase tracking-widest text-white/75">About Wah Thali</p>
            <h1 className="mt-2 text-4xl font-black leading-tight text-white sm:text-5xl">{business.legalName}</h1>
            <p className="mt-5 text-base font-semibold leading-8 text-white/82">{aboutWahThali}</p>
          </section>

          <section className="grid gap-4 p-5 sm:grid-cols-3 sm:p-8">
            {[
              ["Kitchen", "Fresh, homestyle thalis prepared daily."],
              ["Promise", "Care, hygiene, honest pricing, and warm hospitality."],
              ["Service", `${business.openingHours}, with support on ${business.phone}.`],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl bg-[#fff4f5] p-4">
                <h2 className="font-black text-red">{title}</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted">{body}</p>
              </div>
            ))}
          </section>
        </article>
      </main>
      <SiteFooter />
      <MobileNav />
    </>
  );
}
