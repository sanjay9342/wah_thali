import { describe, expect, it } from "vitest";
import { buildOpeningHours, getStoreOrderingStatus, parseOpeningHours } from "./store-hours";
import type { RestaurantSettings } from "./types";

const baseSettings: RestaurantSettings = {
  gstRate: 0.05,
  packagingFee: 0,
  deliveryFee: 40,
  deliveryFeeMode: "FLAT",
  deliveryFeePercent: 5,
  deliveryDistanceSlabs: [
    { upToKm: 1, fee: 20 },
    { upToKm: 2, fee: 30 },
  ],
  freeDeliveryThreshold: 499,
  minimumOrder: 149,
  serviceablePins: ["700001"],
  locationRestrictionEnabled: false,
  kitchenAddress: "Kitchen",
  kitchenLatitude: "",
  kitchenLongitude: "",
  deliveryRadiusKm: 5,
  openingHours: "11:30 AM - 10:00 PM",
  supportPhone: "7001323730",
  whatsappNumber: "917001323730",
  storeMode: "OPEN",
  storeStatusReason: "",
  busyMessage: "Kitchen busy",
  pausedMessage: "Ordering paused",
  closedMessage: "Restaurant closed",
  autoAcceptOrders: false,
  requireDeclineReason: true,
  maxOrdersPerSlot: 25,
  defaultPrepMinutes: 25,
  rushPrepBufferMinutes: 10,
  lastOrderBufferMinutes: 30,
  codEnabled: true,
  onlinePaymentsEnabled: false,
  lowStockAlertThreshold: 5,
  newOrderSoundEnabled: true,
  newOrderSound: "classic-bell",
  whatsappOrderAlerts: true,
  ownerWhatsAppOrderAlerts: true,
  adminDailyDigestTime: "21:00",
};

describe("store hours", () => {
  it("normalizes admin time inputs for display", () => {
    expect(buildOpeningHours("09:05", "23:30")).toBe("9:05 AM - 11:30 PM");
    expect(parseOpeningHours("11:30 AM - 10:00 PM")).toEqual({
      openingMinutes: 690,
      closingMinutes: 1320,
    });
  });

  it("closes before opening and during the last order buffer", () => {
    expect(getStoreOrderingStatus(baseSettings, new Date("2026-01-01T07:00:00.000Z")).unavailable).toBe(false);
    expect(getStoreOrderingStatus(baseSettings, new Date("2026-01-01T05:00:00.000Z")).unavailable).toBe(true);
    expect(getStoreOrderingStatus(baseSettings, new Date("2026-01-01T16:00:00.000Z")).unavailable).toBe(true);
  });

  it("supports overnight opening hours", () => {
    const overnightSettings = {
      ...baseSettings,
      openingHours: "6:00 PM - 2:00 AM",
    };

    expect(getStoreOrderingStatus(overnightSettings, new Date("2026-01-01T18:30:00.000Z")).unavailable).toBe(false);
    expect(getStoreOrderingStatus(overnightSettings, new Date("2026-01-01T20:00:00.000Z")).unavailable).toBe(true);
    expect(getStoreOrderingStatus(overnightSettings, new Date("2026-01-01T08:00:00.000Z")).unavailable).toBe(true);
  });
});
