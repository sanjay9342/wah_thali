import { AdminAccessClient } from "@/components/admin-access-client";
import { requireAdminPagePermission } from "@/lib/admin-page-auth";

export const dynamic = "force-dynamic";

export default async function AdminAccessPage() {
  await requireAdminPagePermission("access", "/admin/access");
  return <AdminAccessClient />;
}
