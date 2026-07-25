import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";
import { business, policies } from "@/lib/business";

export function SiteFooter() {
  const footerLinks = [
    { slug: "about", title: "About Wah Thali" },
    ...policies.map((policy) => ({ slug: policy.slug, title: policy.title })),
  ];
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`;

  return (
    <footer className="bg-transparent pb-24 md:px-6 md:pt-6 lg:px-8">
      <div
        className="relative mx-auto hidden min-h-[450px] max-w-6xl overflow-hidden rounded-b-[44px] rounded-t-[12px] bg-maroon bg-cover bg-center px-8 pt-14 text-white shadow-[0_18px_54px_rgba(72,0,17,0.28)] md:block"
        style={{ backgroundImage: "url('/wah-thali-footer-bg.png')" }}
      >
        <div className="absolute left-1/2 top-16 z-20 grid h-44 w-44 -translate-x-1/2 place-items-center rounded-full bg-[#fff4df] shadow-[0_8px_26px_rgba(0,0,0,0.18)] ring-4 ring-[#f2cb83]">
          <Image
            src="/wah-thali-logo-cutout.png"
            alt={business.brandName}
            width={154}
            height={154}
            className="h-[142px] w-[142px] object-contain"
          />
        </div>

        <div className="absolute left-[8%] top-[228px] z-20 w-[220px]">
          <FooterContact
            icon={<MapPin size={24} />}
            title="Visit Us"
            body={business.address}
            href={mapHref}
          />
        </div>
        <div className="absolute left-[58%] top-[228px] z-20 w-[130px]">
          <FooterContact
            icon={<Phone size={24} />}
            title="Call Us"
            body={business.phone}
            href={`tel:${business.phone}`}
          />
        </div>
        <div className="absolute right-[6%] top-[228px] z-20 w-[170px]">
          <FooterContact
            icon={<Mail size={24} />}
            title="Email Us"
            body={business.email}
            href={`mailto:${business.email}`}
          />
        </div>

        <FooterBottom footerLinks={footerLinks} />
      </div>

      <div
        className="relative min-h-[690px] overflow-hidden rounded-b-[30px] bg-transparent bg-center text-white shadow-[0_18px_54px_rgba(72,0,17,0.28)] md:hidden"
        style={{
          backgroundImage: "url('/wah-thali-footer-mobile-bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute left-1/2 top-[158px] z-20 grid h-24 w-24 -translate-x-1/2 place-items-center rounded-full bg-[#fff4df] shadow-[0_8px_26px_rgba(0,0,0,0.18)] ring-4 ring-[#f2cb83]">
          <Image
            src="/wah-thali-logo-cutout.png"
            alt={business.brandName}
            width={128}
            height={128}
            className="h-20 w-20 object-contain"
          />
        </div>

        <div className="absolute left-4 right-4 top-[378px] z-20 grid grid-cols-3 gap-2 p-2">
          <FooterContact
            icon={<MapPin size={17} />}
            title="Visit"
            body="Map"
            href={mapHref}
            compact
          />
          <FooterContact
            icon={<Phone size={17} />}
            title="Call"
            body={business.phone}
            href={`tel:${business.phone}`}
            compact
          />
          <FooterContact
            icon={<Mail size={17} />}
            title="Email"
            body={business.email}
            href={`mailto:${business.email}`}
            compact
          />
        </div>

        <FooterBottom footerLinks={footerLinks} mobile className="bottom-[132px]" />
      </div>
    </footer>
  );
}

function FooterBottom({
  footerLinks,
  mobile = false,
  className = "",
}: {
  footerLinks: { slug: string; title: string }[];
  mobile?: boolean;
  className?: string;
}) {
  return (
    <div className={`absolute left-4 right-4 z-20 mx-auto max-w-5xl border-t border-[#c99a57]/35 pt-3 ${className || (mobile ? "bottom-5" : "bottom-10 md:left-8 md:right-8 md:pt-5")}`}>
      <nav className={`flex flex-wrap items-center justify-center gap-y-2 font-semibold text-[#f5d5a1] ${mobile ? "gap-x-3 text-[9px]" : "gap-x-7 text-[11px]"}`} aria-label="Footer links">
            {footerLinks.map((link) => (
              <Link key={link.slug} href={`/${link.slug}`} className="hover:text-white">
                {link.title}
              </Link>
            ))}
          </nav>
      <p className={`mt-3 text-center font-semibold leading-4 text-[#f5d5a1]/85 ${mobile ? "text-[9px]" : "text-[11px]"}`}>&copy; {new Date().getFullYear()} {business.legalName}. Fresh homestyle meals from Kolkata.</p>
    </div>
  );
}

function FooterContact({
  icon,
  title,
  body,
  href,
  compact = false,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  href?: string;
  compact?: boolean;
}) {
  const content = (
    <>
      <span className={`mx-auto grid place-items-center rounded-full bg-[#fff4df] text-maroon shadow-[0_8px_18px_rgba(0,0,0,0.18)] ring-2 ring-[#e5bd73] ${compact ? "h-9 w-9" : "h-12 w-12"}`}>
        {icon}
      </span>
      <span className={`${compact ? "mt-1 text-[10px]" : "mt-2 text-sm"} block text-center font-black text-[#ffe7b0] drop-shadow`}>{title}</span>
      <span className={`mx-auto mt-1 block text-center font-semibold text-[#f6d6a5] drop-shadow ${compact ? "max-w-[140px] text-[8px] leading-3" : "max-w-[220px] text-xs leading-5"}`}>{body}</span>
    </>
  );

  if (href) {
    return <a href={href} className="block">{content}</a>;
  }

  return <div>{content}</div>;
}
