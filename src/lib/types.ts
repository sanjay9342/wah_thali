import type { NewOrderSound } from "@/lib/order-sounds";

export type { NewOrderSound } from "@/lib/order-sounds";

export type DietaryType = "VEG" | "NON_VEG" | "JAIN";

export type Product = {
  id: string;
  slug: string;
  name: string;
  displayName?: string;
  kitchenName?: string;
  reportCode?: string;
  category: string;
  categoryId?: string;
  parentCategory?: string;
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

export type CategoryOption = {
  id: string;
  name: string;
  parentId?: string | null;
  parentName?: string;
  sortOrder: number;
  visible: boolean;
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
  desktopImage?: string;
  mobileImage?: string;
  targetCategory?: string;
  active: boolean;
  sortOrder: number;
};

export type AdminOrder = {
  orderNumber: string;
  customerName: string;
  customerMobile: string;
  customerEmail?: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  gst: number;
  amount: number;
  itemSummary: string;
  items: { productId?: string; name: string; quantity: number; price: number }[];
  payments: { provider: string; status: string; amount: number; providerPaymentId?: string | null }[];
  paymentSummary: string;
  createdAt: string;
  timeline: { toStatus: string; note?: string | null; createdAt: string }[];
  reviews?: {
    id: string;
    productName: string;
    rating: number;
    comment?: string;
    createdAt: string;
  }[];
};

export type AdminCustomer = {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  birthday?: string;
  anniversary?: string;
  tags: string[];
  isVip: boolean;
  orders: number;
  ltv: number;
  points: number;
  tier: string;
  lastOrder?: string;
  orderHistory?: {
    orderNumber: string;
    status: OrderStatus;
    amount: number;
    createdAt: string;
    itemSummary: string;
    paymentSummary: string;
  }[];
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

export type CouponAudience = "ALL" | "NEW" | "EXISTING" | "VIP" | "POINTS" | "TAGS";
export type CouponChannel = "WEBSITE";
export type FulfillmentMethod = "DELIVERY" | "PICKUP";

export type Coupon = {
  code: string;
  label: string;
  type: "FIXED" | "PERCENT";
  value: number;
  minOrder: number;
  maxDiscount?: number;
  audience?: CouponAudience;
  minPoints?: number;
  minCustomerOrders?: number;
  redemptionLimit?: number | null;
  customerUsageLimit?: number;
  redeemedCount?: number;
  customerRedeemedCount?: number;
  productIds?: string[];
  categoryIds?: string[];
  channels?: CouponChannel[];
  fulfillmentMethods?: FulfillmentMethod[];
  tagNames?: string[];
  startsAt?: string;
  endsAt?: string;
};

export type BusinessSettings = {
  gstRate: number;
  packagingFee: number;
  deliveryFee: number;
  deliveryFeeMode: "FLAT" | "PERCENT" | "DISTANCE";
  deliveryFeePercent: number;
  deliveryDistanceSlabs: { upToKm: number; fee: number }[];
  freeDeliveryThreshold: number;
  minimumOrder: number;
  serviceablePins: string[];
  locationRestrictionEnabled: boolean;
  kitchenAddress: string;
  kitchenLatitude: string;
  kitchenLongitude: string;
  deliveryRadiusKm: number;
  openingHours: string;
  supportPhone: string;
  whatsappNumber: string;
  leadWhatsAppNumber: string;
};

export type AdminLead = {
  id: string;
  name: string;
  phone: string;
  company?: string;
  source: string;
  stage: string;
  score: number;
  createdAt?: string;
  note?: string;
  customer?: {
    id: string;
    name: string;
    mobile: string;
    email?: string;
  };
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
  newOrderSound: NewOrderSound;
  whatsappOrderAlerts: boolean;
  ownerWhatsAppOrderAlerts: boolean;
  adminDailyDigestTime: string;
};

export type RestaurantSettings = BusinessSettings & AdvancedSettings;

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "NEW"
  | "CONFIRMED"
  | "PREPARING"
  | "PACKED"
  | "READY_FOR_PICKUP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";
