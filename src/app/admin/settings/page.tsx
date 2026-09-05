import { AdminSettingsClient } from "@/components/admin-settings-client";
import { requireAdminPagePermission } from "@/lib/admin-page-auth";
import { defaultHomeSlides, getBusinessSettingsFromDb, getCategoryOptionsFromDb, getHomeDishCategoriesFromDb } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import type { HomeSlide } from "@/lib/types";

export const dynamic = "force-dynamic";

function isHomeSlides(value: unknown): value is HomeSlide[] {
  return Array.isArray(value) && value.every((slide) => {
    if (!slide || typeof slide !== "object") return false;
    const item = slide as Record<string, unknown>;
    return ["id", "eyebrow", "title", "body", "code", "image"].every((key) => typeof item[key] === "string") &&
      (item.desktopImage === undefined || typeof item.desktopImage === "string") &&
      (item.mobileImage === undefined || typeof item.mobileImage === "string") &&
      (item.targetCategory === undefined || typeof item.targetCategory === "string");
  });
}

export default async function AdminSettingsPage() {
  await requireAdminPagePermission("settings", "/admin/settings");
  const [settings, categoryOptions, homeDishCategories] = await Promise.all([
    getBusinessSettingsFromDb(),
    getCategoryOptionsFromDb(),
    getHomeDishCategoriesFromDb(),
  ]);
  const mainCategories = categoryOptions
    .filter((category) => category.visible && !category.parentId)
    .map((category) => category.name);

  if (!isDatabaseConfigured()) {
    return <AdminSettingsClient initialSettings={settings} initialSlides={defaultHomeSlides} initialCategories={mainCategories} initialHomeDishCategories={homeDishCategories} />;
  }

  let slides = defaultHomeSlides;
  let advanced = {};

  try {
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
    slides = isHomeSlides(slidesSetting?.value) ? slidesSetting.value : defaultHomeSlides;
    advanced = Object.fromEntries(advancedRows.map((row) => [row.key, row.value]));
  } catch (error) {
    console.error("Admin settings read failed. Falling back to local admin settings.", error);
  }

  return (
    <AdminSettingsClient
      initialSettings={settings}
      initialAdvanced={advanced}
      initialSlides={slides}
      initialCategories={mainCategories}
      initialHomeDishCategories={homeDishCategories}
    />
  );
}
