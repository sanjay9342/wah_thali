import Link from "next/link";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { business, type Policy } from "@/lib/business";

export function LegalPage({ policy }: { policy: Policy }) {
  return (
    <>
      <Header />
      <main className="bg-white px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-[0_12px_34px_rgba(34,31,32,0.06)] ring-1 ring-border">
          <section className="bg-red p-6 text-white sm:p-8 lg:p-10">
            <Link href="/" className="text-sm font-black text-white">
              Back to Wah Thali
            </Link>
            <p className="mt-6 text-xs font-black uppercase tracking-widest text-white/75">{business.legalName}</p>
            <h1 className="mt-2 text-4xl font-black leading-tight text-white sm:text-5xl">{policy.title}</h1>
            <p className="mt-2 text-sm font-bold text-white/75">Effective Date: {policy.effectiveDate}</p>
            <p className="mt-5 max-w-3xl text-base font-semibold leading-7 text-white/82">{policy.summary}</p>
          </section>

          <div className="space-y-6 p-5 sm:p-8">
            {policy.sections.map((section, index) => (
              <section key={section.heading}>
                <h2 className="text-xl font-black text-red">
                  {index + 1}. {section.heading}
                </h2>
                <div className="mt-3 space-y-3 text-sm font-semibold leading-7 text-muted">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}

            <section className="rounded-2xl bg-[#fff4f5] p-4">
              <h2 className="font-black text-red">Contact Us</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{business.legalName}</p>
              <p className="text-sm leading-6 text-muted">Email: {business.legalEmail}</p>
              <p className="text-sm leading-6 text-muted">Customer support: {business.phone}</p>
              <p className="text-sm leading-6 text-muted">Address: {business.address}</p>
            </section>
          </div>
        </article>
      </main>
      <SiteFooter />
      <MobileNav />
    </>
  );
}
