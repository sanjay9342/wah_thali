import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAccessAssignments, getAdminAccessForIdentity, upsertAdminAccessAssignment } from "@/lib/admin-access";
import { hasAdminPermission, isAdminPermission, isAdminRole } from "@/lib/admin-access-shared";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const identitySchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().optional(),
});

const updateSchema = z.object({
  actor: identitySchema,
  target: identitySchema.extend({
    name: z.string().min(1),
    mobile: z.string().min(8),
  }),
  role: z.string().refine(isAdminRole, "Invalid admin role."),
  permissions: z.array(z.string().refine(isAdminPermission, "Invalid admin permission.")).optional(),
  active: z.boolean(),
});

function identityFromSearchParams(searchParams: URLSearchParams) {
  return {
    id: searchParams.get("actorId") ?? undefined,
    name: searchParams.get("actorName") ?? undefined,
    mobile: searchParams.get("actorMobile") ?? undefined,
    email: searchParams.get("actorEmail") ?? undefined,
  };
}

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const actor = identityFromSearchParams(searchParams);
  const query = searchParams.get("q")?.trim() ?? "";
  const mobileQuery = query.replace(/\D/g, "").slice(-10);
  const actorAccess = await getAdminAccessForIdentity(actor);
  if (!hasAdminPermission(actorAccess.permissions, "access")) {
    return NextResponse.json({ error: "Only staff users with Staff Access permission can view this page.", access: actorAccess }, { status: 403 });
  }

  const assignments = await getAdminAccessAssignments();
  const customers = query.length >= 2
    ? await prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { mobile: { contains: mobileQuery || query } },
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 25,
        select: {
          id: true,
          name: true,
          mobile: true,
          email: true,
        },
      })
    : [];

  return NextResponse.json({ assignments, customers, access: actorAccess, queryRequired: query.length < 2 });
}

export async function PATCH(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid access update.", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const assignment = await upsertAdminAccessAssignment(parsed.data);
    return NextResponse.json({ assignment });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update staff access." }, { status: 403 });
  }
}
