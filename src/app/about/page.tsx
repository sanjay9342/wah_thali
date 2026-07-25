import Link from "next/link";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { aboutWahThali, business } from "@/lib/business";

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="bg-cream px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-border">
          <section className="bg-[#fff1df] p-5 sm:p-8">
            <Link href="/" className="text-sm font-black text-red">
              Back to Wah Thali
            </Link>
            <p className="mt-6 text-xs font-black uppercase tracking-widest text-red">About Wah Thali</p>
            <h1 className="mt-2 text-3xl font-black text-maroon sm:text-4xl">{business.legalName}</h1>
            <p className="mt-5 text-base font-semibold leading-8 text-charcoal/75">{aboutWahThali}</p>
          </section>

          <section className="grid gap-4 p-5 sm:grid-cols-3 sm:p-8">
            {[
              ["Kitchen", "Fresh, homestyle thalis prepared daily."],
              ["Promise", "Care, hygiene, honest pricing, and warm hospitality."],
              ["Service", `${business.openingHours}, with support on ${business.phone}.`],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl bg-cream p-4">
                <h2 className="font-black text-maroon">{title}</h2>
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
