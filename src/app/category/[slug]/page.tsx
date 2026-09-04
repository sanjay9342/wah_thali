import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MenuExperience } from "@/components/menu-experience";
import { getPublicMenuPageDataFromDb } from "@/lib/db";

export const revalidate = 60;

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { categoryOptions } = await getPublicMenuPageDataFromDb();
  const category = categoryOptions.find((item) => slugifyCategory(item.name) === slug);

  if (!category) {
    return {
      title: "Category",
      alternates: { canonical: `/category/${slug}` },
    };
  }

  return {
    title: `${category.name} Dishes`,
    description: `Browse ${category.name} dishes from Wah Thali for online ordering in Kolkata.`,
    alternates: { canonical: `/category/${slug}` },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const { categories, categoryOptions, products, slides, categoryImages, categoryOffers, restaurantSettings, homeDishCategories } = await getPublicMenuPageDataFromDb();
  const activeCategory = categoryOptions.find((category) => slugifyCategory(category.name) === slug)?.name;

  if (!activeCategory) notFound();

  return (
    <MenuExperience
      initialCategories={categories}
      initialCategoryOptions={categoryOptions}
      initialProducts={products}
      initialSlides={slides}
      initialCategoryImages={categoryImages}
      initialCategoryOffers={categoryOffers}
      restaurantSettings={restaurantSettings}
      initialActiveCategory={activeCategory}
      initialHomeDishCategories={homeDishCategories}
      categoryPage
    />
  );
}

function slugifyCategory(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
