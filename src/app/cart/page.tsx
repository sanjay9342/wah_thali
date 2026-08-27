import { CartClient } from "@/components/cart-client";
import { Header } from "@/components/header";
import { getPublicCartPageDataFromDb } from "@/lib/db";

export const revalidate = 60;

export default async function CartPage() {
  const { products, coupons, restaurantSettings, categoryOffers, cartSuggestionCategories } = await getPublicCartPageDataFromDb();

  return (
    <>
      <Header />
      <main className="bg-white px-0 pb-0 sm:px-6 sm:pb-28 lg:px-8">
        <CartClient
          initialProducts={products}
          initialCoupons={coupons}
          restaurantSettings={restaurantSettings}
          initialCategoryOffers={categoryOffers}
          cartSuggestionCategories={cartSuggestionCategories}
        />
      </main>
    </>
  );
}
