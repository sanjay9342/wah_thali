import { AdminAccessGate } from "@/components/admin-access-gate";
import { AdminOrderAlerts } from "@/components/admin-order-alerts";
import { getRestaurantSettingsFromDb } from "@/lib/db";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const settings = await getRestaurantSettingsFromDb();

  return (
    <AdminAccessGate>
      <AdminOrderAlerts enabled={settings.newOrderSoundEnabled} sound={settings.newOrderSound} />
      {children}
    </AdminAccessGate>
  );
}
