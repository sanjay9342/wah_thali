import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

export function DesktopTrustFooter({ categories }: { categories: string[] }) {
  const topCategories = categories.filter((category) => category !== "All").slice(0, 5);

  return (
    <section className="hidden border-t border-[#f1e7e4] bg-white lg:block">
      <div className="mx-auto max-w-[1180px] px-5 py-9">
        <div className="grid grid-cols-[1.15fr_0.7fr_0.8fr_0.8fr] gap-12">
          <div>
            <Link href="/" className="relative block h-12 w-40 overflow-hidden">
              <Image src="/wah-thali-logo-cutout.png" alt="Wah Thali" fill sizes="160px" className="object-contain object-left" />
            </Link>
            <p className="mt-5 max-w-[360px] text-sm font-semibold leading-7 text-muted">
              Fresh homestyle meals delivered straight to your doorstep. Simple ordering, clean food, and fast delivery.
            </p>
          </div>

          <FooterColumn title="Top Categories">
            {topCategories.map((category) => (
              <Link key={category} href={getCategoryHref(category)} className="text-sm font-bold text-muted hover:text-maroon">
                {category}
              </Link>
            ))}
          </FooterColumn>

          <FooterColumn title="Our Policies">
            {[
              ["Privacy Policy", "/privacy-policy"],
              ["About Us", "/about"],
              ["Terms and Conditions", "/terms-and-conditions"],
              ["Refund Policy", "/refund-cancellation-policy"],
              ["Delivery & Pickup Policy", "/delivery-policy"],
            ].map(([label, href]) => (
              <Link key={href} href={href} className="text-sm font-bold text-muted hover:text-maroon">
                {label}
              </Link>
            ))}
          </FooterColumn>

          <FooterColumn title="Support & More">
            {[
              ["Help Center", "/support"],
              ["Orders", "/orders"],
              ["Offers", "/offers"],
              ["Loyalty", "/loyalty"],
              ["Account", "/account"],
            ].map(([label, href]) => (
              <Link key={href} href={href} className="text-sm font-bold text-muted hover:text-maroon">
                {label}
              </Link>
            ))}
          </FooterColumn>
        </div>
      </div>
    </section>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-base font-black uppercase tracking-wide text-charcoal">{title}</h3>
      <div className="mt-6 grid gap-4">{children}</div>
    </div>
  );
}

function getCategoryHref(category: string) {
  return `/menu?category=${encodeURIComponent(category)}`;
}
