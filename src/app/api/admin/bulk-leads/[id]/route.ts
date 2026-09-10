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

async function deleteHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const access = await requireAdminPermission(request, "leads");
  if (!access.ok) return access.response;

  const { id } = await params;
  const lead = await prisma.lead.findFirstOrThrow({
    where: { id, ...bulkLeadWhere },
    select: { id: true, name: true, phone: true, source: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.leadStageHistory.deleteMany({ where: { leadId: id } });
    await tx.lead.delete({ where: { id } });
  });

  await logActivity({
    type: "LEAD_DELETED",
    actor: lead.phone,
    entity: "Lead",
    entityId: lead.id,
    summary: `Deleted bulk enquiry for ${lead.name}`,
    metadata: { source: lead.source },
  });

  return NextResponse.json({ deleted: true, lead });
}

export const DELETE = withApiErrorHandling(deleteHandler, "DELETE /api/admin/bulk-leads/[id]");
