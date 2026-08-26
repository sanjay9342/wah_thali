import Link from "next/link";
import { ArrowLeft, CalendarDays, FileText } from "lucide-react";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { business, type Policy } from "@/lib/business";

function sectionId(heading: string) {
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function LegalPage({ policy }: { policy: Policy }) {
  return (
    <>
      <Header />
      <main className="bg-white pb-28 lg:pb-12">
        <section className="border-b border-[#eadfd5] bg-white px-4 py-8 text-charcoal sm:px-6 sm:py-10 lg:px-8 lg:py-12">
          <div className="mx-auto max-w-[1120px]">
            <Link
              href="/"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-maroon shadow-sm ring-1 ring-[#eadfd5] transition-colors hover:bg-[#f7f8fb]"
            >
              <ArrowLeft size={18} strokeWidth={2.7} />
              <span>Back to Wah Thali</span>
            </Link>

            <div className="mt-8 max-w-4xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-maroon/70">{business.legalName}</p>
              <h1 className="mt-3 text-[36px] font-black leading-[1.05] text-charcoal sm:text-5xl lg:text-[58px]">{policy.title}</h1>
              <p className="mt-5 max-w-3xl text-base font-semibold leading-7 text-muted sm:text-lg">{policy.summary}</p>
            </div>

            <div className="mt-7 grid gap-3 text-sm font-black sm:grid-cols-2 lg:max-w-3xl">
              <div className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 text-charcoal ring-1 ring-[#eadfd5]">
                <CalendarDays size={18} className="shrink-0 text-maroon" />
                <span>Effective Date: {policy.effectiveDate}</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 text-charcoal ring-1 ring-[#eadfd5]">
                <FileText size={18} className="shrink-0 text-maroon" />
                <span>{policy.sections.length} policy sections</span>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-[1120px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
          <article className="space-y-4">
            {policy.sections.map((section, index) => (
              <section key={section.heading} id={sectionId(section.heading)} className="rounded-lg border border-[#eadfd5] bg-white p-5 shadow-[0_10px_24px_rgba(34,31,32,0.04)] sm:p-6">
                <div className="flex items-start gap-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cream text-sm font-black text-maroon">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-xl font-black leading-tight text-charcoal">{section.heading}</h2>
                    <div className="mt-4 space-y-3 text-[15px] font-semibold leading-7 text-muted">
                      {section.body.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </article>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-lg border border-[#eadfd5] bg-white p-5 shadow-[0_10px_24px_rgba(34,31,32,0.04)]">
              <h2 className="text-base font-black text-charcoal">On this page</h2>
              <nav className="mt-4 grid gap-2" aria-label={`${policy.title} sections`}>
                {policy.sections.map((section, index) => (
                  <a key={section.heading} href={`#${sectionId(section.heading)}`} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm font-black text-muted ring-1 ring-border hover:text-maroon">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white text-[11px] text-maroon ring-1 ring-[#eadfd5]">{index + 1}</span>
                    <span className="min-w-0 truncate">{section.heading}</span>
                  </a>
                ))}
              </nav>
            </section>
          </aside>
        </div>
      </main>
      <SiteFooter showLogo={false} showContact={false} />
      <MobileNav />
    </>
  );
}
