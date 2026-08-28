import { MenuExperience } from "@/components/menu-experience";
import { getPublicHomePageDataFromDb } from "@/lib/db";

export const revalidate = 60;

export default async function Home() {
  const { categories, categoryOptions, products, slides, categoryImages, categoryOffers, restaurantSettings, coupons, homeDishCategories } = await getPublicHomePageDataFromDb();

  return <MenuExperience initialCategories={categories} initialCategoryOptions={categoryOptions} initialProducts={products} initialSlides={slides} initialCategoryImages={categoryImages} initialCategoryOffers={categoryOffers} initialCoupons={coupons} restaurantSettings={restaurantSettings} initialHomeDishCategories={homeDishCategories} />;
}
