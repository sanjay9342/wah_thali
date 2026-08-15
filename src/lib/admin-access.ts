import "server-only";

import { Prisma } from "@prisma/client";
import { business } from "@/lib/business";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import {
  getPermissionsForRole,
  isAdminRole,
  type AdminAccessAssignment,
  type AdminAccessIdentity,
  type AdminAccessResult,
  type AdminRole,
} from "@/lib/admin-access-shared";

const adminAccessSettingKey = "adminAccessAssignments";

function normalizeMobile(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "").slice(-10);
}

function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function parseList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getBootstrapAdminMobiles() {
  return [
    ...parseList(process.env.ADMIN_MOBILES),
    ...parseList(process.env.WAH_ADMIN_MOBILES),
    business.phone,
  ].map(normalizeMobile).filter(Boolean);
}

function getBootstrapAdminEmails() {
  return [
    ...parseList(process.env.ADMIN_EMAILS),
    ...parseList(process.env.WAH_ADMIN_EMAILS),
    business.email,
    business.legalEmail,
  ].map(normalizeEmail).filter(Boolean);
}

function isAdminAssignment(value: unknown): value is AdminAccessAssignment {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<AdminAccessAssignment>;
  return typeof item.name === "string" &&
    typeof item.mobile === "string" &&
    typeof item.active === "boolean" &&
    typeof item.grantedAt === "string" &&
    isAdminRole(item.role);
}

function readAssignments(value: unknown): AdminAccessAssignment[] {
  return Array.isArray(value) ? value.filter(isAdminAssignment) : [];
}

function assignmentMatches(assignment: AdminAccessAssignment, identity: AdminAccessIdentity) {
  const mobile = normalizeMobile(identity.mobile);
  const email = normalizeEmail(identity.email);
  return Boolean(
    assignment.active &&
      ((identity.id && assignment.customerId === identity.id) ||
        (mobile && normalizeMobile(assignment.mobile) === mobile) ||
        (email && normalizeEmail(assignment.email) === email)),
  );
}

function bootstrapAssignment(identity: AdminAccessIdentity): AdminAccessAssignment | null {
  const mobile = normalizeMobile(identity.mobile);
  const email = normalizeEmail(identity.email);
  const isBootstrapAdmin =
    (mobile && getBootstrapAdminMobiles().includes(mobile)) ||
    (email && getBootstrapAdminEmails().includes(email));

  if (!isBootstrapAdmin) return null;

  return {
    customerId: identity.id,
    name: identity.name || "Wah Thali Admin",
    mobile: mobile || business.phone,
    email: email || undefined,
    role: "ADMIN",
    active: true,
    grantedAt: new Date().toISOString(),
    grantedBy: "environment",
  };
}

export async function getAdminAccessAssignments(): Promise<AdminAccessAssignment[]> {
  if (!isDatabaseConfigured()) return [];

  const row = await prisma.businessSetting.findUnique({
    where: { key: adminAccessSettingKey },
    select: { value: true },
  });

  return readAssignments(row?.value);
}

export async function saveAdminAccessAssignments(assignments: AdminAccessAssignment[]) {
  if (!isDatabaseConfigured()) return;

  await prisma.businessSetting.upsert({
    where: { key: adminAccessSettingKey },
    create: {
      key: adminAccessSettingKey,
      value: assignments as unknown as Prisma.InputJsonValue,
    },
    update: {
      value: assignments as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function getAdminAccessForIdentity(identity: AdminAccessIdentity): Promise<AdminAccessResult> {
  const bootstrap = bootstrapAssignment(identity);
  if (bootstrap) {
    return {
      allowed: true,
      role: "ADMIN",
      permissions: getPermissionsForRole("ADMIN"),
      assignment: bootstrap,
      source: "bootstrap",
    };
  }

  const assignment = (await getAdminAccessAssignments()).find((item) => assignmentMatches(item, identity));
  if (!assignment) {
    return { allowed: false, role: null, permissions: [] };
  }

  return {
    allowed: true,
    role: assignment.role,
    permissions: getPermissionsForRole(assignment.role),
    assignment,
    source: "assigned",
  };
}

export async function upsertAdminAccessAssignment({
  actor,
  target,
  role,
  active,
}: {
  actor: AdminAccessIdentity;
  target: AdminAccessIdentity;
  role: AdminRole;
  active: boolean;
}) {
  const actorAccess = await getAdminAccessForIdentity(actor);
  if (actorAccess.role !== "ADMIN") {
    throw new Error("Only admins can manage staff access.");
  }

  const mobile = normalizeMobile(target.mobile);
  if (!mobile) {
    throw new Error("A customer mobile number is required.");
  }

  const existing = await getAdminAccessAssignments();
  const nextAssignment: AdminAccessAssignment = {
    customerId: target.id,
    name: target.name || "Staff user",
    mobile,
    email: normalizeEmail(target.email) || undefined,
    role,
    active,
    grantedAt: new Date().toISOString(),
    grantedBy: actor.mobile || actor.email || actor.id,
  };

  const next = [
    nextAssignment,
    ...existing.filter((assignment) => {
      return !(
        (target.id && assignment.customerId === target.id) ||
        normalizeMobile(assignment.mobile) === mobile ||
        (target.email && normalizeEmail(assignment.email) === normalizeEmail(target.email))
      );
    }),
  ];

  await saveAdminAccessAssignments(next);
  return nextAssignment;
}
