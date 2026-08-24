import { AdminInventoryClient } from "@/components/admin-inventory-client";
import { requireAdminPagePermission } from "@/lib/admin-page-auth";
import { getAdminProductsFromDb, getCategoriesFromDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ edit?: string }>;
}) {
  await requireAdminPagePermission("inventory", "/admin/inventory");
  const resolvedSearchParams = await searchParams;
  const [categories, products] = await Promise.all([getCategoriesFromDb(), getAdminProductsFromDb()]);

  return <AdminInventoryClient initialCategories={categories} initialProducts={products} initialEditId={resolvedSearchParams?.edit} />;
}
