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
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-black text-maroon">{title}</h1>
          <p className="mt-2 max-w-3xl leading-7 text-muted">{intro}</p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <article key={section.title} className="rounded-xl border border-border bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-charcoal">{section.title}</h2>
              <p className="mt-2 leading-7 text-muted">{section.body}</p>
              {section.action && section.href ? (
                <Link href={section.href} className="mt-4 inline-flex h-11 items-center rounded-lg bg-red px-4 font-black text-white">
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
