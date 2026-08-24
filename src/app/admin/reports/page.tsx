import { AdminReportsClient } from "@/components/admin-reports-client";
import { getAdminReportsSnapshot } from "@/lib/admin-reports";
import { requireAdminPagePermission } from "@/lib/admin-page-auth";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string; date?: string; from?: string; to?: string; q?: string }>;
}) {
  await requireAdminPagePermission("reports", "/admin/reports");
  const resolvedSearchParams = await searchParams;
  const snapshot = await getAdminReportsSnapshot({
    period: resolvedSearchParams?.period,
    date: resolvedSearchParams?.date,
    from: resolvedSearchParams?.from,
    to: resolvedSearchParams?.to,
    q: resolvedSearchParams?.q,
  });

  return <AdminReportsClient snapshot={snapshot} />;
}
