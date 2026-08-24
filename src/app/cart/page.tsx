import { CartClient } from "@/components/cart-client";
import { Header } from "@/components/header";
import { getCategoryOffersFromDb, getCouponsFromDb, getProductsFromDb, getRestaurantSettingsFromDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>;
}) {
  const params = await searchParams;
  const [products, coupons, restaurantSettings, categoryOffers] = await Promise.all([
    getProductsFromDb(),
    getCouponsFromDb(),
    getRestaurantSettingsFromDb(),
    getCategoryOffersFromDb(),
  ]);

  return (
    <>
      <Header />
      <main className="bg-white px-4 pb-28 sm:px-6 lg:px-8">
        <CartClient addProductId={params.add} initialProducts={products} initialCoupons={coupons} restaurantSettings={restaurantSettings} initialCategoryOffers={categoryOffers} />
      </main>
    </>
  );
}
