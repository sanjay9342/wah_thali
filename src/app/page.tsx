import { MenuExperience } from "@/components/menu-experience";
import { getCategoriesFromDb, getCategoryImagesFromDb, getCategoryOffersFromDb, getCouponsFromDb, getHomeSlidesFromDb, getProductsFromDb, getRestaurantSettingsFromDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const [categories, products, slides, categoryImages, categoryOffers, restaurantSettings, coupons] = await Promise.all([
    getCategoriesFromDb(),
    getProductsFromDb(),
    getHomeSlidesFromDb(),
    getCategoryImagesFromDb(),
    getCategoryOffersFromDb(),
    getRestaurantSettingsFromDb(),
    getCouponsFromDb(),
  ]);

  return <MenuExperience initialCategories={categories} initialProducts={products} initialSlides={slides} initialCategoryImages={categoryImages} initialCategoryOffers={categoryOffers} initialCoupons={coupons} restaurantSettings={restaurantSettings} initialActiveCategory={params?.category} />;
}
