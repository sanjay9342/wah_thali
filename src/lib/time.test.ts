import { describe, expect, it } from "vitest";
import { formatIstDateTime, getIstDateInputValue, getIstDayRangeUtc, parseIstDateInput } from "./time";

describe("IST time helpers", () => {
  it("formats UTC order timestamps in India time", () => {
    expect(formatIstDateTime("2026-08-22T07:00:58.000Z")).toContain("12:30:58 pm");
  });

  it("keeps date input values on the IST calendar day", () => {
    expect(getIstDateInputValue("2026-08-21T20:00:00.000Z")).toBe("2026-08-22");
  });

  it("parses coupon dates as full IST days", () => {
    expect(parseIstDateInput("2026-08-22", "start")?.toISOString()).toBe("2026-08-21T18:30:00.000Z");
    expect(parseIstDateInput("2026-08-22", "end")?.toISOString()).toBe("2026-08-22T18:29:59.999Z");
  });

  it("builds an IST business-day range in UTC", () => {
    const range = getIstDayRangeUtc("2026-08-22T07:00:00.000Z");
    expect(range.start.toISOString()).toBe("2026-08-21T18:30:00.000Z");
    expect(range.end.toISOString()).toBe("2026-08-22T18:30:00.000Z");
  });
});
