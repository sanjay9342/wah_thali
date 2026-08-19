import { AdminCouponsClient } from "@/components/admin-coupons-client";
import { getAdminCouponsFromDb, getProductsFromDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  const products = await getProductsFromDb();
  const coupons = await getAdminCouponsFromDb();

  return (
    <AdminCouponsClient
      initialCoupons={coupons.map((coupon) => ({
        ...coupon,
        type: coupon.type as "FIXED" | "PERCENT",
        startsAt: coupon.startsAt ? new Date(coupon.startsAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        endsAt: coupon.endsAt ? new Date(coupon.endsAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      }))}
      discountedProducts={products.filter((product) => product.offer).length}
    />
  );
}
