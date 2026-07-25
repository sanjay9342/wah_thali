/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/wah_thali",
  }),
});

const categories = [
  "Chef's Recommendations",
  "Exclusive Thali",
  "Meal at 99",
  "Mini Thali",
  "Momos",
  "Chinese Combo",
  "Biryani Combo",
  "Kolkata Biryani",
  "Indian Combo",
  "Subscription Meals",
  "Beverages",
  "Desserts",
];

const products = [
  {
    id: "p1",
    slug: "wah-special-chicken-thali",
    name: "Wah Special Chicken Thali",
    category: "Exclusive Thali",
    description: "Rice, dal, sabzi, salad, chutney, and homestyle chicken curry.",
    image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=900&q=80",
    dietaryType: "NON_VEG",
    rating: 4.7,
    ratingCount: 1261,
    prepMinutes: 28,
    price: 229,
    originalPrice: 269,
    bestseller: true,
    offer: "15% off",
    spiceLevel: "Medium",
    variants: [
      ["regular", "Regular", 0],
      ["large", "Large", 59],
      ["family", "Family Pack", 220],
    ],
    addons: [
      ["egg", "Boiled egg", 25],
      ["extra-chicken", "Extra chicken", 89],
      ["raita", "Raita", 29],
    ],
    stock: 42,
    reorderAt: 20,
    margin: 62,
  },
  {
    id: "p2",
    slug: "veg-mini-thali",
    name: "Veg Mini Thali",
    category: "Mini Thali",
    description: "A compact lunch with rice, dal, seasonal sabzi, papad, and salad.",
    image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=900&q=80",
    dietaryType: "VEG",
    rating: 4.5,
    ratingCount: 884,
    prepMinutes: 18,
    price: 99,
    bestseller: true,
    spiceLevel: "Mild",
    variants: [
      ["regular", "Regular", 0],
      ["large", "Large", 45],
    ],
    addons: [
      ["sweet", "Gulab jamun", 35],
      ["salad", "Extra salad", 20],
    ],
    stock: 18,
    reorderAt: 12,
    margin: 54,
  },
  {
    id: "p3",
    slug: "kolkata-chicken-biryani",
    name: "Kolkata Chicken Biryani",
    category: "Kolkata Biryani",
    description: "Fragrant rice, tender chicken, potato, egg, and subtle Kolkata spices.",
    image: "https://images.unsplash.com/photo-1563379091339-03246963d51a?auto=format&fit=crop&w=900&q=80",
    dietaryType: "NON_VEG",
    rating: 4.8,
    ratingCount: 2140,
    prepMinutes: 32,
    price: 249,
    originalPrice: 289,
    offer: "Combo deal",
    spiceLevel: "Medium",
    variants: [
      ["regular", "Regular", 0],
      ["large", "Large", 70],
      ["family", "Family Pack", 260],
    ],
    addons: [
      ["egg", "Extra egg", 25],
      ["chicken-chaap", "Chicken chaap", 129],
      ["cold-drink", "Cold drink", 49],
    ],
    stock: 27,
    reorderAt: 14,
    margin: 58,
  },
  {
    id: "p4",
    slug: "chinese-hakka-combo",
    name: "Chinese Hakka Combo",
    category: "Chinese Combo",
    description: "Hakka noodles with chilli chicken gravy and crunchy salad.",
    image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=900&q=80",
    dietaryType: "NON_VEG",
    rating: 4.4,
    ratingCount: 617,
    prepMinutes: 24,
    price: 189,
    spiceLevel: "Hot",
    variants: [
      ["regular", "Regular", 0],
      ["large", "Large", 55],
    ],
    addons: [
      ["momos", "4 pc momos", 69],
      ["sauce", "Extra sauce", 15],
    ],
    stock: 11,
    reorderAt: 10,
    margin: 49,
  },
  {
    id: "p5",
    slug: "paneer-butter-masala-combo",
    name: "Paneer Butter Masala Combo",
    category: "Indian Combo",
    description: "Paneer butter masala with jeera rice, lachha paratha, and salad.",
    image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=80",
    dietaryType: "VEG",
    rating: 4.6,
    ratingCount: 702,
    prepMinutes: 25,
    price: 219,
    spiceLevel: "Mild",
    variants: [
      ["regular", "Regular", 0],
      ["large", "Large", 60],
    ],
    addons: [
      ["paratha", "Extra paratha", 35],
      ["dessert", "Dessert cup", 45],
    ],
    stock: 34,
    reorderAt: 16,
    margin: 57,
  },
  {
    id: "p6",
    slug: "monthly-office-lunch",
    name: "Monthly Office Lunch",
    category: "Subscription Meals",
    description: "Rotating weekday meals with billing, pause, skip, and GST invoice support.",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80",
    dietaryType: "VEG",
    rating: 4.5,
    ratingCount: 241,
    prepMinutes: 30,
    price: 2999,
    offer: "Best for teams",
    spiceLevel: "Medium",
    variants: [
      ["veg", "Veg plan", 0],
      ["mixed", "Mixed plan", 800],
    ],
    addons: [
      ["dessert-weekly", "Weekly dessert", 399],
      ["gst-invoice", "GST invoice", 0],
    ],
    stock: 8,
    reorderAt: 6,
    margin: 41,
  },
];

const settings = {
  gstRate: 0.05,
  packagingFee: 0,
  deliveryFee: 40,
  freeDeliveryThreshold: 0,
  minimumOrder: 149,
  serviceablePins: ["700001", "700016", "700019", "700029", "700091"],
  openingHours: "11:30 AM - 10:00 PM",
  supportPhone: "7001323730",
  whatsappNumber: "917001323730",
};

async function main() {
  for (const [index, name] of categories.entries()) {
    await prisma.category.upsert({
      where: { slug: name.toLowerCase().replaceAll(" ", "-").replaceAll("'", "") },
      create: {
        name,
        slug: name.toLowerCase().replaceAll(" ", "-").replaceAll("'", ""),
        sortOrder: index,
      },
      update: { name, sortOrder: index, visible: true },
    });
  }

  for (const product of products) {
    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: product.category.toLowerCase().replaceAll(" ", "-").replaceAll("'", "") },
    });

    await prisma.product.upsert({
      where: { id: product.id },
      create: {
        id: product.id,
        categoryId: category.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        price: product.price,
        originalPrice: product.originalPrice,
        dietaryType: product.dietaryType,
        rating: product.rating,
        ratingCount: product.ratingCount,
        prepMinutes: product.prepMinutes,
        bestseller: product.bestseller ?? false,
        offer: product.offer,
        spiceLevel: product.spiceLevel,
        images: { create: { url: product.image, alt: product.name, sortOrder: 0 } },
        variants: {
          create: product.variants.map(([id, name, price]) => ({
            id: `${product.id}-${id}`,
            name,
            price,
          })),
        },
        addons: {
          create: product.addons.map(([id, name, price]) => ({
            id: `${product.id}-${id}`,
            name,
            price,
          })),
        },
        inventory: {
          create: { stock: product.stock, reorderAt: product.reorderAt, margin: product.margin },
        },
      },
      update: {
        categoryId: category.id,
        name: product.name,
        description: product.description,
        price: product.price,
        originalPrice: product.originalPrice,
        dietaryType: product.dietaryType,
        rating: product.rating,
        ratingCount: product.ratingCount,
        prepMinutes: product.prepMinutes,
        bestseller: product.bestseller ?? false,
        offer: product.offer,
        spiceLevel: product.spiceLevel,
        inventory: {
          upsert: {
            create: { stock: product.stock, reorderAt: product.reorderAt, margin: product.margin },
            update: { stock: product.stock, reorderAt: product.reorderAt, margin: product.margin },
          },
        },
      },
    });
  }

  await prisma.coupon.upsert({
    where: { code: "WAH50" },
    create: {
      code: "WAH50",
      label: "Flat Rs 50 off",
      type: "FIXED",
      value: 50,
      minOrder: 299,
      startsAt: new Date("2026-01-01"),
      endsAt: new Date("2028-01-01"),
      active: true,
    },
    update: { label: "Flat Rs 50 off", active: true },
  });

  await prisma.coupon.upsert({
    where: { code: "FAMILY10" },
    create: {
      code: "FAMILY10",
      label: "10% off family orders",
      type: "PERCENT",
      value: 10,
      minOrder: 699,
      maxDiscount: 120,
      startsAt: new Date("2026-01-01"),
      endsAt: new Date("2028-01-01"),
      active: true,
    },
    update: { label: "10% off family orders", active: true },
  });

  for (const [key, value] of Object.entries(settings)) {
    await prisma.businessSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  if (process.env.WAH_SEED_DEMO_DATA === "true") {
    const customer = await prisma.customer.upsert({
      where: { mobile: "919000000000" },
      create: {
        name: "Sanjay",
        mobile: "919000000000",
        email: "customer@example.com",
        loyalty: { create: { points: 1240, tier: "Gold member" } },
        addresses: {
          create: {
            label: "Home",
            line1: "221B Baker Street",
            area: "Salt Lake",
            city: "Kolkata",
            state: "West Bengal",
            pinCode: "700091",
            isDefault: true,
          },
        },
      },
      update: { name: "Sanjay" },
    });

    await prisma.order.upsert({
      where: { orderNumber: "WH0001" },
      create: {
        orderNumber: "WH0001",
        customerId: customer.id,
        status: "PREPARING",
        subtotal: 488,
        discount: 0,
        gst: 15,
        grandTotal: 550,
        items: {
          create: [
            { productId: "p1", name: "Wah Special Chicken Thali", quantity: 1, price: 229 },
            { productId: "p3", name: "Kolkata Chicken Biryani", quantity: 1, price: 249 },
          ],
        },
        timeline: {
          create: [
            { toStatus: "NEW", note: "Placed" },
            { fromStatus: "NEW", toStatus: "CONFIRMED", note: "Confirmed" },
            { fromStatus: "CONFIRMED", toStatus: "PREPARING", note: "Preparing" },
          ],
        },
      },
      update: { status: "PREPARING" },
    });
  }

  await prisma.activityEvent.create({
    data: {
      type: "DATABASE_SEEDED",
      actor: "system",
      entity: "Setup",
      summary: "Seeded Wah Thali Supabase/Postgres starter data",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
