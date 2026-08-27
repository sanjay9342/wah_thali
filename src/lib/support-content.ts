export const supportTopics = [
  {
    slug: "order-issues",
    title: "Order Issues",
    body: "Missing items, wrong dishes, delays, or live order questions.",
    questions: [
      {
        title: "My order is delayed",
        body: "Delivery partners sometimes face traffic. Check the live tracking on your order page. If it's delayed by over 30 mins, chat with us.",
      },
      {
        title: "Items are missing",
        body: "We double-check all bags, but mistakes happen. Contact us with your order number for an instant refund for missing items.",
      },
      {
        title: "Received the wrong item",
        body: "Please keep the wrong item and contact our chat support. We will issue a refund or arrange a replacement.",
      },
    ],
  },
  {
    slug: "returns-refunds",
    title: "Returns & Refunds",
    body: "Refund status, cancellation rules, and quality concerns.",
    questions: [
      {
        title: "How do I return an item?",
        body: "Go to your Orders, select the item, and tap 'Return'. Note: Fresh produce cannot be returned, but we will refund you if quality is poor.",
      },
      {
        title: "Return policy for fresh items",
        body: "We do not pick up fresh items for returns. If you're unhappy with the quality, we will issue a direct refund.",
      },
      {
        title: "Refund status",
        body: "Refunds reflect in your original payment method within 3-5 business days.",
      },
    ],
  },
  {
    slug: "payments",
    title: "Payments",
    body: "Payment failures, COD, online payments, and invoice questions.",
    questions: [
      {
        title: "Payment deducted but order not placed",
        body: "If payment was deducted, share your payment reference. We will verify and either confirm the order or help with a refund.",
      },
      {
        title: "COD is not showing",
        body: "COD availability depends on the restaurant settings and delivery rules active at checkout.",
      },
      {
        title: "Need invoice details",
        body: "Open the order from Orders. For GST or billing questions, contact support with the order number.",
      },
    ],
  },
  {
    slug: "delivery-pickup",
    title: "Delivery & Pickup",
    body: "Delivery area, location checks, delivery fee, and self-pickup help.",
    questions: [
      {
        title: "How does self pickup work?",
        body: "Choose Self pickup in the final order confirmation. No delivery charge is added, and you can collect the order from the Wah Thali kitchen address shown before payment.",
      },
      {
        title: "Can I choose pickup if delivery is not available?",
        body: "Yes. If your location is outside the delivery area, choose Self pickup before confirming the order and collect it directly from the kitchen.",
      },
      {
        title: "When should I collect a pickup order?",
        body: "Follow the live order tracker. Please collect once it shows Ready for pickup so the food stays fresh and hot.",
      },
    ],
  },
  {
    slug: "account",
    title: "Account",
    body: "Login, profile, saved address, and account data help.",
    questions: [
      {
        title: "Change phone number",
        body: "Currently, phone numbers cannot be changed as they are linked to your wallet and orders. Please create a new account.",
      },
      {
        title: "Update delivery address",
        body: "Go to Profile > Delivery Addresses to add or remove addresses.",
      },
      {
        title: "Delete account",
        body: "Please contact support to permanently delete your account and erase your data.",
      },
    ],
  },
];

export function getSupportTopic(slug: string) {
  return supportTopics.find((topic) => topic.slug === slug);
}
