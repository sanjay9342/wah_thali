import { AdminOrdersClient } from "@/components/admin-orders-client";
import { requireAdminPagePermission } from "@/lib/admin-page-auth";
import { getAdminOrdersFromDb, getRestaurantSettingsFromDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await requireAdminPagePermission("orders", "/admin/orders");
  const [orders, settings] = await Promise.all([getAdminOrdersFromDb(), getRestaurantSettingsFromDb()]);

  return (
    <AdminOrdersClient
      initialOrders={orders}
      defaultPrepMinutes={settings.defaultPrepMinutes}
      requireDeclineReason={settings.requireDeclineReason}
    />
  );
}
