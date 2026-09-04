import type { Metadata } from "next";
import { MenuExperience } from "@/components/menu-experience";
import { getPublicMenuPageDataFromDb } from "@/lib/db";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Menu",
  description: "Browse Wah Thali's fresh thalis, biryani, Chinese combos, mini meals, offers, and homestyle dishes for online ordering in Kolkata.",
  alternates: { canonical: "/menu" },
};

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const params = await searchParams;
  const activeCategory = Array.isArray(params.category) ? params.category[0] : params.category;
  const { categories, categoryOptions, products, slides, categoryImages, categoryOffers, restaurantSettings, homeDishCategories } = await getPublicMenuPageDataFromDb();

  return <MenuExperience initialCategories={categories} initialCategoryOptions={categoryOptions} initialProducts={products} initialSlides={slides} initialCategoryImages={categoryImages} initialCategoryOffers={categoryOffers} restaurantSettings={restaurantSettings} initialActiveCategory={activeCategory} initialHomeDishCategories={homeDishCategories} />;
}
