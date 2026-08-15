export const adminRoles = ["ADMIN", "MANAGER", "STAFF"] as const;

export type AdminRole = (typeof adminRoles)[number];

export type AdminPermission =
  | "dashboard"
  | "orders"
  | "inventory"
  | "categories"
  | "coupons"
  | "customers"
  | "settings"
  | "access";

export type AdminAccessIdentity = {
  id?: string;
  name?: string;
  mobile?: string;
  email?: string;
};

export type AdminAccessAssignment = Required<Pick<AdminAccessIdentity, "name" | "mobile">> & {
  customerId?: string;
  email?: string;
  role: AdminRole;
  active: boolean;
  grantedAt: string;
  grantedBy?: string;
};

export type AdminAccessResult = {
  allowed: boolean;
  role: AdminRole | null;
  permissions: AdminPermission[];
  assignment?: AdminAccessAssignment;
  source?: "bootstrap" | "assigned";
};

export const roleLabels: Record<AdminRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  STAFF: "Staff",
};

export const roleDescriptions: Record<AdminRole, string> = {
  ADMIN: "Full access, including settings and staff role management.",
  MANAGER: "Operational access for orders, products, coupons, customers, and categories.",
  STAFF: "Kitchen and inventory access for daily restaurant work.",
};

export const rolePermissions: Record<AdminRole, AdminPermission[]> = {
  ADMIN: ["dashboard", "orders", "inventory", "categories", "coupons", "customers", "settings", "access"],
  MANAGER: ["dashboard", "orders", "inventory", "categories", "coupons", "customers"],
  STAFF: ["dashboard", "orders", "inventory"],
};

export function getPermissionsForRole(role: AdminRole | null | undefined) {
  return role ? rolePermissions[role] : [];
}

export function hasAdminPermission(role: AdminRole | null | undefined, permission: AdminPermission) {
  return getPermissionsForRole(role).includes(permission);
}

export function getAdminPathPermission(pathname: string): AdminPermission {
  if (pathname.startsWith("/admin/orders")) return "orders";
  if (pathname.startsWith("/admin/inventory")) return "inventory";
  if (pathname.startsWith("/admin/categories")) return "categories";
  if (pathname.startsWith("/admin/coupons")) return "coupons";
  if (pathname.startsWith("/admin/customers")) return "customers";
  if (pathname.startsWith("/admin/settings")) return "settings";
  if (pathname.startsWith("/admin/access")) return "access";
  return "dashboard";
}

export function canAccessAdminPath(role: AdminRole | null | undefined, pathname: string) {
  return hasAdminPermission(role, getAdminPathPermission(pathname));
}

export function isAdminRole(value: unknown): value is AdminRole {
  return adminRoles.includes(value as AdminRole);
}
