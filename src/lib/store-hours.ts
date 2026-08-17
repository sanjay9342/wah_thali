import type { RestaurantSettings } from "@/lib/types";

const MINUTES_PER_DAY = 24 * 60;

export type OpeningHoursRange = {
  openingMinutes: number;
  closingMinutes: number;
};

export type StoreOrderingStatus = {
  unavailable: boolean;
  outsideOrderingHours: boolean;
  title: string;
  message: string;
};

export function parseOpeningHours(value: string): OpeningHoursRange | null {
  const normalized = value
    .trim()
    .replace(/[–—]/g, "-")
    .replace(/\s+to\s+/i, " - ");
  const range = normalized.split(/\s*-\s*/);
  if (range.length !== 2) return null;

  const openingMinutes = parseTimeToMinutes(range[0]);
  const closingMinutes = parseTimeToMinutes(range[1]);
  if (openingMinutes === null || closingMinutes === null) return null;

  return { openingMinutes, closingMinutes };
}

export function buildOpeningHours(openingTime: string, closingTime: string) {
  const openingMinutes = parseTimeToMinutes(openingTime);
  const closingMinutes = parseTimeToMinutes(closingTime);
  if (openingMinutes === null || closingMinutes === null) return null;

  return `${formatMinutesAsClock(openingMinutes)} - ${formatMinutesAsClock(closingMinutes)}`;
}

export function minutesToTimeInput(minutes: number) {
  const normalized = normalizeMinutes(minutes);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatMinutesAsClock(minutes: number) {
  const normalized = normalizeMinutes(minutes);
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${meridiem}`;
}

export function isOutsideOrderingHours(settings: RestaurantSettings, now = new Date()) {
  const range = parseOpeningHours(settings.openingHours);
  if (!range) return false;

  const nowMinutes = getKolkataMinutes(now);
  const lastOrderMinutes = normalizeMinutes(range.closingMinutes - settings.lastOrderBufferMinutes);

  if (range.openingMinutes < range.closingMinutes) {
    return nowMinutes < range.openingMinutes || nowMinutes >= lastOrderMinutes;
  }

  return nowMinutes >= lastOrderMinutes && nowMinutes < range.openingMinutes;
}

export function getStoreStatusMessage(settings: RestaurantSettings) {
  if (settings.storeStatusReason.trim()) return settings.storeStatusReason;
  if (settings.storeMode === "BUSY") return settings.busyMessage;
  if (settings.storeMode === "PAUSED") return settings.pausedMessage;
  if (settings.storeMode === "CLOSED") return settings.closedMessage;
  return "Restaurant is accepting orders.";
}

export function getStoreOrderingStatus(settings: RestaurantSettings, now = new Date()): StoreOrderingStatus {
  const outsideOrderingHours = isOutsideOrderingHours(settings, now);

  if (settings.storeMode === "CLOSED") {
    return {
      unavailable: true,
      outsideOrderingHours,
      title: "Restaurant closed",
      message: getStoreStatusMessage(settings),
    };
  }

  if (settings.storeMode === "PAUSED") {
    return {
      unavailable: true,
      outsideOrderingHours,
      title: "Ordering paused",
      message: getStoreStatusMessage(settings),
    };
  }

  if (outsideOrderingHours) {
    return {
      unavailable: true,
      outsideOrderingHours: true,
      title: "Restaurant closed",
      message: `Ordering is available during ${settings.openingHours}. Last orders close ${settings.lastOrderBufferMinutes} minutes before closing time.`,
    };
  }

  if (settings.storeMode === "BUSY") {
    return {
      unavailable: false,
      outsideOrderingHours: false,
      title: "Kitchen busy",
      message: getStoreStatusMessage(settings),
    };
  }

  return {
    unavailable: false,
    outsideOrderingHours: false,
    title: "Restaurant open",
    message: getStoreStatusMessage(settings),
  };
}

export function parseTimeToMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;

  return hour * 60 + minute;
}

function getKolkataMinutes(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);

  return hour * 60 + minute;
}

function normalizeMinutes(value: number) {
  return ((value % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}
