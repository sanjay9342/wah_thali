import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";
import { business, policies } from "@/lib/business";

export function SiteFooter() {
  const footerLinks = [
    { slug: "about", title: "About" },
    ...policies.map((policy) => ({ slug: policy.slug, title: policy.title })),
  ];
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`;

  return (
    <footer className="border-t border-[#f1e7e4] bg-white px-4 pb-28 pt-8 lg:px-8 lg:pb-7 lg:pt-7">
      <div className="mx-auto grid max-w-[1248px] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(520px,0.9fr)] lg:items-center">
        <div>
          <Link href="/" className="relative block h-12 w-40 overflow-hidden">
            <Image src="/wah-thali-logo-cutout.png" alt={business.brandName} fill sizes="176px" className="object-contain object-left" />
          </Link>
          <p className="mt-3 max-w-md text-sm font-semibold leading-6 text-muted">Fresh homestyle meals from Kolkata. Simple ordering, clean food, and fast delivery.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:gap-2">
          <FooterContact icon={<MapPin size={18} />} title="Visit" body="Map" href={mapHref} />
          <FooterContact icon={<Phone size={18} />} title="Call" body={business.phone} href={`tel:${business.phone}`} />
          <FooterContact icon={<Mail size={18} />} title="Email" body={business.email} href={`mailto:${business.email}`} />
        </div>
      </div>

      <div className="mx-auto mt-6 flex max-w-[1248px] flex-wrap items-center justify-between gap-4 border-t border-[#f1e7e4] pt-5">
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-black text-muted" aria-label="Footer links">
          {footerLinks.map((link) => (
            <Link key={link.slug} href={`/${link.slug}`} className="hover:text-red">
              {link.title}
            </Link>
          ))}
        </nav>
        <p className="text-xs font-semibold text-muted">&copy; {new Date().getFullYear()} {business.legalName}</p>
      </div>
    </footer>
  );
}

function FooterContact({
  icon,
  title,
  body,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  href: string;
}) {
  return (
    <a href={href} className="flex min-w-0 items-center gap-3 rounded-xl border border-[#f1e7e4] bg-white p-3 shadow-[0_8px_20px_rgba(34,31,32,0.035)]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#fff4f5] text-red">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-charcoal">{title}</span>
        <span className="block truncate text-xs font-semibold text-muted">{body}</span>
      </span>
    </a>
  );
}
