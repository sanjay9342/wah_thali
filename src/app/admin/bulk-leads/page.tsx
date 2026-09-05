import { AdminBulkLeadsClient } from "@/components/admin-bulk-leads-client";
import { getAdminLeadsFromDb, getRestaurantSettingsFromDb } from "@/lib/db";
import { requireAdminPagePermission } from "@/lib/admin-page-auth";

export const dynamic = "force-dynamic";

export default async function AdminBulkLeadsPage() {
  await requireAdminPagePermission("leads", "/admin/bulk-leads");
  const [leads, settings] = await Promise.all([
    getAdminLeadsFromDb(),
    getRestaurantSettingsFromDb(),
  ]);

  return (
    <AdminBulkLeadsClient
      leads={leads}
      initialLeadWhatsAppNumber={settings.leadWhatsAppNumber || settings.whatsappNumber}
    />
  );
}
