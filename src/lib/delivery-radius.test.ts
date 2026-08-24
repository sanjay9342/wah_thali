import { describe, expect, it } from "vitest";
import { getDeliveryCoverage } from "./delivery-radius";

const settings = {
  serviceablePins: [],
  locationRestrictionEnabled: true,
  kitchenLatitude: "22.514805",
  kitchenLongitude: "88.398226",
  deliveryRadiusKm: 5,
  deliveryFeeMode: "FLAT" as const,
};

describe("delivery radius", () => {
  it("allows locations inside the configured radius", () => {
    const result = getDeliveryCoverage({
      latitude: "22.516000",
      longitude: "88.400000",
    }, settings);

    expect(result.serviceable).toBe(true);
    expect(result.distanceKm).toBeLessThan(1);
  });

  it("blocks locations outside the configured radius", () => {
    const result = getDeliveryCoverage({
      latitude: "22.572646",
      longitude: "88.363895",
    }, settings);

    expect(result.serviceable).toBe(false);
    expect(result.needsLocation).toBe(false);
  });

  it("asks for current location when coordinates are missing", () => {
    const result = getDeliveryCoverage({}, settings);

    expect(result.serviceable).toBe(false);
    expect(result.needsLocation).toBe(true);
  });
});
