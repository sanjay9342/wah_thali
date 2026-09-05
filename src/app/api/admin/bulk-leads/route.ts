import { withApiErrorHandling } from "@/lib/api-error";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const bulkLeadWhere = {
  OR: [
    { source: { contains: "Party", mode: "insensitive" as const } },
    { source: { contains: "Bulk", mode: "insensitive" as const } },
    { source: { contains: "Corporate", mode: "insensitive" as const } },
    { source: { contains: "Office", mode: "insensitive" as const } },
    { source: { contains: "Subscription", mode: "insensitive" as const } },
  ],
};

async function deleteHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const access = await requireAdminPermission(request, "leads");
  if (!access.ok) return access.response;

  const result = await prisma.$transaction(async (tx) => {
    await tx.leadStageHistory.deleteMany({
      where: {
        lead: bulkLeadWhere,
      },
    });

    return tx.lead.deleteMany({
      where: bulkLeadWhere,
    });
  });

  await logActivity({
    type: "LEADS_DELETED",
    entity: "Lead",
    summary: `Deleted ${result.count} bulk order enquiries`,
    metadata: { count: result.count },
  });

  return NextResponse.json({ deleted: result.count });
}

export const DELETE = withApiErrorHandling(deleteHandler, "DELETE /api/admin/bulk-leads");
