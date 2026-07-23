export type DietaryType = "VEG" | "NON_VEG" | "JAIN";

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  image: string;
  dietaryType: DietaryType;
  rating: number;
  ratingCount: number;
  prepTimeMinutes: number;
  price: number;
  originalPrice?: number;
  bestseller?: boolean;
  offer?: string;
  available: boolean;
  spiceLevel: "Mild" | "Medium" | "Hot";
  variants: { id: string; name: string; price: number }[];
  addons: { id: string; name: string; price: number }[];
};

export type CartLine = {
  productId: string;
  variantId: string;
  addonIds: string[];
  quantity: number;
  instructions?: string;
};

export type Coupon = {
  code: string;
  label: string;
  type: "FIXED" | "PERCENT";
  value: number;
  minOrder: number;
  maxDiscount?: number;
};

export type BusinessSettings = {
  gstRate: number;
  packagingFee: number;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  minimumOrder: number;
  serviceablePins: string[];
  openingHours: string;
  supportPhone: string;
  whatsappNumber: string;
};

export type OrderStatus =
  | "NEW"
  | "CONFIRMED"
  | "PREPARING"
  | "PACKED"
  | "READY_FOR_PICKUP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";
