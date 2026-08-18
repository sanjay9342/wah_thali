export const business = {
  brandName: "Wah Thali",
  legalName: "Wah Thali (a unit of Backyard Bol LLP)",
  ownerContacts: ["Anjan Majumder", "Swarnali Majumder"],
  address: "248/1 Rajdanga Main Road, Kasba, Kolkata 70107",
  city: "Kolkata",
  state: "West Bengal",
  phone: "7001323730",
  email: "wahthali21@gmail.com",
  legalEmail: "backyardbol21@gmail.com",
  gstin: "19AAYFB5998A1ZR",
  googleBusinessUrl: "https://share.google/5RQ9Ovl0gN0lqKgdS",
  googleReviewUrl: "https://app.reviewus.in/rate-us?businessId=7125",
  facebookUrl: "https://www.facebook.com/wahthali21",
  instagramUrl: "https://www.instagram.com/wahthali/",
  openingHours: "11:30 AM - 10:00 PM",
  lastOrderTime: "10:00 PM",
  averagePreparationTime: "30 mins",
  cancellationWindow: "1 minute after placing the order, before preparation starts",
  refundTimeline: "5 to 10 business days",
  deliveryCharges: [
    { label: "Up to 1 km", amount: 20 },
    { label: "1 km to 2 km", amount: 30 },
    { label: "2 km to 3 km", amount: 40 },
    { label: "3 km to 4 km", amount: 50 },
    { label: "4 km to 5 km", amount: 60 },
  ],
};

export const aboutWahThali =
  "Wah Thali was born from a simple belief - that a good meal has the power to make someone feel at home, no matter how busy life gets. What started as a dream to serve fresh, wholesome food has grown into a kitchen where every meal is prepared with care, quality ingredients, and authentic flavours. Every thali we serve carries our promise of honesty, hygiene, and heartfelt hospitality, because to us, every customer is like a guest at our own table.";

export type Policy = {
  slug: string;
  title: string;
  effectiveDate: string;
  summary: string;
  sections: { heading: string; body: string[] }[];
};

export const policies: Policy[] = [
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    effectiveDate: "01-08-2026",
    summary:
      "How Wah Thali collects, uses, stores, and protects customer information for orders, support, promotions, and website security.",
    sections: [
      {
        heading: "Information we collect",
        body: [
          "When you place an order, create an account, or contact us, we may collect your name, mobile number, email address, delivery address, order history, payment status, device details, IP address, and website usage data.",
          "Payment information is processed securely through trusted payment partners. We do not store card details, banking credentials, or UPI PINs.",
        ],
      },
      {
        heading: "How we use information",
        body: [
          "We use customer information to process and deliver orders, send order confirmations and delivery updates, respond to support requests, improve products and services, personalize the experience, prevent fraud, and meet legal or regulatory requirements.",
          "Promotional communication is sent only where customers have opted in, and customers may opt out at any time.",
        ],
      },
      {
        heading: "Sharing and security",
        body: [
          "We do not sell, rent, or trade personal information. Information may be shared only with delivery partners, payment providers, technology providers, cloud service providers, or government authorities where required by law.",
          "We use reasonable technical and organizational measures to protect information, though no internet transmission or electronic storage method is completely secure.",
        ],
      },
      {
        heading: "Customer rights and retention",
        body: [
          "Customers may request access, correction, account deletion subject to legal obligations, or opt out of promotional messages by contacting Wah Thali.",
          "Information is retained only as long as necessary to provide services, maintain business records, comply with law, and resolve disputes.",
        ],
      },
    ],
  },
  {
    slug: "terms-and-conditions",
    title: "Terms and Conditions",
    effectiveDate: "01-08-2026",
    summary:
      "The terms for using the Wah Thali website, placing orders, payments, delivery, cancellations, refunds, offers, and acceptable use.",
    sections: [
      {
        heading: "Acceptance and services",
        body: [
          "By using the website or placing an order, you confirm that you are at least 18 years of age or are using the service under the supervision of a parent or guardian.",
          "Wah Thali provides freshly prepared meals, thalis, combos, beverages, takeaway, and home delivery. All orders are subject to availability and acceptance.",
        ],
      },
      {
        heading: "Orders, pricing, and payments",
        body: [
          "Orders are confirmed only after payment or operational confirmation, where applicable. Once accepted, preparation may begin immediately.",
          "Prices are shown in Indian Rupees. Taxes, delivery fees, convenience fees, and discounts are displayed before payment. Prices may change without prior notice.",
          "We accept secure online payments and approved payment methods. Wah Thali does not store card details, banking credentials, or UPI PINs.",
        ],
      },
      {
        heading: "Delivery and food quality",
        body: [
          "Delivery times are estimates and may vary because of traffic, weather, festivals, high order volumes, or other operational factors.",
          "Customers must provide accurate delivery details and be available to receive the order. Food should be consumed promptly after delivery and stored or reheated responsibly.",
        ],
      },
      {
        heading: "Cancellations, refunds, and offers",
        body: [
          "Customer cancellation is allowed only before food preparation starts. Once preparation begins, cancellation requests may not be accepted.",
          "Refunds may apply for restaurant-cancelled orders, duplicate payments, payment deducted but order not confirmed, or verified quality issues.",
          "Coupons, discounts, loyalty rewards, and promotional campaigns may have expiry dates, usage conditions, and may be modified or withdrawn without prior notice.",
        ],
      },
      {
        heading: "Law and jurisdiction",
        body: [
          "These terms are governed by the laws of India. Disputes are subject to the competent courts of Kolkata, West Bengal.",
        ],
      },
    ],
  },
  {
    slug: "refund-cancellation-policy",
    title: "Refund and Cancellation Policy",
    effectiveDate: "01-08-2026",
    summary:
      "Freshly prepared orders may be cancelled only before preparation starts. Approved refunds are processed to the original payment method.",
    sections: [
      {
        heading: "Customer cancellation",
        body: [
          "Customers may cancel an order only before food preparation has started. The client-approved operational cancellation window is 1 minute after placing the order, subject to preparation status.",
          "Once preparation starts, cancellation requests cannot be accepted because the meal has been specially prepared for the order.",
        ],
      },
      {
        heading: "Restaurant cancellation",
        body: [
          "Wah Thali may cancel an order because of item unavailability, operational issues, kitchen emergencies, delivery constraints, technical errors, safety concerns, or suspected fraudulent transactions.",
          "If payment has been received and the order is cancelled by Wah Thali, eligible refunds will be initiated to the original payment method.",
        ],
      },
      {
        heading: "Refund eligibility",
        body: [
          "Refunds may be approved for duplicate payments, payment deducted but order not confirmed, restaurant-cancelled orders, incorrect items, significantly damaged food, or verified quality issues reported promptly.",
          "Wrong or missing items may be replaced or refunded at Wah Thali's discretion after verification.",
        ],
      },
      {
        heading: "Non-refundable situations",
        body: [
          "Refunds generally do not apply where cancellation is requested after preparation begins, address or contact details are incorrect, the customer is unavailable, delays are beyond our reasonable control, or the concern is based only on personal taste preference.",
          "Failed deliveries due to customer-related reasons may not be eligible for refund.",
        ],
      },
      {
        heading: "Issue reporting and refund timeline",
        body: [
          "Customers should report wrong, missing, damaged, or quality issues within 30 minutes of delivery with order ID, registered mobile number, issue description, and photos where applicable.",
          "Approved online-payment refunds are processed to the original payment method, usually within 5 to 10 business days depending on the bank or payment provider.",
        ],
      },
    ],
  },
  {
    slug: "delivery-policy",
    title: "Delivery Policy",
    effectiveDate: "01-08-2026",
    summary:
      "Delivery is available in selected serviceable areas during operating hours, with distance-based delivery charges and estimated delivery timing.",
    sections: [
      {
        heading: "Delivery area and hours",
        body: [
          "Wah Thali delivers to selected serviceable areas based on delivery address, distance, and operational availability at checkout.",
          `Operating hours are ${business.openingHours}, with last order cut-off at ${business.lastOrderTime}.`,
        ],
      },
      {
        heading: "Preparation and estimated delivery",
        body: [
          "All meals are freshly prepared after the order is confirmed. Average preparation time is about 30 minutes.",
          "Typical delivery time is 30 to 60 minutes depending on location, traffic, weather, order volume, peak meal hours, and road conditions. Delivery times are estimates only.",
        ],
      },
      {
        heading: "Delivery charges",
        body: [
          "Delivery charges are calculated based on distance from the kitchen and are displayed before payment.",
          "Client-approved distance slabs: up to 1 km Rs 20, 1-2 km Rs 30, 2-3 km Rs 40, 3-4 km Rs 50, and 4-5 km Rs 60.",
          "Packaging charge is currently Nil. Free-delivery threshold is not applicable unless a campaign specifically states otherwise.",
        ],
      },
      {
        heading: "Delivery attempts and failed delivery",
        body: [
          "The delivery partner will make reasonable attempts to contact the customer before marking delivery as failed.",
          "Orders may be considered undeliverable if the address is incorrect or incomplete, the customer cannot be contacted, access is restricted, or the customer refuses delivery. Such orders may not be eligible for refund.",
        ],
      },
      {
        heading: "Order verification",
        body: [
          "Customers should verify correct items, quantity, and packaging condition upon receipt. Issues should be reported to support as soon as possible, preferably within 30 minutes of delivery.",
        ],
      },
    ],
  },
  {
    slug: "data-deletion",
    title: "User Data Deletion Instructions",
    effectiveDate: "18-08-2026",
    summary:
      "How customers can request deletion of their Wah Thali account data collected through the website, WhatsApp, Meta integrations, orders, and support.",
    sections: [
      {
        heading: "How to request deletion",
        body: [
          `To request deletion of your Wah Thali account or personal data, email ${business.legalEmail} from your registered email address with the subject line "Data Deletion Request".`,
          `You may also call or WhatsApp Wah Thali support at ${business.phone} and ask for a data deletion request to be recorded.`,
        ],
      },
      {
        heading: "Information to include",
        body: [
          "Please include your full name, registered mobile number, registered email address, and a short note confirming that you want your Wah Thali account data deleted.",
          "For security, we may contact you on your registered mobile number or email address to verify the request before deletion is processed.",
        ],
      },
      {
        heading: "What we delete",
        body: [
          "After verification, we delete or anonymize account profile details, saved addresses, marketing preferences, support notes, and WhatsApp or website identifiers linked to your account where deletion is legally permitted.",
          "If you used WhatsApp login, OTP, or Meta messaging features, related contact identifiers and message records used only for account access or support will be deleted or anonymized where permitted.",
        ],
      },
      {
        heading: "Records we may retain",
        body: [
          "Some order, invoice, payment, tax, fraud-prevention, dispute, and compliance records may be retained for the period required by law or legitimate business obligations.",
          "Retained records are restricted to the minimum information needed for accounting, legal compliance, payment reconciliation, refunds, chargebacks, and dispute resolution.",
        ],
      },
      {
        heading: "Processing timeline",
        body: [
          "We aim to acknowledge deletion requests within 7 business days after receiving sufficient details.",
          "Verified deletion or anonymization requests are generally completed within 30 days, unless a longer period is required because of legal, security, or operational obligations.",
        ],
      },
      {
        heading: "Contact for privacy requests",
        body: [
          `${business.legalName} can be contacted at ${business.legalEmail}.`,
          `Business address: ${business.address}.`,
        ],
      },
    ],
  },
];

export function getPolicy(slug: string) {
  return policies.find((policy) => policy.slug === slug);
}
