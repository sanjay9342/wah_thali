import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAccessAssignments, getAdminAccessForIdentity, upsertAdminAccessAssignment } from "@/lib/admin-access";
import { isAdminRole } from "@/lib/admin-access-shared";
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
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const actor = identityFromSearchParams(searchParams);
  const actorAccess = await getAdminAccessForIdentity(actor);
  if (actorAccess.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can view staff access.", access: actorAccess }, { status: 403 });
  }

  const [assignments, customers] = await Promise.all([
    getAdminAccessAssignments(),
    prisma.customer.findMany({
      orderBy: { updatedAt: "desc" },
      take: 250,
      select: {
        id: true,
        name: true,
        mobile: true,
        email: true,
      },
    }),
  ]);

  return NextResponse.json({ assignments, customers, access: actorAccess });
}

export async function PATCH(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
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
