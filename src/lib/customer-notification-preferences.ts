import "server-only";

import { Prisma } from "@prisma/client";
import { normalizeMobile } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export type CustomerNotificationPreferences = {
  appMuted: boolean;
  whatsappMuted: boolean;
};

export const defaultCustomerNotificationPreferences: CustomerNotificationPreferences = {
  appMuted: false,
  whatsappMuted: false,
};

const preferencesEventType = "CUSTOMER_NOTIFICATION_PREFERENCES";

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readMetadataPreferences(metadata: Prisma.JsonValue): CustomerNotificationPreferences {
  const source = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {};

  return {
    appMuted: readBoolean(source.appMuted, defaultCustomerNotificationPreferences.appMuted),
    whatsappMuted: readBoolean(source.whatsappMuted, defaultCustomerNotificationPreferences.whatsappMuted),
  };
}

export async function getCustomerNotificationPreferences(mobileInput: string): Promise<CustomerNotificationPreferences> {
  const mobile = normalizeMobile(mobileInput);
  if (!mobile) return defaultCustomerNotificationPreferences;

  const event = await prisma.activityEvent.findFirst({
    where: {
      type: preferencesEventType,
      actor: mobile,
    },
    orderBy: { createdAt: "desc" },
    select: { metadata: true },
  });

  return event ? readMetadataPreferences(event.metadata) : defaultCustomerNotificationPreferences;
}

export async function setCustomerNotificationPreferences(
  mobileInput: string,
  preferences: CustomerNotificationPreferences,
) {
  const mobile = normalizeMobile(mobileInput);
  return prisma.activityEvent.create({
    data: {
      type: preferencesEventType,
      actor: mobile,
      entity: "Customer",
      entityId: mobile,
      summary: "Customer notification preferences updated",
      metadata: preferences as Prisma.InputJsonValue,
    },
  });
}
