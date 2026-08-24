import { AdminCouponsClient } from "@/components/admin-coupons-client";
import { requireAdminPagePermission } from "@/lib/admin-page-auth";
import { getAdminCouponsFromDb, getCustomerTagsFromDb, getProductsFromDb } from "@/lib/db";
import { getIstDateInputValue } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  await requireAdminPagePermission("coupons", "/admin/coupons");
  const [products, coupons, customerTags] = await Promise.all([
    getProductsFromDb(),
    getAdminCouponsFromDb(),
    getCustomerTagsFromDb(),
  ]);

  return (
    <AdminCouponsClient
      initialCoupons={coupons.map((coupon) => ({
        ...coupon,
        type: coupon.type as "FIXED" | "PERCENT",
        startsAt: coupon.startsAt ? getIstDateInputValue(coupon.startsAt) : getIstDateInputValue(),
        endsAt: coupon.endsAt ? getIstDateInputValue(coupon.endsAt) : getIstDateInputValue(),
      }))}
      discountedProducts={products.filter((product) => product.offer).length}
      initialCustomerTags={customerTags}
    />
  );
}
