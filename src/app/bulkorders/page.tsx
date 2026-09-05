import type { Metadata } from "next";
import { BulkOrdersClient } from "@/components/bulk-orders-client";
import { DesktopTrustFooter } from "@/components/desktop-trust-footer";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { getCategoriesFromDb, getPublicOffersPageDataFromDb } from "@/lib/db";

export const metadata: Metadata = {
  title: "Bulk Orders",
  description: "Request Wah Thali bulk meals, party orders, monthly subscriptions, and corporate meal callbacks in Kolkata.",
  alternates: { canonical: "/bulkorders" },
};

export const revalidate = 60;

export default async function BulkOrdersPage() {
  const [{ coupons }, categories] = await Promise.all([
    getPublicOffersPageDataFromDb(),
    getCategoriesFromDb(),
  ]);

  return (
    <>
      <Header />
      <BulkOrdersClient coupons={coupons} />
      <DesktopTrustFooter categories={categories} />
      <MobileNav />
    </>
  );
}
