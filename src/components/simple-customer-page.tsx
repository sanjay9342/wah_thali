import Link from "next/link";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";

export function SimpleCustomerPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: { title: string; body: string; action?: string; href?: string }[];
}) {
  return (
    <>
      <Header />
      <main className="mx-auto min-h-screen w-full max-w-7xl px-5 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-6">
        <div className="overflow-hidden rounded-[24px] bg-red p-6 text-white shadow-[0_16px_36px_rgba(214,0,50,0.16)] sm:p-8 lg:p-10">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-white/75">Wah Thali</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-white/82 sm:text-lg">{intro}</p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:gap-5">
          {sections.map((section) => (
            <article key={section.title} className="rounded-[22px] border border-[#f1e7e4] bg-white p-5 shadow-[0_12px_34px_rgba(34,31,32,0.06)]">
              <h2 className="text-xl font-black text-charcoal">{section.title}</h2>
              <p className="mt-2 text-sm font-semibold leading-7 text-muted sm:text-base">{section.body}</p>
              {section.action && section.href ? (
                <Link href={section.href} className="mt-5 inline-flex h-11 items-center rounded-xl bg-red px-5 text-sm font-black text-white shadow-[0_9px_20px_rgba(214,0,50,0.16)]">
                  {section.action}
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      </main>
      <MobileNav />
    </>
  );
}
