import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { getConfiguredDatabaseUrlKey, isDatabaseConfigured, prisma } from "@/lib/prisma";
import { hasServerEnv, readServerEnv } from "@/lib/server-env";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getWhatsAppNotificationConfigStatus, getWhatsAppOtpConfigStatus } from "@/lib/whatsapp";

type Check = {
  ok: boolean;
  configured?: boolean;
  code?: string;
  message: string;
};

function envConfigured(key: string, aliases: string[] = []) {
  return hasServerEnv(key, aliases);
}

function getExpectedHost() {
  const siteUrl = readServerEnv("NEXT_PUBLIC_SITE_URL") || "https://wahthali.in";
  try {
    return new URL(siteUrl).host;
  } catch {
    return "wahthali.in";
  }
}

function getRequestHost(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  return forwardedHost?.split(",")[0]?.trim() || new URL(request.url).host;
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
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : undefined;
    const errorMessage = error instanceof Error ? error.message : "";
    return {
      ok: false,
      configured: true,
      code,
      message: errorMessage
        ? `Database environment variable exists, but the app could not connect: ${errorMessage}`
        : "Database environment variable exists, but the app could not connect.",
    };
  }
}

async function getHandler(request: Request) {
  const requestHost = getRequestHost(request);
  const expectedHost = getExpectedHost();
  const database = await checkDatabase();
  const supabaseConfigured = isSupabaseConfigured();
  const whatsAppStatus = getWhatsAppOtpConfigStatus();
  const whatsAppNotificationStatus = getWhatsAppNotificationConfigStatus();
  const requiredEnv = {
    NEXT_PUBLIC_SITE_URL: envConfigured("NEXT_PUBLIC_SITE_URL"),
    DATABASE_URL: envConfigured("DATABASE_URL"),
    DIRECT_URL: envConfigured("DIRECT_URL"),
    POSTGRES_PRISMA_URL: envConfigured("POSTGRES_PRISMA_URL"),
    POSTGRES_URL: envConfigured("POSTGRES_URL"),
    POSTGRES_URL_NON_POOLING: envConfigured("POSTGRES_URL_NON_POOLING"),
    SUPABASE_DB_URL: envConfigured("SUPABASE_DB_URL"),
    SUPABASE_URL: envConfigured("SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_URL: envConfigured("NEXT_PUBLIC_SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: envConfigured("SUPABASE_SERVICE_ROLE_KEY"),
    SUPABASE_STORAGE_BUCKET: envConfigured("SUPABASE_STORAGE_BUCKET"),
    ADMIN_MOBILES: envConfigured("ADMIN_MOBILES"),
    ADMIN_EMAILS: envConfigured("ADMIN_EMAILS"),
    ADMIN_BOOTSTRAP_PASSWORD: envConfigured("ADMIN_BOOTSTRAP_PASSWORD"),
  };
  const paymentEnv = {
    RAZORPAY_KEY_ID: envConfigured("RAZORPAY_KEY_ID"),
    RAZORPAY_KEY_SECRET: envConfigured("RAZORPAY_KEY_SECRET"),
    RAZORPAY_WEBHOOK_SECRET: envConfigured("RAZORPAY_WEBHOOK_SECRET"),
  };
  const whatsappEnv = {
    META_WHATSAPP_PHONE_NUMBER_ID: envConfigured("META_WHATSAPP_PHONE_NUMBER_ID", ["WHATSAPP_PHONE_NUMBER_ID", "META_PHONE_NUMBER_ID"]),
    META_WHATSAPP_ACCESS_TOKEN: envConfigured("META_WHATSAPP_ACCESS_TOKEN"),
    META_WHATSAPP_VERIFY_TOKEN: envConfigured("META_WHATSAPP_VERIFY_TOKEN"),
    META_WHATSAPP_OTP_TEMPLATE_NAME: envConfigured("META_WHATSAPP_OTP_TEMPLATE_NAME", ["WHATSAPP_OTP_TEMPLATE_NAME", "META_WHATSAPP_TEMPLATE_NAME"]),
    META_WHATSAPP_LANGUAGE_CODE: envConfigured("META_WHATSAPP_LANGUAGE_CODE"),
    META_WHATSAPP_DEFAULT_COUNTRY_CODE: envConfigured("META_WHATSAPP_DEFAULT_COUNTRY_CODE", ["WHATSAPP_DEFAULT_COUNTRY_CODE"]),
    META_GRAPH_API_VERSION: envConfigured("META_GRAPH_API_VERSION"),
    META_WHATSAPP_OTP_BUTTON_SUB_TYPE: envConfigured("META_WHATSAPP_OTP_BUTTON_SUB_TYPE", ["WHATSAPP_OTP_BUTTON_SUB_TYPE"]),
    META_WHATSAPP_OTP_BUTTON_INDEX: envConfigured("META_WHATSAPP_OTP_BUTTON_INDEX", ["WHATSAPP_OTP_BUTTON_INDEX"]),
    META_WHATSAPP_ORDER_STATUS_TEMPLATE_NAME: envConfigured("META_WHATSAPP_ORDER_STATUS_TEMPLATE_NAME"),
    META_WHATSAPP_ORDER_NEW_TEMPLATE_NAME: envConfigured("META_WHATSAPP_ORDER_NEW_TEMPLATE_NAME"),
    META_WHATSAPP_ORDER_DELIVERED_TEMPLATE_NAME: envConfigured("META_WHATSAPP_ORDER_DELIVERED_TEMPLATE_NAME"),
    META_WHATSAPP_ORDER_DECLINED_TEMPLATE_NAME: envConfigured("META_WHATSAPP_ORDER_DECLINED_TEMPLATE_NAME"),
    META_WHATSAPP_ORDER_CANCELLED_TEMPLATE_NAME: envConfigured("META_WHATSAPP_ORDER_CANCELLED_TEMPLATE_NAME"),
    META_WHATSAPP_COUPON_TEMPLATE_NAME: envConfigured("META_WHATSAPP_COUPON_TEMPLATE_NAME", ["META_WHATSAPP_OFFER_TEMPLATE_NAME"]),
    META_WHATSAPP_FREEFORM_NOTIFICATIONS: envConfigured("META_WHATSAPP_FREEFORM_NOTIFICATIONS"),
  };
  const domainOk = requestHost === expectedHost || requestHost === `www.${expectedHost}` || requestHost.startsWith("localhost:");
  const ok = database.ok && supabaseConfigured && requiredEnv.NEXT_PUBLIC_SITE_URL && domainOk && whatsAppStatus.configured;

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
      whatsapp: {
        ok: whatsAppStatus.configured,
        configured: whatsAppStatus.configured,
        missing: whatsAppStatus.missing,
        message: whatsAppStatus.configured
          ? "WhatsApp OTP credentials are configured."
          : "WhatsApp OTP credentials are missing in the deployment.",
      },
      whatsappNotifications: {
        ok: whatsAppNotificationStatus.configured,
        orderNotificationsReady: whatsAppNotificationStatus.orderNotificationsReady,
        couponNotificationsReady: whatsAppNotificationStatus.couponNotificationsReady,
        freeformEnabled: whatsAppNotificationStatus.freeformEnabled,
        orderTemplates: {
          status: whatsAppNotificationStatus.orderStatusTemplateConfigured,
          placed: whatsAppNotificationStatus.orderPlacedTemplateConfigured,
          delivered: whatsAppNotificationStatus.orderDeliveredTemplateConfigured,
          declined: whatsAppNotificationStatus.orderDeclinedTemplateConfigured,
          cancelled: whatsAppNotificationStatus.orderCancelledTemplateConfigured,
        },
        missing: whatsAppNotificationStatus.missing,
        message: whatsAppNotificationStatus.configured
          ? "WhatsApp customer notification credentials are configured."
          : "WhatsApp customer notifications need an approved order/coupon template or META_WHATSAPP_FREEFORM_NOTIFICATIONS=true.",
      },
      webhooks: {
        razorpay: `https://${expectedHost}/api/webhooks/razorpay`,
        meta: `https://${expectedHost}/api/webhooks/meta`,
        n8n: `https://${expectedHost}/api/webhooks/n8n`,
      },
    },
    { status: ok ? 200 : 503 },
  );
}

export const GET = withApiErrorHandling(getHandler, "GET /api/health");
