import { AdminCategoriesClient } from "@/components/admin-categories-client";
import { requireAdminPagePermission } from "@/lib/admin-page-auth";
import { getCartSuggestionCategoriesFromDb, getCategoryImagesFromDb, getCategoryOffersFromDb } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await requireAdminPagePermission("categories", "/admin/categories");
  if (!isDatabaseConfigured()) {
    return <AdminCategoriesClient initialCategories={[]} />;
  }

  const [categories, categoryImages, categoryOffers, cartSuggestionCategories] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    }),
    getCategoryImagesFromDb(),
    getCategoryOffersFromDb(),
    getCartSuggestionCategoriesFromDb(),
  ]);

  return (
    <AdminCategoriesClient
      initialCategories={categories.map((category) => ({
        id: category.id,
        name: category.name,
        parentId: category.parentId,
        visible: category.visible,
        sortOrder: category.sortOrder,
        _count: category._count,
        image: categoryImages[category.slug] ?? "",
        offer: categoryOffers[category.slug] ?? "",
      }))}
      initialCartSuggestionCategories={cartSuggestionCategories}
    />
  );
}
