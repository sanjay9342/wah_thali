import { MenuExperience } from "@/components/menu-experience";
import { getCategoriesFromDb, getCategoryImagesFromDb, getCategoryOffersFromDb, getHomeSlidesFromDb, getProductsFromDb, getRestaurantSettingsFromDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const [categories, products, slides, categoryImages, categoryOffers, restaurantSettings] = await Promise.all([
    getCategoriesFromDb(),
    getProductsFromDb(),
    getHomeSlidesFromDb(),
    getCategoryImagesFromDb(),
    getCategoryOffersFromDb(),
    getRestaurantSettingsFromDb(),
  ]);

  return <MenuExperience initialCategories={categories} initialProducts={products} initialSlides={slides} initialCategoryImages={categoryImages} initialCategoryOffers={categoryOffers} restaurantSettings={restaurantSettings} initialActiveCategory={params?.category} />;
}
