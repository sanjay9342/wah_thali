import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const databaseUrlKeys = [
  "DATABASE_URL",
  "DIRECT_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "SUPABASE_DB_URL",
] as const;

function cleanDatabaseUrl(raw: string) {
  return raw.trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
}

function getDatabaseUrl() {
  for (const key of databaseUrlKeys) {
    const raw = process.env[key]?.trim();
    if (raw) return cleanDatabaseUrl(raw);
  }

  return "postgresql://postgres:postgres@localhost:5432/wah_thali";
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: getDatabaseUrl(),
    }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export function isDatabaseConfigured() {
  return databaseUrlKeys.some((key) => Boolean(process.env[key]?.trim()));
}

export function getConfiguredDatabaseUrlKey() {
  return databaseUrlKeys.find((key) => Boolean(process.env[key]?.trim())) ?? null;
}
