import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAccessForIdentity } from "@/lib/admin-access";

const identitySchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().optional(),
});

async function postHandler(request: Request) {
  const parsed = identitySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid account session." }, { status: 400 });
  }

  const access = await getAdminAccessForIdentity(parsed.data);
  return NextResponse.json({ access });
}

export const POST = withApiErrorHandling(postHandler, "POST /api/admin/access/me");
