import { MenuExperience } from "@/components/menu-experience";
import { getCategoriesFromDb, getCategoryImagesFromDb, getHomeSlidesFromDb, getProductsFromDb, getRestaurantSettingsFromDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MenuPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const [categories, products, slides, categoryImages, restaurantSettings] = await Promise.all([
    getCategoriesFromDb(),
    getProductsFromDb(),
    getHomeSlidesFromDb(),
    getCategoryImagesFromDb(),
    getRestaurantSettingsFromDb(),
  ]);

  return <MenuExperience initialCategories={categories} initialProducts={products} initialSlides={slides} initialCategoryImages={categoryImages} restaurantSettings={restaurantSettings} initialActiveCategory={params?.category} />;
}
