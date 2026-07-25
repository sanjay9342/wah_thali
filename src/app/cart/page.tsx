import { CartClient } from "@/components/cart-client";
import { getCouponsFromDb, getProductsFromDb, getRestaurantSettingsFromDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>;
}) {
  const params = await searchParams;
  const [products, coupons, restaurantSettings] = await Promise.all([
    getProductsFromDb(),
    getCouponsFromDb(),
    getRestaurantSettingsFromDb(),
  ]);

  return (
    <main className="bg-[#f2f0f5] sm:px-6 lg:px-8">
      <CartClient addProductId={params.add} initialProducts={products} initialCoupons={coupons} restaurantSettings={restaurantSettings} />
    </main>
  );
}
