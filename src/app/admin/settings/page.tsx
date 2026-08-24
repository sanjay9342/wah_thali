import { AdminSettingsClient } from "@/components/admin-settings-client";
import { requireAdminPagePermission } from "@/lib/admin-page-auth";
import { defaultHomeSlides, getBusinessSettingsFromDb, getCategoriesFromDb, getHomeDishCategoriesFromDb } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import type { HomeSlide } from "@/lib/types";

export const dynamic = "force-dynamic";

function isHomeSlides(value: unknown): value is HomeSlide[] {
  return Array.isArray(value) && value.every((slide) => {
    if (!slide || typeof slide !== "object") return false;
    const item = slide as Record<string, unknown>;
    return ["id", "eyebrow", "title", "body", "code", "image"].every((key) => typeof item[key] === "string") &&
      (item.targetCategory === undefined || typeof item.targetCategory === "string");
  });
}

export default async function AdminSettingsPage() {
  await requireAdminPagePermission("settings", "/admin/settings");
  const [settings, categories, homeDishCategories] = await Promise.all([
    getBusinessSettingsFromDb(),
    getCategoriesFromDb(),
    getHomeDishCategoriesFromDb(),
  ]);

  if (!isDatabaseConfigured()) {
    return <AdminSettingsClient initialSettings={settings} initialSlides={defaultHomeSlides} initialCategories={categories} initialHomeDishCategories={homeDishCategories} />;
  }

  const [slidesSetting, advancedRows] = await Promise.all([
    prisma.businessSetting.findUnique({ where: { key: "homeSlides" } }),
    prisma.businessSetting.findMany({
      where: {
        key: {
          in: [
            "storeMode",
            "storeStatusReason",
            "busyMessage",
            "pausedMessage",
            "closedMessage",
            "autoAcceptOrders",
            "requireDeclineReason",
            "maxOrdersPerSlot",
            "defaultPrepMinutes",
            "rushPrepBufferMinutes",
            "lastOrderBufferMinutes",
            "codEnabled",
            "onlinePaymentsEnabled",
            "lowStockAlertThreshold",
            "newOrderSoundEnabled",
            "newOrderSound",
            "whatsappOrderAlerts",
            "ownerWhatsAppOrderAlerts",
            "adminDailyDigestTime",
          ],
        },
      },
    }),
  ]);
  const slides = isHomeSlides(slidesSetting?.value) ? slidesSetting.value : defaultHomeSlides;
  const advanced = Object.fromEntries(advancedRows.map((row) => [row.key, row.value]));

  return (
    <AdminSettingsClient
      initialSettings={settings}
      initialAdvanced={advanced}
      initialSlides={slides}
      initialCategories={categories}
      initialHomeDishCategories={homeDishCategories}
    />
  );
}
