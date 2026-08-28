import { AdminInventoryClient } from "@/components/admin-inventory-client";
import { requireAdminPagePermission } from "@/lib/admin-page-auth";
import { getAdminProductsFromDb, getCategoryOptionsFromDb, getCategoriesFromDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ edit?: string }>;
}) {
  await requireAdminPagePermission("inventory", "/admin/inventory");
  const resolvedSearchParams = await searchParams;
  const [categories, categoryOptions, products] = await Promise.all([
    getCategoriesFromDb(),
    getCategoryOptionsFromDb({ visibleOnly: false }),
    getAdminProductsFromDb(),
  ]);

  return <AdminInventoryClient initialCategories={categories} initialCategoryOptions={categoryOptions} initialProducts={products} initialEditId={resolvedSearchParams?.edit} />;
}
