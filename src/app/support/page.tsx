import type { Metadata } from "next";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { SupportClient } from "@/components/support-client";

export const metadata: Metadata = {
  title: "Support",
  description: "Contact Wah Thali support for order help, refunds, cancellations, delivery issues, complaints, and WhatsApp assistance.",
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return (
    <>
      <Header />
      <SupportClient />
      <SiteFooter showLogo={false} />
      <MobileNav />
    </>
  );
}
