import Link from "next/link";
import { business, policies } from "@/lib/business";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-white px-4 py-8 pb-28">
      <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-[1fr_auto] sm:px-6 lg:px-8">
        <div>
          <p className="text-lg font-black text-maroon">{business.brandName}</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{business.legalName}</p>
          <p className="mt-2 text-sm font-semibold text-charcoal">{business.address}</p>
          <p className="mt-1 text-sm text-muted">
            Phone: {business.phone} | Email: {business.email} | GSTIN: {business.gstin}
          </p>
        </div>
        <nav className="flex flex-wrap gap-3 text-sm font-black text-red" aria-label="Legal links">
          {policies.map((policy) => (
            <Link key={policy.slug} href={`/${policy.slug}`}>
              {policy.title}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
