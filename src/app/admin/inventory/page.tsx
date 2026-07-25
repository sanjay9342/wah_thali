import { AdminInventoryClient } from "@/components/admin-inventory-client";
import { getAdminProductsFromDb, getCategoriesFromDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ edit?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const [categories, products] = await Promise.all([getCategoriesFromDb(), getAdminProductsFromDb()]);

  return <AdminInventoryClient initialCategories={categories} initialProducts={products} initialEditId={resolvedSearchParams?.edit} />;
}
