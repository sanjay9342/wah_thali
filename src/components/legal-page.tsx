import Link from "next/link";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { business, type Policy } from "@/lib/business";

export function LegalPage({ policy }: { policy: Policy }) {
  return (
    <>
      <Header />
      <main className="bg-cream px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-4xl rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-border sm:p-8">
          <Link href="/" className="text-sm font-black text-red">
            Back to Wah Thali
          </Link>
          <p className="mt-6 text-xs font-black uppercase tracking-widest text-red">{business.legalName}</p>
          <h1 className="mt-2 text-3xl font-black text-maroon sm:text-4xl">{policy.title}</h1>
          <p className="mt-2 text-sm font-bold text-muted">Effective Date: {policy.effectiveDate}</p>
          <p className="mt-5 rounded-2xl bg-cream p-4 text-sm font-semibold leading-6 text-charcoal">{policy.summary}</p>

          <div className="mt-6 space-y-6">
            {policy.sections.map((section, index) => (
              <section key={section.heading}>
                <h2 className="text-xl font-black text-maroon">
                  {index + 1}. {section.heading}
                </h2>
                <div className="mt-3 space-y-3 text-sm leading-7 text-muted">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <section className="mt-8 rounded-2xl bg-cream p-4">
            <h2 className="font-black text-maroon">Contact Us</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{business.legalName}</p>
            <p className="text-sm leading-6 text-muted">Email: {business.legalEmail}</p>
            <p className="text-sm leading-6 text-muted">Customer support: {business.phone}</p>
            <p className="text-sm leading-6 text-muted">Address: {business.address}</p>
          </section>
        </article>
      </main>
      <SiteFooter />
      <MobileNav />
    </>
  );
}
