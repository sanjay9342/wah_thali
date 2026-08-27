import "server-only";

import { NextResponse } from "next/server";
import { getAdminAccessForIdentity } from "@/lib/admin-access";
import { hasAdminPermission, type AdminPermission } from "@/lib/admin-access-shared";

function readHeader(request: Request, name: string) {
  return request.headers.get(name)?.trim() || undefined;
}

export async function requireAdminPermission(request: Request, permission: AdminPermission) {
  const identity = {
    id: readHeader(request, "x-wah-admin-id"),
    name: readHeader(request, "x-wah-admin-name"),
    mobile: readHeader(request, "x-wah-admin-mobile"),
    email: readHeader(request, "x-wah-admin-email"),
  };
  const access = await getAdminAccessForIdentity(identity);

  if (!access.allowed || !hasAdminPermission(access.permissions, permission)) {
    return {
      ok: false as const,
      access,
      response: NextResponse.json(
        { error: "You do not have permission for this admin action.", access },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, access };
}

export async function requireAnyAdminPermission(request: Request, permissions: AdminPermission[]) {
  const identity = {
    id: readHeader(request, "x-wah-admin-id"),
    name: readHeader(request, "x-wah-admin-name"),
    mobile: readHeader(request, "x-wah-admin-mobile"),
    email: readHeader(request, "x-wah-admin-email"),
  };
  const access = await getAdminAccessForIdentity(identity);

  if (!access.allowed || !permissions.some((permission) => hasAdminPermission(access.permissions, permission))) {
    return {
      ok: false as const,
      access,
      response: NextResponse.json(
        { error: "You do not have permission for this admin action.", access },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, access };
}
