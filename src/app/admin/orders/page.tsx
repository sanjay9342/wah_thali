import { AdminOrdersClient } from "@/components/admin-orders-client";
import { getAdminOrdersFromDb, getRestaurantSettingsFromDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const [orders, settings] = await Promise.all([getAdminOrdersFromDb(), getRestaurantSettingsFromDb()]);

  return (
    <AdminOrdersClient
      initialOrders={orders}
      defaultPrepMinutes={settings.defaultPrepMinutes}
      requireDeclineReason={settings.requireDeclineReason}
    />
  );
}
