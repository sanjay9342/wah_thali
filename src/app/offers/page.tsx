import type { Metadata } from "next";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { OffersClient } from "@/components/offers-client";
import { getPublicOffersPageDataFromDb } from "@/lib/db";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Offers",
  description: "Find Wah Thali coupons, meal deals, rewards, and fresh food offers for thalis, biryani, and combos in Kolkata.",
  alternates: { canonical: "/offers" },
};

export default async function OffersPage() {
  const { coupons } = await getPublicOffersPageDataFromDb();

  return (
    <>
      <Header />
      <OffersClient coupons={coupons} />
      <MobileNav />
    </>
  );
}
