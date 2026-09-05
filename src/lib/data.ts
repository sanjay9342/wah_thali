import type { BusinessSettings, Coupon, Product } from "./types";
import { rewardCoupons } from "@/lib/rewards";

export const settings: BusinessSettings = {
  gstRate: 0.05,
  packagingFee: 0,
  deliveryFee: 40,
  deliveryFeeMode: "FLAT",
  deliveryFeePercent: 5,
  deliveryDistanceSlabs: [
    { upToKm: 1, fee: 20 },
    { upToKm: 2, fee: 30 },
    { upToKm: 3, fee: 40 },
    { upToKm: 4, fee: 50 },
    { upToKm: 5, fee: 60 },
  ],
  freeDeliveryThreshold: 499,
  minimumOrder: 149,
  serviceablePins: ["700001", "700016", "700019", "700029", "700091"],
  locationRestrictionEnabled: false,
  kitchenAddress: "248/1 Rajdanga Main Road, Kasba, Kolkata",
  kitchenLatitude: "22.514805",
  kitchenLongitude: "88.398226",
  deliveryRadiusKm: 5,
  openingHours: "11:30 AM - 10:00 PM",
  supportPhone: "7001323730",
  whatsappNumber: "917001323730",
  leadWhatsAppNumber: "917001323730",
};

export const categories = [
];

export const products: Product[] = [
];

export const coupons: Coupon[] = [
  ...rewardCoupons,
  {
    code: "PARTY",
    label: "Flat 50% off",
    type: "PERCENT",
    value: 50,
    minOrder: 249,
    maxDiscount: 120,
  },
  { code: "FREEDEL", label: "Free delivery offer", type: "FIXED", value: 40, minOrder: 199 },
  {
    code: "YUMMY",
    label: "30% off selected orders",
    type: "PERCENT",
    value: 30,
    minOrder: 199,
    maxDiscount: 80,
  },
  { code: "WAH50", label: "Flat Rs 50 off", type: "FIXED", value: 50, minOrder: 299 },
  {
    code: "FAMILY10",
    label: "10% off family orders",
    type: "PERCENT",
    value: 10,
    minOrder: 699,
    maxDiscount: 120,
  },
];

export const dashboard = {
  salesToday: 48230,
  netRevenue: 43180,
  orders: 146,
  repeatCustomers: 68,
  activeSubscriptions: 21,
  paymentFailures: 4,
  leakageAlerts: [
    "18 abandoned carts above Rs 299",
    "7 overdue corporate follow-ups",
    "11 inactive VIP customers for 30+ days",
  ],
};
