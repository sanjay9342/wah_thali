import type { Metadata } from "next";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { OffersClient } from "@/components/offers-client";
import { getCouponsFromDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Offers",
  description: "Find Wah Thali coupons, meal deals, rewards, and fresh food offers for thalis, biryani, and combos in Kolkata.",
  alternates: { canonical: "/offers" },
};

export default async function OffersPage() {
  const coupons = await getCouponsFromDb();

  return (
    <>
      <Header />
      <OffersClient coupons={coupons} />
      <MobileNav />
    </>
  );
}
