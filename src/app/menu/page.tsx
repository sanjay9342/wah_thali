import type { Metadata } from "next";
import { MenuExperience } from "@/components/menu-experience";
import { getPublicMenuPageDataFromDb } from "@/lib/db";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Menu",
  description: "Browse Wah Thali's fresh thalis, biryani, Chinese combos, mini meals, offers, and homestyle dishes for online ordering in Kolkata.",
  alternates: { canonical: "/menu" },
};

export default async function MenuPage() {
  const { categories, products, slides, categoryImages, categoryOffers, restaurantSettings } = await getPublicMenuPageDataFromDb();

  return <MenuExperience initialCategories={categories} initialProducts={products} initialSlides={slides} initialCategoryImages={categoryImages} initialCategoryOffers={categoryOffers} restaurantSettings={restaurantSettings} />;
}
