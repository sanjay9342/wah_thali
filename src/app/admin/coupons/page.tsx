import { AdminCouponsClient } from "@/components/admin-coupons-client";
import { getProductsFromDb } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  const products = await getProductsFromDb();
  const coupons = isDatabaseConfigured()
    ? await prisma.coupon.findMany({ orderBy: { code: "asc" } })
    : [];

  return (
    <AdminCouponsClient
      initialCoupons={coupons.map((coupon) => ({
        ...coupon,
        type: coupon.type as "FIXED" | "PERCENT",
        startsAt: coupon.startsAt.toISOString().slice(0, 10),
        endsAt: coupon.endsAt.toISOString().slice(0, 10),
      }))}
      discountedProducts={products.filter((product) => product.offer).length}
    />
  );
}
