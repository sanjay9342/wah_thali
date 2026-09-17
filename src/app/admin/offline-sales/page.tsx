import { AdminOfflineSalesClient } from "@/components/admin-offline-sales-client";
import { getAdminProductsFromDb, getRestaurantSettingsFromDb } from "@/lib/db";
import { requireAdminPagePermission } from "@/lib/admin-page-auth";

export const dynamic = "force-dynamic";

export default async function AdminOfflineSalesPage() {
  await requireAdminPagePermission("offlineSales", "/admin/offline-sales");
  const [products, settings] = await Promise.all([
    getAdminProductsFromDb(),
    getRestaurantSettingsFromDb(),
  ]);

  return <AdminOfflineSalesClient products={products} gstRate={settings.gstRate} />;
}
