import { AdminOfflineSalesClient } from "@/components/admin-offline-sales-client";
import { getAdminProductsFromDb } from "@/lib/db";
import { requireAdminPagePermission } from "@/lib/admin-page-auth";

export const dynamic = "force-dynamic";

export default async function AdminOfflineSalesPage() {
  await requireAdminPagePermission("offlineSales", "/admin/offline-sales");
  const products = await getAdminProductsFromDb();

  return <AdminOfflineSalesClient products={products} />;
}
