import { AdminCouponsClient } from "@/components/admin-coupons-client";
import { requireAdminPagePermission } from "@/lib/admin-page-auth";
import { getAdminCouponsFromDb, getCategoryOptionsFromDb, getCustomerTagsFromDb, getProductsFromDb } from "@/lib/db";
import { getIstDateTimeInputValue } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  await requireAdminPagePermission("coupons", "/admin/coupons");
  const [products, coupons, customerTags, categories] = await Promise.all([
    getProductsFromDb(),
    getAdminCouponsFromDb(),
    getCustomerTagsFromDb(),
    getCategoryOptionsFromDb({ visibleOnly: false }),
  ]);

  return (
    <AdminCouponsClient
      initialCoupons={coupons.map((coupon) => ({
        ...coupon,
        type: coupon.type as "FIXED" | "PERCENT",
        startsAt: coupon.startsAt ? getIstDateTimeInputValue(coupon.startsAt) : getIstDateTimeInputValue(),
        endsAt: coupon.endsAt ? getIstDateTimeInputValue(coupon.endsAt) : getIstDateTimeInputValue(),
      }))}
      discountedProducts={products.filter((product) => product.offer).length}
      initialCustomerTags={customerTags}
      products={products.map((product) => ({ id: product.id, name: product.displayName || product.name, categoryId: product.categoryId ?? "", category: product.category }))}
      categories={categories.map((category) => ({ id: category.id, name: category.name }))}
    />
  );
}
