import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { business, policies } from "@/lib/business";

export function SiteFooter({ showLogo = true, showContact = true }: { showLogo?: boolean; showContact?: boolean }) {
  const footerLinks = [
    { slug: "about", title: "About" },
    ...policies.map((policy) => ({ slug: policy.slug, title: policy.title })),
  ];
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`;

  return (
    <footer className="border-t border-[#f1e7e4] bg-white px-4 pb-24 pt-6 lg:px-8 lg:pb-7 lg:pt-7">
      <div className={`mx-auto grid max-w-[1248px] gap-5 ${showContact ? "lg:grid-cols-[minmax(0,1fr)_minmax(520px,0.9fr)] lg:items-center" : ""}`}>
        <div>
          {showLogo ? (
            <Link href="/" className="relative block h-12 w-40 overflow-hidden">
              <Image src="/wah-thali-logo-cutout.png" alt={business.brandName} fill sizes="176px" className="object-contain object-left" />
            </Link>
          ) : null}
          <p className={`${showLogo ? "mt-3" : ""} max-w-md text-[12px] font-semibold leading-5 text-muted lg:text-sm lg:leading-6`}>
            Fresh homestyle meals from Kolkata. Simple ordering, clean food, and fast delivery.
          </p>
        </div>

        {showContact ? (
          <div className="grid gap-3 sm:grid-cols-3 lg:gap-3">
            <FooterContact icon={<MapPin size={20} />} eyebrow="Find us" title="Visit" body="Open map" href={mapHref} />
            <FooterContact icon={<Phone size={20} />} eyebrow="Talk now" title="Call" body={business.phone} href={`tel:${business.phone}`} />
            <FooterContact icon={<Mail size={20} />} eyebrow="Write to us" title="Email" body={business.email} href={`mailto:${business.email}`} />
          </div>
        ) : null}
      </div>

      <div className="mx-auto mt-5 flex max-w-[1248px] flex-col gap-4 border-t border-[#f1e7e4] pt-5 lg:flex-row lg:items-center lg:justify-between">
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-black leading-5 text-muted lg:gap-x-5 lg:text-xs" aria-label="Footer links">
          {footerLinks.map((link) => (
            <Link key={link.slug} href={`/${link.slug}`} className="hover:text-red">
              {link.title}
            </Link>
          ))}
        </nav>
        <p className="text-[11px] font-semibold leading-5 text-muted lg:text-xs">&copy; {new Date().getFullYear()} {business.legalName}</p>
      </div>
    </footer>
  );
}

function FooterContact({
  icon,
  eyebrow,
  title,
  body,
  href,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="group relative isolate flex min-w-0 items-center gap-3 overflow-hidden rounded-[18px] border border-[#f1e2e5] bg-white p-3.5 shadow-[0_12px_28px_rgba(34,31,32,0.055)] transition duration-200 hover:-translate-y-0.5 hover:border-maroon/25 hover:shadow-[0_18px_38px_rgba(141,0,33,0.09)]"
    >
      <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-maroon/75 opacity-70 transition-all group-hover:opacity-100" />
      <span className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-[#fff4f5] opacity-0 transition-opacity group-hover:opacity-100" />
      <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-[#fff4f5] text-maroon ring-1 ring-maroon/10 transition duration-200 group-hover:bg-maroon group-hover:text-white group-hover:ring-maroon">
        {icon}
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-maroon/65">{eyebrow}</span>
        <span className="mt-0.5 block text-[14px] font-black leading-tight text-charcoal">{title}</span>
        <span className="mt-0.5 block truncate text-[12px] font-bold leading-4 text-muted">{body}</span>
      </span>
      <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#fbfbfc] text-muted transition duration-200 group-hover:bg-[#fff4f5] group-hover:text-maroon">
        <ArrowUpRight size={16} strokeWidth={2.6} />
      </span>
    </a>
  );
}
