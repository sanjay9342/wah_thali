import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeMobile } from "@/lib/customer-auth";
import { getAdminAccessForIdentity } from "@/lib/admin-access";
import { hasAdminPermission, type AdminPermission } from "@/lib/admin-access-shared";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const sessionCookie = "wah_thali_customer_mobile";

export async function requireAdminPagePermission(permission: AdminPermission, pathname: string) {
  const cookieStore = await cookies();
  const mobile = normalizeMobile(cookieStore.get(sessionCookie)?.value ?? "");

  if (!mobile) {
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  const customer = isDatabaseConfigured()
    ? await prisma.customer.findUnique({
        where: { mobile },
        select: { id: true, name: true, mobile: true, email: true },
      })
    : null;

  if (!customer) {
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  const access = await getAdminAccessForIdentity({
    id: customer.id,
    name: customer.name,
    mobile: customer.mobile,
    email: customer.email ?? undefined,
  });
  if (!access.allowed || !access.role) {
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  if (!hasAdminPermission(access.permissions, permission)) {
    if (hasAdminPermission(access.permissions, "orders")) {
      redirect("/admin/orders");
    }
    redirect("/");
  }

  return access;
}
