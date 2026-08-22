import { AdminCouponsClient } from "@/components/admin-coupons-client";
import { getAdminCouponsFromDb, getProductsFromDb } from "@/lib/db";
import { getIstDateInputValue } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  const products = await getProductsFromDb();
  const coupons = await getAdminCouponsFromDb();

  return (
    <AdminCouponsClient
      initialCoupons={coupons.map((coupon) => ({
        ...coupon,
        type: coupon.type as "FIXED" | "PERCENT",
        startsAt: coupon.startsAt ? getIstDateInputValue(coupon.startsAt) : getIstDateInputValue(),
        endsAt: coupon.endsAt ? getIstDateInputValue(coupon.endsAt) : getIstDateInputValue(),
      }))}
      discountedProducts={products.filter((product) => product.offer).length}
    />
  );
}
