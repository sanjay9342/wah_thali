import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { OffersClient } from "@/components/offers-client";
import { getCouponsFromDb } from "@/lib/db";

export const dynamic = "force-dynamic";

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
