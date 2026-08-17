import { config } from "dotenv";

import { defineConfig } from "prisma/config";

config({ path: ".env.local" });
config();

const databaseUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL ??
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@localhost:5432/wah_thali";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    url: databaseUrl,
  },
});
