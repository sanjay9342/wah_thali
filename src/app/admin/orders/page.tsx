import { AdminOrdersClient } from "@/components/admin-orders-client";
import { getAdminOrdersFromDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await getAdminOrdersFromDb();

  return <AdminOrdersClient initialOrders={orders} />;
}
