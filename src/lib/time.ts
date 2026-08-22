export const IST_TIME_ZONE = "Asia/Kolkata";

type DateInput = string | number | Date;

const istDatePartsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: IST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatIstDateTime(value: DateInput) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

export function formatIstDateTimeShort(value: DateInput) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

export function formatIstDate(value: DateInput, month: "short" | "2-digit" = "2-digit") {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month,
    year: month === "short" ? undefined : "numeric",
  }).format(new Date(value));
}

export function formatIstTime(value: DateInput, includeSeconds = false) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
    hour12: true,
  }).format(new Date(value));
}

export function getIstDateInputValue(value: DateInput = new Date(), offsetDays = 0) {
  const date = new Date(new Date(value).getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = istDatePartsFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function parseIstDateInput(value: string, boundary: "start" | "end" = "start") {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const start = new Date(Date.UTC(year, month - 1, day, -5, -30, 0, 0));
  if (boundary === "start") return start;

  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function getIstDayRangeUtc(value: DateInput = new Date()) {
  const dateInput = getIstDateInputValue(value);
  const start = parseIstDateInput(dateInput, "start") ?? new Date(value);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
