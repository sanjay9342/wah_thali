import type { Metadata } from "next";
import { MenuExperience } from "@/components/menu-experience";
import { getCategoriesFromDb, getCategoryImagesFromDb, getCategoryOffersFromDb, getHomeSlidesFromDb, getProductsFromDb, getRestaurantSettingsFromDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Menu",
  description: "Browse Wah Thali's fresh thalis, biryani, Chinese combos, mini meals, offers, and homestyle dishes for online ordering in Kolkata.",
  alternates: { canonical: "/menu" },
};

export default async function MenuPage({
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
