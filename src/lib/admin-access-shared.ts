export const adminRoles = ["ADMIN", "MANAGER", "STAFF"] as const;

export type AdminRole = (typeof adminRoles)[number];

export type AdminPermission =
  | "dashboard"
  | "orders"
  | "inventory"
  | "categories"
  | "coupons"
  | "customers"
  | "leads"
  | "reports"
  | "settings"
  | "access";

export const adminPermissions = [
  "dashboard",
  "orders",
  "inventory",
  "categories",
  "coupons",
  "customers",
  "leads",
  "reports",
  "settings",
  "access",
] as const satisfies readonly AdminPermission[];

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
  permissions?: AdminPermission[];
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
  MANAGER: "Operational access for daily menu, orders, coupons, customers, reports, and settings.",
  STAFF: "Limited access for selected admin pages. Starts with orders only.",
};

export const permissionLabels: Record<AdminPermission, string> = {
  dashboard: "Dashboard",
  orders: "Orders",
  inventory: "Inventory",
  categories: "Categories",
  coupons: "Coupons",
  customers: "Customers",
  leads: "Bulk Leads",
  reports: "Reports",
  settings: "Settings",
  access: "Staff Access",
};

export const permissionDescriptions: Record<AdminPermission, string> = {
  dashboard: "View admin home and quick numbers.",
  orders: "Accept, prepare, dispatch, cancel, and refund orders.",
  inventory: "Create and update dishes, pricing, stock, variants, and addons.",
  categories: "Create categories, images, offers, visibility, and display order.",
  coupons: "Create, update, notify, and disable coupon offers.",
  customers: "View customer accounts, tags, points, and order history.",
  leads: "View bulk-order enquiry forms and notification settings.",
  reports: "Open sales, tax, and performance reports.",
  settings: "Update business, checkout, store, sound, payment, and WhatsApp settings.",
  access: "Grant, edit, or disable staff roles and privileges.",
};

export const rolePermissions: Record<AdminRole, AdminPermission[]> = {
  ADMIN: ["dashboard", "orders", "inventory", "categories", "coupons", "customers", "leads", "reports", "settings", "access"],
  MANAGER: ["dashboard", "orders", "inventory", "categories", "coupons", "customers", "leads", "reports", "settings"],
  STAFF: ["orders"],
};

export function getPermissionsForRole(role: AdminRole | null | undefined) {
  return role ? rolePermissions[role] : [];
}

export function isAdminPermission(value: unknown): value is AdminPermission {
  return adminPermissions.includes(value as AdminPermission);
}

export function normalizeAdminPermissions(value: unknown, fallbackRole?: AdminRole | null) {
  const fallback = fallbackRole ? getPermissionsForRole(fallbackRole) : [];
  if (!Array.isArray(value)) return fallback;
  const unique = Array.from(new Set(value.filter(isAdminPermission)));
  return unique.length ? unique : fallback;
}

export function getPermissionsForAssignment(assignment: Pick<AdminAccessAssignment, "role" | "permissions">) {
  return normalizeAdminPermissions(assignment.permissions, assignment.role);
}

export function hasAdminPermission(access: AdminRole | AdminPermission[] | null | undefined, permission: AdminPermission) {
  const permissions = Array.isArray(access) ? access : getPermissionsForRole(access);
  return permissions.includes(permission);
}

export function getAdminPathPermission(pathname: string): AdminPermission {
  if (pathname.startsWith("/admin/orders")) return "orders";
  if (pathname.startsWith("/admin/inventory")) return "inventory";
  if (pathname.startsWith("/admin/categories")) return "categories";
  if (pathname.startsWith("/admin/coupons")) return "coupons";
  if (pathname.startsWith("/admin/customers")) return "customers";
  if (pathname.startsWith("/admin/bulk-leads")) return "leads";
  if (pathname.startsWith("/admin/reports")) return "reports";
  if (pathname.startsWith("/admin/settings")) return "settings";
  if (pathname.startsWith("/admin/access")) return "access";
  return "dashboard";
}

export function canAccessAdminPath(role: AdminRole | null | undefined, pathname: string) {
  return hasAdminPermission(role, getAdminPathPermission(pathname));
}

export function canPermissionsAccessAdminPath(permissions: AdminPermission[], pathname: string) {
  return hasAdminPermission(permissions, getAdminPathPermission(pathname));
}

export function isAdminRole(value: unknown): value is AdminRole {
  return adminRoles.includes(value as AdminRole);
}
