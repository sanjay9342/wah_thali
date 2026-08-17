import { NextResponse } from "next/server";
import { getConfiguredDatabaseUrlKey, isDatabaseConfigured, prisma } from "@/lib/prisma";
import { isSupabaseConfigured } from "@/lib/supabase";

type Check = {
  ok: boolean;
  configured?: boolean;
  message: string;
};

function configured(value: string | undefined) {
  return Boolean(value?.trim());
}

function getExpectedHost() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://wahthali.in";
  try {
    return new URL(siteUrl).host;
  } catch {
    return "wahthali.in";
  }
}

async function checkDatabase(): Promise<Check> {
  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      configured: false,
      message: "Database environment variable is missing in the deployment.",
    };
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      configured: true,
      message: "Database connection is working.",
    };
  } catch (error) {
    console.error("Health check database connection failed.", error);
    return {
      ok: false,
      configured: true,
      message: "Database environment variable exists, but the app could not connect.",
    };
  }
}

export async function GET(request: Request) {
  const requestHost = new URL(request.url).host;
  const expectedHost = getExpectedHost();
  const database = await checkDatabase();
  const supabaseConfigured = isSupabaseConfigured();
  const requiredEnv = {
    NEXT_PUBLIC_SITE_URL: configured(process.env.NEXT_PUBLIC_SITE_URL),
    DATABASE_URL: configured(process.env.DATABASE_URL),
    DIRECT_URL: configured(process.env.DIRECT_URL),
    POSTGRES_PRISMA_URL: configured(process.env.POSTGRES_PRISMA_URL),
    POSTGRES_URL: configured(process.env.POSTGRES_URL),
    POSTGRES_URL_NON_POOLING: configured(process.env.POSTGRES_URL_NON_POOLING),
    SUPABASE_DB_URL: configured(process.env.SUPABASE_DB_URL),
    SUPABASE_URL: configured(process.env.SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_URL: configured(process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: configured(process.env.SUPABASE_SERVICE_ROLE_KEY),
    SUPABASE_STORAGE_BUCKET: configured(process.env.SUPABASE_STORAGE_BUCKET),
    ADMIN_MOBILES: configured(process.env.ADMIN_MOBILES),
    ADMIN_EMAILS: configured(process.env.ADMIN_EMAILS),
  };
  const paymentEnv = {
    RAZORPAY_KEY_ID: configured(process.env.RAZORPAY_KEY_ID),
    RAZORPAY_KEY_SECRET: configured(process.env.RAZORPAY_KEY_SECRET),
    RAZORPAY_WEBHOOK_SECRET: configured(process.env.RAZORPAY_WEBHOOK_SECRET),
  };
  const whatsappEnv = {
    META_WHATSAPP_PHONE_NUMBER_ID: configured(process.env.META_WHATSAPP_PHONE_NUMBER_ID),
    META_WHATSAPP_ACCESS_TOKEN: configured(process.env.META_WHATSAPP_ACCESS_TOKEN),
    META_WHATSAPP_VERIFY_TOKEN: configured(process.env.META_WHATSAPP_VERIFY_TOKEN),
  };
  const domainOk = requestHost === expectedHost || requestHost === `www.${expectedHost}` || requestHost.startsWith("localhost:");
  const ok = database.ok && supabaseConfigured && requiredEnv.NEXT_PUBLIC_SITE_URL && domainOk;

  return NextResponse.json(
    {
      ok,
      checkedAt: new Date().toISOString(),
      domain: {
        ok: domainOk,
        requestHost,
        expectedHost,
        message: domainOk ? "Request host matches configured site URL." : "Request host does not match NEXT_PUBLIC_SITE_URL.",
      },
      database,
      databaseUrlKey: getConfiguredDatabaseUrlKey(),
      supabase: {
        ok: supabaseConfigured,
        configured: supabaseConfigured,
        message: supabaseConfigured ? "Supabase server credentials are configured." : "Supabase server credentials are missing.",
      },
      requiredEnv,
      paymentEnv,
      whatsappEnv,
      webhooks: {
        razorpay: `https://${expectedHost}/api/webhooks/razorpay`,
        meta: `https://${expectedHost}/api/webhooks/meta`,
        n8n: `https://${expectedHost}/api/webhooks/n8n`,
      },
    },
    { status: ok ? 200 : 503 },
  );
}
