import { MenuExperience } from "@/components/menu-experience";
import { getCategoriesFromDb, getProductsFromDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [categories, products] = await Promise.all([getCategoriesFromDb(), getProductsFromDb()]);

  return <MenuExperience initialCategories={categories} initialProducts={products} />;
}
