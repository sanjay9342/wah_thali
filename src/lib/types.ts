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
  recentReviews?: ProductReview[];
};

export type ProductReview = {
  id: string;
  customerName: string;
  rating: number;
  comment?: string;
  createdAt: string;
};

export type AdminProduct = Product & {
  stock: number;
  reorderAt: number;
  margin: number;
};

export type HomeSlide = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  code: string;
  image: string;
  targetCategory?: string;
  active: boolean;
  sortOrder: number;
};

export type AdminOrder = {
  orderNumber: string;
  customerName: string;
  customerMobile: string;
  status: OrderStatus;
  amount: number;
  itemSummary: string;
  paymentSummary: string;
  createdAt: string;
  timeline: { toStatus: string; note?: string | null; createdAt: string }[];
};

export type AdminCustomer = {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  orders: number;
  ltv: number;
  points: number;
  tier: string;
  lastOrder?: string;
};

export type CategoryImageMap = Record<string, string>;
export type CategoryOfferMap = Record<string, string>;

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
  startsAt?: string;
  endsAt?: string;
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

export type StoreMode = "OPEN" | "BUSY" | "PAUSED" | "CLOSED";

export type AdvancedSettings = {
  storeMode: StoreMode;
  storeStatusReason: string;
  busyMessage: string;
  pausedMessage: string;
  closedMessage: string;
  autoAcceptOrders: boolean;
  requireDeclineReason: boolean;
  maxOrdersPerSlot: number;
  defaultPrepMinutes: number;
  rushPrepBufferMinutes: number;
  lastOrderBufferMinutes: number;
  codEnabled: boolean;
  onlinePaymentsEnabled: boolean;
  lowStockAlertThreshold: number;
  newOrderSoundEnabled: boolean;
  whatsappOrderAlerts: boolean;
  adminDailyDigestTime: string;
};

export type RestaurantSettings = BusinessSettings & AdvancedSettings;

export type OrderStatus =
  | "NEW"
  | "CONFIRMED"
  | "PREPARING"
  | "PACKED"
  | "READY_FOR_PICKUP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";
