const timelineLabels = [
  "Receiver",
  "Email",
  "Address",
  "Address type",
  "Fulfillment",
  "Pickup address",
  "Customer note",
  "Location",
  "GPS",
  "Distance",
  "ETA",
  "Coupon",
];

type TimelineEvent = {
  note?: string | null;
};

export type OrderFulfillmentDetails = {
  receiver: string;
  email: string;
  address: string;
  addressType: string;
  fulfillment: string;
  pickupAddress: string;
  customerNote: string;
  location: string;
  gps: string;
  distance: string;
  eta: string;
  coupon: string;
  isPickup: boolean;
};

export function getOrderFulfillmentDetails(timeline: TimelineEvent[] = []): OrderFulfillmentDetails {
  const notes = timeline.map((event) => event.note).filter((note): note is string => Boolean(note));
  const parts = notes.flatMap((note) => note.split("|").map((part) => part.trim()).filter(Boolean));
  const addressType = readTimelinePart(parts, "Address type") || extractTimelineValue(notes, "Address type") || "";
  const fulfillment = readTimelinePart(parts, "Fulfillment") || extractTimelineValue(notes, "Fulfillment") || "";

  return {
    receiver: readTimelinePart(parts, "Receiver") || extractTimelineValue(notes, "Receiver") || "",
    email: readTimelinePart(parts, "Email") || extractTimelineValue(notes, "Email") || "",
    address: readTimelinePart(parts, "Address") || extractTimelineValue(notes, "Address") || "",
    addressType,
    fulfillment,
    pickupAddress: readTimelinePart(parts, "Pickup address") || extractTimelineValue(notes, "Pickup address") || "",
    customerNote: readTimelinePart(parts, "Customer note") || extractTimelineValue(notes, "Customer note") || "",
    location: readTimelinePart(parts, "Location") || extractTimelineValue(notes, "Location") || "",
    gps: readTimelinePart(parts, "GPS") || extractTimelineValue(notes, "GPS") || "",
    distance: readTimelinePart(parts, "Distance") || extractTimelineValue(notes, "Distance") || "",
    eta: readTimelinePart(parts, "ETA") || extractTimelineValue(notes, "ETA") || "",
    coupon: readTimelinePart(parts, "Coupon") || extractCouponCode(notes),
    isPickup: /pickup/i.test(`${addressType} ${fulfillment}`),
  };
}

export function extractTimelineValue(notes: string[], label: string) {
  const joined = notes.join(" | ");
  const nextLabels = timelineLabels.filter((item) => item !== label).join("|");
  const pattern = new RegExp(`${label}:\\s*(.*?)(?=\\s(?:${nextLabels}):|\\sCoupon\\s|\\s\\|\\s|$)`, "i");
  return joined.match(pattern)?.[1]?.trim().replace(/[.]$/, "");
}

export function getStoredOrderChargeAmount(order: { subtotal: number; discount: number; gst: number; grandTotal: number }) {
  return Math.max(order.grandTotal - order.subtotal + order.discount - order.gst, 0);
}

export function getStoredOrderChargeLabel(isPickup: boolean) {
  return isPickup ? "Platform/packaging charges" : "Delivery/platform charges";
}

function readTimelinePart(parts: string[], label: string) {
  const prefix = `${label}:`;
  return parts.find((part) => part.toLowerCase().startsWith(prefix.toLowerCase()))?.slice(prefix.length).trim() ?? "";
}

function extractCouponCode(notes: string[]) {
  return notes.join(" | ").match(/\bCoupon\s+([A-Z0-9_-]+)\s+applied/i)?.[1] ?? "";
}
