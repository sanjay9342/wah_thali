import type { BusinessSettings, Coupon, Product } from "./types";

export const settings: BusinessSettings = {
  gstRate: 0.05,
  packagingFee: 18,
  deliveryFee: 39,
  freeDeliveryThreshold: 499,
  minimumOrder: 149,
  serviceablePins: ["700001", "700016", "700019", "700029", "700091"],
  openingHours: "10:30 AM - 11:00 PM",
  supportPhone: "+91-90000-00000",
  whatsappNumber: "919000000000",
};

export const categories = [
  "Chef's Recommendations",
  "Exclusive Thali",
  "Meal at 99",
  "Mini Thali",
  "Momos",
  "Chinese Combo",
  "Biryani Combo",
  "Kolkata Biryani",
  "Beverages",
  "Desserts",
];

export const products: Product[] = [
  {
    id: "p1",
    slug: "wah-special-chicken-thali",
    name: "Wah Special Chicken Thali",
    category: "Exclusive Thali",
    description: "Rice, dal, sabzi, salad, chutney, and homestyle chicken curry.",
    image:
      "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=900&q=80",
    dietaryType: "NON_VEG",
    rating: 4.7,
    ratingCount: 1261,
    prepTimeMinutes: 28,
    price: 229,
    originalPrice: 269,
    bestseller: true,
    offer: "15% off",
    available: true,
    spiceLevel: "Medium",
    variants: [
      { id: "regular", name: "Regular", price: 0 },
      { id: "large", name: "Large", price: 59 },
      { id: "family", name: "Family Pack", price: 220 },
    ],
    addons: [
      { id: "egg", name: "Boiled egg", price: 25 },
      { id: "extra-chicken", name: "Extra chicken", price: 89 },
      { id: "raita", name: "Raita", price: 29 },
    ],
  },
  {
    id: "p2",
    slug: "veg-mini-thali",
    name: "Veg Mini Thali",
    category: "Mini Thali",
    description: "A compact lunch with rice, dal, seasonal sabzi, papad, and salad.",
    image:
      "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=900&q=80",
    dietaryType: "VEG",
    rating: 4.5,
    ratingCount: 884,
    prepTimeMinutes: 18,
    price: 99,
    bestseller: true,
    available: true,
    spiceLevel: "Mild",
    variants: [
      { id: "regular", name: "Regular", price: 0 },
      { id: "large", name: "Large", price: 45 },
    ],
    addons: [
      { id: "sweet", name: "Gulab jamun", price: 35 },
      { id: "salad", name: "Extra salad", price: 20 },
    ],
  },
  {
    id: "p3",
    slug: "kolkata-chicken-biryani",
    name: "Kolkata Chicken Biryani",
    category: "Kolkata Biryani",
    description: "Fragrant rice, tender chicken, potato, egg, and subtle Kolkata spices.",
    image:
      "https://images.unsplash.com/photo-1563379091339-03246963d51a?auto=format&fit=crop&w=900&q=80",
    dietaryType: "NON_VEG",
    rating: 4.8,
    ratingCount: 2140,
    prepTimeMinutes: 32,
    price: 249,
    originalPrice: 289,
    offer: "Combo deal",
    available: true,
    spiceLevel: "Medium",
    variants: [
      { id: "regular", name: "Regular", price: 0 },
      { id: "large", name: "Large", price: 70 },
      { id: "family", name: "Family Pack", price: 260 },
    ],
    addons: [
      { id: "egg", name: "Extra egg", price: 25 },
      { id: "chicken-chaap", name: "Chicken chaap", price: 129 },
      { id: "cold-drink", name: "Cold drink", price: 49 },
    ],
  },
  {
    id: "p4",
    slug: "chinese-hakka-combo",
    name: "Chinese Hakka Combo",
    category: "Chinese Combo",
    description: "Hakka noodles with chilli chicken gravy and crunchy salad.",
    image:
      "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=900&q=80",
    dietaryType: "NON_VEG",
    rating: 4.4,
    ratingCount: 617,
    prepTimeMinutes: 24,
    price: 189,
    available: true,
    spiceLevel: "Hot",
    variants: [
      { id: "regular", name: "Regular", price: 0 },
      { id: "large", name: "Large", price: 55 },
    ],
    addons: [
      { id: "momos", name: "4 pc momos", price: 69 },
      { id: "sauce", name: "Extra sauce", price: 15 },
    ],
  },
  {
    id: "p5",
    slug: "paneer-butter-masala-combo",
    name: "Paneer Butter Masala Combo",
    category: "Indian Combo",
    description: "Paneer butter masala with jeera rice, lachha paratha, and salad.",
    image:
      "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=80",
    dietaryType: "VEG",
    rating: 4.6,
    ratingCount: 702,
    prepTimeMinutes: 25,
    price: 219,
    available: true,
    spiceLevel: "Mild",
    variants: [
      { id: "regular", name: "Regular", price: 0 },
      { id: "large", name: "Large", price: 60 },
    ],
    addons: [
      { id: "paratha", name: "Extra paratha", price: 35 },
      { id: "dessert", name: "Dessert cup", price: 45 },
    ],
  },
  {
    id: "p6",
    slug: "monthly-office-lunch",
    name: "Monthly Office Lunch",
    category: "Subscription Meals",
    description: "Rotating weekday meals with billing, pause, skip, and GST invoice support.",
    image:
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80",
    dietaryType: "VEG",
    rating: 4.5,
    ratingCount: 241,
    prepTimeMinutes: 30,
    price: 2999,
    offer: "Best for teams",
    available: true,
    spiceLevel: "Medium",
    variants: [
      { id: "veg", name: "Veg plan", price: 0 },
      { id: "mixed", name: "Mixed plan", price: 800 },
    ],
    addons: [
      { id: "dessert-weekly", name: "Weekly dessert", price: 399 },
      { id: "gst-invoice", name: "GST invoice", price: 0 },
    ],
  },
];

export const coupons: Coupon[] = [
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
