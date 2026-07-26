import { AdminCategoriesClient } from "@/components/admin-categories-client";
import { getCategoryImagesFromDb, getCategoryOffersFromDb } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  if (!isDatabaseConfigured()) {
    return <AdminCategoriesClient initialCategories={[]} />;
  }

  const [categories, categoryImages, categoryOffers] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    }),
    getCategoryImagesFromDb(),
    getCategoryOffersFromDb(),
  ]);

  return (
    <AdminCategoriesClient
      initialCategories={categories.map((category) => ({
        id: category.id,
        name: category.name,
        visible: category.visible,
        sortOrder: category.sortOrder,
        _count: category._count,
        image: categoryImages[category.slug] ?? "/wah-thali-meal-cutout-v2.png",
        offer: categoryOffers[category.slug] ?? "",
      }))}
    />
  );
}
